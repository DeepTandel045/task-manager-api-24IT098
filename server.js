const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const Task = require("./models/Task");

const app = express();
const PORT = 5000;

// -----------------------------
// Connect MongoDB
// -----------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// -----------------------------
// Middleware
// -----------------------------
app.use(express.json());
app.use(cors());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// ==============================
// GET ALL TASKS
// ==============================
app.get("/tasks", async (req, res, next) => {
  try {
    const tasks = await Task.find();

    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
});

// ==============================
// GET TASK BY ID
// ==============================
app.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// ==============================
// CREATE TASK
// ==============================
app.post("/tasks", async (req, res, next) => {
  try {
const task = await Task.create({
  title: req.body.title,
  description: req.body.description,
  completed: req.body.completed,
  priority: req.body.priority,
});

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// ==============================
// UPDATE TASK
// ==============================
app.put("/tasks/:id", async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// ==============================
// DELETE TASK
// ==============================
app.delete("/tasks/:id", async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (err) {
    next(err);
  }
});

// ==============================
// 404 Handler
// ==============================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// ==============================
// Global Error Handler
// ==============================
app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({
        error: err.message,
        stack: err.stack
    });

});

// ==============================
// Start Server
// ==============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});