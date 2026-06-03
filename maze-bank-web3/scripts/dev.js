const net = require("net");
const { spawn } = require("child_process");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";

const commonEnv = {
  ...process.env,
  BROWSER: "none",
  HARDHAT_RPC_URL: "http://127.0.0.1:8545",
};

function startPersistent(command, args, label, extraEnv = {}) {
  const child = spawn(command, args, {
    env: { ...commonEnv, ...extraEnv },
    shell: useShell,
    stdio: ["ignore", "pipe", "pipe"],
  });

  pipeChildOutput(child, label);

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
}

function runAndWait(command, args, label, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...commonEnv, ...extraEnv },
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    pipeChildOutput(child, label);

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`${label} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function pipeChildOutput(child, label) {
  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const socket = net.connect(port, host);

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function main() {
  const hardhatNode = startPersistent(npmCommand, ["exec", "--", "hardhat", "node"], "hardhat node");

  await waitForPort(8545);
  await runAndWait(
    npmCommand,
    ["exec", "--", "hardhat", "run", "scripts/deploy.js", "--network", "localhost"],
    "deploy"
  );

  const backend = startPersistent(npmCommand, ["run", "backend"], "backend");
  const frontend = startPersistent(npmCommand, ["start"], "frontend");

  const shutdown = () => {
    backend.kill();
    frontend.kill();
    hardhatNode.kill();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
