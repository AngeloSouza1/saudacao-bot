import { spawn } from "node:child_process";
import net from "node:net";

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

function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finalize = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));
    socket.connect(Number(port), host);
  });
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

async function main() {
  const dashboardHost = process.env.DASHBOARD_HOST || "127.0.0.1";
  const backendInUse = await isPortInUse(backendPort, dashboardHost);
  const frontendInUse = await isPortInUse(frontendPort, "127.0.0.1");

  console.log("🚀 Iniciando Saudacao Bot (backend + frontend v0)...");
  console.log(`   - Backend/API: http://${dashboardHost}:${backendPort}`);
  console.log(`   - Frontend v0: http://127.0.0.1:${frontendPort}`);

  if (backendInUse) {
    console.log(`   - Backend já ativo na porta ${backendPort}. Reaproveitando instância existente.`);
  } else {
    startProcess("backend", "node", ["index.js"], {
      DASHBOARD_HOST: dashboardHost,
      DASHBOARD_PORT: backendPort
    });
  }

  if (frontendInUse) {
    console.log(`   - Frontend já ativo na porta ${frontendPort}. Reaproveitando instância existente.`);
  } else {
    startProcess("frontend-v0", npmCmd, ["--prefix", "frontend-v0", "run", "dev", "--", "-p", frontendPort], {
      BACKEND_API_BASE_URL: process.env.BACKEND_API_BASE_URL || `http://${dashboardHost}:${backendPort}`
    });
  }

  if (!children.length) {
    console.log("✅ Nada para iniciar. Backend e frontend já estavam em execução.");
  }
}

await main();
