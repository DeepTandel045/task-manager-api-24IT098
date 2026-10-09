
const taskEvents = require("./events");

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Listener for task creation
taskEvents.on("task-created", async (data) => {
  try {
    console.log(
      `[Notification] Handler started: ${new Date().toISOString()}`
    );

    // Simulate a slow notification process
    await delay(2000);

    console.log("[Notification] New task created");
    console.log("Task title:", data.task.title);
    console.log("Assigned user:", data.assignedUser);
    console.log("Task created at:", data.createdAt);
    console.log(
      `[Notification] Handler completed: ${new Date().toISOString()}`
    );
  } catch (err) {
    taskEvents.emit("error", err);
  }
});

// Listener for task deletion
taskEvents.on("task-deleted", async (data) => {
  try {
    await delay(500);

    console.log(
      `[Notification] Task "${data.title}" was deleted at ${new Date().toISOString()}`
    );
  } catch (err) {
    taskEvents.emit("error", err);
  }
});

// Error listener
taskEvents.on("error", (err) => {
  console.error(
    `[Notification Error] ${new Date().toISOString()}`,
    err.message
  );
});

console.log("Task event listeners registered");
