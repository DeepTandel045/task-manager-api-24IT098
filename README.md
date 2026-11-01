# Task Management Application - CI/CD Pipeline

[![CI Pipeline](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/workflows/ci.yml/badge.svg)](https://github.com/DeepTandel045/task-manager-api-24IT098/actions/workflows/ci.yml)

**Course:** Advanced Web Development (AWD)  
**Student ID:** 24IT098  
**Practical 12:** CI/CD Pipeline Automation with GitHub Actions  
**CO/PO Mapping:** CO5 / PO3, PO5  

---

## 1. Objective
To automate testing and validation of the Task Management backend application using a Continuous Integration (CI) pipeline configured via GitHub Actions.

---

## 2. CI/CD Architecture & Workflow

```text
Developer Push (git push origin main)
         │
         ▼
GitHub Actions Trigger (on: push, on: pull_request to main)
         │
         ▼
Job: build-and-test (ubuntu-latest)
  ├── 1. Checkout Code (actions/checkout@v4)
  ├── 2. Setup Node.js v18 (actions/setup-node@v4)
  ├── 3. Install Dependencies (npm install)
  ├── 4. Run Automated Tests (npm test -> Jest & Supertest)
  └── 5. Pass / Fail Status Reporting
         │
         ▼
Result Status:
  ✅ Green Checkmark (Build & Tests Passed)
  ❌ Red Cross (Build or Test Failed)
```

---

## 3. Workflow Configuration (`.github/workflows/ci.yml`)

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
          node-version: 18
          cache: 'npm'

      - name: Install Dependencies
        run: npm install

      - name: Run Automated Tests
        run: npm test
```

---

## 4. Automated Tests (`tests/task.test.js`)

The test suite uses **Jest** and **Supertest** to test API endpoints:

1. **Test 1: `GET /tasks`**
   - Asserts response HTTP status is `200 OK`.
   - Asserts returned payload is an array of tasks.
2. **Test 2: `GET /` (Health / Root Endpoint)**
   - Asserts response HTTP status is `200 OK`.
   - Asserts healthy status message (`status: "success"`).

---

## 5. Deliberate Failure & Recovery Demonstration

### A. Failing Pipeline Run (Deliberate Test Failure)
- **Action:** Altered expected status code in `tests/task.test.js` from `200` to `500`:
  ```javascript
  expect(res.statusCode).toBe(500); // Expected 500, received 200
  ```
- **Result:** GitHub Actions detected the mismatch and exited with code 1.
- **Status:** ❌ Failed (Red X)

### B. Passing Pipeline Run (Fixed Test)
- **Action:** Restored the test assertion to expect `200`:
  ```javascript
  expect(res.statusCode).toBe(200);
  ```
- **Result:** Jest tests passed cleanly (2 passed, 2 total).
- **Status:** ✅ Passed (Green checkmark)

---

## 6. Key Analysis & Viva Questions

### Q1: What is the difference between Continuous Integration (CI) and Continuous Deployment (CD), and which one does this practical demonstrate?
- **Continuous Integration (CI):** The practice of automating the integration of code changes from multiple contributors into a single repository frequently. Every commit automatically triggers automated builds, dependency installation, and test suites to verify that the changes do not break the codebase.
- **Continuous Deployment (CD):** The automated process where code changes that pass all CI stages are automatically deployed directly to production/staging servers without human intervention.
- **This Practical:** Specifically demonstrates **Continuous Integration (CI)**, where automated dependency installation and Jest unit/integration tests run automatically upon pushing code to GitHub.

### Q2: Why does running tests automatically on every push catch problems earlier than testing manually before a release?
Running automated tests on each `git push` ensures that regressions and bugs are detected immediately when the context is fresh in the developer's mind (often termed "shift-left testing"). Testing manually before release batches weeks of changes together, making root cause identification slow, difficult, and prone to human oversight.

### Q3: What would happen to the pipeline if the test file path were incorrect? Would the workflow fail at the same step as a genuine test failure?
If the test file path is incorrect or missing, Jest will fail during the test execution phase with "No tests found" (exiting with code 1 by default), failing at the same step (`run: npm test`). However, the log output would explicitly state `No tests found` rather than an assertion failure (such as `expect(received).toBe(expected)`), clearly distinguishing configuration errors from functional regressions.

---

## 7. Local Execution

To run the tests locally:
```bash
npm install
npm test
```
