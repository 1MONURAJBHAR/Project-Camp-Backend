import { User } from "../models/user.model.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ProjectNote } from "../models/note.models.js";

const getProjects = asyncHandler(async (req, res) => {
  const projects = await ProjectMember.aggregate([
    {
      $match: {
        //Find all ProjectMember documents from ProjectMember collections where (user = req.user._id)
        user: new mongoose.Types.ObjectId(req.user._id), //Note that one person can be assigned to multiple projects
      },
    },
    {
      $lookup: {
        //We will get the project document on each projectmember document in the projects field, obtained from above match
        from: "projects",
        localField: "project",
        foreignField: "_id",
        as: "projects",
        pipeline: [
          //Apply pipeline on project document to count how many people are assigned to this project
          {
            $lookup: {
              //Count all the members assigned to this project
              from: "projectmembers", //we can get multiple projectMember documents because on the same project multiple people can work with different roles.
              localField: "_id",
              foreignField: "project",
              as: "projectmembers", //In project document a field "projectmembers" is added which contains all the projectMember documents whose "projectId" is matched with projects "id"
            },
          },
          {
            $addFields: {
              members: { //dynamically creating this member field.
                $size: "$projectmembers",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$project", //Convert project array to object
    },
    {
      $project: {
        //Inside ProjectMember documents only take "project" field and in project field keep these--> project._id, project.name, project.description, project.members, project.createdAt, project.createdBy and the role from ProjectMember.
        project: {
          //Project all these fields from "project object" inside projectMember document.
          _id: 1,
          name: 1,
          description: 1,
          members: 1,
          createdAt: 1,
          createdBy: 1,
        },
        role: 1, //project this field from ProjectMember document
        _id: 0, //Don't show the id of ProjectMember document
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  if (!mongoose.isValidObjectId(projectId)){
    throw new ApiError(400, "Inavlid project Id");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project fetched successfully"));
});

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  //Project is created with name, description, and createdBy.
  const project = await Project.create({
    name,
    description,
    createdBy: new mongoose.Types.ObjectId(req.user._id),
  });

  //we also have to add who created the project , the project id and role of creater.
  await ProjectMember.create({
    user: new mongoose.Types.ObjectId(req.user._id),
    project: new mongoose.Types.ObjectId(project._id),
    role: UserRolesEnum.ADMIN,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, project, "Project created Successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { projectId } = req.params;

  const project = await Project.findByIdAndUpdate(
    projectId,
    {
      name,  //update the name and description
      description,
    },
    { new: true }, //return the new document
  );

  if (!project) {
    throw new ApiError(404, "Project not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  if (!mongoose.isValidObjectId(projectId)) {
    throw new ApiError(400, "Project Id is not valid");
  }

  //Delete the project
  const project = await Project.findByIdAndDelete(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  //Delete related project members
  const deletedMembers = await ProjectMember.deleteMany({
    project: new mongoose.Types.ObjectId(projectId),
  });
  console.log("Deleted members:", deletedMembers);

  //Find all tasks related to this project
  const tasks = await Task.find({
    project: new mongoose.Types.ObjectId(projectId),
  });

  //Delete subtasks for each task
  const taskIds = tasks.map((task) => task._id);

  const deletedSubtasks = await Subtask.deleteMany({
    task: { $in: taskIds }, //delete all subtask documents from subtask collection whose task fields "id" matches with the taskId in taskIds array, one by one delete "all subtask documents" of all "tasks" related to the deleted project, whose id's are stored in taskIds array.
  });
  console.log("Deleted subtasks:", deletedSubtasks);

  //Delete tasks themselves
  const deletedTasks = await Task.deleteMany({
    //Here delete all tasks related to deleted project.
    _id: { $in: taskIds },
  });
  console.log("Deleted tasks:", deletedTasks);

  // Delete the notes related to the deleted Project
  const deleteNotes = await ProjectNote.deleteMany({
    project: new mongoose.Types.ObjectId(projectId),
  });
  console.log("Deleted notes:", deleteNotes);

  /**deleteNotes will contain an object like { acknowledged: true, deletedCount: X } & same for all.
   Make sure your controller function is async, otherwise await won’t work. */

  // Return response
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        project,
        "Project and all related tasks, subtasks, notes, and members deleted successfully",
      ),
    );
});


const addMembersToProject = asyncHandler(async (req, res) => {
  const { email, role } = req.body; //Extracts the email and role from the request body.
  const { projectId } = req.params; //Extracts projectId from the request URL (like /projects/:projectId/members).
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

  /**Quick Rules:
    findById... → pass a single _id (string or ObjectId).
    findOne... → pass an object filter ({ user, project }). */
  await ProjectMember.findOneAndUpdate(   //findByIdAndUpdate expects a single "_id", not a filter object.
    {
      user: new mongoose.Types.ObjectId(user._id), //This searches for a document in the ProjectMember collection that matches the combination of this user and this project.If found, it will update the document with the new role.
      project: new mongoose.Types.ObjectId(projectId),
    }, //If the user is already a project member, their role will be updated.
    {
      //If the user is not yet a project member, a new membership document will be created.
      user: new mongoose.Types.ObjectId(user._id),
      project: new mongoose.Types.ObjectId(projectId),
      role: role,
    },
    {
      new: true, // // return the updated document instead of the old one
      upsert: true, //// if no matching doc is found, create a new one
    },
  );

  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Project member added successfully"));
});


const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const projectMembers = await ProjectMember.aggregate([
    {//First stage
      $match: { //we will get many ProjectMember documents here, whose project fields "id" is same as "projectId", because there are many users/people working on same project,so for each user/prople diffrernt ProjectMember document will be created.
        project: new mongoose.Types.ObjectId(projectId),
      },
    },
     //Now we have only that projectMember document whose project fields "id" is same as "projectId"
    {//This will lookup on each project member document one by one.
      $lookup: { //Applying this lookup on each ProjectMember document 
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {   //Project only these fields from user documents 
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        user: {  //convert user field from array to an object in ProjectMember document 
          $arrayElemAt: ["$user", 0],//means select only that element in user array whose is at 0th index.
        },
      },
    },
    {
      $project: { //Project these fields in projectMember document 
        project: 1,
        user: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
        _id: 0,  //Do not print the id of projectMember document.
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, projectMembers, "Project members fetched successfully"));
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { newRole } = req.body;
 
  
  if (!AvailableUserRole.includes(newRole)) {
    throw new ApiError(400, "Invalid Role");
  }

  //Extracting the projectMember document from the projectMember collection whose (project === projectId) & (user === userId).
  let projectMember = await ProjectMember.findOne({
    project: new mongoose.Types.ObjectId(projectId),
    user: new mongoose.Types.ObjectId(userId),
  });

  if (!projectMember) {
    throw new ApiError(400, "Project member not found");
  }
 
  //Update the projectMember document with newRole
  projectMember = await ProjectMember.findByIdAndUpdate(
    projectMember._id,
    {
      role: newRole,
    },
    { new: true },
  );

  if (!projectMember) {
    throw new ApiError(400, "Project member not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        projectMember,
        "Project member role updated successfully",
      ),
    );
});

const deleteMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  let projectMember = await ProjectMember.findOne({
    project: new mongoose.Types.ObjectId(projectId),
    user: new mongoose.Types.ObjectId(userId),
  });

  if (!projectMember) {
    throw new ApiError(400, "Project member not found");
  }

  //This projectMember holds the deleted document
  projectMember = await ProjectMember.findByIdAndDelete(projectMember._id);

  if (!projectMember) {
    throw new ApiError(400, "Project member not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        projectMember,
        "Project member deleted successfully",
      ),
    );
});

export {
  addMembersToProject,
  createProject,
  deleteMember,
  getProjects,
  getProjectById,
  getProjectMembers,
  updateProject,
  deleteProject,
  updateMemberRole,
};

