const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

console.log('====================================================');
console.log('🌱 AgriTrace — Starting Full-Stack Development Services');
console.log('   Backend:  http://127.0.0.1:5000/api/v1 (FastAPI)');
console.log('   Docs:     http://127.0.0.1:5000/docs');
console.log('   Frontend: http://localhost:3000 (Next.js 14)');
console.log('====================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const pythonCmd = isWindows ? 'python' : 'python3';

const backend = spawn(pythonCmd, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '5000', '--reload'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: isWindows,
});

backend.on('error', (err) => {
  console.error('[AgriTrace Backend Error]:', err);
});

const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: isWindows,
});

frontend.on('error', (err) => {
  console.error('[AgriTrace Frontend Error]:', err);
});

const { execSync } = require('child_process');

function killProcess(proc) {
  if (!proc || !proc.pid) return;
  if (isWindows) {
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } catch {}
  } else {
    try {
      proc.kill('SIGTERM');
    } catch {}
  }
}

function cleanup() {
  console.log('\n🛑 Shutting down AgriTrace full-stack services...');
  killProcess(backend);
  killProcess(frontend);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

