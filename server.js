
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

require("dotenv").config();

const cache = require("./cache");
const taskEvents = require("./events");
require("./listeners");

const Task = require("./models/Task");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authMiddleware = require("./middleware/authMiddleware");
const validateTask = require("./middleware/validationMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// ==============================
// CONNECT MONGODB
// ==============================

mongoose
    .connect(process.env.MONGO_URI || "mongodb://mongodb:27017/taskdb")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));

// ==============================
// MIDDLEWARE
// ==============================

app.use(express.json());
app.use(cors());

// Logging Middleware
app.use((req, res, next) => {
    console.log(
        `${req.method} ${req.url} - ${new Date().toISOString()}`
    );
    next();
});

// ==============================
// REGISTER USER
// ==============================

app.post("/register", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "User already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            email,
            password: hashedPassword,
        });

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ==============================
// LOGIN USER
// ==============================

app.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h",
            }
        );

        res.status(200).json({
            message: "Login successful",
            token: token,
        });
    } catch (err) {
        next(err);
    }
});

// ==============================
// GET CURRENT USER
// ==============================

app.get("/me", authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        res.status(200).json({
            id: user._id,
            email: user.email,
        });
    } catch (err) {
        next(err);
    }
});

// ==============================
// GET ALL TASKS - WITH CACHING
// ==============================

app.get("/tasks", authMiddleware, async (req, res, next) => {
    try {
        const cachedTasks = cache.get("all_tasks");

        if (cachedTasks) {
            console.log("CACHE HIT");
            return res.status(200).json(cachedTasks);
        }

        console.log("CACHE MISS");

        const tasks = await Task.find();

        cache.set("all_tasks", tasks);

        res.status(200).json(tasks);
    } catch (err) {
        next(err);
    }
});

// ==============================
// CREATE TASK - PRACTICAL 10
// ==============================

app.post(
    "/tasks",
    authMiddleware,
    validateTask,
    async (req, res, next) => {
        try {
            const task = await Task.create({
                title: req.body.title,
                description: req.body.description,
                completed: req.body.completed,
                priority: req.body.priority,
            });

            // Practical 9: invalidate cache
            cache.del("all_tasks");

            // Prepare notification information
            const notificationData = {
                task: task.toObject(),
                assignedUser: req.user.email || req.user.id,
                createdAt: new Date().toISOString(),
            };

            // Log API response timestamp
            console.log(
                `[API] Response sent at ${new Date().toISOString()}`
            );

            // Send response immediately
            res.status(201).json(task);

            // Emit event for background notification
            taskEvents.emit("task-created", notificationData);
        } catch (err) {
            next(err);
        }
    }
);

// ==============================
// UPDATE TASK
// ==============================

app.put("/tasks/:id", authMiddleware, async (req, res, next) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!task) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        // Practical 9: invalidate cache
        cache.del("all_tasks");

        res.status(200).json(task);
    } catch (err) {
        next(err);
    }
});

// ==============================
// DELETE TASK - PRACTICAL 10
// ==============================

app.delete("/tasks/:id", authMiddleware, async (req, res, next) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        // Practical 9: invalidate cache
        cache.del("all_tasks");

        console.log(
            `[API] Delete response sent at ${new Date().toISOString()}`
        );

        res.status(200).json({
            message: "Task deleted successfully",
        });

        // Emit deletion notification
        taskEvents.emit("task-deleted", {
            title: task.title,
            deletedAt: new Date().toISOString(),
        });
    } catch (err) {
        next(err);
    }
});

// ==============================
// 404 HANDLER
// ==============================

app.use((req, res) => {
    res.status(404).json({
        error: "Route not found",
    });
});

// ==============================
// GLOBAL ERROR HANDLER
// ==============================

app.use((err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: err.message,
    });
});

// ==============================
// START SERVER
// ==============================

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
