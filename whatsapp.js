import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import sharp from "sharp";
import whatsappWeb from "whatsapp-web.js";

dotenv.config();

const { Client, LocalAuth, MessageMedia } = whatsappWeb;

let clientPromise;
let currentClient;
let authenticatedLogged = false;
let readyLogged = false;
const status = {
  phase: "idle",
  transportState: "",
  sender: "",
  lastError: "",
  qrAvailable: false,
  qrText: "",
  qrImageDataUrl: ""
};

function isHeadlessMode() {
  return process.env.WHATSAPP_HEADLESS !== "false";
}

function getSessionName() {
  return process.env.WHATSAPP_SESSION_NAME || "saudacao-bot";
}

function getSessionDir() {
  return `.wwebjs_auth/session-${getSessionName()}`;
}

function hasSavedSession() {
  return fs.existsSync(getSessionDir());
}

function clearSavedSession() {
  const sessionDir = getSessionDir();

  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    console.log(`🧹 Sessão local removida: ${sessionDir}`);
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

function createClient() {
  const sessionDir = getSessionDir();
  const savedSession = hasSavedSession();
  const executablePath = detectChromeExecutablePath();

  console.log(`🔄 Inicializando WhatsApp Web (sessão: ${getSessionName()})`);
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
      clientId: getSessionName()
    }),
    puppeteer: {
      headless: isHeadlessMode(),
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  client.on("qr", (qr) => {
    authenticatedLogged = false;
    readyLogged = false;
    status.phase = "qr";
    status.sender = "";
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

  client.on("ready", () => {
    status.phase = "ready";
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    status.lastError = "";
    status.sender = fromChatId(client.info?.wid?._serialized || "");
    if (!readyLogged) {
      console.log("✅ WhatsApp Web conectado.");
      readyLogged = true;
    }
  });

  client.on("authenticated", () => {
    status.phase = "authenticated";
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    status.lastError = "";
    if (!authenticatedLogged) {
      console.log("🔐 Sessão autenticada.");
      authenticatedLogged = true;
    }
  });

  client.on("auth_failure", (message) => {
    status.phase = "auth_failure";
    status.lastError = String(message || "");
    console.error("❌ Falha de autenticação do WhatsApp Web:", message);
  });

  client.on("change_state", (state) => {
    status.transportState = String(state || "");
    if (!["ready", "authenticated"].includes(String(status.phase || ""))) {
      status.phase = `state:${state}`;
    }
    console.log(`ℹ️ Estado do cliente: ${state}`);
  });

  client.on("disconnected", (reason) => {
    status.phase = "disconnected";
    status.lastError = String(reason || "");
    status.sender = "";
    status.qrAvailable = false;
    status.qrText = "";
    status.qrImageDataUrl = "";
    console.warn("⚠️ WhatsApp Web desconectado:", reason);
    clientPromise = undefined;
    currentClient = undefined;
    authenticatedLogged = false;
    readyLogged = false;
  });

  return client;
}

export async function initWhatsApp() {
  if (!clientPromise) {
    status.phase = "initializing";
    status.lastError = "";
    const client = createClient();
    currentClient = client;
    clientPromise = new Promise((resolve, reject) => {
      client.once("ready", () => resolve(client));
      client.once("auth_failure", (error) => reject(new Error(error)));
      client.initialize().catch(reject);
    });
  } else {
    console.log("♻️ Reaproveitando cliente WhatsApp Web já inicializado.");
  }

  try {
    return await clientPromise;
  } catch (error) {
    const errorMessage = String(error?.message || error);
    const isSessionContextError =
      hasSavedSession() && errorMessage.includes("Execution context was destroyed");
    const isBrowserLockError = errorMessage.includes("The browser is already running for");

    if (isBrowserLockError) {
      status.phase = "error";
      status.lastError = "browser_locked";
      throw new Error(
        "Já existe outra instância usando esta sessão do WhatsApp Web. Feche a janela/processo anterior antes de iniciar outra."
      );
    }

    if (!isSessionContextError) {
      status.phase = "error";
      status.lastError = errorMessage;
      throw error;
    }

    console.warn("⚠️ A sessão salva falhou ao carregar. Vou resetar a sessão local e pedir um novo QR Code.");

    try {
      await currentClient?.destroy();
    } catch {
      // Ignora falha ao destruir cliente anterior.
    }

    clearSavedSession();
    clientPromise = undefined;
    currentClient = undefined;
    authenticatedLogged = false;
    readyLogged = false;
    status.phase = "resetting_session";
    return initWhatsApp();
  }
}

export function getWhatsAppStatus() {
  return { ...status };
}

export async function listGroups() {
  const phase = String(status.phase || "");
  if (!["ready", "authenticated"].includes(phase)) {
    throw new Error("WhatsApp não está pronto para listar grupos.");
  }

  const client = currentClient || await initWhatsApp();
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
  return path.resolve(process.cwd(), raw);
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildBannerMediaFromPath(imageFullPath, cardData) {
  const width = Number(process.env.WHATSAPP_BANNER_WIDTH || 1200);
  const height = Number(process.env.WHATSAPP_BANNER_HEIGHT || 460);

  const logoBuffer = await sharp(imageFullPath)
    .rotate()
    .resize({ width: 380, height: 380, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2230"/>
          <stop offset="100%" stop-color="#123d37"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
      <text x="470" y="240" fill="#ffffff" font-size="66" font-family="Georgia, serif" font-weight="700">🤖 Saudação de hoje</text>
    </svg>
  `;

  const bannerBuffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 34, b: 48, alpha: 1 }
    }
  })
    .composite([
      { input: Buffer.from(svgText), top: 0, left: 0 },
      { input: logoBuffer, top: Math.max(0, Math.floor((height - 380) / 2)), left: 48 }
    ])
    .jpeg({ quality: 68, mozjpeg: true })
    .toBuffer();

  return new MessageMedia("image/jpeg", bannerBuffer.toString("base64"), "saudacao-banner.jpg");
}

async function buildOptimizedMediaFromPath(imageFullPath) {
  const maxWidthRaw = Number(process.env.WHATSAPP_IMAGE_MAX_WIDTH || 320);
  const qualityRaw = Number(process.env.WHATSAPP_IMAGE_QUALITY || 45);
  const maxWidth = Number.isFinite(maxWidthRaw) && maxWidthRaw > 0 ? Math.floor(maxWidthRaw) : 720;
  const quality = Number.isFinite(qualityRaw) ? Math.min(95, Math.max(35, Math.floor(qualityRaw))) : 72;

  const input = sharp(imageFullPath, { failOn: "none" });
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

export async function sendText({
  to,
  groupId,
  groupName,
  text,
  imagePath,
  mediaAsDocument,
  mediaFileName,
  imageStyle,
  cardData
}) {
  const client = await initWhatsApp();
  const destination = await resolveDestination(client, { to, groupId, groupName });

  const me = client.info?.wid?._serialized || "desconhecido@c.us";
  console.log(`📨 Enviando mensagem: ${fromChatId(me)} -> ${destination.destinationLabel}`);
  const mediaFullPath = resolveMediaPath(imagePath);
  let message;

  if (mediaFullPath) {
    if (!fs.existsSync(mediaFullPath)) {
      throw new Error(`Imagem não encontrada: ${mediaFullPath}`);
    }
    let media;
    try {
      const style = String(imageStyle || "").toLowerCase();
      if (style === "banner") {
        media = await buildBannerMediaFromPath(mediaFullPath, cardData || {});
        console.log("🖼️ Banner personalizado gerado para envio.");
      } else {
        media = await buildOptimizedMediaFromPath(mediaFullPath);
        console.log("🖼️ Imagem otimizada para envio.");
      }
    } catch (error) {
      console.warn("⚠️ Falha ao otimizar imagem; enviando original:", error?.message || error);
      media = MessageMedia.fromFilePath(mediaFullPath);
    }
    const sendAsDocument = Boolean(mediaAsDocument);
    const options = {
      caption: String(text || "")
    };
    if (sendAsDocument) {
      options.sendMediaAsDocument = true;
    }
    const customFileName = String(mediaFileName || "").trim();
    if (customFileName) {
      options.filename = customFileName;
    }
    message = await client.sendMessage(destination.chatId, media, options);
  } else {
    message = await client.sendMessage(destination.chatId, text);
  }
  const ack = await waitForAck(client, message);

  if (ack === null) {
    console.log("⌛ Sem confirmação de entrega nos primeiros 10s.");
  } else {
    console.log(`📬 Status da mensagem: ${ackLabel(ack)} (${ack})`);
  }

  return message;
}
