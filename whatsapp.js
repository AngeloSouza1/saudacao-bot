import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import sharp from "sharp";
import whatsappWeb from "whatsapp-web.js";

dotenv.config();

const { Client, LocalAuth, MessageMedia } = whatsappWeb;
const dataRootDir = path.resolve(process.env.SAUDACAO_DATA_DIR || process.cwd());
const DEFAULT_SESSION_KEY = "system";
const sessionRegistry = new Map();

function createInitialStatus() {
  return {
    phase: "idle",
    phaseStartedAt: 0,
    transportState: "",
    sender: "",
    userName: "",
    userAvatar: "",
    lastError: "",
    qrAvailable: false,
    qrText: "",
    qrImageDataUrl: ""
  };
}

function normalizeSessionKey(rawValue) {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || DEFAULT_SESSION_KEY;
}

function resolveSessionKey(options = {}) {
  return normalizeSessionKey(options?.username || options?.sessionKey || DEFAULT_SESSION_KEY);
}

function getSessionContext(options = {}) {
  const sessionKey = resolveSessionKey(options);
  if (!sessionRegistry.has(sessionKey)) {
    sessionRegistry.set(sessionKey, {
      key: sessionKey,
      clientPromise: undefined,
      currentClient: undefined,
      recoveryPromise: undefined,
      lastRecoveryAt: 0,
      authenticatedLogged: false,
      readyLogged: false,
      status: createInitialStatus()
    });
  }
  return sessionRegistry.get(sessionKey);
}

function isHeadlessMode() {
  return process.env.WHATSAPP_HEADLESS !== "false";
}

function getBaseSessionName() {
  return process.env.WHATSAPP_SESSION_NAME || "saudacao-bot";
}

function getClientId(sessionKey) {
  const base = getBaseSessionName();
  return sessionKey === DEFAULT_SESSION_KEY ? base : `${base}-${sessionKey}`;
}

function getSessionDir(options = {}) {
  const sessionKey = resolveSessionKey(options);
  return path.join(dataRootDir, ".wwebjs_auth", `session-${getClientId(sessionKey)}`);
}

function hasSavedSession(options = {}) {
  return fs.existsSync(getSessionDir(options));
}

function clearSavedSession(options = {}) {
  const sessionKey = resolveSessionKey(options);
  const sessionDir = getSessionDir({ sessionKey });

  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    console.log(`🧹 Sessão local removida (${sessionKey}): ${sessionDir}`);
  }
}

function clearSessionBrowserLocks(options = {}) {
  const sessionDir = getSessionDir(options);
  const lockPaths = [
    path.join(sessionDir, "DevToolsActivePort"),
    path.join(sessionDir, "SingletonLock"),
    path.join(sessionDir, "SingletonSocket"),
    path.join(sessionDir, "SingletonCookie"),
    path.join(sessionDir, "Default", "LOCK")
  ];

  let removedAny = false;
  for (const lockPath of lockPaths) {
    try {
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        removedAny = true;
      }
    } catch {
      // Ignora falhas de limpeza pontuais.
    }
  }

  if (removedAny) {
    console.warn(`🧹 Locks temporários do navegador removidos em ${sessionDir}`);
  }
}

function normalizePhoneNumber(number) {
  return String(number || "").replace(/\D/g, "");
}

function toChatId(number) {
  const normalized = normalizePhoneNumber(number);
  if (!normalized) {
    throw new Error("Defina WHATSAPP_TO com um número válido.");
  }

  return `${normalized}@c.us`;
}

function fromChatId(chatId) {
  return String(chatId || "").replace(/@c\.us$/, "");
}

async function refreshCurrentUserProfile(client, context) {
  const session = context || getSessionContext();
  const status = session.status;
  const wid = String(client?.info?.wid?._serialized || "").trim();
  const sender = fromChatId(wid);
  status.sender = sender;

  const displayName = String(
    client?.info?.pushname ||
    client?.info?.me?.pushname ||
    client?.info?.me?.name ||
    ""
  ).trim();
  status.userName = displayName || sender || "";

  if (!wid) {
    status.userAvatar = "";
    return;
  }

  let avatarUrl = "";

  try {
    avatarUrl = String(await client.getProfilePicUrl(wid) || "").trim();
  } catch {
    avatarUrl = "";
  }

  if (!avatarUrl) {
    try {
      const meContact = await client.getContactById(wid);
      if (meContact && typeof meContact.getProfilePicUrl === "function") {
        avatarUrl = String(await meContact.getProfilePicUrl() || "").trim();
      }
    } catch {
      avatarUrl = "";
    }
  }

  status.userAvatar = avatarUrl;
}

function normalizeGroupId(groupId) {
  const value = String(groupId || "").trim();
  if (!value) {
    throw new Error("Defina um grupo válido.");
  }

  return value.endsWith("@g.us") ? value : `${value}@g.us`;
}

function ackLabel(ack) {
  const labels = {
    "-1": "erro",
    "0": "pendente",
    "1": "enviado_ao_servidor",
    "2": "entregue_ao_destino",
    "3": "lida",
    "4": "reproduzida"
  };

  return labels[String(ack)] || `desconhecido_${ack}`;
}

function waitForAck(client, message, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const messageId = message.id?._serialized;

    if (!messageId) {
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => {
      client.removeListener("message_ack", onAck);
      resolve(null);
    }, timeoutMs);

    function onAck(msg, ack) {
      const currentId = msg?.id?._serialized;
      if (currentId !== messageId) {
        return;
      }

      clearTimeout(timeout);
      client.removeListener("message_ack", onAck);
      resolve(ack);
    }

    client.on("message_ack", onAck);
  });
}

function detectChromeExecutablePath() {
  const explicit = String(process.env.PUPPETEER_EXECUTABLE_PATH || "").trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const directCandidates = [
    path.resolve(".cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome"),
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome",
    "/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome"
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const roots = [
    path.resolve(".cache/puppeteer/chrome"),
    "/opt/render/project/src/.cache/puppeteer/chrome",
    "/opt/render/.cache/puppeteer/chrome"
  ];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let dirs = [];
    try {
      dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      dirs = [];
    }
    dirs.sort().reverse();
    for (const dir of dirs) {
      const candidate = path.join(root, dir, "chrome-linux64", "chrome");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return "";
}

function createClient(options = {}) {
  const session = getSessionContext(options);
  const sessionKey = session.key;
  const status = session.status;
  const sessionDir = getSessionDir({ sessionKey });
  const savedSession = hasSavedSession({ sessionKey });
  const executablePath = detectChromeExecutablePath();

  console.log(`🔄 Inicializando WhatsApp Web (sessão: ${getClientId(sessionKey)})`);
  console.log(`🖥️ Navegador interno em modo ${isHeadlessMode() ? "oculto" : "visível"}.`);
  console.log(
    savedSession
      ? `💾 Sessão local encontrada em ${sessionDir}. Vou tentar conectar sem QR.`
      : "📭 Nenhuma sessão local encontrada. Será necessário escanear o QR Code."
  );
  if (executablePath) {
    console.log(`🌐 Chrome detectado em: ${executablePath}`);
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: getClientId(sessionKey),
      dataPath: path.join(dataRootDir, ".wwebjs_auth")
    }),
    puppeteer: {
      headless: isHeadlessMode(),
      ...(executablePath ? { executablePath } : {}),
      protocolTimeout: 120000,
      timeout: 120000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check"
      ]
    }
  });

  client.on("qr", (qr) => {
    session.authenticatedLogged = false;
    session.readyLogged = false;
    status.phase = "qr";
    status.phaseStartedAt = Date.now();
    status.sender = "";
    status.userName = "";
    status.userAvatar = "";
    status.qrAvailable = true;
    status.qrText = String(qr || "");
    status.qrImageDataUrl = "";
    console.log("📱 Escaneie o QR Code abaixo no WhatsApp Web:");
    qrcode.generate(qr, { small: true });

    QRCode.toDataURL(status.qrText, {
      width: 320,
      margin: 1
    })
      .then((dataUrl) => {
        if (status.phase === "qr") {
          status.qrImageDataUrl = dataUrl;
        }
      })
      .catch((error) => {
        console.warn("⚠️ Não foi possível gerar QR em imagem para o dashboard:", error?.message || error);
      });
  });

  client.on("loading_screen", (percent, message) => {
    console.log(`⏳ Carregando WhatsApp Web: ${percent}% ${message || ""}`.trim());
  });

  client.on("ready", async () => {
    status.phase = "ready";
    status.phaseStartedAt = Date.now();
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    status.lastError = "";
    await refreshCurrentUserProfile(client, session);
    if (!session.readyLogged) {
      console.log(`✅ WhatsApp Web conectado (${sessionKey}).`);
      session.readyLogged = true;
    }
  });

  client.on("authenticated", () => {
    status.phase = "authenticated";
    status.phaseStartedAt = Date.now();
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    status.lastError = "";
    status.userName = "";
    status.userAvatar = "";
    if (!session.authenticatedLogged) {
      console.log(`🔐 Sessão autenticada (${sessionKey}).`);
      session.authenticatedLogged = true;
    }
  });

  client.on("auth_failure", (message) => {
    status.phase = "auth_failure";
    status.phaseStartedAt = Date.now();
    status.lastError = String(message || "");
    status.sender = "";
    status.userName = "";
    status.userAvatar = "";
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    console.error(`❌ Falha de autenticação do WhatsApp Web (${sessionKey}):`, message);
  });

  client.on("change_state", (state) => {
    status.transportState = String(state || "");
    if (!["ready", "authenticated"].includes(String(status.phase || ""))) {
      status.phase = `state:${state}`;
      status.phaseStartedAt = Date.now();
    }
    console.log(`ℹ️ Estado do cliente (${sessionKey}): ${state}`);
  });

  client.on("disconnected", (reason) => {
    status.phase = "disconnected";
    status.phaseStartedAt = Date.now();
    status.lastError = String(reason || "");
    status.sender = "";
    status.userName = "";
    status.userAvatar = "";
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    console.warn(`⚠️ WhatsApp Web desconectado (${sessionKey}):`, reason);
    session.clientPromise = undefined;
    session.currentClient = undefined;
    session.authenticatedLogged = false;
    session.readyLogged = false;
  });

  return client;
}

export async function initWhatsApp(options = {}) {
  const session = getSessionContext(options);
  const sessionKey = session.key;
  const status = session.status;
  const allowBrowserLockRetry = options?.allowBrowserLockRetry !== false;
  const allowBootstrapRetry = options?.allowBootstrapRetry !== false;

  if (!session.clientPromise) {
    status.phase = "initializing";
    status.phaseStartedAt = Date.now();
    status.lastError = "";
    const client = createClient({ sessionKey });
    session.currentClient = client;
    session.clientPromise = new Promise((resolve, reject) => {
      client.once("ready", () => resolve(client));
      client.once("auth_failure", (error) => reject(new Error(error)));
      client.initialize().catch(reject);
    });
  } else {
    console.log(`♻️ Reaproveitando cliente WhatsApp Web já inicializado (${sessionKey}).`);
  }

  try {
    return await session.clientPromise;
  } catch (error) {
    const errorMessage = String(error?.message || error);
    const isSessionContextError =
      hasSavedSession({ sessionKey }) && errorMessage.includes("Execution context was destroyed");
    const isBrowserLockError = errorMessage.includes("The browser is already running for");
    const isProtocolTimeoutError =
      errorMessage.includes("Runtime.callFunctionOn timed out") ||
      errorMessage.includes("Increase the 'protocolTimeout' setting");

    if (isProtocolTimeoutError) {
      try {
        await session.currentClient?.destroy();
      } catch {
        // Ignora falhas ao destruir cliente anterior.
      }

      session.clientPromise = undefined;
      session.currentClient = undefined;
      session.authenticatedLogged = false;
      session.readyLogged = false;

      if (allowBootstrapRetry) {
        clearSessionBrowserLocks({ sessionKey });
        status.phase = "retrying_after_timeout";
        status.lastError = "";
        return initWhatsApp({ sessionKey, allowBrowserLockRetry, allowBootstrapRetry: false });
      }

      status.phase = "error";
      status.lastError = "browser_start_timeout";
      throw new Error(
        "O navegador do WhatsApp demorou demais para responder. Tente novamente em alguns instantes."
      );
    }

    if (isBrowserLockError) {
      try {
        await session.currentClient?.destroy();
      } catch {
        // Ignora falhas ao destruir cliente anterior.
      }

      session.clientPromise = undefined;
      session.currentClient = undefined;
      session.authenticatedLogged = false;
      session.readyLogged = false;

      if (allowBrowserLockRetry) {
        clearSessionBrowserLocks({ sessionKey });
        status.phase = "resetting_browser_lock";
        status.lastError = "";
        return initWhatsApp({ sessionKey, allowBrowserLockRetry: false });
      }

      status.phase = "error";
      status.lastError = "browser_locked";
      throw new Error(
        "Já existe outra instância usando esta sessão do WhatsApp Web. Feche a janela/processo anterior antes de iniciar outra."
      );
    }

    if (!isSessionContextError) {
      status.phase = "error";
      status.lastError = errorMessage;
      console.error(`❌ Falha ao inicializar WhatsApp Web (${sessionKey}):`, errorMessage);
      throw error;
    }

    console.warn("⚠️ A sessão salva falhou ao carregar. Vou resetar a sessão local e pedir um novo QR Code.");

    try {
      await session.currentClient?.destroy();
    } catch {
      // Ignora falha ao destruir cliente anterior.
    }

    clearSavedSession({ sessionKey });
    session.clientPromise = undefined;
    session.currentClient = undefined;
    session.authenticatedLogged = false;
    session.readyLogged = false;
    status.phase = "resetting_session";
    return initWhatsApp({ sessionKey });
  }
}

export function getWhatsAppStatus(options = {}) {
  const session = getSessionContext(options);
  return { ...session.status };
}

export async function restartWhatsAppSession(options = {}, restartOptions = {}) {
  const session = getSessionContext(options);
  const sessionKey = session.key;
  const clearSaved = restartOptions?.clearSaved !== false;
  const restart = restartOptions?.restart !== false;
  const now = Date.now();

  if (session.recoveryPromise) {
    return session.recoveryPromise;
  }
  if (now - Number(session.lastRecoveryAt || 0) < 10000) {
    return getWhatsAppStatus({ sessionKey });
  }

  session.lastRecoveryAt = now;
  session.recoveryPromise = (async () => {
    try {
      await session.currentClient?.destroy();
    } catch {
      // ignora
    }

    clearSessionBrowserLocks({ sessionKey });
    if (clearSaved) {
      clearSavedSession({ sessionKey });
    }

    session.clientPromise = undefined;
    session.currentClient = undefined;
    session.authenticatedLogged = false;
    session.readyLogged = false;
    session.status = createInitialStatus();
    session.status.phase = "restarting";
    session.status.phaseStartedAt = Date.now();

    if (!restart) {
      return getWhatsAppStatus({ sessionKey });
    }

    try {
      await initWhatsApp({ sessionKey });
    } catch {
      // status refletirá a falha
    }
    return getWhatsAppStatus({ sessionKey });
  })();

  try {
    return await session.recoveryPromise;
  } finally {
    session.recoveryPromise = undefined;
  }
}

export async function listGroups(options = {}) {
  const session = getSessionContext(options);
  const phase = String(session.status.phase || "");
  if (!["ready", "authenticated"].includes(phase)) {
    throw new Error("WhatsApp não está pronto para listar grupos.");
  }

  const client = session.currentClient || await initWhatsApp({ sessionKey: session.key });
  const chats = await Promise.race([
    client.getChats(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo limite ao ler grupos do WhatsApp.")), 20000))
  ]);

  return chats
    .filter((chat) => chat.isGroup)
    .map((chat) => ({
      id: chat.id._serialized,
      name: chat.name
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function resolveDestination(client, { to, groupId, groupName }) {
  if (groupId) {
    const chatId = normalizeGroupId(groupId);
    return {
      chatId,
      destinationLabel: `grupo:${chatId}`,
      isGroup: true
    };
  }

  if (groupName) {
    const chats = await client.getChats();
    const groupChat = chats.find((chat) => chat.isGroup && chat.name === groupName);

    if (!groupChat) {
      throw new Error(`Grupo não encontrado no WhatsApp Web: "${groupName}".`);
    }

    return {
      chatId: groupChat.id._serialized,
      destinationLabel: `grupo:${groupChat.name}`,
      isGroup: true
    };
  }

  const chatId = toChatId(to);
  const isRegistered = await client.isRegisteredUser(chatId);

  if (!isRegistered) {
    throw new Error(`O número ${to} não está registrado no WhatsApp.`);
  }

  return {
    chatId,
    destinationLabel: to,
    isGroup: false
  };
}

function resolveMediaPath(imagePath) {
  const raw = String(imagePath || "").trim();
  if (!raw) return "";
  if (path.isAbsolute(raw)) return raw;
  const cwdResolved = path.resolve(process.cwd(), raw);
  if (fs.existsSync(cwdResolved)) return cwdResolved;

  const dataResolved = path.resolve(dataRootDir, raw);
  if (fs.existsSync(dataResolved)) return dataResolved;

  return cwdResolved;
}

function isRemoteMediaUrl(imagePath) {
  return /^https?:\/\//i.test(String(imagePath || "").trim());
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapBannerTitle(rawTitle, maxLineLength = 22, maxLines = 3) {
  const words = String(rawTitle || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["🤖 Saudação de hoje"];

  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxLineLength));
      current = word.slice(maxLineLength);
    }

    if (lines.length >= maxLines - 1) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (words.length > 0 && lines.length === maxLines) {
    const consumed = lines.join(" ").trim();
    const original = words.join(" ").trim();
    if (consumed.length < original.length) {
      lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxLineLength - 1)).trim()}…`;
    }
  }

  return lines.slice(0, maxLines);
}

async function buildBannerMediaFromInput(imageInput, cardData, bannerTitle) {
  const width = Number(process.env.WHATSAPP_BANNER_WIDTH || 1080);
  const height = Number(process.env.WHATSAPP_BANNER_HEIGHT || 940);
  const titleLines = wrapBannerTitle(
    String(bannerTitle || process.env.WHATSAPP_BANNER_TITLE || "🤖 Saudação de hoje").trim() || "🤖 Saudação de hoje"
  );
  const backgroundColor = String(cardData?.backgroundColor || process.env.WHATSAPP_BANNER_BG_COLOR || "#123d37").trim() || "#123d37";
  const textColor = String(cardData?.textColor || process.env.WHATSAPP_BANNER_TEXT_COLOR || "#ffffff").trim() || "#ffffff";
  const backgroundImagePath = String(cardData?.backgroundImagePath || process.env.WHATSAPP_BANNER_BG_IMAGE || "").trim();
  const hasBackgroundImage = Boolean(backgroundImagePath);
  const simpleBackgroundMode = Boolean(cardData?.simpleBackgroundMode);
  const titleFontSize = titleLines.length > 2 ? 54 : titleLines.length > 1 ? 64 : 74;
  const titleLineHeight = titleFontSize + 10;
  const backgroundLayer = hasBackgroundImage
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>`;
  const outerPanelFill = hasBackgroundImage ? "none" : "url(#panel)";
  const outerPanelStroke = hasBackgroundImage ? "none" : "rgba(125,255,210,0.22)";
  const contentRowFill = hasBackgroundImage ? "none" : "rgba(6,18,26,0.18)";
  const contentRowStroke = hasBackgroundImage ? "none" : "rgba(255,255,255,0.06)";

  const mediaFrameWidth = 138;
  const mediaFrameHeight = 138;
  const mediaContentWidth = 122;
  const mediaContentHeight = 122;
  const mediaLeft = 32;
  const mediaTop = 28;
  const mediaRadius = 22;
  const mediaContentLeft = Math.floor((mediaFrameWidth - mediaContentWidth) / 2);
  const mediaContentTop = Math.floor((mediaFrameHeight - mediaContentHeight) / 2);
  const shadowWidth = mediaFrameWidth + 18;
  const shadowHeight = mediaFrameHeight + 18;
  const shadowLeft = mediaLeft - 9;
  const shadowTop = mediaTop - 6;
  const contentAreaLeft = 18;
  const contentAreaTop = 18;
  const contentAreaWidth = width - 36;
  const contentAreaHeight = height - 36;
  const titleCenterX = Math.floor(width / 2);
  const titleCenterY = Math.floor(contentAreaTop + contentAreaHeight / 2);
  const titleBlockHeight = Math.max(1, titleLines.length - 1) * titleLineHeight;
  const titleStartY = Math.floor(titleCenterY - titleBlockHeight / 2);
  const titleSvg = titleLines
    .map((line, index) => {
      const y = titleStartY + index * titleLineHeight;
      return `<text x="${titleCenterX}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(textColor)}" font-size="${titleFontSize}" font-family="Georgia, serif" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join("");
  const mediaContentBackdropBuffer = Buffer.from(`
    <svg width="${mediaFrameWidth}" height="${mediaFrameHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mediaInner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
        </linearGradient>
      </defs>
      <rect
        x="${mediaContentLeft}"
        y="${mediaContentTop}"
        width="${mediaContentWidth}"
        height="${mediaContentHeight}"
        rx="18"
        fill="url(#mediaInner)"
        stroke="rgba(255,255,255,0.12)"
        stroke-width="1.5"
      />
    </svg>
  `);
  const logoInnerBuffer = await sharp(imageInput)
    .rotate()
    .resize({
      width: mediaContentWidth,
      height: mediaContentHeight,
      fit: "cover",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  const mediaFrameBuffer = await sharp({
    create: {
      width: mediaFrameWidth,
      height: mediaFrameHeight,
      channels: 4,
      background: { r: 14, g: 24, b: 34, alpha: 1 }
    }
  })
    .composite([
      { input: mediaContentBackdropBuffer, top: 0, left: 0 },
      {
        input: logoInnerBuffer,
        top: mediaContentTop,
        left: mediaContentLeft
      }
    ])
    .png()
    .toBuffer();
  const mediaShadowBuffer = await sharp({
    create: {
      width: shadowWidth,
      height: shadowHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{
      input: Buffer.from(`
        <svg width="${shadowWidth}" height="${shadowHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="6" width="${mediaFrameWidth}" height="${mediaFrameHeight}" rx="${mediaRadius}" fill="rgba(0,0,0,0.18)"/>
        </svg>
      `),
      top: 0,
      left: 0
    }])
    .blur(10)
    .png()
    .toBuffer();
  const mediaRingBuffer = Buffer.from(`
    <svg width="${mediaFrameWidth}" height="${mediaFrameHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="${mediaFrameWidth - 6}" height="${mediaFrameHeight - 6}" rx="${mediaRadius - 3}" fill="none" stroke="rgba(255,255,255,0.56)" stroke-width="2"/>
      <rect x="10" y="10" width="${mediaFrameWidth - 20}" height="${mediaFrameHeight - 20}" rx="${mediaRadius - 9}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    </svg>
  `);

  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2230"/>
          <stop offset="100%" stop-color="${escapeXml(backgroundColor)}"/>
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(8,24,34,0.56)"/>
          <stop offset="100%" stop-color="rgba(8,24,34,0.20)"/>
        </linearGradient>
      </defs>
      ${backgroundLayer}
      <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="18" fill="${outerPanelFill}" stroke="${outerPanelStroke}" stroke-width="2"/>
      <rect x="${contentAreaLeft}" y="${contentAreaTop}" width="${contentAreaWidth}" height="${contentAreaHeight}" rx="18" fill="${contentRowFill}" stroke="${contentRowStroke}" stroke-width="1.2"/>
      ${titleSvg}
    </svg>
  `;

  const composites = [];
  if (backgroundImagePath) {
    const bgIsRemote = isRemoteMediaUrl(backgroundImagePath);
    const bgInput = bgIsRemote ? await fetchRemoteMediaBuffer(backgroundImagePath) : resolveMediaPath(backgroundImagePath);
    if (!bgIsRemote && !fs.existsSync(String(bgInput || ""))) {
      throw new Error(`Imagem de fundo não encontrada: ${String(bgInput || "")}`);
    }
    const backgroundFilledBuffer = await sharp(bgInput)
      .rotate()
      .resize({
        width: contentAreaWidth,
        height: contentAreaHeight,
        fit: "fill",
        position: "centre",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .modulate(simpleBackgroundMode ? { brightness: 1.0, saturation: 1.0 } : { brightness: 1.02, saturation: 1.03 })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const backgroundAreaBuffer = await sharp({
      create: {
        width: contentAreaWidth,
        height: contentAreaHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        { input: backgroundFilledBuffer, top: 0, left: 0 }
      ])
      .png()
      .toBuffer();
    composites.push({ input: backgroundAreaBuffer, top: contentAreaTop, left: contentAreaLeft });
  }

  const bannerBuffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 34, b: 48, alpha: 1 }
    }
  })
    .composite([
      ...composites,
      { input: Buffer.from(svgText), top: 0, left: 0 },
      { input: mediaShadowBuffer, top: shadowTop, left: shadowLeft },
      { input: mediaFrameBuffer, top: mediaTop, left: mediaLeft },
      { input: mediaRingBuffer, top: mediaTop, left: mediaLeft }
    ])
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();

  return new MessageMedia("image/jpeg", bannerBuffer.toString("base64"), "saudacao-banner.jpg");
}

async function buildOptimizedMediaFromInput(imageInput) {
  const maxWidthRaw = Number(process.env.WHATSAPP_IMAGE_MAX_WIDTH || 320);
  const qualityRaw = Number(process.env.WHATSAPP_IMAGE_QUALITY || 45);
  const maxWidth = Number.isFinite(maxWidthRaw) && maxWidthRaw > 0 ? Math.floor(maxWidthRaw) : 720;
  const quality = Number.isFinite(qualityRaw) ? Math.min(95, Math.max(35, Math.floor(qualityRaw))) : 72;

  const input = sharp(imageInput, { failOn: "none" });
  const metadata = await input.metadata();
  const originalWidth = Number(metadata?.width || 0);
  const resizeWidth = originalWidth > 0 ? Math.min(originalWidth, maxWidth) : maxWidth;

  const optimizedBuffer = await input
    .rotate()
    .resize({ width: resizeWidth, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  return MessageMedia.fromFilePath ? new MessageMedia(
    "image/jpeg",
    optimizedBuffer.toString("base64"),
    "saudacao-imagem.jpg"
  ) : null;
}

async function fetchRemoteMediaBuffer(imageUrl) {
  const rawUrl = String(imageUrl || "").trim();
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  if (/^https?:\/\/images\.unsplash\.com\//i.test(rawUrl)) {
    headers.Referer = "https://unsplash.com/";
  } else if (/^https?:\/\/cdn\.pixabay\.com\//i.test(rawUrl)) {
    headers.Referer = "https://pixabay.com/";
  }

  const response = await fetch(rawUrl, {
    cache: "no-store",
    headers
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem remota (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendText({
  to,
  groupId,
  groupName,
  text,
  imagePath,
  mediaAsDocument,
  mediaFileName,
  bannerTitle,
  imageStyle,
  backgroundColor,
  backgroundImagePath,
  textColor,
  cardData,
  mentions
}, options = {}) {
  const session = getSessionContext(options);
  const client = await initWhatsApp({ sessionKey: session.key });
  const destination = await resolveDestination(client, { to, groupId, groupName });

  const me = client.info?.wid?._serialized || "desconhecido@c.us";
  console.log(`📨 Enviando mensagem: ${fromChatId(me)} -> ${destination.destinationLabel}`);
  const rawImagePath = String(imagePath || "").trim();
  const mediaIsRemote = isRemoteMediaUrl(rawImagePath);
  const mediaFullPath = mediaIsRemote ? "" : resolveMediaPath(rawImagePath);
  let message;

  if (rawImagePath) {
    if (!mediaIsRemote && !fs.existsSync(mediaFullPath)) {
      throw new Error(`Imagem não encontrada: ${mediaFullPath}`);
    }
    let media;
    let mediaInput;
    const style = String(imageStyle || "").toLowerCase();
    try {
      mediaInput = mediaIsRemote
        ? await fetchRemoteMediaBuffer(rawImagePath)
        : mediaFullPath;
      if (style === "banner") {
        media = await buildBannerMediaFromInput(
          mediaInput,
          { ...(cardData || {}), backgroundColor, backgroundImagePath, textColor },
          bannerTitle
        );
        console.log("🖼️ Banner personalizado gerado para envio.");
      } else {
        media = await buildOptimizedMediaFromInput(mediaInput);
        console.log("🖼️ Imagem otimizada para envio.");
      }
    } catch (error) {
      console.warn("⚠️ Falha ao gerar banner principal; tentando fallback compacto:", error?.message || error);
      try {
        mediaInput = mediaInput || (mediaIsRemote ? await fetchRemoteMediaBuffer(rawImagePath) : mediaFullPath);
        if (style === "banner") {
          media = await buildBannerMediaFromInput(
            mediaInput,
            { ...(cardData || {}), backgroundColor, backgroundImagePath, textColor, simpleBackgroundMode: true },
            bannerTitle
          );
          console.log("🖼️ Banner compacto gerado no fallback mantendo imagem de fundo.");
        } else {
          media = await buildOptimizedMediaFromInput(mediaInput);
          console.log("🖼️ Imagem otimizada gerada no fallback.");
        }
      } catch (fallbackError) {
        console.warn("⚠️ Falha no fallback compacto com fundo; tentando sem fundo:", fallbackError?.message || fallbackError);
        try {
          mediaInput = mediaInput || (mediaIsRemote ? await fetchRemoteMediaBuffer(rawImagePath) : mediaFullPath);
          media = await buildBannerMediaFromInput(
            mediaInput,
            { ...(cardData || {}), backgroundColor, backgroundImagePath: "", textColor },
            bannerTitle
          );
          console.log("🖼️ Banner compacto gerado no fallback sem imagem de fundo.");
        } catch (bannerWithoutBgError) {
          console.warn("⚠️ Falha no fallback do banner sem fundo; enviando mídia otimizada simples:", bannerWithoutBgError?.message || bannerWithoutBgError);
          try {
            mediaInput = mediaInput || (mediaIsRemote ? await fetchRemoteMediaBuffer(rawImagePath) : mediaFullPath);
            media = await buildOptimizedMediaFromInput(mediaInput);
          } catch (optimizedError) {
            console.warn("⚠️ Falha ao otimizar fallback; enviando original:", optimizedError?.message || optimizedError);
            if (mediaIsRemote) {
              const remoteBuffer = await fetchRemoteMediaBuffer(rawImagePath);
              media = new MessageMedia("image/jpeg", remoteBuffer.toString("base64"), "saudacao-remota.jpg");
            } else {
              media = MessageMedia.fromFilePath(mediaFullPath);
            }
          }
        }
      }
    }
    const sendAsDocument = Boolean(mediaAsDocument);
    const options = {
      caption: String(text || "")
    };
    const mentionList = Array.isArray(mentions)
      ? mentions.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    if (mentionList.length > 0) {
      options.mentions = mentionList;
    }
    if (sendAsDocument) {
      options.sendMediaAsDocument = true;
    }
    const customFileName = String(mediaFileName || "").trim();
    if (customFileName) {
      options.filename = customFileName;
    }
    message = await client.sendMessage(destination.chatId, media, options);
  } else {
    const mentionList = Array.isArray(mentions)
      ? mentions.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    if (mentionList.length > 0) {
      message = await client.sendMessage(destination.chatId, String(text || ""), { mentions: mentionList });
    } else {
      message = await client.sendMessage(destination.chatId, text);
    }
  }
  const ack = await waitForAck(client, message);

  if (ack === null) {
    console.log("⌛ Sem confirmação de entrega nos primeiros 10s.");
  } else {
    console.log(`📬 Status da mensagem: ${ackLabel(ack)} (${ack})`);
  }

  return message;
}
