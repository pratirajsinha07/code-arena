const Redis = require('ioredis');
const { Queue } = require('bullmq');

const q = new Queue('execution');
const r = new Redis();
r.subscribe('execution-stream', 'execution-results');
r.on('message', (c, m) => {
  console.log(`[${c}]`, m);
});

q.add('run-code', { 
  code: '#include <iostream>\n#include <string>\nint main() { std::string s; std::cout << "Loop start\\n"; while(std::cin >> s) { std::cout << "Got: " << s << "\\n"; } std::cout << "Loop end\\n"; return 0; }' 
}).then(() => console.log('Job queued. Waiting 5s...'));

setTimeout(() => process.exit(0), 5000);
