import http from "http";
import net from "net";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import { dashboardHeroHtml, dashboardMainShellHtml } from "./dashboard/dashboard-shell.js";
import { dashboardStaticHtml } from "./dashboard/dashboard-static.js";
import {
  cancelActiveCycle,
  clearCompletedCycles,
  createNewCycle,
  refreshActiveCyclePending,
  getAgendaEditorJson,
  getDashboardState,
  getGroups,
  registerAbsence,
  reconnectWhatsApp,
  replaceEffectiveAluno,
  revertEffectiveItem,
  runNow,
  runNowForced,
  runTest,
  sendCustomMessageToTarget,
  sendAgendaListToDestination,
  swapPendingStudents,
  validateDestinationPassword,
  validateLockPassword,
  updateAgendaEditorJson,
  updateConfig,
  updateState,
  updateSettings
} from "./bot.js";

dotenv.config();

const PORT = Number(process.env.PORT || process.env.DASHBOARD_PORT || 3001);
const HOST = process.env.DASHBOARD_HOST || "0.0.0.0";
const DASHBOARD_AUTH_USER = String(process.env.DASHBOARD_AUTH_USER || "admin").trim();
const DASHBOARD_AUTH_PASSWORD = String(process.env.DASHBOARD_AUTH_PASSWORD || "").trim();
let apiSendNowInFlight = false;
let apiSendNowForcedInFlight = false;
let apiSendNowLastAt = 0;
let apiSendNowForcedLastAt = 0;
const API_MANUAL_SEND_COOLDOWN_MS = 10000;
let apiAnyManualSendInFlight = false;
let apiAnyManualSendLastAt = 0;
const DASHBOARD_CSS = readFileSync(new URL("./dashboard/dashboard.css", import.meta.url), "utf8");
const DASHBOARD_CLIENT_JS = readFileSync(new URL("./dashboard/dashboard-client.browser.js", import.meta.url), "utf8");

function isDashboardAuthEnabled() {
  return Boolean(DASHBOARD_AUTH_PASSWORD);
}

function isAuthorizedRequest(req) {
  if (!isDashboardAuthEnabled()) return true;
  const authHeader = String(req.headers?.authorization || "").trim();
  if (!authHeader.startsWith("Basic ")) return false;
  const token = authHeader.slice(6).trim();
  if (!token) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return user === DASHBOARD_AUTH_USER && pass === DASHBOARD_AUTH_PASSWORD;
}

function requireDashboardAuth(req, res) {
  if (isAuthorizedRequest(req)) return true;
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Saudacao Bot", charset="UTF-8"',
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
  return false;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(html);
}

function sendCss(res, css) {
  res.writeHead(200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(css);
}

function sendJs(res, script) {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(script);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function pageHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Saudação Bot</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231f5b3a'/%3E%3Ctext x='50%25' y='54%25' text-anchor='middle' font-family='Georgia' font-size='28' fill='%23e9f7eb' font-weight='700'%3ESB%3C/text%3E%3C/svg%3E">
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            saudacao: {
              50: "#f6fbf7",
              100: "#e5f3e8",
              200: "#c9e6d0",
              300: "#9fd0ac",
              400: "#6cb07e",
              500: "#3f8a58",
              600: "#2f6d46",
              700: "#255539",
              800: "#1d432f",
              900: "#163126"
            },
            sun: {
              100: "#fff4d9",
              300: "#f6d88d"
            }
          },
          boxShadow: {
            "soft-panel": "0 22px 56px rgba(18, 45, 31, 0.12)"
          },
          borderRadius: {
            "4xl": "2rem"
          }
        }
      }
    };
  </script>
  <link rel="stylesheet" href="/dashboard.css">
</head>
<body>
  <div class="wrap">
    ${dashboardHeroHtml()}
    ${dashboardMainShellHtml()}
  </div>

  ${dashboardStaticHtml()}

  <script type="module" src="/dashboard-client.js"></script>
</body>
</html>`;
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/status") {
      sendJson(res, 200, getDashboardState());
      return true;
    }

    if (req.method === "GET" && pathname === "/api/groups") {
      try {
        const groups = await getGroups();
        sendJson(res, 200, { groups, waiting: false });
      } catch (error) {
        sendJson(res, 200, {
          groups: [],
          waiting: true,
          message: String(error?.message || "erro_ao_carregar_grupos")
        });
      }
      return true;
    }

    if (req.method === "POST" && pathname === "/api/send-test") {
      await runTest();
      sendJson(res, 200, { ok: true, message: "Teste enviado." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/send-agenda-list") {
      await sendAgendaListToDestination();
      sendJson(res, 200, { ok: true, message: "Lista de agendamentos enviada pelo WhatsApp." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/send-custom-message") {
      const body = await readBody(req);
      await sendCustomMessageToTarget(body?.targetType, body?.targetValue, body?.template);
      sendJson(res, 200, { ok: true, message: "Mensagem personalizada enviada com sucesso." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/send-now") {
      const now = Date.now();
      if (apiAnyManualSendInFlight) {
        sendJson(res, 429, {
          ok: false,
          error: "Já existe um envio manual em andamento. Aguarde finalizar."
        });
        return true;
      }
      if (now - apiAnyManualSendLastAt < API_MANUAL_SEND_COOLDOWN_MS) {
        sendJson(res, 429, {
          ok: false,
          error: "Envio manual já executado há instantes. Aguarde alguns segundos."
        });
        return true;
      }
      if (apiSendNowInFlight) {
        sendJson(res, 429, {
          ok: false,
          error: "Envio manual em andamento. Aguarde finalizar."
        });
        return true;
      }
      if (now - apiSendNowLastAt < API_MANUAL_SEND_COOLDOWN_MS) {
        sendJson(res, 429, {
          ok: false,
          error: "Envio já executado há instantes. Aguarde alguns segundos."
        });
        return true;
      }
      const state = getDashboardState();
      if (!state?.cycle?.active) {
        sendJson(res, 400, {
          ok: false,
          error: "Sem ciclo ativo. Inicie um novo ciclo para enviar agora."
        });
        return true;
      }
      apiSendNowInFlight = true;
      apiAnyManualSendInFlight = true;
      try {
        const result = await runNow();
        apiSendNowLastAt = Date.now();
        apiAnyManualSendLastAt = apiSendNowLastAt;
        if (result) {
          sendJson(res, 200, { ok: true, sent: true, message: "Envio imediato executado." });
          return true;
        }

        const refreshed = getDashboardState();
        const reason = String(refreshed?.lastRun?.reason || "");
        const reasonMap = {
          fora_de_dia_util: "Nenhum envio: hoje não é dia útil.",
          sem_aula_no_dia: "Nenhum envio: não há aula para hoje na agenda."
        };
        sendJson(res, 200, {
          ok: true,
          sent: false,
          message: reasonMap[reason] || "Nenhum envio imediato foi realizado."
        });
      } finally {
        apiSendNowInFlight = false;
        apiAnyManualSendInFlight = false;
      }
      return true;
    }

    if (req.method === "POST" && pathname === "/api/send-now-forced") {
      const now = Date.now();
      if (apiAnyManualSendInFlight) {
        sendJson(res, 429, {
          ok: false,
          error: "Já existe um envio manual em andamento. Aguarde finalizar."
        });
        return true;
      }
      if (now - apiAnyManualSendLastAt < API_MANUAL_SEND_COOLDOWN_MS) {
        sendJson(res, 429, {
          ok: false,
          error: "Envio manual já executado há instantes. Aguarde alguns segundos."
        });
        return true;
      }
      if (apiSendNowForcedInFlight) {
        sendJson(res, 429, {
          ok: false,
          error: "Envio forçado em andamento. Aguarde finalizar."
        });
        return true;
      }
      if (now - apiSendNowForcedLastAt < API_MANUAL_SEND_COOLDOWN_MS) {
        sendJson(res, 429, {
          ok: false,
          error: "Envio forçado já executado há instantes. Aguarde alguns segundos."
        });
        return true;
      }
      const state = getDashboardState();
      if (!state?.cycle?.active) {
        sendJson(res, 400, {
          ok: false,
          error: "Sem ciclo ativo. Inicie um novo ciclo para envio forçado."
        });
        return true;
      }
      apiSendNowForcedInFlight = true;
      apiAnyManualSendInFlight = true;
      try {
        const result = await runNowForced();
        apiSendNowForcedLastAt = Date.now();
        apiAnyManualSendLastAt = apiSendNowForcedLastAt;
        if (result) {
          sendJson(res, 200, { ok: true, sent: true, message: "Envio forçado executado." });
          return true;
        }
        const refreshed = getDashboardState();
        const reason = String(refreshed?.lastRun?.reason || "");
        const reasonMap = {
          fora_de_dia_util: "Nenhum envio: hoje não é dia útil.",
          sem_aula_no_dia: "Nenhum envio: não há aula para hoje na agenda."
        };
        sendJson(res, 200, {
          ok: true,
          sent: false,
          message: reasonMap[reason] || "Nenhum envio forçado foi realizado."
        });
      } finally {
        apiSendNowForcedInFlight = false;
        apiAnyManualSendInFlight = false;
      }
      return true;
    }

    if (req.method === "POST" && pathname === "/api/whatsapp/reconnect") {
      await reconnectWhatsApp();
      sendJson(res, 200, {
        ok: true,
        message: "Reconexão solicitada. Se necessário, escaneie o QR Code."
      });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/settings") {
      const body = await readBody(req);
      updateSettings(body);
      sendJson(res, 200, { ok: true, message: "Destino salvo." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/config") {
      const body = await readBody(req);
      updateConfig(body);
      sendJson(res, 200, { ok: true, message: "Configuração salva e agendamento recarregado." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/unlock") {
      const body = await readBody(req);
      const result = validateLockPassword(body?.password);
      if (!result.ok) {
        sendJson(res, 401, { ok: false, error: "Senha incorreta." });
        return true;
      }
      sendJson(res, 200, { ok: true, configured: result.configured });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/unlock-destination") {
      const body = await readBody(req);
      const result = validateDestinationPassword(body?.password);
      if (!result.ok) {
        sendJson(res, 401, { ok: false, error: "Senha incorreta." });
        return true;
      }
      sendJson(res, 200, { ok: true, configured: result.configured });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/state") {
      const body = await readBody(req);
      const state = updateState(body);
      sendJson(res, 200, { ok: true, state, message: "Estado inicial dos envios atualizado." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/cycle/new") {
      const body = await readBody(req);
      const cycle = createNewCycle(body?.name);
      sendJson(res, 200, { ok: true, cycle, message: "Novo ciclo criado com sucesso." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/cycle/cancel") {
      const cycle = cancelActiveCycle({ reason: "manual", clearQueue: true });
      sendJson(res, 200, { ok: true, cycle, message: "Ciclo ativo cancelado com sucesso." });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/cycle/refresh-pending") {
      const result = refreshActiveCyclePending();
      sendJson(res, 200, {
        ok: true,
        ...result,
        message: "Ciclo atual atualizado somente nos itens pendentes."
      });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/cycle/clear-completed") {
      const result = clearCompletedCycles();
      sendJson(res, 200, {
        ok: true,
        ...result,
        message: result.removed > 0
          ? `${result.removed} ciclo(s) concluído(s) removido(s) do histórico.`
          : "Nenhum ciclo concluído para remover."
      });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/absence") {
      const body = await readBody(req);
      const aluno = String(body?.aluno || "").trim();
      const result = registerAbsence(aluno, body?.pendingIndex);
      sendJson(res, 200, {
        ok: true,
        ...result,
        message: result.moved
          ? "Ausência registrada. O aluno foi movido para o fim da fila."
          : "Ausência registrada. O aluno já está no fim da fila."
      });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/revert-effective") {
      const body = await readBody(req);
      const aluno = String(body?.aluno || "").trim();
      const itemKey = String(body?.itemKey || "").trim();
      const performedBy = String(body?.performedBy || "").trim();
      const result = performedBy
        ? replaceEffectiveAluno(aluno, itemKey, performedBy)
        : revertEffectiveItem(aluno, itemKey);
      sendJson(res, 200, {
        ok: true,
        ...result,
        message: performedBy
          ? "Efetivação corrigida. O aluno previsto voltou para o fim da fila e a data foi mantida como efetivada."
          : "Efetivação revertida. O aluno foi movido para o fim da fila."
      });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/swap-pending") {
      const body = await readBody(req);
      const result = swapPendingStudents(
        body?.fromPendingIndex,
        body?.toPendingIndex,
        body?.fromAluno,
        body?.toAluno
      );
      sendJson(res, 200, {
        ok: true,
        ...result,
        message: result.changed
          ? "Posição dos alunos pendentes atualizada."
          : "Nenhuma alteração de posição foi necessária."
      });
      return true;
    }

    if (req.method === "GET" && pathname === "/api/agenda-json") {
      const payload = getAgendaEditorJson();
      sendJson(res, 200, payload);
      return true;
    }

    if (req.method === "POST" && pathname === "/api/agenda-json") {
      const body = await readBody(req);
      const payload = updateAgendaEditorJson(body);
      sendJson(res, 200, { ok: true, message: "JSON salvo e agendamento recarregado.", ...payload });
      return true;
    }
  } catch (error) {
    sendJson(res, 500, { error: String(error.message || error) });
    return true;
  }

  return false;
}

export async function startDashboard() {
  const server = createDashboardServer();
  return await listenDashboardServer(server);
}

function createDashboardServer() {
  return http.createServer(async (req, res) => {
    if (!requireDashboardAuth(req, res)) {
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (await handleApi(req, res, url.pathname)) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/dashboard.css") {
      sendCss(res, DASHBOARD_CSS);
      return;
    }

    if (req.method === "GET" && url.pathname === "/dashboard-client.js") {
      sendJs(res, DASHBOARD_CLIENT_JS);
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      sendHtml(res, pageHtml());
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });
}

function normalizeDashboardListenError(error) {
  if (String(error?.code || "") === "EADDRINUSE") {
    return new Error(
      `A porta ${PORT} já está em uso. Encerre a instância anterior do dashboard antes de iniciar outra.`
    );
  }
  return error instanceof Error ? error : new Error(String(error || "Falha ao subir dashboard."));
}

function listenDashboardServer(server) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      const normalized = normalizeDashboardListenError(error);
      console.error(`❌ Falha ao subir dashboard em http://${HOST}:${PORT}:`, normalized.message);
      reject(normalized);
    };

    server.once("error", onError);
    server.listen(PORT, HOST, () => {
      server.off("error", onError);
      server.on("error", (error) => {
        const normalized = normalizeDashboardListenError(error);
        console.error(`❌ Erro no dashboard em http://${HOST}:${PORT}:`, normalized.message);
      });
      console.log(`🖥️ Dashboard disponível em http://${HOST}:${PORT}`);
      resolve(server);
    });
  });
}

export async function assertDashboardPortAvailable() {
  const tester = net.createServer();
  return await new Promise((resolve, reject) => {
    const finalize = (error = null) => {
      tester.removeAllListeners();
      if (error) {
        reject(normalizeDashboardListenError(error));
        return;
      }
      resolve(true);
    };

    tester.once("error", (error) => finalize(error));
    tester.once("listening", () => {
      tester.close((closeError) => finalize(closeError));
    });
    tester.listen(PORT, HOST);
  });
}
