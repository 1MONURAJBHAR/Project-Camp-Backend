import { User } from "../models/user.model.js";
import { Project } from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";


//Get the tasks assigned on a project.
const getTasks = asyncHandler(async (req, res) => {

  const { projectId } = req.params;

  const project = await Project.findById(projectId);//find a project inside project collection whose "_id" is same as "projectId"

  if (!project) {
    throw new ApiError(404, "Project not found");
  }
  //
  
  //Inside task collections there can be many task document whose project  "id" is same as this "projectId "
  const tasks = await Task.find({
    //many tasks can be assigned on a project
    project: new mongoose.Types.ObjectId(projectId), //find all those tasks document whose project "id" is same as "projectId"
  }).populate("assignedTo", "username fullName avatar");

  return res
    .status(201)
    .json(new ApiResponse(201, tasks, "Task fetched successfully"));
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }
  const files = req.files || []; //req.files contain array of file objects-->[ {fileobj}, {fileobj}, {fileobj}, {fileobj} ]
  //console.log(files);

  const attachments = files.map((file) => {
    // When using memoryStorage, the file is in a buffer.
    // You might upload this buffer to a cloud service like AWS S3 or Uploadcare.
    // The example below assumes you save the file locally and create a URL.
    return {
      // If you save the file, you would use the new filename/path here.
      // For a cloud service, you would use the URL they provide.
      url: `${process.env.SERVER_URL}/${process.env.IMAGES_PATH}/${file.originalname}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  });

  const task = await Task.create({
    title,
    description,
    project: new mongoose.Types.ObjectId(projectId),
    assignedTo: assignedTo // --> if there is any value in assignedTo then it will assign the project to "assignedTo"i.e:the user whom the project is assigned to, if no value in "assingnedTo" then return undefined
      ? new mongoose.Types.ObjectId(assignedTo) //This is similar to if-else condition, if assignedTo is provided then assign the project to "assignedTo"i.e:whoever to whom the project is assignedTo or undefined if no value is provided in "assignedTo".
      : undefined,
    status,
    assignedBy: new mongoose.Types.ObjectId(req.user._id),
    attachments,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.aggregate([
    {  //In first stage we will get the task document  
      $match: {  //find the task document from the task collection whose _id matches to taskId.
        _id: new mongoose.Types.ObjectId(taskId),
      },
    },
    {//Now populating the fields in task documents such as assignedTo,subtask & etc..
      $lookup: {
        from: "users",  //Go inside the users collection and match the "_id" of each users document with the "_id" in "assignedTo" field.
        localField: "assignedTo", 
        foreignField: "_id",
        as: "assignedTo", //collect those user document to whom this task is assigned to and add it in this field "assignedTo".
        pipeline: [ 
          { //only select these fields from all those users document to whom this task is assignedTo or in simple words from those user documents who are in assignedTo field.
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
            }
          },
        ],
      },
    },
    {
      $lookup: {//There can be many subtasks inside one task
        from: "subtasks",
        localField: "_id",
        foreignField: "task",
        as: "subtasks",//There are many subtask documents inside this subtasks field, which are the subtasks of this task.
        pipeline: [//Applying pipeline on each subtask document 
          {//Take one by one all subtask document and attach createdBy field on each subtask document which contains info of user who created the subtask.
            $lookup: {
              from: "users",
              localField: "createdBy", //This createdBy user contain the userId of that user who created this subtask.
              foreignField: "_id",
              as: "createdBy", //contain the user document of that user who created the subtask, this createdBy field contains the array in which the  user document is stored as object (usually only one user document).
              pipeline: [
                {
                  $project: {//project only these fields from user document
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
            $addFields: { //add this field to subtask document 
              createdBy: {  //convert createdBy array to Object
                $arrayElemAt: ["$createdBy", 0],
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {   //This assigned to field is in task document
        assignedTo: {//convert assignedTo array to object`
          $arrayElemAt: ["$assignedTo", 0],
        },
      },
    },
  ]);

  if (!task || task.length === 0) {
    throw new ApiError(404, "Task not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, task[0], "Task fetched successfully"));
});



const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Inavlid task ID");
  }

  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }
  //update the fields which came from the documnets. Only truthy fields are updated.
  //  Only the modified fields are will be validated, the fields which are not modified will not be validated by mongoDB
  if (title) task.title = title;
  if (description) task.description = description;
  if (status) task.status = status;
  if (assignedTo) {
    task.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  }


 const files = req.files || []; //req.files contain array of file objects-->[ {fileobj}, {fileobj}, {fileobj}, {fileobj} ]
 //console.log(files);

 const attachments = files.map((file) => {
   // When using memoryStorage, the file is in a buffer.
   // You might upload this buffer to a cloud service like AWS S3 or Uploadcare.
   // The example below assumes you save the file locally and create a URL.
   return {
     // If you save the file, you would use the new filename/path here.
     // For a cloud service, you would use the URL they provide.
     url: `${process.env.SERVER_URL}/${process.env.IMAGES_PATH}/${file.originalname}`,
     mimetype: file.mimetype,
     size: file.size,
   };
 });
  
  
  if(attachments) task.attachments = attachments;

  await task.save();

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task updated successfully"));

}); 


const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  if (!mongoose.isValidObjectId( taskId )) {
    throw new ApiError(400, "Task Id is not valid..");
  }

  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(400, "Task is not found via taskId");
  }

  //Inside Subtask collections delete all subtasks documents whose task fields "id" is matched task._id, that is delete all subtasks of this tasks
  await Subtask.deleteMany({ task: task._id });//delete subtasks first, task._id task document's id
  await task.deleteOne();  //delete task

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Task deleted successfully"));
  

}); 

const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, isCompleted } = req.body;

  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Task ID is not valid");
  }

  if (!title ) {
    throw new ApiError(400, "Title is not provided..");
  }


  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }


  const subtask = await Subtask.create({
    title,
    description,
    task: task._id,
    isCompleted,
    createdBy: new mongoose.Types.ObjectId(req.user._id),
  });

 
  return res
    .status(201)
    .json(new ApiResponse(201, subtask, "Subtask created successfully"));


});


const updateSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;
  const { title, description, isCompleted } = req.body;
  //console.log(req.params);

  const subtask =
    await Subtask.findById(
      subTaskId,
    ); /**No need to wrap subtaskId in new ObjectId() with findById(),findById automatically converts string → ObjectId. In findOne() you must convert stringId to ObjectId by using "new mongoose.Types.ObjectId()"  like this ----> findOne({ _id: new mongoose.types.ObjectId(subtaskId) });   */
  console.log(subtask);

  if (!subtask) {
    throw new ApiError(404, "Subtask not found");
  }

  const UpdateSubtask = await Subtask.findByIdAndUpdate(
    subTaskId,
    {
      ...(title && { title }),
      ...(description && { description }),
      ...(isCompleted && { isCompleted }),
    },
    {
      new: true,
      runValidators: true,
    },
  );
  /**Updates only the fields provided.
     Validation runs only on modified fields.
     Returns the updated document directly.
     By default, Mongoose schema validators only run on save(), not on update methods like findByIdAndUpdate().
     If you don’t include runValidators: true, then Mongoose won’t check your schema rules when updating.
     
     Ensures data integrity when updating.
     Prevents invalid values in your database.
     Works for all validators: required, maxlength, min, enum, match, custom validators, etc.*/

  if (!UpdateSubtask) {
    throw new ApiError(400, "Subtask not updation failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, UpdateSubtask, "Subtask updated successfully"));
});


const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;

  if (!mongoose.isValidObjectId(subTaskId)) {
    throw new ApiError(400,"Invalid subtask ID")
  }

  const delSubtask = await Subtask.findById(subTaskId);

  if (!delSubtask) {
    throw new ApiError(404, "Subtask not found");
  }

  await delSubtask.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Subtask deleted successfully"));
  
});

export {
  createSubTask,
  createTask,
  deleteTask,
  deleteSubTask,
  getTaskById,
  getTasks,
  updateSubTask,
  updateTask,
};
