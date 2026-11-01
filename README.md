# Task Management Application - CI/CD Pipeline

[![CI Pipeline](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/workflows/ci.yml/badge.svg)](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/workflows/ci.yml)

**Course:** Advanced Web Development Frameworks (ITUE301)  
**Semester:** 5th  
**Student ID:** 24IT098  
**Student Name:** Deep Tandel  
**Practical 12:** Automate testing and deployment of the application using a CI/CD pipeline  
**CO/PO Mapping:** CO5 / PO3, PO5  

---

## 1. Objective
To automate testing and validation of the Task Management backend application using a Continuous Integration (CI) pipeline configured via GitHub Actions.

---

## 2. CI/CD Architecture & Pipeline Workflow

```text
git push origin main / pull_request targeting main
         │
         ▼
GitHub Actions Trigger (on: push, on: pull_request)
         │
         ▼
Job: build-and-test (runs-on: ubuntu-latest)
  ├── 1. Checkout Code (actions/checkout@v4)
  ├── 2. Setup Node.js v20 (actions/setup-node@v4)
  ├── 3. Install Dependencies (run: npm install)
  ├── 4. Run Automated Tests (run: npm test -> Jest & Supertest)
  └── 5. Report Pass / Fail Status
         │
         ▼
Pipeline Result:
  ✅ Green Checkmark (All tests passed -> Exit code 0)
  ❌ Red X Cross (Test assertion failed or build error -> Exit code 1)
```

---

## 3. GitHub Actions Workflow Configuration (`.github/workflows/ci.yml`)

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm install

      - name: Run Automated Tests
        run: npm test
```

---

## 4. Automated Test Suite (`tests/task.test.js`)

The test suite utilizes **Jest** and **Supertest** to execute automated integration tests against the Express API endpoints without requiring external database dependencies during CI:

```javascript
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
});
```

---

## 5. Deliberate Failure & Recovery Demonstration

### A. Failing Pipeline Run (Deliberate Test Failure)
- **Commit:** `111ad13` - *Practical 12: Demonstrate pipeline failure with deliberately broken test*
- **Workflow Run ID:** `41310080583`
- **Workflow Run URL:** [View Failed Run](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/runs/41310080583)
- **Deliberate Change:** Changed expected status code in `tests/task.test.js` from `200` to `500`:
  ```javascript
  expect(res.statusCode).toBe(500); // Expected 500, received 200
  ```
- **Pipeline Result:** ❌ **FAILED (Red X)**
- **Console Log Output:**
  ```text
  FAIL tests/task.test.js
    ● Task Management API Automated CI Tests › GET /tasks returns 200
      expect(received).toBe(expected) // Object.is equality
      Expected: 500
      Received: 200
      Tests: 1 failed, 1 passed, 2 total
      Process completed with exit code 1.
  ```

### B. Passing Pipeline Run (Fixed Test)
- **Commit:** `e8cc350` - *Fix deliberate test failure - all CI automated tests passing*
- **Workflow Run ID:** `41310191964`
- **Workflow Run URL:** [View Passing Run](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/runs/41310191964)
- **Fix Applied:** Restored assertion to `expect(res.statusCode).toBe(200);`
- **Pipeline Result:** ✅ **PASSED (Green Checkmark)**
- **Console Log Output:**
  ```text
  PASS tests/task.test.js
    Task Management API Automated CI Tests
      √ GET /tasks returns 200 (37 ms)
      √ GET / returns 200 and healthy status message (6 ms)
  Test Suites: 1 passed, 1 total
  Tests:       2 passed, 2 total
  Snapshots:   0 total
  ```

---

## 6. Key Analysis & Viva Questions

### Q1: What is the difference between Continuous Integration (CI) and Continuous Deployment (CD), and which one does this practical actually demonstrate?
- **Continuous Integration (CI):** The practice of automating the integration and verification of code changes from multiple developers into a central repository. Every commit automatically triggers dependency installation, compilation/linting, and automated tests to catch regressions early.
- **Continuous Deployment (CD):** The automated stage that directly follows CI, where changes passing all automated tests are automatically built into deployable artifacts (such as Docker images) and released into staging or production server environments without manual intervention.
- **This Practical Demonstration:** This practical specifically demonstrates **Continuous Integration (CI)** by validating repository changes, managing dependencies, and executing automated Jest/Supertest suites on GitHub Actions runners upon `git push`.

### Q2: Why does running tests automatically on every push catch problems earlier than testing manually before a release?
1. **Immediate Feedback Loop ("Shift-Left Testing"):** Developers are notified of regressions within minutes of writing the code while the mental context of the implementation is still fresh.
2. **Isolation of Causes:** Because tests run on small, discrete commits, identifying which specific line of code broke a test is trivial compared to diagnosing a bug across a batched multi-week release.
3. **Consistency:** Automated pipelines eliminate human error, forgotten test cases, and environment-specific quirks ("it works on my machine").

### Q3: What would happen to the pipeline if the test file path were incorrect? Would the workflow fail at the same step as a genuine test failure?
- If the test file path is incorrect or the referenced module path has a casing mismatch (e.g., `Task` vs `task` on case-sensitive Linux runners), the workflow still fails at the test execution step (`Run Automated Tests`).
- **Difference in Diagnostics:**
  - A **genuine test failure** displays an assertion mismatch (e.g., `Expected: 500`, `Received: 200`).
  - A **path or import failure** throws an uncaught module resolution error (`Cannot find module ...` or `No tests found`), failing before any test assertions can execute.

---

## 7. Supplementary Problems

### 1. Adding a Linting Job (ESLint) Before Tests
In `.github/workflows/ci.yml`, a separate linting job can be configured, and `build-and-test` can depend on it via `needs: lint`:
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx eslint .

  build-and-test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm test
```

### 2. PR-Only Trigger Configuration
To configure the workflow to run exclusively on pull requests targeting `main` (and not on direct pushes):
```yaml
on:
  pull_request:
    branches: [main]
```

### 3. README Status Badge
Added at the top of this README:
```markdown
[![CI Pipeline](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/workflows/ci.yml/badge.svg)](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/workflows/ci.yml)
```

---

## 8. Local Execution Commands

```bash
# Install dependencies
npm install

# Run automated tests
npm test
```

---

## 9. Deliverables & Repository Links

- **Repository:** [https://github.com/DeepTandel045/task-manager-api-24IT098](https://github.com/DeepTandel045/task-manager-api-24IT098)
- **Workflow File:** [`.github/workflows/ci.yml`](https://github.com/DeepTandel045/task-manager-api-24IT098/blob/main/.github/workflows/ci.yml)
- **Test Suite:** [`tests/task.test.js`](https://github.com/DeepTandel045/task-manager-api-24IT098/blob/main/tests/task.test.js)
