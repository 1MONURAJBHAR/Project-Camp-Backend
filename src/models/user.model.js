import mongoose, { Schema } from "mongoose";
import brcypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema(
  {
    avatar: {
      type: {
        url: String,
        localPath: String,
      },
      default: {
        url: `https://placehold.co/200x200`,
        localPath: "",
      },
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    }, 
    forgotPasswordToken: {
      type: String,
    },
    forgotPasswordExpiry: {
      type: Date,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {  //Don't use arrow function here because it has global context for "this"
  if (!this.isModified("password")) return next();  //checks if password is not modified then move to next(), if modified then move ahead and hash the password before save.

  this.password = await brcypt.hash(this.password, 10);  
  next();
});



userSchema.methods.isPasswordCorrect = async function (password) {
  return await brcypt.compare(password, this.password);   //password-->current passwrod send by user, this.password-->password from database.
};  //bcrypt will compare both these password and return true or false.

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
  );
};


userSchema.methods.generateTemporaryToken = function () {
    const unHashedToken = crypto.randomBytes(20).toString("hex")
    //Hashing is permanent, after hashing we cannot decrypt it
    const hashedToken = crypto  //hasing the same unHashedToken
        .createHash("sha256")
        .update(unHashedToken)  
        .digest("hex")

    const tokenExpiry = Date.now() + (20*60*1000) //set the expiry time 20 mins ahead of current Date.now() 
  return { unHashedToken, hashedToken, tokenExpiry };
};

export const User = mongoose.model("User", userSchema);




/**The crypto module is a built-in Node.js library that provides cryptographic functionality — things like hashing, encryption, decryption, and generating random values.
 *  It’s widely used for authentication, password security, API tokens, and more.

Key Features of crypto
Hashing → One-way functions (e.g., sha256, md5, sha512).
HMAC (Hash-based Message Authentication Code) → Verifies both data integrity & authenticity.
Encryption / Decryption → Symmetric (AES) and Asymmetric (RSA, EC).
Random Values → crypto.randomBytes() for tokens, IDs, salts.
Key Derivation → pbkdf2 for password-based key stretching.*/

