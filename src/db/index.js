import mongoose from "mongoose";
import { DB_NAME } from "../utils/constants.js";

const connectDB = async () => {
    try {
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log("✅ MongoDB connected");
        
    } catch (error) {
        console.error("❌ MongoDB connection error", error);
        process.exit(1);
        
    }
}

export default connectDB
