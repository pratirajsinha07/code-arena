const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('WebSocket server');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  
  let role = 'viewer'; // Default to viewer if no token
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      role = decoded.role || 'viewer';
    } catch (e) {
      console.log('Invalid token, disconnecting.');
      ws.close(1008, 'Invalid token');
      return;
    }
  }

  if (role === 'viewer') {
    console.log('Viewer connected, dropping incoming messages.');
    const originalOn = ws.on.bind(ws);
    ws.on = (event, listener) => {
      if (event === 'message') {
        const wrappedListener = (message) => {
          // Drop incoming messages for viewer
        };
        return originalOn(event, wrappedListener);
      }
      return originalOn(event, listener);
    };
  } else {
    console.log('Editor connected.');
  }

  setupWSConnection(ws, req);
});

const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
  console.log(`Yjs WebSocket server running on port ${PORT}`);
});
