import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//Using winston & morgan loggers
//Morgan intercepts every request and logs it using the format we defined.
import logger from "./utils/loggers.js";
import morgan from "morgan";

const morganFormat = ":method :url :status :response-time ms";  //morgan fromats the http request in this format.

//app.use() → Adds Morgan as middleware in Express.
app.use(
  morgan(morganFormat, {
    stream: {           //stream.write()--> receives the formatted string (message) from morgan and parses the string into a structured object & then sent it to winston.
      write: (message) => {
        const logObject = {
          //Convert the raw string log into a structured JSON object.
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject)); // Converts the JavaScript object into a string because Winston logs strings & after that it sent it to winston at info level.
      },
    },
  }),
);


app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));


app.use(cookieParser())
//cors configurations
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));



import healthCheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js"
import projectRouter from "./routes/project.routes.js"
import taskRouter from "./routes/task.routes.js"
import noteRouter from "./routes/note.routes.js"

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter); 
app.use("/api/v1/project", projectRouter);
app.use("/api/v1/task", taskRouter);
app.use("/api/v1/note", noteRouter);

app.get("/", (req, res) => {  
    console.log("Welcome to basecampy"); 
    res.send("Hello!");
})

export default app;

