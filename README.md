# Practical 11: Containerization with Docker and Docker Compose

## Objective
Containerize the full-stack Task Management application using Docker and orchestrate all services using Docker Compose.

---

## Architecture Diagram

```
docker-compose.yml
├── frontend (React + Vite, built + served, port 5173)
├── backend  (Node.js / Express, port 5000)
└── mongodb  (Official MongoDB image, port 27017)

Network: app-network (Docker bridge network)
Flow: frontend (browser) ──► backend ──► mongodb
```

---

## Project Structure
```
advance_wd/
├── docker-compose.yml           # Multi-container orchestration definition
├── README.md                    # Project documentation & run guide
├── task-manager-api/            # Node/Express Backend
│   ├── Dockerfile               # Backend container image definition
│   ├── .dockerignore            # Excludes node_modules, .env, git
│   ├── server.js
│   ├── package.json
│   └── ...
└── student-portfolio/           # React / Vite Frontend
    ├── Dockerfile               # Multi-stage frontend container image
    ├── .dockerignore            # Excludes node_modules, dist, etc.
    ├── vite.config.js           # Configured for host and port 5173
    ├── package.json
    └── ...
```

---

## Prerequisites
1. **Docker Desktop** installed and running on your system.
2. Verify Docker and Docker Compose:
   ```bash
   docker --version
   docker compose version
   ```

---

## Step-by-Step Instructions to Run the Application

### 1. Build and Start All Containers
From the root directory (`advance_wd`), run:
```bash
docker compose up --build
```
*(Or `docker-compose up --build` if using Compose V1 syntax)*

This single command:
1. Builds the backend Node image and installs its npm dependencies.
2. Builds the frontend React image (running `npm run build` and serving with Vite preview on port 5173).
3. Pulls the official MongoDB image.
4. Creates a custom bridge network (`app-network`).
5. Creates a persistent named volume (`mongo-data`).
6. Starts all 3 services in the correct order (`mongodb` -> `backend` -> `frontend`).

### 2. Verify Running Containers
Open a new terminal and run:
```bash
docker ps
```
You should see all three containers:
- `task-frontend` on port `0.0.0.0:5173->5173/tcp`
- `task-backend` on port `0.0.0.0:5000->5000/tcp`
- `mongodb` on port `0.0.0.0:27017->27017/tcp`

### 3. Access the Application
- **Frontend UI:** Open [http://localhost:5173](http://localhost:5173) in your browser.
- **Backend API:** Test endpoints at [http://localhost:5000](http://localhost:5000).

### 4. Stopping the Stack
To gracefully stop the running containers:
```bash
docker compose down
```
To stop and remove containers including the database volume (resetting DB):
```bash
docker compose down -v
```

---

## Key Analysis & Viva Questions

### 1. Why does the backend container need to reference MongoDB by its service name (`mongodb`) rather than `localhost`?
Inside Docker, each container has its own isolated network namespace and its own loopback address (`localhost` / `127.0.0.1`). If the backend container attempts to connect to `localhost:27017`, it is looking for MongoDB inside its own container where Mongo is not running. 

Docker Compose provides built-in internal DNS service discovery on user-defined networks. By specifying the connection string as `mongodb://mongodb:27017/taskdb`, Docker automatically resolves `mongodb` to the internal IP address of the MongoDB container.

### 2. What is the difference between `EXPOSE` in a Dockerfile and the `ports` mapping in `docker-compose.yml`?
- **`EXPOSE` (Dockerfile):** Serves as metadata and internal documentation indicating which ports the containerized application listens on. It does **not** publish or bind the port to the host machine.
- **`ports` (docker-compose.yml):** Actually maps and forwards a port on the host machine to a port inside the container (`HOST_PORT:CONTAINER_PORT`), allowing outside traffic (such as your host web browser) to access the service.

### 3. Why is it bad practice to copy `node_modules` into a Docker image instead of running `npm install` inside?
- **Platform/Architecture Differences:** Native C/C++ bindings compiled during `npm install` on the host OS (e.g. Windows x64) will fail when run inside a Linux container (e.g. Debian/Alpine Linux).
- **Build Performance & Image Bloat:** Local `node_modules` can contain gigabytes of temporary data. Transferring them into the Docker daemon build context drastically slows down build times.
- **Reproducibility:** Running `npm install` inside the container guarantees that dependencies are cleanly resolved for the exact target runtime environment.

### 4. How does data persist across container restarts?
A Docker named volume (`mongo-data`) is mounted at MongoDB's internal data directory `/data/db`. When the container stops or is recreated, Docker preserves the named volume so database records are not lost.
