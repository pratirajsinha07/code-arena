const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Queue } = require('bullmq');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/codearena')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const executionQueue = new Queue('execution', { connection: { host: '127.0.0.1', port: 6379 } });

const bcrypt = require('bcrypt');

const User = require('./models/User');

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Validate lengths manually to send a nice 400 error before Mongoose validation
    if (!username || username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    
    const user = await User.create({ username, password, role: role || 'viewer' });
    
    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sign up', details: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'Username does not exist' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });
    
    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log in', details: err.message });
  }
});

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

app.delete('/api/users/me', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    await User.findByIdAndDelete(req.user.userId);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account', details: err.message });
  }
});

const Room = require('./models/Room');

app.post('/api/rooms', requireAuth, async (req, res) => {
  try {
    const roomId = Math.random().toString(36).substring(2, 8);
    const room = await Room.create({ roomId, hostId: req.user.userId });
    res.json({ room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms/:roomId', requireAuth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.post('/api/execute', requireAuth, async (req, res) => {
  console.log('[API] Received execute request');
  const { code, language, stdin, roomId } = req.body;
  if (!code || !roomId) {
    console.log('[API] Missing code or roomId in request');
    return res.status(400).json({ error: 'Code and roomId are required' });
  }
  try {
    const job = await executionQueue.add('run-code', { code, language: language || 'cpp', stdin: stdin || '', roomId });
    console.log(`[API] Queued job ${job.id} for room ${roomId}`);
    res.json({ jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to queue job', details: err.message });
  }
});

const redisPub = new Redis({ host: '127.0.0.1', port: 6379 });
app.post('/api/execute/stop', requireAuth, async (req, res) => {
  const { jobId, roomId } = req.body;
  if (!jobId || !roomId) return res.status(400).json({ error: 'jobId and roomId are required' });
  await redisPub.publish(`execution-kill:${jobId}`, JSON.stringify({ roomId }));
  res.json({ success: true });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const match = request.url.match(/^\/rooms\/([a-zA-Z0-9-]+)$/);
  if (match) {
    const roomId = match[1];
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.roomId = roomId;
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});


const redisSub = new Redis({ host: '127.0.0.1', port: 6379 });

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      
      // Handle terminal input
      if (parsed.type === 'input' && parsed.jobId) {
        redisPub.publish(`execution-input:${parsed.jobId}`, JSON.stringify({ data: parsed.data }));
      }
      
      // Handle custom host permission events (role changes)
      if (parsed.type === 'role-change') {
        // Broadcast this to all clients in the same room
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
            client.send(JSON.stringify({
              channel: `room-events:${ws.roomId}`,
              message: { type: 'role-change', targetUser: parsed.targetUser, newRole: parsed.newRole }
            }));
          }
        });
      }
    } catch (e) {}
  });
});

redisSub.psubscribe('execution-stream:*', 'execution-results:*', (err) => {
  if (err) console.error('Failed to psubscribe', err);
});
redisSub.on('pmessage', (pattern, channel, message) => {
  // Extract roomId from channel name: execution-stream:roomId
  const parts = channel.split(':');
  if (parts.length < 2) return;
  const channelType = parts[0];
  const roomId = parts[1];
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
      client.send(JSON.stringify({ channel: channelType, message: JSON.parse(message) }));
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`API Gateway & Telemetry WS running on port ${PORT}`));
