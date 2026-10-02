const Redis = require('ioredis');
const { Queue } = require('bullmq');

const q = new Queue('execution');
const r = new Redis();
r.subscribe('execution-stream', 'execution-results');
r.on('message', (c, m) => {
  console.log(`[${c}]`, m);
});

q.add('run-code', { 
  code: '#include <iostream>\nusing namespace std;\nint main() { int age; cout << "Enter: "; cin >> age; cout << "Got " << age; return 0; }' 
}).then(() => console.log('Job queued. Waiting 5s...'));

setTimeout(() => process.exit(0), 5000);
