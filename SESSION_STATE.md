# Code Arena - Session Context & State

**Saved At:** 2026-10-02 15:52 (Local Time)
**Status:** Awaiting Phase 3

## 1. Project Overview
**Code Arena** is a real-time collaborative coding environment (MERN stack + WebSockets + Docker). It allows users to collaboratively write C++ code, execute it securely in a Docker container, and interact with the running program's standard input/output via a simulated TTY terminal.

## 2. Completed Milestones

### Phase 1: Real-time Editor & Execution Pipeline
- **Frontend (`/frontend`)**: React + Vite, Monaco Editor for syntax highlighting. `xterm.js` for the terminal UI. `yjs`, `y-websocket`, and `y-monaco` for real-time collaborative editing.
- **API Gateway (`/api-gateway`)**: Express + WS server. Relays WebSocket telemetry (editor sync & terminal input) to/from Redis using Pub/Sub. Queues execution jobs to BullMQ.
- **Worker Engine (`/worker-engine`)**: BullMQ worker that pulls jobs, spins up ephemeral Docker containers (`gcc` image), compiles the code, and attaches to the container using `dockerode` (`hijack: true`) for interactive `std::cin` streams.
- **Bugs Squashed**: Fixed a "ghost process" issue where old `worker-engine` instances hijacked BullMQ jobs and broke terminal input. Fixed Monaco read-only lock race conditions.

### Phase 2: MERN Authentication & Security
- **Backend (`/api-gateway`)**: Integrated MongoDB (`mongoose`). Built a `User` schema with strict validation and a `pre-save` hook for `bcrypt` password hashing.
- **Routes**:
  - `POST /api/auth/signup` & `POST /api/auth/login`: Issue expiring JWTs.
  - `DELETE /api/users/me`: Protected route that securely deletes an account after password verification.
- **Frontend Routing**: Implemented `react-router-dom` to split the app into `<Auth />` and `<Dashboard />`.
- **UI/UX Hardening**: Added "Show/Hide Password" toggles, clear inline red error messages, and a secure Delete Account confirmation modal.
- **Styling**: Integrated the 'Press Start 2P' Google Font and created a `<RetroTitle />` component to give the app a classic 8-bit arcade aesthetic.

## 3. Current Background Processes (Running)
- **API Gateway**: `node index.js` (Port 3001)
- **Worker Engine**: `node index.js` (Listening to Redis queue)
- **Frontend**: `npm run dev` (Vite, Port 5173)
- **Infrastructure**: Redis & MongoDB (running locally).

## 4. Next Steps
- Waiting for the user to initiate the next phase (Phase 3). Just provide this file as context if a new session is started!
