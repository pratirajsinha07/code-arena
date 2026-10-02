const { Worker } = require('bullmq');
const Docker = require('dockerode');
const Redis = require('ioredis');
const tar = require('tar-stream');
require('dotenv').config();

const docker = new Docker(); // connects to local docker socket
const redisPub = new Redis({ host: '127.0.0.1', port: 6379 });

const activeStreams = new Map();
const activeContainers = new Map();
const inputSub = new Redis({ host: '127.0.0.1', port: 6379 });
inputSub.psubscribe('execution-input:*', 'execution-kill:*');
inputSub.on('pmessage', async (pattern, channel, message) => {
  const parts = channel.split(':');
  if (parts.length < 2) return;
  const jobId = parts[1];
  
  if (channel.startsWith('execution-kill:')) {
    const container = activeContainers.get(jobId);
    if (container) {
      console.log(`[Worker] Killing container for job ${jobId}`);
      try { await container.kill(); } catch (e) {}
    }
  } else if (channel.startsWith('execution-input:')) {
    const { data } = JSON.parse(message);
    const stream = activeStreams.get(jobId);
    if (stream) stream.write(data);
  }
});

const worker = new Worker('execution', async (job) => {
  const { code, language, roomId, stdin } = job.data;
  console.log(`[Worker] Processing job ${job.id} for room ${roomId || 'unknown'}`);

  let container;
  let stdoutData = '';
  let stderrData = '';
  let statsHistory = [];
  let statsInterval = null;

  try {
    container = await docker.createContainer({
      Image: 'codearena-runner',
      Cmd: ['sh', '-c', 'g++ /app/main.cpp -o /app/main && /app/main < /app/input.txt'],
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
    pack.entry({ name: 'main.cpp' }, code || '');
    pack.entry({ name: 'input.txt' }, stdin || '');
    pack.finalize();
    await container.putArchive(pack, { path: '/app' });

    const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true, hijack: true });
    activeStreams.set(job.id, stream);
    activeContainers.set(job.id, container);
    
    stream.on('data', (c) => {
      const chunk = c.toString('utf8');
      stdoutData += chunk;
      redisPub.publish(`execution-stream:${roomId}`, JSON.stringify({ jobId: job.id, type: 'stdout', chunk }));
    });
    
    await container.start();
    console.log('[Worker] Stream constructor:', stream.constructor.name);

    statsInterval = setInterval(async () => {
      try {
        const s = await container.stats({ stream: false });
        if (s && s.memory_stats && s.memory_stats.usage) {
          statsHistory.push(s.memory_stats.usage);
        }
      } catch (e) {}
    }, 200);

    const waitPromise = container.wait();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000));
    const result = await Promise.race([waitPromise, timeoutPromise]);

    if (result === 'timeout') {
      const msg = '\nExecution timed out (5s)';
      stderrData += msg;
      redisPub.publish(`execution-stream:${roomId}`, JSON.stringify({ jobId: job.id, type: 'stderr', chunk: msg }));
      await container.kill();
    }

  } catch (err) {
    const msg = `\nError: ${err.message}`;
    stderrData += msg;
    redisPub.publish(`execution-stream:${roomId}`, JSON.stringify({ jobId: job.id, type: 'stderr', chunk: msg }));
  } finally {
    activeStreams.delete(job.id);
    activeContainers.delete(job.id);
    if (statsInterval) clearInterval(statsInterval);
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (e) {}
    }
  }

  const payload = {
    jobId: job.id,
    stdout: stdoutData,
    stderr: stderrData,
    stats: statsHistory
  };

  await redisPub.publish(`execution-results:${roomId}`, JSON.stringify(payload));
  console.log(`[Worker] Published result for job ${job.id}`);
  
  return payload;
}, { connection: { host: '127.0.0.1', port: 6379 } });

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err);
});

console.log('Worker engine started. Listening for execution jobs...');
