import req from "express/lib/request.js"
import { ProjectNote } from "../models/note.models.js"
import { Project } from "../models/project.models.js"
import { ApiError } from "../utils/api-error.js"
import { ApiResponse } from "../utils/api-response.js"
import { asyncHandler } from "../utils/async-handler.js"
import mongoose from "mongoose"


//List all notes of a project
const getProjectNotes = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
        throw new ApiError(400, "Invalid project Id");
    }

    const notes = await ProjectNote.find({ project: projectId })
        .populate("createdBy", "username email")
        .sort({ createdAt: -1 });
    
    return res
        .status(200)
        .json(new ApiResponse(200, notes, "Project notes fetched successfully"))
    
})


//create note for a project
const createProjectNote = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { content } = req.body;

    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can create notes")
    }

    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const note = await ProjectNote.create({
        project: projectId,
        createdBy: req.user._id,
        content,
    });


    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note created successfully"));
})


const getProjectNoteById = asyncHandler(async (req, res) => {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note Id")
    }

    const note = await ProjectNote.findById(noteId).populate("createdBy", "name email");

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note details fetched successfully"));

})


const updateProjectNote = asyncHandler(async(req, res) => {
    const { noteId } = req.params;
    const { content } = req.body;

    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can update notes");
    }

    const note = await ProjectNote.findById(noteId)

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    note.content = content || note.content; //if user does not provide new content then retain the previous content as it is.
    await note.save(); //save the updated note document in database

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note updated successfully"));
})


const deleteProjetNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
        throw new ApiError(400, "Invalid note Id")
    }

    if (req.user.role !== "admin") {
        throw new ApiError(400, "Only Admins can delete notes")
    }

    const note = await ProjectNote.findByIdAndDelete(noteId);

    if (!note) {
        throw new ApiError(404, "Note not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, note, "Note deleted successfully"));

})

export {
    createProjectNote,
    getProjectNoteById,
    getProjectNotes,
    updateProjectNote,
    deleteProjetNote,
}

