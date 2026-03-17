import { spawn } from "node:child_process";

const backendPort = String(process.env.DASHBOARD_PORT || "3001");
const frontendPort = String(process.env.FRONTEND_PORT || "3000");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let shuttingDown = false;
const children = [];

function startProcess(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const reason = signal ? `signal ${signal}` : `code ${String(code ?? 0)}`;
    console.error(`❌ Processo "${label}" finalizou (${reason}). Encerrando os demais...`);
    shutdown();
    process.exit(typeof code === "number" ? code : 1);
  });

  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  shutdown();
  process.exit(0);
});

console.log("🚀 Iniciando Saudacao Bot (backend + frontend v0)...");
console.log(`   - Backend/API: http://127.0.0.1:${backendPort}`);
console.log(`   - Frontend v0: http://127.0.0.1:${frontendPort}`);

startProcess("backend", "node", ["index.js"], {
  DASHBOARD_HOST: process.env.DASHBOARD_HOST || "127.0.0.1",
  DASHBOARD_PORT: backendPort
});

startProcess("frontend-v0", npmCmd, ["--prefix", "frontend-v0", "run", "dev", "--", "-p", frontendPort], {
  BACKEND_API_BASE_URL: process.env.BACKEND_API_BASE_URL || `http://127.0.0.1:${backendPort}`
});
