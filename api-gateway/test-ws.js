const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001/telemetry');
ws.on('open', () => {
  console.log('Connected to WS');
  // trigger a job to see if we get the message
  const { Queue } = require('bullmq');
  const q = new Queue('execution');
  q.add('run-code', { code: '#include <iostream>\nint main(){std::cout<<"WS Hello\\n";return 0;}' });
});
ws.on('message', (msg) => {
  console.log('Received:', msg.toString());
});
setTimeout(() => process.exit(0), 5000);
