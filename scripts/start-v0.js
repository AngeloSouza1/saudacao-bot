import { execFileSync, spawn } from "node:child_process";
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

async function readBackendStatus(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${baseUrl}/api/status`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function isFrontendHealthy(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(baseUrl, {
      cache: "no-store",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function isBackendHealthy(status) {
  const phase = String(status?.whatsapp?.phase || "");
  const sender = String(status?.whatsapp?.sender || "");
  const qrAvailable = Boolean(status?.whatsapp?.qrAvailable);
  const lastError = String(status?.whatsapp?.lastError || "").toLowerCase();

  if (sender || qrAvailable) return true;
  if (["ready", "authenticated", "qr", "initializing"].includes(phase)) return true;
  if (lastError.includes("navigating frame was detached")) return false;
  if (phase === "error") return false;
  return Boolean(status);
}

function stopProcessOnPort(port) {
  const pids = new Set();

  try {
    const output = execFileSync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
      encoding: "utf8"
    }).trim();
    for (const pid of output.split(/\s+/).filter(Boolean)) {
      pids.add(pid);
    }
  } catch {
    // noop
  }

  if (!pids.size) {
    try {
      const output = execFileSync("ss", ["-ltnp"], {
        encoding: "utf8"
      });
      const pattern = new RegExp(`:${String(port)}\\b`);
      for (const line of output.split("\n")) {
        if (!pattern.test(line)) continue;
        for (const match of line.matchAll(/pid=(\d+)/g)) {
          if (match[1]) pids.add(match[1]);
        }
      }
    } catch {
      // noop
    }
  }

  const pidList = Array.from(pids);
  for (const pid of pidList) {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      // noop
    }
  }
  return pidList;
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
  const backendBaseUrl = process.env.BACKEND_API_BASE_URL || `http://${dashboardHost}:${backendPort}`;
  const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
  let backendInUse = await isPortInUse(backendPort, dashboardHost);
  let frontendInUse = await isPortInUse(frontendPort, "127.0.0.1");

  console.log("🚀 Iniciando Saudacao Bot (backend + frontend v0)...");
  console.log(`   - Backend/API: http://${dashboardHost}:${backendPort}`);
  console.log(`   - Frontend v0: http://127.0.0.1:${frontendPort}`);

  if (backendInUse) {
    const backendStatus = await readBackendStatus(backendBaseUrl);
    if (isBackendHealthy(backendStatus)) {
      console.log(`   - Backend já ativo na porta ${backendPort}. Reaproveitando instância existente.`);
    } else {
      const stoppedPids = stopProcessOnPort(backendPort);
      if (stoppedPids.length) {
        console.log(`   - Backend na porta ${backendPort} estava travado. Reiniciando instância (${stoppedPids.join(", ")}).`);
      } else {
        console.log(`   - Backend na porta ${backendPort} não respondeu corretamente. Iniciando nova instância.`);
      }
      backendInUse = false;
    }
  }

  if (!backendInUse) {
    startProcess("backend", "node", ["index.js"], {
      DASHBOARD_HOST: dashboardHost,
      DASHBOARD_PORT: backendPort
    });
  }

  if (frontendInUse) {
    const frontendHealthy = await isFrontendHealthy(frontendBaseUrl);
    if (frontendHealthy) {
      console.log(`   - Frontend já ativo na porta ${frontendPort}. Reaproveitando instância existente.`);
    } else {
      const stoppedPids = stopProcessOnPort(frontendPort);
      if (stoppedPids.length) {
        console.log(`   - Frontend na porta ${frontendPort} estava travado. Reiniciando instância (${stoppedPids.join(", ")}).`);
      } else {
        console.log(`   - Frontend na porta ${frontendPort} não respondeu corretamente. Iniciando nova instância.`);
      }
      frontendInUse = false;
    }
  }

  if (!frontendInUse) {
    startProcess("frontend-v0", npmCmd, ["--prefix", "frontend-v0", "run", "dev", "--", "-p", frontendPort], {
      BACKEND_API_BASE_URL: backendBaseUrl
    });
  }

  if (!children.length) {
    console.log("✅ Nada para iniciar. Backend e frontend já estavam em execução.");
  }
}

await main();
