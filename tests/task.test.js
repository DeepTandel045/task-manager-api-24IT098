process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../server");
const Task = require("../models/task");
const cache = require("../cache");

// Mock Task model find method so tests run isolated from MongoDB in CI
jest.mock("../models/task", () => ({
    find: jest.fn().mockResolvedValue([
        { _id: "67246b1001", title: "Test Task 1", completed: false },
        { _id: "67246b1002", title: "Test Task 2", completed: true },
    ]),
}));

describe("Task Management API Automated CI Tests", () => {
    afterAll(() => {
        cache.close();
    });

    // Practical Step 2: Test GET /tasks endpoint returns status 200
    test("GET /tasks returns 200", async () => {
        const res = await request(app).get("/tasks");
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // Post-lab Requirement: Second automated test covering a different endpoint
    test("GET / returns 200 and healthy status message", async () => {
        const res = await request(app).get("/");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("success");
    });

    // Practical 13: Test AI Description Generation Route with graceful degradation
    test("POST /api/ai/generate-description returns generated description and disclaimer", async () => {
        const res = await request(app)
            .post("/api/ai/generate-description")
            .send({ title: "Fix login authentication bug" });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("description");
        expect(res.body).toHaveProperty("disclaimer");
        expect(res.body.description.length).toBeGreaterThan(0);
    });
});
