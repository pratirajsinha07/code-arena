const Docker = require('dockerode');
const docker = new Docker();
const tar = require('tar-stream');

async function run() {
  const c = await docker.createContainer({
    Image: 'codearena-runner', 
    Cmd: ['sh', '-c', 'g++ /app/main.cpp -o /app/a.out && /app/a.out'], 
    WorkingDir: '/app',
    Tty: true, 
    OpenStdin: true, 
    StdinOnce: false,
    HostConfig: {
      Memory: 512 * 1024 * 1024,
      NetworkMode: 'none',
      PidsLimit: 64,
      AutoRemove: false
    }
  });
  
  const pack = tar.pack(); 
  pack.entry({ name: 'main.cpp' }, '#include <iostream>\nusing namespace std;\nint main() { int age; cout << "Enter: "; cin >> age; cout << "Got " << age; return 0; }'); 
  pack.finalize(); 
  await c.putArchive(pack, { path: '/app' }); 
  
  const s = await c.attach({stream: true, stdin: true, stdout: true, stderr: true, hijack: true}); 
  s.on('data', d => console.log(d.toString())); 
  
  await c.start(); 
  
  setInterval(async () => {
    try {
      await c.stats({ stream: false });
    } catch (e) {}
  }, 200);

  const waitPromise = c.wait();

  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 3000));
  
  const result = await Promise.race([waitPromise, timeoutPromise]);
  console.log('Result:', result);
  process.exit(0);
}

run();
