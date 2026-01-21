import { Router } from "express";

import {
  createTask,
  updateTask,
  deleteTask,
  getTasks,
  getTaskById,
  createSubTask,
  updateSubTask,
  deleteSubTask,
} from "../controllers/task.controllers.js";

import {
  validateProjectPermission,
  verifyJWT,
  validateTaskStatus,
} from "../middlewares/auth.middleware.js"; // if you have auth middleware

import { validate } from "../middlewares/validator.middleware.js"; // optional validators

import {
  createTheTasks,
  UpdateTheTask,
  createTheSubTask,
  updateTheSubTask,
} from "../validators/index.js";


const router = Router();
router.use(verifyJWT);

import { upload } from "../middlewares/multer.middleware.js";

import { AvailableUserRole,UserRolesEnum } from "../utils/constants.js";


router
  .route("/:projectId")
  .get(validateProjectPermission(AvailableUserRole), getTasks)
  .post(
    validateProjectPermission([UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN, ]),
    upload.array("attachments"), 
    createTheTasks(), 
    validate,
    createTask,
  );



router
  .route("/:projectId/t/:taskId")
  .get(validateProjectPermission(AvailableUserRole), getTaskById)
  .put(  //Update a task
    validateProjectPermission([UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN]),
    upload.array("attachments"),
    validateTaskStatus,
    UpdateTheTask(),
    validate,
    updateTask,
  )
  .delete(  //delete a task
    validateProjectPermission([UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN]),
    deleteTask,
  );  



// Create a subtask under a task
router
  .route("/:projectId/t/:taskId/subtasks")
  .post( //create a subtask
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    createTheSubTask(),
    validate,
    createSubTask,
);
  

router
  .route("/:projectId/st/:subTaskId") //this projectId & subTaskId names will be stored in "req.params" so ensure while taking values/destructuring the req.params you use these names only, if you use different name it will return null & also this is same for all.  
  .put(
    // Update a subtask
    validateProjectPermission(AvailableUserRole),
    updateTheSubTask(),
    validate,
    updateSubTask,
  )
  .delete(
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    deleteSubTask,
  ); //delete a subtask

export default router;

