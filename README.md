<div align="center">
  <img src="frontend/public/favicon.svg" width="120" height="120" alt="Code Arena Logo" />
  <h1 style="font-family: monospace;">CODE ARENA</h1>
  
  <p><b>Real-time collaborative IDE and distributed execution engine.</b></p>
</div>

---

## Features

- **Conflict-Free Real-Time Sync:** Peer-to-peer code synchronization powered by Yjs (CRDTs) with zero merge conflicts.
- **Isolated Execution Sandbox:** Untrusted C++ code and standard inputs are compiled and executed inside ephemeral, resource-constrained Docker containers.
- **Asynchronous Job Queue:** High-throughput task handling using Redis and BullMQ to decouple heavy compute workloads from the API Gateway.
- **Dynamic Workspaces:** Unique, UUID-routed rooms with built-in host permissions (grant/revoke write access) and live participant awareness.
- **Secure Authentication:** Robust JWT-based authentication with bcrypt password hashing and MongoDB persistence.
- **Retro UI/UX:** Distraction-free, full-screen vertical split layout featuring the Monaco Editor, Xterm.js, Framer Motion page transitions, and a classic 'Press Start 2P' design system.

---

## System Architecture

Code Arena utilizes a microservices architecture to separate state management from code execution:

1. **Client Layer:** React application maintaining local Monaco Editor state, communicating via REST for auth and WebSockets for live typing.
2. **State & Gateway Layer (Node/Express):** Manages user sessions, provisions dynamic WebSocket rooms, and queues execution requests. 
3. **Queue Layer (BullMQ + Redis):** Buffers incoming execution requests to prevent server overloads and manages Redis Pub/Sub channels to stream `stdout` back to clients.
4. **Worker Layer (Dockerode):** An independent Node process that pulls jobs, writes `stdin` to temporary files, mounts them to isolated Docker containers, executes the binaries, and streams the output.

---

##  Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), Framer Motion, Monaco Editor, Xterm.js, Tailwind/CSS |
| **Backend** | Node.js, Express, Mongoose, JWT, bcrypt |
| **Real-Time** | Yjs, `y-websocket` |
| **Infrastructure** | Docker, Redis, BullMQ, MongoDB |

---

##  Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Docker Desktop** (Running locally)
- **Redis Server** (Running on port `6379`)
- **MongoDB** (Running locally on `27017` or via Atlas)

### 1. Clone & Configure
```bash
git clone [https://github.com/pratirajsinha07/code-arena.git](https://github.com/pratirajsinha07/code-arena.git)
cd code-arena

# Duplicate environment templates
cp frontend/.env.example frontend/.env
cp api-gateway/.env.example api-gateway/.env
cp worker-engine/.env.example worker-engine/.env
