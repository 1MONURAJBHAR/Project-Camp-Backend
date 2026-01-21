class ApiError extends Error{
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ) {
      super(message); //calling the constructor of parent class & it expects only one parameter to be passed on.
      ((this.statusCode = statusCode),
        (this.data = null),
        (this.message = message),
        (this.success = false),
        (this.errors = errors)); 

      if (stack) {
        this.stack = stack;
      } else {
        //It tells V8: “Generate a .stack trace for this error object.” Here error object-->new ApiError()
        Error.captureStackTrace(this, this.constructor);
      }
     
    }
};


export { ApiError };


