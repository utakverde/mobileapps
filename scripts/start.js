const net = require('net');
const { spawn } = require('child_process');

const preferredPorts = [];
const envPort = Number.parseInt(process.env.EXPO_PORT || '', 10);

if (Number.isInteger(envPort) && envPort > 0) {
  preferredPorts.push(envPort);
}

for (let port = 8081; port <= 8090; port += 1) {
  if (!preferredPorts.includes(port)) {
    preferredPorts.push(port);
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findPort() {
  for (const port of preferredPorts) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  return preferredPorts[0] || 8081;
}

async function main() {
  const port = await findPort();
  const expoCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const expoArgs = ['expo', 'start', '--port', String(port), ...process.argv.slice(2)];

  console.log(`Starting Expo on port ${port}...`);

  const child = spawn(expoCmd, expoArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      EXPO_PORT: String(port),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
