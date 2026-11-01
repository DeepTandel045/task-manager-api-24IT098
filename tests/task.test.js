const request = require("supertest");
const app = require("../server");
const Task = require("../models/Task");
const cache = require("../cache");

// Mock Task model find method so tests run isolated from MongoDB in CI
jest.mock("../models/Task", () => ({
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
});
