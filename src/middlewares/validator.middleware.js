import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-error.js";

export const validate = (req, res, next) => {
  const errors = validationResult(req); //This will take the array of error coming from userRegisterValidator()
  //errors is not a simple array or string. Its datatype is an object returned by express-validator, specifically a Result object that represents the result of the validation. 
  
  if (errors.isEmpty()) { //check the array if it is empty then move to next middleware or server
    return next(); 
  }

  //if there are error in this "errors" array then catch them and store in "extractedErrors" array & thorw it
  const extractedErrors = []; //All the errors will be collected in this extractedErrors.

  errors.array().map((err) =>     //Here we are converting errors into an error, actually it is an error but we are again converting it to an error.
    extractedErrors.push({      //By using the map method on errors array, pushing all the "error path" and "error messages" into extractedErrors array.
      [err.path]: err.msg,
    }),
  );
  console.log("Extracted Errors (JSON):",JSON.stringify(extractedErrors, null, 2),
  );
  throw new ApiError(422, "Recieved data is not valid", extractedErrors); //If any errors occurs then throw this error
};
