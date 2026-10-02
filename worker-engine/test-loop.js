const { Queue } = require('bullmq');
const q = new Queue('execution');
q.add('run-code', { 
  code: '#include <iostream>\n#include <string>\nint main() { std::string s; std::cout << "Loop start\\n"; while(std::cin >> s) { std::cout << "Got: " << s << "\\n"; } std::cout << "Loop end\\n"; return 0; }' 
}).then(() => console.log('queued'));
setTimeout(() => process.exit(0), 3000);
