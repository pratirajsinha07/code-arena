<div align="center">
  <img src="frontend/public/favicon.svg" width="100" height="100" alt="Code Arena Logo" />
  <h1 style="font-family: monospace;">CODE ARENA</h1>
  <p><b>Real-time, competitive programming collaboration in 8-bit.</b></p>
</div>

---

<!-- 📸 UI SCREENSHOT PLACEHOLDER -->
> [!NOTE]
> *(Insert a clean screenshot of the retro "Code Arena" IDE interface here)*

---

Code Arena is a real-time, competitive programming platform that brings developers together in isolated virtual rooms to collaborate, write code, and instantly test logic against a robust backend execution engine. Featuring an immersive 8-bit retro aesthetic, it perfectly blends modern collaborative engineering with a classic arcade feel.

## 🛠 Tech Stack

- **Frontend**: React (Vite), Framer Motion, Monaco Editor, Xterm.js
- **Real-Time Engine**: Yjs (CRDTs), `y-websocket`
- **API Gateway**: Node.js, Express, MongoDB (Mongoose), JWT Authentication
- **Execution Engine**: BullMQ, Dockerode, Redis
- **Infrastructure**: Redis (Pub/Sub & Queueing), Docker

## 🧠 Architecture Overview

Code Arena operates on a highly decoupled microservices architecture designed for real-time collaboration and secure, isolated execution:

- **WebSocket Room Isolation**: Collaborative text editing is powered by Yjs. The API Gateway routes incoming WebSockets to isolated room channels. Changes are synced across peers using Conflict-free Replicated Data Types (CRDTs), ensuring zero merge conflicts and ultra-low latency.
- **Decoupled Execution Pipeline**: When a user clicks "Run Code", the API Gateway submits a payload to a **BullMQ** queue backed by Redis. The independent **Worker Engine** pulls the job, spins up an ephemeral, isolated **Docker container**, injects the code and standard input, executes the compiled binary, and streams the standard output back to the client via Redis Pub/Sub.
- **Instant AC/WA Evaluation**: The frontend instantly parses the incoming output stream, stripping ANSI codes and matching the precise output against expected test cases to yield real-time Accepted or Wrong Answer badges.

## 🏃 Local Setup

### Prerequisites
- Node.js (v18+)
- Docker Desktop (Running locally)
- Redis Server (Running on port `6379`)
- MongoDB (Running locally on `27017` or via MongoDB Atlas)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/code-arena.git
cd code-arena
```

### 2. Configure Environment Variables
You'll need to set up environment variables for the frontend and backend services. We've provided `.env.example` templates in each directory.

```bash
cp frontend/.env.example frontend/.env
cp api-gateway/.env.example api-gateway/.env
cp worker-engine/.env.example worker-engine/.env
```
*Ensure you update `api-gateway/.env` with your desired `JWT_SECRET` and `MONGO_URI`.*

### 3. Install Dependencies & Start Services
You will need three separate terminal windows to run the microservices.

**Terminal 1: API Gateway**
```bash
cd api-gateway
npm install
node index.js
```

**Terminal 2: Worker Engine**
```bash
cd worker-engine
npm install
node index.js
```

**Terminal 3: Frontend**
```bash
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:5173` in your browser. Create an account, spin up a new room, and start coding!

## 🚀 Cloud Deployment Note

If you are looking to deploy this platform to the cloud for a live portfolio piece:

1. **Database**: Provision a free **MongoDB Atlas** cluster and a free Redis instance (e.g., Upstash or Redis Labs).
2. **Frontend**: The React/Vite app can be deployed easily on **Vercel**. Connect your GitHub repository and it will auto-detect the Vite build.
3. **API Gateway**: The Node.js Express server can be deployed on a free tier service like **Render.com**.

> [!WARNING]
> **The Docker Worker Caveat**
> Running the C++ Docker worker (`worker-engine`) on free cloud tiers is extremely difficult. Serverless and PaaS providers (like Render or Heroku) restrict you from running nested Docker containers inside their infrastructure. 
> To run the execution engine in the cloud, you **must** deploy the `worker-engine` on a Virtual Private Server (VPS) that gives you root access to the Docker daemon (e.g., DigitalOcean Droplets, AWS EC2, or Hetzner).
