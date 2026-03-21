import fs from "fs";
import path from "path";
import cron from "node-cron";
import dotenv from "dotenv";
import { getWhatsAppStatus, initWhatsApp, listGroups, sendText } from "./whatsapp.js";

dotenv.config();

const TZ = process.env.TZ || "America/Sao_Paulo";
const configPath = "./config.json";
const statePath = "./state.json";
const settingsPath = "./settings.json";
const cyclesPath = "./cycles.json";
const lastRunPath = "./last-run.json";
const weekdayMap = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

let initialized = false;
let schedulerStarted = false;
let scheduledJobs = [];
let scheduleSummary = [];
let lastRun = null;
let manualSendInFlight = false;
let lastManualSendAt = 0;
let lastManualSendType = "";
const MANUAL_SEND_COOLDOWN_MS = Number(process.env.MANUAL_SEND_COOLDOWN_MS || 15000);
const FORCED_SEND_COOLDOWN_MS = Number(process.env.FORCED_SEND_COOLDOWN_MS || 60000);

function bootstrapLastRun() {
  if (fs.existsSync(lastRunPath)) {
    try {
      lastRun = readJson(lastRunPath);
      return;
    } catch {
      // ignora arquivo inválido e recria abaixo
    }
  }

  lastRun = null;
  writeJson(lastRunPath, lastRun);
}

function saveLastRun(payload) {
  lastRun = payload || null;
  writeJson(lastRunPath, lastRun);
}

function loadLastRunSafe() {
  try {
    if (!fs.existsSync(lastRunPath)) return null;
    const raw = readJson(lastRunPath);
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

function bootstrapSettings() {
  if (fs.existsSync(settingsPath)) {
    return;
  }

  const initialSettings = {
    to: process.env.WHATSAPP_TO || "",
    groupId: process.env.WHATSAPP_GROUP_ID || "",
    groupName: process.env.WHATSAPP_GROUP_NAME || ""
  };

  writeJson(settingsPath, initialSettings);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  const resolvedPath = String(path || "").trim();
  if (!resolvedPath) {
    throw new Error("Caminho de escrita JSON não informado.");
  }

  const dir = pathModuleDirname(resolvedPath);
  if (dir && dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, resolvedPath);
}

function pathModuleDirname(filePath) {
  return path.dirname(filePath);
}

function backupCorruptedJson(filePath, reason = "") {
  if (!fs.existsSync(filePath)) return "";
  const suffix = `${Date.now()}.corrupted${reason ? `-${reason}` : ""}.bak`;
  const backupPath = `${filePath}.${suffix}`;
  fs.renameSync(filePath, backupPath);
  return backupPath;
}

function loadConfig() {
  return readJson(configPath);
}

function saveConfig(config) {
  writeJson(configPath, config);
}

function loadState() {
  return readJson(statePath);
}

function saveState(state) {
  const next = { ...(state || {}) };
  if (!Array.isArray(next.ordemVinculadaCiclo)) {
    next.ordemVinculadaCiclo = [];
  }
  writeJson(statePath, next);
}

function loadSettings() {
  bootstrapSettings();
  return readJson(settingsPath);
}

function saveSettings(settings) {
  writeJson(settingsPath, settings);
}

function makeCycleId() {
  return "cycle_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function defaultCycleStore() {
  return {
    activeCycleId: "",
    cycles: []
  };
}

function buildCycleName(customName, reason = "manual") {
  const raw = String(customName || "").trim();
  if (raw) return raw;
  const now = new Date();
  const stamp = now.toLocaleString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const prefix = reason === "bootstrap" ? "Ciclo inicial" : "Novo ciclo";
  return `${prefix} ${stamp}`;
}

function createCycleSnapshotFromCurrentState(reason = "bootstrap", customName = "") {
  const config = loadConfig();
  const state = getStateNormalized();
  const totalAlunos = getCycleCapacity(config);

  return {
    id: makeCycleId(),
    name: buildCycleName(customName, reason),
    status: "active",
    reason,
    createdAt: new Date().toISOString(),
    completedAt: null,
    start: {
      idxAluno: state.idxAluno,
      idxAula: state.idxAula,
      dataInicio: state.dataInicio || ""
    },
    sentCount: 0,
    totalAlunos
  };
}

function getCycleCapacity(config) {
  const alunosCount = Array.isArray(config?.alunos) ? config.alunos.length : 0;
  const aulasCount = getAgendaEntriesByConfig(config || {}).length;
  return Math.max(0, Math.min(alunosCount, aulasCount));
}

function bootstrapCycles() {
  if (fs.existsSync(cyclesPath)) {
    return;
  }

  const cycle = createCycleSnapshotFromCurrentState("bootstrap");
  const payload = defaultCycleStore();
  payload.activeCycleId = cycle.id;
  payload.cycles.push(cycle);
  writeJson(cyclesPath, payload);
}

function loadCycles() {
  bootstrapCycles();
  let raw;
  try {
    raw = readJson(cyclesPath);
  } catch (error) {
    const backupPath = backupCorruptedJson(cyclesPath, "invalid-json");
    console.error(
      `[cycles] Arquivo inválido detectado em ${cyclesPath}. Backup salvo em ${backupPath || "indisponível"}.`,
      error
    );

    const cycle = createCycleSnapshotFromCurrentState("bootstrap", "Ciclo recuperado");
    const recovered = defaultCycleStore();
    recovered.activeCycleId = cycle.id;
    recovered.cycles.push(cycle);
    writeJson(cyclesPath, recovered);
    raw = recovered;
  }
  const safe = {
    activeCycleId: typeof raw?.activeCycleId === "string" ? raw.activeCycleId : "",
    cycles: Array.isArray(raw?.cycles) ? raw.cycles : []
  };
  return safe;
}

function saveCycles(payload) {
  writeJson(cyclesPath, payload);
}

function getActiveCycle(cyclesPayload) {
  const payload = cyclesPayload || loadCycles();
  if (!payload.activeCycleId) return null;
  return payload.cycles.find((cycle) => cycle.id === payload.activeCycleId && cycle.status === "active") || null;
}

function getCycleHistory(cyclesPayload, limit = 8) {
  const payload = cyclesPayload || loadCycles();
  const list = Array.isArray(payload.cycles) ? payload.cycles : [];
  return [...list]
    .sort((a, b) => {
      const left = new Date(a?.createdAt || 0).getTime();
      const right = new Date(b?.createdAt || 0).getTime();
      return right - left;
    })
    .slice(0, Math.max(1, Number(limit) || 8));
}

function completeActiveCycleIfNeeded(cyclesPayload) {
  const payload = cyclesPayload || loadCycles();
  const active = getActiveCycle(payload);
  if (!active) {
    return payload;
  }

  const total = Number(active.totalAlunos || 0);
  const sent = Number(active.sentCount || 0);
  if (total > 0 && sent >= total) {
    active.status = "completed";
    active.completedAt = new Date().toISOString();
    payload.activeCycleId = "";
  }

  return payload;
}

function markCycleMessageSent(alunoEfetivado = "", agendaItemKey = "") {
  const payload = loadCycles();
  const active = getActiveCycle(payload);
  const aluno = String(alunoEfetivado || "").trim();
  const itemKeyRaw = String(agendaItemKey || "").trim();
  const itemKey = normalizeAgendaItemKey(itemKeyRaw);
  if (active && aluno) {
    const config = loadConfig();
    const state = getStateNormalized();
    const alunos = Array.isArray(config?.alunos) ? config.alunos : [];
    if (alunos.includes(aluno)) {
      // Regra de negócio:
      // ao enviar, NÃO reordena/troca alunos automaticamente.
      // Apenas registra qual linha foi efetivada.
      const efetivados = Array.isArray(state.efetivadosCiclo) ? [...state.efetivadosCiclo] : [];
      efetivados.push(aluno);
      state.efetivadosCiclo = efetivados;
      if (itemKey) {
        const manual = Array.isArray(state.efetivacoesManuais) ? [...state.efetivacoesManuais] : [];
        const existingIndex = manual.findIndex((item) => normalizeAgendaItemKey(item?.itemKey) === itemKey);
        if (existingIndex >= 0) {
          manual[existingIndex] = { itemKey, aluno };
        } else {
          manual.push({ itemKey, aluno });
        }
        state.efetivacoesManuais = manual;
        const reverted = new Set(Array.isArray(state.revertidosEfetivados) ? state.revertidosEfetivados : []);
        reverted.delete(itemKey);
        state.revertidosEfetivados = [...reverted];
      }
      state.updatedAt = new Date().toISOString();
      saveState(state);
    }
  }
  if (!active) return null;

  active.sentCount = Number(active.sentCount || 0) + 1;
  active.lastMessageAt = new Date().toISOString();
  completeActiveCycleIfNeeded(payload);
  saveCycles(payload);
  return getActiveCycle(payload);
}

function assertAppConfig() {
  const config = loadConfig();

  if (!Array.isArray(config.alunos) || config.alunos.length === 0) {
    throw new Error("config.json precisa ter pelo menos um aluno em \"alunos\".");
  }

  const entries = getAgendaEntriesByConfig(config);
  if (entries.length === 0) {
    throw new Error("config.json precisa ter ao menos uma aula válida para os dias permitidos.");
  }

  return { config };
}

function assertSendConfig() {
  const { config } = assertAppConfig();
  const settings = loadSettings();

  if (!settings.to && !settings.groupId && !settings.groupName) {
    throw new Error("Defina um destino em settings.json ou no dashboard.");
  }

  return { config, settings };
}

function diaSemanaNumero(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short"
  }).format(date);

  return weekdayMap[weekday];
}

function isDiaUtil(d) {
  return d >= 1 && d <= 5;
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(normalized)) return true;
    if (["false", "0", "nao", "não", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function isDiaPermitido(config, d) {
  // "Dias úteis apenas = Sim" => segunda a sexta.
  // "Dias úteis apenas = Não" => segunda a sábado (exclui domingo).
  if (asBoolean(config?.diasUteisApenas, false)) {
    return isDiaUtil(d);
  }
  return d >= 1 && d <= 6;
}

function getAgendaEntriesByConfig(config) {
  return getAgendaEntries(config).filter(({ dia }) => {
    const day = Number(dia);
    return Number.isInteger(day) && isDiaPermitido(config, day);
  });
}

function parseHora(hora) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!match) {
    throw new Error(`Horário inválido em config.json: "${hora}". Use HH:MM.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Horário inválido em config.json: "${hora}".`);
  }

  return { hours, minutes };
}

function validateAula(aula, contextLabel) {
  if (!aula || typeof aula !== "object") {
    throw new Error(`${contextLabel}: aula inválida.`);
  }

  const titulo = String(aula.titulo || "").trim();
  const materia = String(aula.materia || "").trim();
  const professor = String(aula.professor || "").trim();
  const hora = String(aula.hora || "").trim();

  // "titulo" é opcional para manter compatibilidade com agendas antigas.
  if (titulo && titulo.length < 2) {
    throw new Error(`${contextLabel}: título da aula muito curto.`);
  }
  if (!materia) throw new Error(`${contextLabel}: matéria obrigatória.`);
  if (!professor) throw new Error(`${contextLabel}: professor obrigatório.`);
  parseHora(hora);
}

function validateAgendaSemanal(agendaSemanal) {
  if (!agendaSemanal || typeof agendaSemanal !== "object" || Array.isArray(agendaSemanal)) {
    throw new Error("agendaSemanal inválida.");
  }

  const dias = Object.keys(agendaSemanal);
  if (dias.length === 0) {
    throw new Error("agendaSemanal não pode ficar vazia.");
  }

  for (const dia of dias) {
    if (!/^[0-6]$/.test(dia)) {
      throw new Error(`agendaSemanal: dia inválido "${dia}". Use 0..6.`);
    }

    const aulas = agendaSemanal[dia];
    if (Array.isArray(aulas)) {
      if (aulas.length === 0) {
        throw new Error(`agendaSemanal dia ${dia}: lista de aulas vazia.`);
      }

      aulas.forEach((aula, index) => validateAula(aula, `agendaSemanal dia ${dia} item ${index + 1}`));
      continue;
    }

    validateAula(aulas, `agendaSemanal dia ${dia}`);
  }
}

function normalizeAgendaSemanal(agendaSemanal) {
  const normalized = {};
  const days = Object.keys(agendaSemanal || {});

  for (const day of days) {
    const aulasRaw = Array.isArray(agendaSemanal[day]) ? agendaSemanal[day] : [agendaSemanal[day]];
    const aulasNormalized = aulasRaw.map((aula) => {
      const titulo = String(aula?.titulo || "").trim();
      const materia = String(aula?.materia || "").trim();
      const professor = String(aula?.professor || "").trim();
      const horaRaw = String(aula?.hora || "").trim();
      const { hours, minutes } = parseHora(horaRaw);
      const hora = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      return { titulo, materia, professor, hora };
    });

    normalized[String(day)] = aulasNormalized;
  }

  return normalized;
}

function buildCronForAula(hora, antecedenciaMin = 0) {
  const { hours, minutes } = parseHora(hora);
  const totalMinutes = ((hours * 60 + minutes - antecedenciaMin) % 1440 + 1440) % 1440;
  const cronHour = Math.floor(totalMinutes / 60);
  const cronMinute = totalMinutes % 60;

  return { cronHour, cronMinute };
}

function getAgendaEntries(config) {
  const entries = [];

  for (const [dia, aulas] of Object.entries(config.agendaSemanal || {})) {
    if (Array.isArray(aulas)) {
      for (const aula of aulas) {
        entries.push({ dia, aula });
      }
      continue;
    }

    if (aulas && typeof aulas === "object") {
      entries.push({ dia, aula: aulas });
    }
  }

  return entries;
}

function parseDateOnly(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return date;
}

function applyTimeOnDate(baseDate, horario) {
  const { hours, minutes } = parseHora(horario);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function computeNextScheduledDate(dia, horario, referenceDate) {
  const weekday = Number(dia);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;

  const { hours, minutes } = parseHora(horario);
  const base = referenceDate instanceof Date ? referenceDate : new Date();
  const candidate = new Date(base);
  candidate.setHours(hours, minutes, 0, 0);

  const diffDays = (weekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + diffDays);

  if (diffDays === 0 && candidate < base) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

function buildSchedulePreview(config, state, summary, cycleLimit = null, cycleId = "", sentCount = 0) {
  const scheduleItems = Array.isArray(summary) ? summary : [];
  if (!scheduleItems.length) return [];

  // A prévia deve seguir a mesma ordem visual do editor de aulas (Adicionar Aula).
  // O avanço de idxAula continua valendo apenas para o envio em runtime.
  const orderedScheduleItems = scheduleItems;

  const startDate = parseDateOnly(state?.dataInicio);
  const timelineStart = startDate || new Date();
  const capacityFromConfig = getCycleCapacity(config);
  const capacityFromCycle = Number.isInteger(Number(cycleLimit)) ? Math.max(0, Number(cycleLimit)) : null;
  const totalPassos = capacityFromCycle !== null ? capacityFromCycle : capacityFromConfig;
  if (totalPassos <= 0) return [];
  const ordemPendentes = getCycleLinkedOrder(config, state || {}, totalPassos);
  if (!ordemPendentes.length) return [];
  const totalLinhas = Math.min(totalPassos, ordemPendentes.length);
  const baseRows = [];
  let cursor = new Date(timelineStart);
  const manualEffectiveMap = new Map(
    (Array.isArray(state?.efetivacoesManuais) ? state.efetivacoesManuais : [])
      .map((item) => [String(item?.itemKey || ""), String(item?.aluno || "").trim()])
      .filter(([key, aluno]) => key && aluno)
  );
  for (let index = 0; index < totalLinhas; index += 1) {
    const item = orderedScheduleItems[index % Math.max(orderedScheduleItems.length, 1)];
    if (!item) break;

    const scheduledDate = (index === 0 && startDate)
      ? applyTimeOnDate(startDate, item.horario)
      : computeNextScheduledDate(item.dia, item.horario, cursor);
    cursor = new Date(scheduledDate.getTime() + 60 * 1000);
    const scheduledDateISO = scheduledDate.toISOString();
    const itemKey = buildAgendaItemKey({
      cycleId,
      scheduledDateISO,
      materia: item.materia,
      professor: item.professor,
      horario: item.horario
    });
    baseRows.push({
      index,
      dia: item.dia,
      horario: item.horario,
      titulo: String(item.titulo || ""),
      materia: item.materia,
      professor: item.professor,
      scheduledDateISO,
      itemKey
    });
  }

  const preview = [];
  const revertedSet = new Set(
    Array.isArray(state?.revertidosEfetivados)
      ? state.revertidosEfetivados.map((item) => String(item || ""))
      : []
  );

  for (const row of baseRows) {
    const idx = Number(row.index || 0);
    const key = row.itemKey;
    const alunoManual = manualEffectiveMap.get(key);
    const manualEfetivado = Boolean(alunoManual && !revertedSet.has(key));
    const alunoVinculado = String(ordemPendentes[idx] || "").trim();
    const alunoPrevisto = manualEfetivado
      ? String(alunoManual || "").trim() || alunoVinculado || "não definido"
      : alunoVinculado || "não definido";

    preview.push({
      dia: row.dia,
      horario: row.horario,
      titulo: row.titulo,
      materia: row.materia,
      professor: row.professor,
      alunoPrevisto,
      scheduledDateISO: row.scheduledDateISO,
      itemKey: row.itemKey,
      manualEfetivado
    });
  }

  return preview;
}

function getScheduleSummaryForPreview(config) {
  if (Array.isArray(scheduleSummary) && scheduleSummary.length) {
    return scheduleSummary.filter((item) => isDiaPermitido(config || {}, Number(item?.dia)));
  }
  return getAgendaEntriesByConfig(config || {})
    .map(({ dia, aula }) => ({
      dia: String(dia),
      horario: String(aula?.hora || ""),
      titulo: String(aula?.titulo || ""),
      materia: String(aula?.materia || ""),
      professor: String(aula?.professor || "")
    }))
    .sort((a, b) => {
      const byDay = Number(a.dia) - Number(b.dia);
      if (byDay !== 0) return byDay;
      return String(a.horario).localeCompare(String(b.horario));
    });
}

function getPreviewReferenceDate(state) {
  const parsedStart = parseDateOnly(String(state?.dataInicio || "").trim());
  if (parsedStart instanceof Date && !Number.isNaN(parsedStart.getTime())) {
    return parsedStart;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function sortPreviewSummaryLikeLessonsModal(summary, state) {
  const list = Array.isArray(summary) ? summary : [];
  if (!list.length) return [];

  const referenceDate = getPreviewReferenceDate(state);
  const weekdayOccurrenceMap = new Map();
  const rows = list.map((item, index) => {
    const nextDate = computeNextScheduledDate(item?.dia, item?.horario, referenceDate);
    const dayKey = String(item?.dia || "");
    const occurrenceIndex = Number(weekdayOccurrenceMap.get(dayKey) || 0);
    if (nextDate instanceof Date && occurrenceIndex > 0) {
      nextDate.setDate(nextDate.getDate() + (occurrenceIndex * 7));
    }
    weekdayOccurrenceMap.set(dayKey, occurrenceIndex + 1);
    return { item, index, nextDate };
  });

  rows.sort((a, b) => {
    const left = a.nextDate instanceof Date ? a.nextDate.getTime() : Number.POSITIVE_INFINITY;
    const right = b.nextDate instanceof Date ? b.nextDate.getTime() : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return a.index - b.index;
  });

  return rows.map((row) => row.item);
}

function buildAgendaItemKey(item) {
  const cycleId = String(item?.cycleId || "no-cycle");
  return [
    cycleId,
    String(item?.scheduledDateISO || ""),
    String(item?.materia || ""),
    String(item?.professor || ""),
    String(item?.horario || "")
  ].join("|");
}

function normalizeAgendaItemKey(rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return "";
  const parts = key.split("|");
  // Formato novo: cycleId|data|materia|professor|horario
  if (parts.length === 5 && parts[0].startsWith("cycle_")) {
    return key;
  }
  // Compatibilidade: sem cycleId -> prefixa "no-cycle"
  if (parts.length === 4) {
    return ["no-cycle", parts[0], parts[1], parts[2], parts[3]].join("|");
  }
  // Compatibilidade com chave antiga: data|aluno|materia|professor|horario
  if (parts.length === 5) {
    return ["no-cycle", parts[0], parts[2], parts[3], parts[4]].join("|");
  }
  return key;
}

function normalizeStudentDetails(details, alunos = []) {
  const validNames = new Set(
    (Array.isArray(alunos) ? alunos : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const list = Array.isArray(details) ? details : [];
  const normalized = [];
  const seen = new Set();

  for (const item of list) {
    const nome = String(item?.nome || item?.name || "").trim();
    if (!nome || !validNames.has(nome) || seen.has(nome)) continue;
    seen.add(nome);
    normalized.push({
      nome,
      whatsapp: String(item?.whatsapp || "").trim(),
      imagem: String(item?.imagem || item?.image || "").trim()
    });
  }

  return normalized;
}

function buildStudentDetailsForEditor(config) {
  const alunos = Array.isArray(config?.alunos)
    ? config.alunos.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const details = normalizeStudentDetails(config?.alunoDetalhes, alunos);
  const detailMap = new Map(details.map((item) => [item.nome, item]));

  return alunos.map((nome) => {
    const detail = detailMap.get(nome);
    return {
      nome,
      whatsapp: String(detail?.whatsapp || "").trim(),
      imagem: String(detail?.imagem || "").trim()
    };
  });
}

function getStudentDetailByName(config, studentName) {
  const targetName = String(studentName || "").trim().toLocaleLowerCase("pt-BR");
  if (!targetName) return null;
  const alunos = Array.isArray(config?.alunos) ? config.alunos : [];
  const details = normalizeStudentDetails(config?.alunoDetalhes, alunos);
  return details.find(
    (item) => String(item?.nome || "").trim().toLocaleLowerCase("pt-BR") === targetName
  ) || null;
}

function getStudentImageForName(config, studentName) {
  return String(getStudentDetailByName(config, studentName)?.imagem || "").trim();
}

function resolveAgendaItemDate(item) {
  if (item?.scheduledDateISO) {
    const parsed = new Date(item.scheduledDateISO);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function formatAgendaDatePt(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatAgendaLine(item) {
  const date = resolveAgendaItemDate(item);
  const dateLabel = formatAgendaDatePt(date);
  const horario = String(item?.horario || "").trim();
  const titulo = String(item?.titulo || "").trim();
  const materia = String(item?.materia || "").trim();
  const professor = String(item?.professor || "").trim();
  const aluno = String(item?.alunoPrevisto || "").trim() || "não definido";
  const status = item?.manualEfetivado ? "Efetivado" : "Pendente";

  return [
    "• *Agendamento*",
    `  ${dateLabel}${horario ? ` às ${horario}` : ""}`,
    titulo ? `  Título: ${titulo}` : "",
    materia ? `  Matéria: ${materia}` : "",
    professor ? `  Professor: ${professor}` : "",
    `  Aluno: ${aluno}`,
    `  Status: ${status}`
  ].filter(Boolean).join("\n");
}

function buildAgendaListMessage(config, state, activeCycle) {
  const sortedSummary = sortPreviewSummaryLikeLessonsModal(
    getScheduleSummaryForPreview(config),
    state
  );
  const agenda = buildSchedulePreview(
    config,
    state,
    sortedSummary,
    activeCycle ? Number(activeCycle.totalAlunos || 0) : null,
    String(activeCycle?.id || "no-cycle"),
    activeCycle ? Number(activeCycle.sentCount || 0) : 0
  );
  const pendingAgenda = agenda.filter((item) => !Boolean(item?.manualEfetivado));
  if (!pendingAgenda.length) {
    throw new Error("Não há agendamentos disponíveis para envio.");
  }

  const turma = String(config.turma || "Turma").trim();
  const instituicao = String(config.instituicao || "").trim();
  const turmaLinha = instituicao ? `${turma} — ${instituicao}` : turma;
  const total = pendingAgenda.length;

  return [
    "*Agenda pendente da turma*",
    turmaLinha ? `*${turmaLinha}*` : "",
    `Total de pendentes: *${total}*`,
    "",
    ...pendingAgenda.flatMap((item, index) => [
      formatAgendaLine(item),
      index < pendingAgenda.length - 1 ? "\n──────────" : null
    ]),
    "",
    "Qualquer ajuste na ordem ou ausência pode ser tratado pelo painel."
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function isAgendaItemDone(item, index, doneCount, revertedSet) {
  const key = buildAgendaItemKey(item);
  if (revertedSet.has(key)) return false;
  if (Boolean(item?.manualEfetivado)) return true;
  return false;
}

function getLinkedStudentsFromCycleView(config, state, activeCycle, pendingOnly = false) {
  const cycleId = String(activeCycle?.id || "no-cycle");
  const sortedSummary = sortPreviewSummaryLikeLessonsModal(
    getScheduleSummaryForPreview(config),
    state
  );
  const preview = buildSchedulePreview(
    config,
    state,
    sortedSummary,
    activeCycle ? Number(activeCycle.totalAlunos || 0) : null,
    cycleId,
    activeCycle ? Number(activeCycle.sentCount || 0) : 0
  );
  if (!preview.length) return [];

  const revertedSet = new Set(
    Array.isArray(state?.revertidosEfetivados)
      ? state.revertidosEfetivados.map((item) => String(item || ""))
      : []
  );

  const seen = new Set();
  const result = [];
  preview.forEach((item, index) => {
    const done = isAgendaItemDone(item, index, 0, revertedSet);
    if (pendingOnly && done) return;
    const aluno = String(item?.alunoPrevisto || "").trim();
    if (!aluno || seen.has(aluno)) return;
    seen.add(aluno);
    result.push(aluno);
  });
  return result;
}

function getPendingLinkedStudentsFromCycleView(config, state, activeCycle) {
  return getLinkedStudentsFromCycleView(config, state, activeCycle, true);
}

function getStateNormalized() {
  const raw = loadState();
  const idxAlunoRaw = Number(raw?.idxAluno);
  const idxAulaRaw = Number(raw?.idxAula);
  const dataInicioRaw = typeof raw?.dataInicio === "string" ? raw.dataInicio.trim() : "";
  const reposicaoAlunosRaw = Array.isArray(raw?.reposicaoAlunos) ? raw.reposicaoAlunos : [];
  const ordemProximosAlunosRaw = Array.isArray(raw?.ordemProximosAlunos) ? raw.ordemProximosAlunos : [];
  const ordemVinculadaCicloRaw = Array.isArray(raw?.ordemVinculadaCiclo) ? raw.ordemVinculadaCiclo : [];
  const efetivadosCicloRaw = Array.isArray(raw?.efetivadosCiclo) ? raw.efetivadosCiclo : [];
  const revertidosEfetivadosRaw = Array.isArray(raw?.revertidosEfetivados) ? raw.revertidosEfetivados : [];
  const efetivacoesManuaisRaw = Array.isArray(raw?.efetivacoesManuais) ? raw.efetivacoesManuais : [];
  return {
    ...raw,
    idxAluno: Number.isInteger(idxAlunoRaw) ? idxAlunoRaw : 0,
    idxAula: Number.isInteger(idxAulaRaw) ? idxAulaRaw : 0,
    dataInicio: dataInicioRaw,
    reposicaoAlunos: reposicaoAlunosRaw.map((item) => String(item || "").trim()).filter(Boolean),
    ordemProximosAlunos: ordemProximosAlunosRaw.map((item) => String(item || "").trim()).filter(Boolean),
    ordemVinculadaCiclo: ordemVinculadaCicloRaw.map((item) => String(item || "").trim()).filter(Boolean),
    efetivadosCiclo: efetivadosCicloRaw.map((item) => String(item || "").trim()).filter(Boolean),
    revertidosEfetivados: revertidosEfetivadosRaw.map((item) => String(item || "").trim()).filter(Boolean),
    efetivacoesManuais: efetivacoesManuaisRaw
      .map((item) => ({
        itemKey: normalizeAgendaItemKey(item?.itemKey),
        aluno: String(item?.aluno || "").trim()
      }))
      .filter((item) => item.itemKey && item.aluno)
  };
}

function buildStudentRotation(alunos, startIndex = 0) {
  const total = Array.isArray(alunos) ? alunos.length : 0;
  if (!total) return [];

  const base = Number.isInteger(startIndex) ? startIndex : 0;
  const normalizedStart = ((base % total) + total) % total;
  const ordered = [];
  for (let i = 0; i < total; i += 1) {
    ordered.push(alunos[(normalizedStart + i) % total]);
  }
  return ordered;
}

function normalizePendingOrder(state, alunos) {
  const source = Array.isArray(state?.ordemProximosAlunos) ? state.ordemProximosAlunos : [];
  const seen = new Set();
  const cleaned = source
    .map((item) => String(item || "").trim())
    .filter((name) => name && alunos.includes(name) && !seen.has(name) && (seen.add(name), true));

  if (cleaned.length) {
    const rotated = buildStudentRotation(alunos, Number(state?.idxAluno || 0));
    for (const name of rotated) {
      if (!seen.has(name)) {
        cleaned.push(name);
        seen.add(name);
      }
    }
    return cleaned;
  }

  return buildStudentRotation(alunos, Number(state?.idxAluno || 0));
}

function getCycleLinkedOrder(config, state, cycleLimit = null, forceFromGlobal = false) {
  const alunos = Array.isArray(config?.alunos) ? config.alunos : [];
  const total = Number.isInteger(Number(cycleLimit))
    ? Math.max(0, Number(cycleLimit))
    : getCycleCapacity(config);
  if (!alunos.length || total <= 0) return [];

  if (forceFromGlobal) {
    return normalizePendingOrder(state, alunos).slice(0, total);
  }

  const linked = Array.isArray(state?.ordemVinculadaCiclo)
    ? state.ordemVinculadaCiclo.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  const seen = new Set();
  const cleanedLinked = linked.filter((name) => {
    if (!alunos.includes(name)) return false;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  // Se já existe fila vinculada, preserva estritamente essa ordem.
  // Não completar automaticamente com fila global evita incluir alunos
  // fora do vínculo do ciclo ativo.
  if (cleanedLinked.length) {
    return cleanedLinked.slice(0, total);
  }

  return normalizePendingOrder(state, alunos).slice(0, total);
}

function pickAluno() {
  const state = getStateNormalized();
  const config = loadConfig();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  if (!alunos.length) {
    throw new Error("Não há alunos cadastrados.");
  }

  const pending = normalizePendingOrder(state, alunos);
  const aluno = pending[0];
  if (!aluno) {
    throw new Error("Não foi possível selecionar o próximo aluno.");
  }

  pending.shift();
  state.ordemProximosAlunos = pending;
  const idxSelecionado = alunos.indexOf(aluno);
  if (idxSelecionado >= 0) {
    state.idxAluno = (idxSelecionado + 1) % alunos.length;
  }
  state.updatedAt = new Date().toISOString();
  saveState(state);
  return aluno;
}

function consumeAlunoFromGlobalQueue(state, alunos, aluno) {
  const nome = String(aluno || "").trim();
  if (!nome) return;
  const pending = normalizePendingOrder(state, alunos).filter((name) => name !== nome);
  state.ordemProximosAlunos = pending;
  const idxSelecionado = alunos.indexOf(nome);
  if (idxSelecionado >= 0) {
    state.idxAluno = (idxSelecionado + 1) % alunos.length;
  }
}

function pickAlunoFromActiveCyclePreview(config, state, activeCycle) {
  if (!activeCycle) return "";
  const cycleId = String(activeCycle?.id || "no-cycle");
  const sortedSummary = sortPreviewSummaryLikeLessonsModal(
    getScheduleSummaryForPreview(config),
    state
  );
  const preview = buildSchedulePreview(
    config,
    state,
    sortedSummary,
    Number(activeCycle.totalAlunos || 0),
    cycleId,
    Number(activeCycle.sentCount || 0)
  );
  if (!preview.length) return "";

  const revertedSet = new Set(
    Array.isArray(state?.revertidosEfetivados)
      ? state.revertidosEfetivados.map((item) => String(item || ""))
      : []
  );
  const pending = preview.find((item, index) => !isAgendaItemDone(item, index, 0, revertedSet));
  if (!pending) return "";
  return {
    aluno: String(pending?.alunoPrevisto || "").trim(),
    itemKey: String(pending?.itemKey || "").trim()
  };
}

function pickAgendaItemForCurrentDispatch(config, state, activeCycle, aula, targetDate = new Date()) {
  if (!activeCycle || !aula) return null;

  const cycleId = String(activeCycle?.id || "no-cycle");
  const sortedSummary = sortPreviewSummaryLikeLessonsModal(
    getScheduleSummaryForPreview(config),
    state
  );
  const preview = buildSchedulePreview(
    config,
    state,
    sortedSummary,
    Number(activeCycle.totalAlunos || 0),
    cycleId,
    Number(activeCycle.sentCount || 0)
  );
  if (!preview.length) return null;

  const targetDateKey = getLocalDateKey(targetDate);
  const targetHora = String(aula?.hora || "").trim();
  const targetTitulo = String(aula?.titulo || "").trim();
  const targetMateria = String(aula?.materia || "").trim();
  const targetProfessor = String(aula?.professor || "").trim();

  const exact = preview.find((item) => {
    if (Boolean(item?.manualEfetivado)) return false;
    return (
      getLocalDateKey(resolveAgendaItemDate(item)) === targetDateKey &&
      String(item?.horario || "").trim() === targetHora &&
      String(item?.titulo || "").trim() === targetTitulo &&
      String(item?.materia || "").trim() === targetMateria &&
      String(item?.professor || "").trim() === targetProfessor
    );
  });
  if (exact) return exact;

  return preview.find((item) => {
    if (Boolean(item?.manualEfetivado)) return false;
    return getLocalDateKey(resolveAgendaItemDate(item)) === targetDateKey;
  }) || null;
}

function buildMessage(aula, aluno) {
  const config = loadConfig();
  const alunoNome = String(aluno || "").trim();
  const titulo = String(aula.titulo || "").trim();
  const materia = String(aula.materia || "").trim();
  const professor = String(aula.professor || "").trim();
  const hour = new Date().getHours();
  const cumprimento = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const turmaNome = String(config.turma || "sua turma").trim();
  const aulaContexto = titulo
    ? `Hoje nossa saudação é para a aula *${titulo}*, da matéria ${materia}.`
    : `Hoje nossa saudação é para a matéria ${materia}.`;
  const exemploPronto = `${cumprimento}, professor(a) ${professor}. Aqui é a turma ${turmaNome}. ${aulaContexto} Hoje estamos com a maioria presente. A turma está pronta, pode começar quando quiser.`;
  const defaultTemplate = [
    `Turma: *${config.turma} — ${config.instituicao}*`,
    `Matéria: *${aula.materia}*`,
    ...(titulo ? [`Título: *${titulo}*`] : []),
    `Professor: *${aula.professor}*`,
    `Aluno: *${alunoNome}*`,
    `Horário: *${aula.hora}*`,
    "",
    `Olá, *${alunoNome}*! Chegou a sua vez de fazer a saudação de hoje. Contamos com você!`,
    "",
    "*Texto sugerido (ler no início):*",
    "",
    "*Modelo simples:*",
    "*1. Cumprimento*",
    "_“Bom dia, professor.” ou “Boa tarde, professor.”_",
    "",
    "*2. Identificação da turma*",
    "_“Somos a turma [nome ou curso].”_",
    "",
    "*3. Situação de presença*",
    "_“Hoje estamos com a turma completa.” ou “Hoje tivemos algumas ausências, mas a maioria está presente.”_",
    "",
    "*4. Transição para a aula*",
    "_“A turma está pronta para a aula. Pode começar quando quiser.”_",
    "",
    "*Estrutura resumida:*",
    "_Cumprimento → Turma → Presença → Passar a palavra_",
    "",
    "*Exemplo pronto para usar:*",
    `_“${exemploPronto}”_`,
    `*— ${alunoNome} (${materia})*`
  ].join("\n");

  const template = String(config?.defaultGreetingMessage || "").trim() || defaultTemplate;
  return renderGreetingTemplate(template, {
    turma: String(config.turma || ""),
    instituicao: String(config.instituicao || ""),
    turmaLinha: [String(config.turma || "").trim(), String(config.instituicao || "").trim()].filter(Boolean).join(" — "),
    materia,
    titulo,
    professor,
    alunoNome,
    horario: String(aula.hora || "").trim(),
    cumprimento,
    aulaContexto,
    exemploPronto
  });
}

function renderGreetingTemplate(template, vars) {
  const replacements = {
    "{{turma}}": String(vars?.turma || ""),
    "{{instituicao}}": String(vars?.instituicao || ""),
    "{{turmaLinha}}": String(vars?.turmaLinha || ""),
    "{{materia}}": String(vars?.materia || ""),
    "{{titulo}}": String(vars?.titulo || ""),
    "{{professor}}": String(vars?.professor || ""),
    "{{alunoNome}}": String(vars?.alunoNome || ""),
    "{{horario}}": String(vars?.horario || ""),
    "{{cumprimento}}": String(vars?.cumprimento || ""),
    "{{aulaContexto}}": String(vars?.aulaContexto || ""),
    "{{exemploPronto}}": String(vars?.exemploPronto || "")
  };

  return Object.entries(replacements).reduce(
    (text, [token, value]) => text.split(token).join(value),
    String(template || "")
  );
}

function buildNoClassMessage() {
  const config = loadConfig();
  const hour = new Date().getHours();
  const cumprimento = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const turma = String(config.turma || "Turma").trim();
  const instituicao = String(config.instituicao || "").trim();
  const turmaLinha = instituicao ? `${turma} — ${instituicao}` : turma;
  const defaultTemplate = [
    `*📢 Aviso da turma*`,
    "",
    `Turma: *${turmaLinha}*`,
    "",
    `${cumprimento}, pessoal.`,
    "",
    `*HOJE NÃO HAVERÁ AULA.*`,
    "",
    "Aproveitem este tempo para colocar os estudos em dia, revisar os conteúdos já vistos e reforçar os pontos que ainda geram dúvida.",
    "",
    "Uma boa revisão hoje pode fazer diferença no entendimento das próximas aulas.",
    "",
    "*Sigam firmes nos estudos. Constância e dedicação trazem resultado.*"
  ].join("\n");

  const template = String(config?.defaultNoClassMessage || "").trim() || defaultTemplate;
  return renderGreetingTemplate(template, {
    turma,
    instituicao,
    turmaLinha,
    cumprimento
  });
}

function resolveMessageMediaConfig(config, kind = "default", overrides = {}) {
  const normalizedKind = String(kind || "default").trim().toLowerCase();
  const legacyImagePath = String(config.imagePath || process.env.WHATSAPP_IMAGE_PATH || "").trim();
  const legacyMediaFileName = String(config.mediaFileName || process.env.WHATSAPP_MEDIA_FILE_NAME || "").trim();
  const legacyBannerTitle = String(config.bannerTitle || process.env.WHATSAPP_BANNER_TITLE || "").trim();
  const legacyBackgroundColor = String(config.backgroundColor || process.env.WHATSAPP_BANNER_BG_COLOR || "#123d37").trim();
  const legacyBackgroundImagePath = String(config.backgroundImagePath || process.env.WHATSAPP_BANNER_BG_IMAGE || "").trim();

  if (normalizedKind === "no-class") {
    return {
      imagePath: String(overrides.imagePath ?? config.noClassImagePath ?? legacyImagePath).trim(),
      mediaFileName: String(overrides.mediaFileName ?? config.noClassMediaFileName ?? legacyMediaFileName).trim(),
      bannerTitle: String(overrides.bannerTitle ?? config.noClassBannerTitle ?? legacyBannerTitle).trim(),
      backgroundColor: String(overrides.backgroundColor ?? config.noClassBackgroundColor ?? legacyBackgroundColor).trim(),
      backgroundImagePath: String(overrides.backgroundImagePath ?? config.noClassBackgroundImagePath ?? legacyBackgroundImagePath).trim(),
    };
  }

  if (normalizedKind === "custom") {
    return {
      imagePath: String(overrides.imagePath ?? config.customImagePath ?? legacyImagePath).trim(),
      mediaFileName: String(overrides.mediaFileName ?? config.customMediaFileName ?? legacyMediaFileName).trim(),
      bannerTitle: String(overrides.bannerTitle ?? config.customBannerTitle ?? legacyBannerTitle).trim(),
      backgroundColor: String(overrides.backgroundColor ?? config.customBackgroundColor ?? legacyBackgroundColor).trim(),
      backgroundImagePath: String(overrides.backgroundImagePath ?? config.customBackgroundImagePath ?? legacyBackgroundImagePath).trim(),
    };
  }

  return {
    imagePath: String(overrides.imagePath ?? config.greetingImagePath ?? legacyImagePath).trim(),
    mediaFileName: String(overrides.mediaFileName ?? config.greetingMediaFileName ?? legacyMediaFileName).trim(),
    bannerTitle: String(overrides.bannerTitle ?? config.greetingBannerTitle ?? legacyBannerTitle).trim(),
    backgroundColor: String(overrides.backgroundColor ?? config.greetingBackgroundColor ?? legacyBackgroundColor).trim(),
    backgroundImagePath: String(overrides.backgroundImagePath ?? config.greetingBackgroundImagePath ?? legacyBackgroundImagePath).trim(),
  };
}

async function sendBotMessage(text, cardData = null, messageKind = "default") {
  const settings = loadSettings();
  const config = loadConfig();
  const studentImagePath = getStudentImageForName(config, cardData?.aluno);
  const mediaConfig = resolveMessageMediaConfig(config, messageKind);
  const fallbackImagePath = mediaConfig.imagePath;
  const imagePath = studentImagePath || fallbackImagePath;
  const bannerTitle = mediaConfig.bannerTitle;
  const backgroundColor = mediaConfig.backgroundColor;
  const backgroundImagePath = mediaConfig.backgroundImagePath;
  const mediaAsDocument = String(
    config.mediaAsDocument ?? process.env.WHATSAPP_MEDIA_AS_DOCUMENT ?? "false"
  ).toLowerCase() === "true";
  const mediaFileName = mediaConfig.mediaFileName;
  const imageStyle = String(config.imageStyle || process.env.WHATSAPP_IMAGE_STYLE || "banner").trim();
  const message = await sendText({
    to: settings.to,
    groupId: settings.groupId,
    groupName: settings.groupName,
    text,
    imagePath,
    mediaAsDocument,
    mediaFileName,
    bannerTitle,
    imageStyle,
    backgroundColor,
    backgroundImagePath,
    cardData
  });

  saveLastRun({
    type: "custom",
    destination: settings.groupName || settings.groupId || settings.to,
    messageId: message.id?._serialized || "sem-id",
    sentAt: new Date().toISOString()
  });

  if (imagePath) {
    console.log(
      mediaAsDocument
        ? `📎 Envio com mídia como documento habilitado: ${imagePath}`
        : `🖼️ Envio com imagem habilitado: ${imagePath}`
    );
    if (studentImagePath) {
      console.log(`👤 Imagem do aluno aplicada no envio: ${cardData?.aluno || "sem aluno"}`);
    }
  } else {
    console.log("ℹ️ Envio sem imagem (nenhum imagePath configurado).");
  }
  console.log("✅ Enviado pelo WhatsApp Web:", message.id?._serialized || "sem-id");
  return message;
}

export async function sendCustomMessageToTarget(targetType, targetValue, template, overrides = {}) {
  const config = loadConfig();
  const kind = String(targetType || "student").trim();
  const turma = String(config.turma || "").trim();
  const instituicao = String(config.instituicao || "").trim();
  const turmaLinha = [turma, instituicao].filter(Boolean).join(" — ");
  const hour = new Date().getHours();
  const cumprimento = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const mediaConfig = resolveMessageMediaConfig(config, "custom", overrides);
  const fallbackImagePath = mediaConfig.imagePath;
  const bannerTitle = mediaConfig.bannerTitle;
  const backgroundColor = mediaConfig.backgroundColor;
  const backgroundImagePath = mediaConfig.backgroundImagePath;
  const mediaAsDocument = String(
    config.mediaAsDocument ?? process.env.WHATSAPP_MEDIA_AS_DOCUMENT ?? "false"
  ).toLowerCase() === "true";
  const mediaFileName = mediaConfig.mediaFileName;
  const imageStyle = String(config.imageStyle || process.env.WHATSAPP_IMAGE_STYLE || "banner").trim();
  const settings = loadSettings();

  if (kind === "group") {
    const groupName = String(targetValue || "").trim();
    if (!groupName) {
      throw new Error("Grupo não informado.");
    }
    const text = renderGreetingTemplate(String(template || "").trim(), {
      turma,
      instituicao,
      turmaLinha,
      materia: "",
      titulo: "",
      professor: "",
      alunoNome: "",
      horario: "",
      cumprimento,
      aulaContexto: "",
      exemploPronto: ""
    });
    const message = await sendText({
      to: "",
      groupId: "",
      groupName,
      text,
      imagePath: fallbackImagePath,
      mediaAsDocument,
      mediaFileName,
      bannerTitle,
      imageStyle,
      backgroundColor,
      backgroundImagePath,
      cardData: { turma, instituicao, aluno: "", materia: "", titulo: "", professor: "", horario: "" }
    });
    saveLastRun({
      type: "custom_group",
      skipped: false,
      destination: groupName,
      messageId: message.id?._serialized || "sem-id",
      sentAt: new Date().toISOString()
    });
    return message;
  }

  const detail = getStudentDetailByName(config, targetValue);
  const alunoNome = String(detail?.nome || targetValue || "").trim();
  const to = String(detail?.whatsapp || "").trim();
  if (!alunoNome) {
    throw new Error("Aluno não informado.");
  }
  if (!to) {
    throw new Error(`O aluno ${alunoNome} não possui WhatsApp cadastrado.`);
  }
  const text = renderGreetingTemplate(String(template || "").trim(), {
    turma,
    instituicao,
    turmaLinha,
    materia: "",
    titulo: "",
    professor: "",
    alunoNome,
    horario: "",
    cumprimento,
    aulaContexto: "",
    exemploPronto: ""
  });
  const studentImagePath = String(detail?.imagem || "").trim();
  const imagePath = studentImagePath || fallbackImagePath;
  const message = await sendText({
    to,
    groupId: "",
    groupName: "",
    text,
    imagePath,
    mediaAsDocument,
    mediaFileName,
    bannerTitle,
    imageStyle,
    backgroundColor,
    backgroundImagePath,
    cardData: { turma, instituicao, aluno: alunoNome, materia: "", titulo: "", professor: "", horario: "" }
  });
  saveLastRun({
    type: "custom_student",
    skipped: false,
    aluno: alunoNome,
    destination: to || settings.to,
    messageId: message.id?._serialized || "sem-id",
    sentAt: new Date().toISOString()
  });
  return message;
}

function getOrderedLessonsForManualSend(config) {
  const entries = getAgendaEntriesByConfig(config).map(({ dia, aula }) => ({
    dia: String(dia),
    titulo: String(aula?.titulo || ""),
    materia: aula.materia,
    professor: aula.professor,
    hora: aula.hora
  }));

  entries.sort((a, b) => {
    const diaDiff = Number(a.dia) - Number(b.dia);
    if (diaDiff !== 0) return diaDiff;
    const horaDiff = String(a.hora).localeCompare(String(b.hora));
    if (horaDiff !== 0) return horaDiff;
    const materiaDiff = String(a.materia).localeCompare(String(b.materia));
    if (materiaDiff !== 0) return materiaDiff;
    return String(a.professor).localeCompare(String(b.professor));
  });

  return entries;
}

async function withManualSendLock(task, type = "manual") {
  const now = Date.now();
  // Proteção anti-duplo-disparo (ex.: clique duplicado/evento repetido).
  if (lastManualSendType === type && now - lastManualSendAt < 8000) {
    throw new Error("Envio já executado há instantes. Aguarde alguns segundos.");
  }
  // Proteção persistente entre processos/instâncias.
  const diskLastRun = loadLastRunSafe();
  const diskType = String(diskLastRun?.type || "");
  const diskSentAt = String(diskLastRun?.sentAt || "");
  const diskTs = diskSentAt ? new Date(diskSentAt).getTime() : NaN;
  if (
    Number.isFinite(diskTs) &&
    (now - diskTs) >= 0 &&
    (now - diskTs) < MANUAL_SEND_COOLDOWN_MS &&
    (diskType === "forced" || diskType === "scheduled")
  ) {
    throw new Error("Envio recente detectado. Aguarde alguns segundos antes de enviar novamente.");
  }
  if (
    type === "forced" &&
    Number.isFinite(diskTs) &&
    (now - diskTs) >= 0 &&
    (now - diskTs) < FORCED_SEND_COOLDOWN_MS
  ) {
    throw new Error("Envio forçado bloqueado temporariamente para evitar duplicidade. Aguarde 1 minuto.");
  }
  if (manualSendInFlight) {
    throw new Error("Já existe um envio manual em andamento. Aguarde finalizar.");
  }
  manualSendInFlight = true;
  try {
    const result = await task();
    lastManualSendType = type;
    lastManualSendAt = Date.now();
    return result;
  } finally {
    manualSendInFlight = false;
  }
}

export async function runNow() {
  return await withManualSendLock(async () => {
    const { config } = assertSendConfig();
    return await runScheduledDispatch(config);
  }, "now");
}

export async function runNowForced() {
  return await withManualSendLock(async () => {
    const { config } = assertSendConfig();
    const state = getStateNormalized();
    const aulas = getOrderedLessonsForManualSend(config);
    if (!aulas.length) {
      throw new Error("Não há aulas cadastradas para envio forçado.");
    }

    const idxAulaBase = ((state.idxAula % aulas.length) + aulas.length) % aulas.length;
    const aula = aulas[idxAulaBase];
    state.idxAula = (idxAulaBase + 1) % aulas.length;
    saveState(state);

    let aluno = "";
    let itemKeyFromCycle = "";
    const cycles = completeActiveCycleIfNeeded(loadCycles());
    const active = getActiveCycle(cycles);
    if (active) {
      const picked = pickAlunoFromActiveCyclePreview(config, state, active);
      aluno = String(picked?.aluno || "").trim();
      itemKeyFromCycle = String(picked?.itemKey || "").trim();
      if (aluno) {
        consumeAlunoFromGlobalQueue(state, config.alunos || [], aluno);
        saveState(state);
      }
    }
    if (!aluno) {
      aluno = pickAluno();
    }
    const text = buildMessage(aula, aluno);
    const cardData = {
      turma: String(config.turma || ""),
      instituicao: String(config.instituicao || ""),
      titulo: String(aula.titulo || ""),
      materia: String(aula.materia || ""),
      professor: String(aula.professor || ""),
      aluno: String(aluno || ""),
      horario: String(aula.hora || "")
    };
    const message = await sendBotMessage(text, cardData);
    markCycleMessageSent(aluno, itemKeyFromCycle);

    saveLastRun({
      type: "forced",
      skipped: false,
      aluno,
      materia: aula.materia,
      messageId: message.id?._serialized || "sem-id",
      sentAt: new Date().toISOString()
    });

    return message;
  }, "forced");
}

export async function runTest() {
  assertSendConfig();
  const message = await sendBotMessage("Teste do saudação-bot via WhatsApp Web.");
  saveLastRun({
    type: "test",
    skipped: false,
    messageId: message.id?._serialized || "sem-id",
    sentAt: new Date().toISOString()
  });
  return message;
}

export async function sendAgendaListToDestination() {
  const { config, settings } = assertSendConfig();
  const state = getStateNormalized();
  const cycles = completeActiveCycleIfNeeded(loadCycles());
  saveCycles(cycles);
  const activeCycle = getActiveCycle(cycles);
  const text = buildAgendaListMessage(config, state, activeCycle);
  const message = await sendText({
    to: settings.to,
    groupId: settings.groupId,
    groupName: settings.groupName,
    text
  });

  saveLastRun({
    type: "agenda_list",
    skipped: false,
    destination: settings.groupName || settings.groupId || settings.to,
    messageId: message.id?._serialized || "sem-id",
    sentAt: new Date().toISOString()
  });

  return message;
}

function stopScheduler() {
  for (const job of scheduledJobs) {
    job.stop();
  }

  scheduledJobs = [];
  schedulerStarted = false;
}

export function reloadScheduler() {
  stopScheduler();
  startScheduler();
}

export function startScheduler() {
  const { config } = assertAppConfig();
  scheduleSummary = [];
  const scheduledSlots = new Set();
  const weekdaysWithClass = new Set();

  for (const { dia, aula } of getAgendaEntriesByConfig(config)) {
    weekdaysWithClass.add(String(dia));
    const { cronHour, cronMinute } = buildCronForAula(aula.hora, config.antecedenciaMin || 0);
    const expression = `${cronMinute} ${cronHour} * * ${dia}`;
    const label = `${String(cronHour).padStart(2, "0")}:${String(cronMinute).padStart(2, "0")}`;
    const slotKey = `${dia}|${cronHour}|${cronMinute}`;

    // Evita disparo duplicado no mesmo dia/horário quando há várias aulas no mesmo slot.
    if (!scheduledSlots.has(slotKey)) {
      const job = cron.schedule(expression, async () => {
        try {
          await runScheduledDispatch(config);
        } catch (error) {
          console.error(error);
        }
      }, { timezone: TZ });
      scheduledJobs.push(job);
      scheduledSlots.add(slotKey);
    }

    scheduleSummary.push({
      dia,
      horario: aula.hora,
      horarioDisparo: label,
      titulo: String(aula.titulo || ""),
      materia: aula.materia,
      professor: aula.professor
    });
    console.log(`⏰ Agendado: dia ${dia} às ${label} (${TZ})`);
  }

  for (let dia = 1; dia <= 6; dia += 1) {
    if (!isDiaPermitido(config, dia)) continue;
    if (weekdaysWithClass.has(String(dia))) continue;

    const expression = `0 11 * * ${dia}`;
    const slotKey = `${dia}|11|0|sem-aula`;
    if (scheduledSlots.has(slotKey)) continue;

    const job = cron.schedule(expression, async () => {
      try {
        await runScheduledDispatch(config);
      } catch (error) {
        console.error(error);
      }
    }, { timezone: TZ });

    scheduledJobs.push(job);
    scheduledSlots.add(slotKey);
    console.log(`⏰ Agendado aviso sem aula: dia ${dia} às 11:00 (${TZ})`);
  }

  schedulerStarted = true;
}

async function runScheduledDispatch(config) {
  const state = getStateNormalized();
  const cyclesPayload = completeActiveCycleIfNeeded(loadCycles());
  saveCycles(cyclesPayload);
  const activeCycle = getActiveCycle(cyclesPayload);
  const d = diaSemanaNumero();
  if (!isDiaPermitido(config, d)) {
    saveLastRun({
      type: "scheduled",
      skipped: true,
      reason: "dia_nao_permitido",
      sentAt: new Date().toISOString()
    });
    return null;
  }

  const aulasDoDia = getAgendaEntries(config)
    .filter((item) => item.dia === String(d))
    .map((item) => item.aula);

  if (aulasDoDia.length === 0) {
    const text = buildNoClassMessage();
    const message = await sendBotMessage(text, null, "no-class");
    saveLastRun({
      type: "scheduled",
      skipped: false,
      reason: "sem_aula_no_dia",
      messageId: message.id?._serialized || "sem-id",
      sentAt: new Date().toISOString()
    });
    return message;
  }

  const idxAulaBase = ((state.idxAula % aulasDoDia.length) + aulasDoDia.length) % aulasDoDia.length;
  const aula = aulasDoDia[idxAulaBase];
  state.idxAula = (idxAulaBase + 1) % aulasDoDia.length;
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  const pendingFromCycle = pickAgendaItemForCurrentDispatch(config, state, activeCycle, aula, new Date());
  const alunoFromCycle = String(pendingFromCycle?.alunoPrevisto || "").trim();
  const itemKeyFromCycle = String(pendingFromCycle?.itemKey || "").trim();
  const aluno = alunoFromCycle || (alunos.length ? normalizePendingOrder(state, alunos)[0] : "");
  if (!aluno) {
    throw new Error("Não foi possível selecionar o próximo aluno pendente.");
  }
  consumeAlunoFromGlobalQueue(state, alunos, aluno);
  state.updatedAt = new Date().toISOString();
  saveState(state);

  const text = buildMessage(aula, aluno);
  const cardData = {
    turma: String(config.turma || ""),
    instituicao: String(config.instituicao || ""),
    titulo: String(aula.titulo || ""),
    materia: String(aula.materia || ""),
    professor: String(aula.professor || ""),
    aluno: String(aluno || ""),
    horario: String(aula.hora || "")
  };
  const message = await sendBotMessage(text, cardData, "default");
  markCycleMessageSent(aluno, itemKeyFromCycle);

  saveLastRun({
    type: "scheduled",
    skipped: false,
    aluno,
    materia: aula.materia,
    messageId: message.id?._serialized || "sem-id",
    sentAt: new Date().toISOString()
  });

  return message;
}

export async function ensureInitialized() {
  assertAppConfig();
  bootstrapCycles();
  bootstrapLastRun();
  saveState(getStateNormalized());

  if (!initialized) {
    await initWhatsApp();
    initialized = true;
  }
}

export async function ensureService() {
  await ensureInitialized();

  if (!schedulerStarted) {
    startScheduler();
  }
}

export async function reconnectWhatsApp() {
  const client = await initWhatsApp();
  initialized = true;
  return {
    connected: Boolean(client),
    whatsapp: getWhatsAppStatus()
  };
}

export function getDashboardState() {
  const config = loadConfig();
  const settings = loadSettings();
  const state = getStateNormalized();
  const cycles = completeActiveCycleIfNeeded(loadCycles());
  saveCycles(cycles);
  const activeCycle = getActiveCycle(cycles);
  if (
    activeCycle &&
    (
      !Array.isArray(state.ordemVinculadaCiclo) ||
      !state.ordemVinculadaCiclo.length
    )
  ) {
    state.ordemVinculadaCiclo = getCycleLinkedOrder(
      config,
      state,
      Number(activeCycle.totalAlunos || 0)
    );
    state.updatedAt = new Date().toISOString();
    saveState(state);
  }
  const sortedSummary = sortPreviewSummaryLikeLessonsModal(
    getScheduleSummaryForPreview(config),
    state
  );
  const schedulePreview = buildSchedulePreview(
    config,
    state,
    sortedSummary,
    activeCycle ? Number(activeCycle.totalAlunos || 0) : null,
    String(activeCycle?.id || "no-cycle"),
    activeCycle ? Number(activeCycle.sentCount || 0) : 0
  );
  const publicConfig = {
    ...config,
    lockConfigured: Boolean(String(config?.lockPassword || "")),
    lockTimeoutMin: Number(config?.lockTimeoutMin || 15)
  };
  delete publicConfig.lockPassword;

  return {
    timezone: TZ,
    initialized,
    schedulerStarted,
    scheduleSummary,
    settings,
    config: publicConfig,
    state,
    cycle: {
      active: activeCycle,
      canStartNew: !activeCycle,
      history: getCycleHistory(cycles, 200)
    },
    schedulePreview,
    lastRun,
    whatsapp: getWhatsAppStatus()
  };
}

export function createNewCycle(customName = "") {
  const payload = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(payload);
  if (active) {
    throw new Error("Já existe um ciclo ativo. Finalize o ciclo atual para criar um novo.");
  }

  const cycle = createCycleSnapshotFromCurrentState("manual", customName);
  payload.activeCycleId = cycle.id;
  payload.cycles.push(cycle);
  saveCycles(payload);

  const config = loadConfig();
  const state = getStateNormalized();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  // Mantém a fila global atual como base do novo ciclo.
  state.ordemProximosAlunos = normalizePendingOrder(state, alunos);
  // Novo ciclo sempre começa alinhado à ordem global atual (não reaproveita sobra de ciclo antigo).
  state.ordemVinculadaCiclo = getCycleLinkedOrder(
    config,
    state,
    Number(cycle.totalAlunos || 0),
    true
  );
  state.efetivadosCiclo = [];
  state.revertidosEfetivados = [];
  state.efetivacoesManuais = [];
  state.updatedAt = new Date().toISOString();
  saveState(state);
  // Sincroniza pendentes do ciclo recém-criado automaticamente.
  refreshActiveCyclePending();
  return cycle;
}

export function cancelActiveCycle(options = {}) {
  const clearQueue = options?.clearQueue !== false;
  const payload = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(payload);
  if (!active) {
    throw new Error("Não existe ciclo ativo para cancelar.");
  }

  active.status = "completed";
  active.canceled = true;
  active.cancelReason = String(options?.reason || "manual");
  active.completedAt = new Date().toISOString();
  payload.activeCycleId = "";
  saveCycles(payload);

  if (clearQueue) {
    // Mantido sem limpeza adicional de filas.
  }

  return active;
}

export function refreshActiveCyclePending() {
  const payload = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(payload);
  if (!active) {
    throw new Error("Não existe ciclo ativo para atualizar.");
  }

  const config = loadConfig();
  const state = getStateNormalized();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];

  state.ordemProximosAlunos = normalizePendingOrder(state, alunos);
  state.ordemVinculadaCiclo = getCycleLinkedOrder(config, state, Number(active.totalAlunos || 0));
  state.efetivadosCiclo = Array.isArray(state.efetivadosCiclo)
    ? state.efetivadosCiclo.slice(0, Math.max(0, Number(active.sentCount || 0)))
    : [];
  state.updatedAt = new Date().toISOString();
  saveState(state);

  active.totalAlunos = getCycleCapacity(config);
  active.start = {
    idxAluno: Number(state.idxAluno || 0),
    idxAula: Number(state.idxAula || 0),
    dataInicio: String(state.dataInicio || "")
  };
  if (Number(active.sentCount || 0) > Number(active.totalAlunos || 0)) {
    active.sentCount = Number(active.totalAlunos || 0);
  }
  active.updatedAt = new Date().toISOString();
  saveCycles(payload);

  return {
    cycle: active,
    state
  };
}

export function clearCompletedCycles() {
  const payload = completeActiveCycleIfNeeded(loadCycles());
  const list = Array.isArray(payload.cycles) ? payload.cycles : [];
  const before = list.length;
  payload.cycles = list.filter((cycle) => String(cycle?.status || "") === "active");
  if (!payload.cycles.some((cycle) => cycle.id === payload.activeCycleId)) {
    payload.activeCycleId = "";
  }
  saveCycles(payload);

  return {
    removed: Math.max(0, before - payload.cycles.length),
    remaining: payload.cycles.length
  };
}

export function updateSettings(partial) {
  const current = loadSettings();
  const next = {
    to: String(partial.to ?? current.to ?? "").trim(),
    groupId: String(partial.groupId ?? current.groupId ?? "").trim(),
    groupName: String(partial.groupName ?? current.groupName ?? "").trim()
  };

  saveSettings(next);
  return next;
}

export function updateConfig(partial) {
  const current = loadConfig();
  const next = {
    ...current,
    turma: partial.turma ?? current.turma,
    instituicao: partial.instituicao ?? current.instituicao,
    antecedenciaMin: Number(partial.antecedenciaMin ?? current.antecedenciaMin),
    diasUteisApenas: asBoolean(
      partial?.diasUteisApenas,
      asBoolean(current?.diasUteisApenas, false)
    ),
    defaultGreetingMessage:
      partial && Object.prototype.hasOwnProperty.call(partial, "defaultGreetingMessage")
        ? String(partial.defaultGreetingMessage ?? "")
        : String(current?.defaultGreetingMessage ?? ""),
    defaultNoClassMessage:
      partial && Object.prototype.hasOwnProperty.call(partial, "defaultNoClassMessage")
        ? String(partial.defaultNoClassMessage ?? "")
        : String(current?.defaultNoClassMessage ?? ""),
    customMessageTemplate:
      partial && Object.prototype.hasOwnProperty.call(partial, "customMessageTemplate")
        ? String(partial.customMessageTemplate ?? "")
        : String(current?.customMessageTemplate ?? ""),
    greetingImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "greetingImagePath")
        ? String(partial.greetingImagePath ?? "").trim()
        : String(current?.greetingImagePath ?? ""),
    greetingMediaFileName:
      partial && Object.prototype.hasOwnProperty.call(partial, "greetingMediaFileName")
        ? String(partial.greetingMediaFileName ?? "").trim()
        : String(current?.greetingMediaFileName ?? ""),
    greetingBannerTitle:
      partial && Object.prototype.hasOwnProperty.call(partial, "greetingBannerTitle")
        ? String(partial.greetingBannerTitle ?? "").trim()
        : String(current?.greetingBannerTitle ?? ""),
    greetingBackgroundColor:
      partial && Object.prototype.hasOwnProperty.call(partial, "greetingBackgroundColor")
        ? String(partial.greetingBackgroundColor ?? "").trim()
        : String(current?.greetingBackgroundColor ?? ""),
    greetingBackgroundImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "greetingBackgroundImagePath")
        ? String(partial.greetingBackgroundImagePath ?? "").trim()
        : String(current?.greetingBackgroundImagePath ?? ""),
    noClassImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "noClassImagePath")
        ? String(partial.noClassImagePath ?? "").trim()
        : String(current?.noClassImagePath ?? ""),
    noClassMediaFileName:
      partial && Object.prototype.hasOwnProperty.call(partial, "noClassMediaFileName")
        ? String(partial.noClassMediaFileName ?? "").trim()
        : String(current?.noClassMediaFileName ?? ""),
    noClassBannerTitle:
      partial && Object.prototype.hasOwnProperty.call(partial, "noClassBannerTitle")
        ? String(partial.noClassBannerTitle ?? "").trim()
        : String(current?.noClassBannerTitle ?? ""),
    noClassBackgroundColor:
      partial && Object.prototype.hasOwnProperty.call(partial, "noClassBackgroundColor")
        ? String(partial.noClassBackgroundColor ?? "").trim()
        : String(current?.noClassBackgroundColor ?? ""),
    noClassBackgroundImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "noClassBackgroundImagePath")
        ? String(partial.noClassBackgroundImagePath ?? "").trim()
        : String(current?.noClassBackgroundImagePath ?? ""),
    customImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "customImagePath")
        ? String(partial.customImagePath ?? "").trim()
        : String(current?.customImagePath ?? ""),
    customMediaFileName:
      partial && Object.prototype.hasOwnProperty.call(partial, "customMediaFileName")
        ? String(partial.customMediaFileName ?? "").trim()
        : String(current?.customMediaFileName ?? ""),
    customBannerTitle:
      partial && Object.prototype.hasOwnProperty.call(partial, "customBannerTitle")
        ? String(partial.customBannerTitle ?? "").trim()
        : String(current?.customBannerTitle ?? ""),
    customBackgroundColor:
      partial && Object.prototype.hasOwnProperty.call(partial, "customBackgroundColor")
        ? String(partial.customBackgroundColor ?? "").trim()
        : String(current?.customBackgroundColor ?? ""),
    customBackgroundImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "customBackgroundImagePath")
        ? String(partial.customBackgroundImagePath ?? "").trim()
        : String(current?.customBackgroundImagePath ?? ""),
    backgroundColor:
      partial && Object.prototype.hasOwnProperty.call(partial, "backgroundColor")
        ? String(partial.backgroundColor ?? "").trim()
        : String(current?.backgroundColor ?? ""),
    backgroundImagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "backgroundImagePath")
        ? String(partial.backgroundImagePath ?? "").trim()
        : String(current?.backgroundImagePath ?? ""),
    imagePath:
      partial && Object.prototype.hasOwnProperty.call(partial, "imagePath")
        ? String(partial.imagePath ?? "").trim()
        : String(current?.imagePath ?? ""),
    mediaFileName:
      partial && Object.prototype.hasOwnProperty.call(partial, "mediaFileName")
        ? String(partial.mediaFileName ?? "").trim()
        : String(current?.mediaFileName ?? ""),
    bannerTitle:
      partial && Object.prototype.hasOwnProperty.call(partial, "bannerTitle")
        ? String(partial.bannerTitle ?? "").trim()
        : String(current?.bannerTitle ?? ""),
    imageStyle:
      partial && Object.prototype.hasOwnProperty.call(partial, "imageStyle")
        ? String(partial.imageStyle ?? "").trim()
        : String(current?.imageStyle ?? "banner")
  };

  if (partial && Object.prototype.hasOwnProperty.call(partial, "lockTimeoutMin")) {
    const timeout = Number(partial.lockTimeoutMin);
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 240) {
      throw new Error("Tempo de bloqueio inválido. Use entre 1 e 240 minutos.");
    }
    next.lockTimeoutMin = Math.floor(timeout);
  } else if (!Number.isFinite(Number(next.lockTimeoutMin))) {
    next.lockTimeoutMin = 15;
  }

  if (partial && Object.prototype.hasOwnProperty.call(partial, "lockPassword")) {
    next.lockPassword = String(partial.lockPassword ?? "");
  } else if (typeof next.lockPassword !== "string") {
    next.lockPassword = "";
  }

  saveConfig(next);
  reloadScheduler();
  return next;
}

export function validateLockPassword(password) {
  const config = loadConfig();
  const expected = String(config?.lockPassword || "");
  if (!expected) {
    return { ok: true, configured: false };
  }
  return {
    ok: String(password || "") === expected,
    configured: true
  };
}

export function validateDestinationPassword(password) {
  const config = loadConfig();
  const expected = String(
    config?.destinationLockPassword ||
    process.env.DESTINATION_LOCK_PASSWORD ||
    "admin"
  );
  return {
    ok: String(password || "") === expected,
    configured: true
  };
}

export function updateState(partial) {
  const current = getStateNormalized();
  const config = loadConfig();
  const next = { ...current };
  const cyclesPayload = completeActiveCycleIfNeeded(loadCycles());
  const activeCycle = getActiveCycle(cyclesPayload);
  const changingStartState = Boolean(
    partial && (
      Object.prototype.hasOwnProperty.call(partial, "idxAluno") ||
      Object.prototype.hasOwnProperty.call(partial, "idxAula") ||
      Object.prototype.hasOwnProperty.call(partial, "dataInicio")
    )
  );

  if (activeCycle && changingStartState && Number(activeCycle.sentCount || 0) > 0) {
    throw new Error(
      "Não é possível alterar o início com ciclo em andamento. Cancele o ciclo ativo ou crie um novo ciclo."
    );
  }

  if (partial && Object.prototype.hasOwnProperty.call(partial, "idxAluno")) {
    const total = Array.isArray(config.alunos) ? config.alunos.length : 0;
    if (total <= 0) {
      throw new Error("Não há alunos cadastrados para definir o início dos envios.");
    }

    const parsed = Number(partial.idxAluno);
    if (!Number.isInteger(parsed)) {
      throw new Error("idxAluno inválido.");
    }

    next.idxAluno = ((parsed % total) + total) % total;
    next.ordemProximosAlunos = buildStudentRotation(config.alunos || [], next.idxAluno);
  }

  if (partial && Object.prototype.hasOwnProperty.call(partial, "idxAula")) {
    const totalAulas = getAgendaEntries(config).length;
    if (totalAulas <= 0) {
      throw new Error("Não há aulas cadastradas para definir o início dos envios.");
    }

    const parsed = Number(partial.idxAula);
    if (!Number.isInteger(parsed)) {
      throw new Error("idxAula inválido.");
    }

    next.idxAula = ((parsed % totalAulas) + totalAulas) % totalAulas;
  }

  if (partial && Object.prototype.hasOwnProperty.call(partial, "dataInicio")) {
    const value = String(partial.dataInicio ?? "").trim();
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("dataInicio inválida. Use o formato YYYY-MM-DD.");
    }
    next.dataInicio = value;
  }

  if (activeCycle && changingStartState && Number(activeCycle.sentCount || 0) === 0) {
    activeCycle.start = {
      idxAluno: Number(next.idxAluno || 0),
      idxAula: Number(next.idxAula || 0),
      dataInicio: String(next.dataInicio || "")
    };
    next.ordemVinculadaCiclo = getCycleLinkedOrder(
      config,
      next,
      Number(activeCycle.totalAlunos || 0),
      true
    );
    next.revertidosEfetivados = [];
    next.efetivacoesManuais = [];
    next.efetivadosCiclo = [];
    activeCycle.updatedAt = new Date().toISOString();
    saveCycles(cyclesPayload);
  }

  next.updatedAt = new Date().toISOString();
  saveState(next);
  return next;
}

export function registerAbsence(aluno, pendingIndex) {
  const config = loadConfig();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  if (!alunos.length) {
    throw new Error("Não há alunos cadastrados.");
  }

  const state = getStateNormalized();
  const cycles = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(cycles);
  const cycleLimit = active ? Number(active.totalAlunos || 0) : null;
  const pending = getCycleLinkedOrder(config, state, cycleLimit);
  const normalizedAluno = String(aluno || "").trim();
  const pendingIdx = Number(pendingIndex);

  let index = -1;
  if (Number.isInteger(pendingIdx) && pendingIdx >= 0 && pendingIdx < pending.length) {
    if (!normalizedAluno || pending[pendingIdx] === normalizedAluno) {
      index = pendingIdx;
    }
  }
  if (index < 0 && normalizedAluno) {
    index = pending.indexOf(normalizedAluno);
  }
  if (index < 0) {
    throw new Error("Aluno pendente não encontrado para registrar ausência.");
  }

  if (pending.length <= 1 || index === pending.length - 1) {
    state.ordemVinculadaCiclo = pending;
    state.updatedAt = new Date().toISOString();
    saveState(state);
    return { moved: false, aluno: pending[index], ordemVinculadaCiclo: pending };
  }

  const [name] = pending.splice(index, 1);
  pending.push(name);
  state.ordemVinculadaCiclo = pending;
  state.updatedAt = new Date().toISOString();
  saveState(state);
  return { moved: true, aluno: name, ordemVinculadaCiclo: pending };
}

export function swapPendingStudents(fromPendingIndex, toPendingIndex, fromAluno, toAluno) {
  const config = loadConfig();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  if (!alunos.length) {
    throw new Error("Não há alunos cadastrados.");
  }

  const state = getStateNormalized();
  const cycles = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(cycles);
  const cycleLimit = active ? Number(active.totalAlunos || 0) : null;
  const pending = getCycleLinkedOrder(config, state, cycleLimit);
  const fromName = String(fromAluno || "").trim();
  const toName = String(toAluno || "").trim();
  let from = Number(fromPendingIndex);
  let to = Number(toPendingIndex);

  if (fromName && toName) {
    from = pending.indexOf(fromName);
    to = pending.indexOf(toName);
  }

  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error("Posições de troca inválidas.");
  }
  if (from < 0 || to < 0 || from >= pending.length || to >= pending.length) {
    throw new Error("Índices de troca fora da fila pendente.");
  }
  if (from === to) {
    return { changed: false, ordemVinculadaCiclo: pending };
  }

  const temp = pending[from];
  pending[from] = pending[to];
  pending[to] = temp;

  state.ordemVinculadaCiclo = pending;
  state.updatedAt = new Date().toISOString();
  saveState(state);
  return { changed: true, ordemVinculadaCiclo: pending };
}

export function revertEffectiveItem(aluno, itemKey) {
  const config = loadConfig();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  if (!alunos.length) {
    throw new Error("Não há alunos cadastrados.");
  }

  const state = getStateNormalized();
  const normalizedAluno = String(aluno || "").trim();
  if (!normalizedAluno) {
    throw new Error("Aluno inválido para reverter.");
  }
  if (!alunos.includes(normalizedAluno)) {
    throw new Error("Aluno informado não está cadastrado.");
  }

  const cycles = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(cycles);
  const linkedPending = getLinkedStudentsFromCycleView(config, state, active, true)
    .filter((name) => name !== normalizedAluno);
  linkedPending.push(normalizedAluno);
  state.ordemVinculadaCiclo = linkedPending;
  if (Array.isArray(state.efetivadosCiclo) && state.efetivadosCiclo.length) {
    const idxEfetivado = state.efetivadosCiclo.lastIndexOf(normalizedAluno);
    if (idxEfetivado >= 0) {
      state.efetivadosCiclo.splice(idxEfetivado, 1);
    }
  }

  const normalizedKey = normalizeAgendaItemKey(itemKey);
  if (normalizedKey) {
    const set = new Set(state.revertidosEfetivados || []);
    set.add(normalizedKey);
    state.revertidosEfetivados = [...set];
  }

  state.updatedAt = new Date().toISOString();
  saveState(state);

  if (active && Number(active.sentCount || 0) > 0) {
    active.sentCount = Number(active.sentCount || 0) - 1;
    if (active.sentCount < 0) active.sentCount = 0;
    saveCycles(cycles);
  }

  return {
    reverted: true,
    aluno: normalizedAluno,
    ordemVinculadaCiclo: linkedPending
  };
}

export function replaceEffectiveAluno(alunoPrevisto, itemKey, alunoEfetivado) {
  const config = loadConfig();
  const alunos = Array.isArray(config.alunos) ? config.alunos : [];
  if (!alunos.length) {
    throw new Error("Não há alunos cadastrados.");
  }

  const original = String(alunoPrevisto || "").trim();
  const key = normalizeAgendaItemKey(itemKey);
  const performer = String(alunoEfetivado || "").trim();

  if (!key) {
    throw new Error("Item de agenda inválido para correção.");
  }
  if (!performer) {
    throw new Error("Informe quem realizou a saudação.");
  }
  if (!alunos.includes(performer)) {
    throw new Error("Aluno informado não está cadastrado.");
  }
  if (original && !alunos.includes(original)) {
    throw new Error("Aluno previsto não está cadastrado.");
  }

  const state = getStateNormalized();
  const pending = normalizePendingOrder(state, alunos);
  const cycles = completeActiveCycleIfNeeded(loadCycles());
  const active = getActiveCycle(cycles);
  const cycleLimit = active ? Number(active.totalAlunos || 0) : null;
  let linkedPendingBase = getCycleLinkedOrder(config, state, cycleLimit);
  if (!linkedPendingBase.length) {
    linkedPendingBase = getLinkedStudentsFromCycleView(config, state, active, true);
  }

  if (!linkedPendingBase.includes(performer)) {
    throw new Error("Aluno efetivado deve estar na fila pendente do ciclo atual.");
  }

  let linkedPending = linkedPendingBase.filter((name) => name !== performer);
  if (original && original !== performer) {
    linkedPending = linkedPending.filter((name) => name !== original);
    linkedPending.push(original);
  }

  // Importante: não reordenar a fila global aqui.
  // A correção de efetivação atua somente na fila vinculada do ciclo.
  const merged = pending;

  // Mantém a data como efetivada (não reabre como pendente).
  const reverted = new Set(state.revertidosEfetivados || []);
  reverted.delete(key);
  state.revertidosEfetivados = [...reverted];

  // Registra quem realmente efetivou nesta data.
  const overrides = Array.isArray(state.efetivacoesManuais) ? [...state.efetivacoesManuais] : [];
  const idx = overrides.findIndex((item) => item?.itemKey === key);
  const entry = { itemKey: key, aluno: performer };
  if (idx >= 0) {
    overrides[idx] = entry;
  } else {
    overrides.push(entry);
  }
  state.efetivacoesManuais = overrides;

  state.ordemProximosAlunos = merged;
  state.ordemVinculadaCiclo = linkedPending;
  if (Array.isArray(state.efetivadosCiclo) && state.efetivadosCiclo.length) {
    const idxOriginal = state.efetivadosCiclo.lastIndexOf(original);
    if (idxOriginal >= 0) {
      state.efetivadosCiclo[idxOriginal] = performer;
    }
  }
  state.updatedAt = new Date().toISOString();
  saveState(state);

  return {
    corrected: true,
    itemKey: key,
    alunoPrevisto: original,
    alunoEfetivado: performer,
    ordemProximosAlunos: merged
  };
}

export function getAgendaEditorJson() {
  const config = loadConfig();

  return {
    alunos: config.alunos || [],
    alunoDetalhes: buildStudentDetailsForEditor(config),
    agendaSemanal: config.agendaSemanal || {}
  };
}

export function updateAgendaEditorJson(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("JSON inválido.");
  }

  const alunos = Array.isArray(payload.alunos)
    ? payload.alunos.map((item) => String(item || "").trim()).filter(Boolean)
    : null;

  if (!alunos || alunos.length === 0) {
    throw new Error("O campo alunos é obrigatório e não pode ser vazio.");
  }

  validateAgendaSemanal(payload.agendaSemanal);
  const agendaSemanalNormalized = normalizeAgendaSemanal(payload.agendaSemanal);
  const alunoDetalhes = normalizeStudentDetails(payload?.alunoDetalhes, alunos);

  const config = loadConfig();
  config.alunos = alunos;
  config.alunoDetalhes = alunoDetalhes;
  config.agendaSemanal = agendaSemanalNormalized;
  saveConfig(config);
  const state = getStateNormalized();
  state.ordemProximosAlunos = normalizePendingOrder(state, alunos);
  state.updatedAt = new Date().toISOString();
  saveState(state);
  reloadScheduler();
  // Atualização automática segura: se houver ciclo ativo, sincroniza apenas pendentes.
  const cycles = completeActiveCycleIfNeeded(loadCycles());
  if (getActiveCycle(cycles)) {
    refreshActiveCyclePending();
  }
  return getAgendaEditorJson();
}

export async function getGroups() {
  const wa = getWhatsAppStatus() || {};
  const phase = String(wa.phase || "");
  const sender = String(wa.sender || "");
  const ready = ["ready", "authenticated"].includes(phase) || Boolean(sender);
  if (!ready) {
    return [];
  }

  return await Promise.race([
    listGroups(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout_groups")), 15000))
  ]);
}
