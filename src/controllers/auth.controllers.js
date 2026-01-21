import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import crypto from "crypto";
import {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  sendEmail,
} from "../utils/mail.js";
import jwt from "jsonwebtoken";
import path from "path";




//Generate access token and refresh token
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access token",
    );
  }
};

//Register a user
const registerUser = asyncHandler(async (req, res) => {
  const { email, username, password, role, fullName } = req.body;

  const existedUser = await User.findOne({ 
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }

  const user = await User.create({
    email,
    password,
    fullName,
    username,
    isEmailVerified: false,
  });

   //After creation of "user" now,
  //All the functionalities which we have written in the user.model.js (like-->userSchema.methods.generateTemporaryToken) is available in "user" not in "User"--> this is mongoose model collection
  //So we can access all those methods in "user" and not in "User"
    const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;

  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`,//-->this is generation of dynamic links
    ),   //req.protocol-->http/https, req.get("host")-->localhost or whatever the host, when we make request on postman or frontend we give http/https and host info.
  });

    //After the creation of user in register collection mongoDB give it a default "_id" to that document, now we can access that document using this "_id"
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: createdUser },
        "User registered successfully and verification email has been sent on your email",
      ),
    );
});


//Login a user
const login = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password) {
    throw new ApiError(400, " Email & Password is required");
  }

  const user = await User.findOne({ email });

  //if we want both username & email from user then we write this code
  /*
    const user1 = await User.findOne({ email });
    const user2 = await User.findOne({ username });
    
    if(!user1 || !user2){
        console.log("Email and username is required");
     }
    
    // now since both user1 & user2 return the same document we can move ahead with any one document.
   */




  if (!user) {
    throw new ApiError(400, "User does not exists");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully",
      ),
    );
});

//Logout a user
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: "",
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});
/**Cookies are identified by name + domain + path (and sometimes secure attributes).
If these don’t match, clearCookie() won’t remove it.
Always use the same options when clearing as when setting. */



//Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

//Verify the email, After the registeration a mail is sent to you which contains the a link with unHashedToken as you click on that your unHashedToken will come here as verificationToken via params
const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params; //This verificationToken is nothing but the unHashedToken which we sent while registering the user

  if (!verificationToken) {
    throw new ApiError(400, "Email verification token is missing");
  }

  let hashedToken = crypto //hashing the verificationToken because we will find the user document from database using this hashedToken.
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex"); //finalizes and gives you the result as a hexadecimal string.

  const user = await User.findOne({
    //find in the "User" collection that this hashedToken exists in emailVerificationToken field or not
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() }, //This will Find documents where "emailVerificationExpiry" is greater than the current timestamp (Date.now()). i.e:check that this hashedToken is valid or not
  });

  if (!user) {
    throw new ApiError(400, "Token is invalid or expired");
  }

  //clean the fields
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;

  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isEmailVerified: true,
      },
      "Email is verified",
    ),
  );
});

//Resend email verification
const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  if (user.isEmailVerified) {
    throw new ApiError(409, "Email is already verified");
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;

  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`,
    ),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Mail has been sent to your email ID"));
});

//Refresh the access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized access");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token in expired");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    /**{ accessToken, refreshToken: newRefreshToken }
       Uses object shorthand for accessToken (field + variable are same name).
       Uses explicit mapping for refreshToken → assigns the value of newRefreshToken into the field called refreshToken. */

    user.refreshToken = newRefreshToken;  
    await user.save();  //Here mongodb only validate and update the modified fields. Just like here the modified field is "user.refreshToken" so only this field will be vallidated and updated, other fields will remain as it is mongodb won't touch them.

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse( //creating an instance of your custom ApiResponse class.
          200,
          { accessToken, refreshToken: newRefreshToken }, //here refreshToken is variable and newRefreshToken is the value 
          "Access token refreshed",                       //since accessToken variable name and value name is same we are writing it in shorthand just like, "accessToken: accessToken" --> "accessToken"
        ),
      );
  } catch (error) {
    throw new ApiError(401, {}, "Invalid refresh token");
  }
});

//Forgot password request
const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body; //if you forgot your password then provide your email in the body

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = tokenExpiry;

  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Password reset request",
    mailgenContent: forgotPasswordMailgenContent(
      user.username,
      `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`,
    ),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset mail has been sent on your mail id",
      ),
    );
});

//After forgotPasswordRequest
const resetForgotPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  let hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() }, // forgotPasswordExpiry in database should be greater then current time stamp Date.now()
  });

  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  user.forgotPasswordExpiry = undefined;
  user.forgotPasswordToken = undefined;

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

//Only logined user can change password 
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid old Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});


//Upload the avatar 
 const uploadAvatar = asyncHandler(async (req, res) => {
  const userId = req.user._id; // userId from auth middleware (assuming user is logged in)

  if (!req.file) {
    throw new ApiError(400, "No avatar file uploaded");
  }

  const localPath = req.file.path; // e.g., "public\images\1759402117967-images.jpeg"

  // Normalize for URL
  const normalizedPath = localPath.split(path.sep).join("/");

  // Construct URL
  const url = `${req.protocol}://${req.get("host")}/${normalizedPath}`;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      avatar: {
        url,
        localPath,
      },
    },
    { new: true },
  ).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { avatar: user.avatar },  //avatar is varible, user.avatar is value from user document.
        "Avatar uploaded successfully",
      ),
    );
});

export {
  registerUser,
  login,
  logoutUser,
  getCurrentUser,
  verifyEmail,
  resendEmailVerification,
  refreshAccessToken,
  forgotPasswordRequest,
  changeCurrentPassword,
  resetForgotPassword,
  uploadAvatar,
};


  