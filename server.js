const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

require("dotenv").config();

const cache = require("./cache");
const taskEvents = require("./events");
require("./listeners");

const Task = require("./models/task");
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

if (process.env.NODE_ENV !== "test" && require.main === module) {
    mongoose
        .connect(process.env.MONGO_URI || "mongodb://mongodb:27017/taskdb")
        .then(() => console.log("MongoDB Connected"))
        .catch((err) => console.log(err));
}

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
// ROOT / HEALTH CHECK ROUTE
// ==============================

app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Task Manager API is running smoothly",
    });
});

// ==============================
// REGISTER USER
// ==============================

app.post("/register", async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Username, email and password are required",
            });
        }

        const existingUser = await User.findOne({
            $or: [{ email }, { username }],
        });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with that email or username",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
        });

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
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
            return res.status(400).json({
                message: "Invalid credentials",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid credentials",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
            },
            process.env.JWT_SECRET || "default_jwt_secret",
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

            // Practical 10: emit background event
            taskEvents.emit("task-created", {
                task: task,
                assignedUser: req.user.email,
                createdAt: new Date().toISOString(),
            });

            res.status(201).json(task);
        } catch (err) {
            next(err);
        }
    }
);

// ==============================
// UPDATE TASK
// ==============================

app.put(
    "/tasks/:id",
    authMiddleware,
    validateTask,
    async (req, res, next) => {
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

            // Invalidate cache
            cache.del("all_tasks");

            res.status(200).json(task);
        } catch (err) {
            next(err);
        }
    }
);

// ==============================
// DELETE TASK
// ==============================

app.delete("/tasks/:id", authMiddleware, async (req, res, next) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        // Invalidate cache
        cache.del("all_tasks");

        // Emit background event
        taskEvents.emit("task-deleted", {
            taskId: req.params.id,
            title: task.title,
        });

        res.status(200).json({
            message: "Task deleted successfully",
        });
    } catch (err) {
        next(err);
    }
});

// ==============================
// AI GENERATE DESCRIPTION ROUTE - PRACTICAL 13
// ==============================

const aiRateLimitMap = new Map();

app.post(
    ["/api/ai/generate-description", "/ai/generate-description"],
    authMiddleware,
    async (req, res) => {
        try {
            const { title } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({
                    message: "Task title is required to generate description",
                });
            }

            // Rate limiting: 1 request every 5 seconds per user
            const userId = req.user?.id || req.ip;
            const now = Date.now();
            const lastRequest = aiRateLimitMap.get(userId) || 0;
            const cooldown = 5000;

            if (now - lastRequest < cooldown) {
                const waitSec = Math.ceil(
                    (cooldown - (now - lastRequest)) / 1000
                );
                return res.status(429).json({
                    message: `Rate limit: Please wait ${waitSec}s before requesting another AI suggestion.`,
                    rateLimited: true,
                });
            }

            aiRateLimitMap.set(userId, now);

            let generatedDescription = "";
            let suggestedPriority = "medium";
            let isFallback = false;

            const prompt = `Write a short, professional, 1-2 sentence task description for: "${title.trim()}". Keep it concise, actionable, and under 30 words.`;

            // 1. Attempt OpenAI if key is configured
            if (
                process.env.OPENAI_API_KEY &&
                process.env.OPENAI_API_KEY !== "your_openai_api_key_here" &&
                process.env.OPENAI_API_KEY !== "dummy_key"
            ) {
                try {
                    const OpenAI = require("openai");
                    const client = new OpenAI({
                        apiKey: process.env.OPENAI_API_KEY,
                    });
                    const completion =
                        await client.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: [
                                {
                                    role: "system",
                                    content:
                                        "You are a helpful assistant for a task management app. Generate short, clear, actionable task descriptions.",
                                },
                                { role: "user", content: prompt },
                            ],
                            max_tokens: 60,
                        });
                    generatedDescription =
                        completion.choices[0]?.message?.content?.trim() ||
                        "";
                } catch (apiErr) {
                    console.warn(
                        "[AI Warning] OpenAI call failed, falling back to local suggestion:",
                        apiErr.message
                    );
                }
            }

            // 2. Attempt Gemini if Gemini key is configured and OpenAI not used
            if (
                !generatedDescription &&
                process.env.GEMINI_API_KEY &&
                process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
            ) {
                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
                    const geminiRes = await fetch(geminiUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            contents: [
                                { parts: [{ text: prompt }] },
                            ],
                            generationConfig: { maxOutputTokens: 60 },
                        }),
                    });
                    if (geminiRes.ok) {
                        const geminiData = await geminiRes.json();
                        generatedDescription =
                            geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
                            "";
                    }
                } catch (geminiErr) {
                    console.warn(
                        "[AI Warning] Gemini call failed, falling back to local suggestion:",
                        geminiErr.message
                    );
                }
            }

            // 3. Graceful degradation: context-aware fallback generator
            if (!generatedDescription) {
                isFallback = true;
                const lower = title.toLowerCase();
                if (
                    lower.includes("bug") ||
                    lower.includes("fix") ||
                    lower.includes("issue") ||
                    lower.includes("error")
                ) {
                    generatedDescription = `Investigate root cause of ${title.trim()}, apply required code fix, and verify with automated unit tests.`;
                    suggestedPriority = "high";
                } else if (
                    lower.includes("deploy") ||
                    lower.includes("docker") ||
                    lower.includes("prod") ||
                    lower.includes("release")
                ) {
                    generatedDescription = `Verify build artifacts and environment configurations, then deploy ${title.trim()} to the target environment.`;
                    suggestedPriority = "high";
                } else if (
                    lower.includes("test") ||
                    lower.includes("qa") ||
                    lower.includes("jest")
                ) {
                    generatedDescription = `Write and execute comprehensive test suites for ${title.trim()} to ensure zero regressions.`;
                    suggestedPriority = "medium";
                } else if (
                    lower.includes("meeting") ||
                    lower.includes("sync") ||
                    lower.includes("discuss")
                ) {
                    generatedDescription = `Conduct scheduled discussion for ${title.trim()}, take notes, and assign action items.`;
                    suggestedPriority = "medium";
                } else if (
                    lower.includes("read") ||
                    lower.includes("learn") ||
                    lower.includes("research")
                ) {
                    generatedDescription = `Review reference documentation for ${title.trim()} and document key takeaways for the team.`;
                    suggestedPriority = "low";
                } else {
                    generatedDescription = `Implement and complete requirements for "${title.trim()}", verify functionality, and review before completion.`;
                    suggestedPriority = "medium";
                }
            }

            return res.status(200).json({
                title: title.trim(),
                description: generatedDescription,
                suggestedPriority,
                fallback: isFallback,
                message: isFallback
                    ? "Generated via intelligent local fallback (AI service unavailable or API key unconfigured)."
                    : "Generated successfully by AI service.",
                disclaimer:
                    "AI-generated content should be reviewed and verified by the user before saving.",
            });
        } catch (err) {
            console.error("AI route error:", err);
            return res.status(200).json({
                description: `Review requirements and complete task for "${
                    req.body.title || "this task"
                }".`,
                suggestedPriority: "medium",
                fallback: true,
                message:
                    "AI service encountered an error. Provided graceful fallback suggestion.",
                disclaimer:
                    "AI-generated content should be reviewed before saving.",
            });
        }
    }
);

// ==============================
// 404 HANDLER
// ==============================

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found",
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

if (process.env.NODE_ENV !== "test" && require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
