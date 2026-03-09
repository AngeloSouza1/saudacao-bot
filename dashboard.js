import http from "http";
import dotenv from "dotenv";
import {
  cancelActiveCycle,
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
  swapPendingStudents,
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
  <style>
    :root {
      --bg: #eef3e8;
      --card: #fbfcf7;
      --ink: #163126;
      --muted: #5b7267;
      --line: #ced8cb;
      --accent: #2c7a4b;
      --accent-2: #dff3d9;
      --danger: #a43a2f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      height: 100vh;
      overflow: hidden;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 17px;
      color: var(--ink);
      background:
        radial-gradient(circle at top right, #dbead5 0, transparent 32%),
        radial-gradient(circle at bottom left, #d5e7f0 0, transparent 28%),
        var(--bg);
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      height: 100vh;
      padding: 10px 18px;
      display: grid;
      grid-template-rows: auto auto 1fr;
      gap: 10px;
      overflow: hidden;
    }
    .hero, .card {
      background: rgba(251, 252, 247, 0.92);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px;
      box-shadow: 0 14px 40px rgba(22, 49, 38, 0.06);
      backdrop-filter: blur(10px);
    }
    .hero {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      padding: 14px 18px;
      background:
        linear-gradient(120deg, rgba(44, 122, 75, 0.08), rgba(44, 122, 75, 0.02)),
        rgba(251, 252, 247, 0.92);
    }
    .hero-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .hero-logo {
      width: 58px;
      height: 58px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, #1f5b3a, #2f8555);
      color: #e9f7eb;
      font-weight: 700;
      font-size: 24px;
      letter-spacing: 0.6px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 18px rgba(22,49,38,0.18);
      border: 1px solid rgba(255,255,255,0.2);
      flex: 0 0 auto;
    }
    .hero-logo-mark {
      transform: translateY(-1px);
    }
    .hero-title {
      margin: 0;
      font-size: 42px;
      line-height: 1.02;
      letter-spacing: 0.2px;
    }
    .hero-subtitle {
      margin-top: 8px;
      color: var(--muted);
      font-size: 17px;
    }
    .hero-meta {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 40px;
      flex-wrap: wrap;
    }
    .hero-cycle {
      color: #2d5a49;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.15;
    }
    h1, h2 { margin: 0 0 8px; }
    h1 { font-size: 34px; }
    h2 { font-size: 20px; }
    .muted { color: var(--muted); font-size: 18px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 10px;
      align-items: stretch;
      min-height: 0;
    }
    .status-stack {
      grid-template-columns: 1fr;
    }
    .wrap > .grid > .card {
      height: 100%;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }
    .status-card {
      order: -1;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: var(--accent-2);
      color: var(--accent);
      font-weight: bold;
      border: 1px solid transparent;
      transition: all 220ms ease;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: currentColor;
    }
    .status-ok {
      background: #def3dc;
      color: #226e43;
      border-color: #c4e8c1;
    }
    .status-warn {
      background: #fff3dc;
      color: #8a5b14;
      border-color: #f1ddbb;
    }
    .status-error {
      background: #ffe4df;
      color: #9f3025;
      border-color: #f5c2b8;
    }
    label {
      display: block;
      font-size: 15px;
      color: var(--muted);
      margin-bottom: 7px;
      letter-spacing: 0.1px;
      font-weight: 600;
    }
    textarea {
      width: 100%;
      min-height: 240px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: white;
      color: var(--ink);
      font: 13px/1.45 "Courier New", monospace;
      outline: none;
      resize: vertical;
      transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
    }
    textarea:hover {
      border-color: #b5c6b9;
    }
    textarea:focus {
      border-color: #2c7a4b;
      box-shadow: 0 0 0 3px rgba(44, 122, 75, 0.15);
      background-color: #fcfffb;
    }
    input, select {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: white;
      color: var(--ink);
      font: inherit;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
    }
    input:hover, select:hover {
      border-color: #b5c6b9;
    }
    input:focus, select:focus {
      border-color: #caa427;
      box-shadow: 0 0 0 3px rgba(248, 212, 91, 0.35);
      background-color: #fff9d6;
    }
    .modal input:focus,
    .modal select:focus {
      border-color: #caa427;
      box-shadow: 0 0 0 3px rgba(248, 212, 91, 0.35);
      background-color: #fff9d6;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 11px 14px;
      font: inherit;
      font-weight: bold;
      cursor: pointer;
      background: var(--ink);
      color: white;
      transition: transform 140ms ease, box-shadow 180ms ease, background-color 180ms ease;
      box-shadow: 0 6px 18px rgba(22, 49, 38, 0.18);
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 9px 20px rgba(22, 49, 38, 0.24);
    }
    button:active {
      transform: translateY(0);
      box-shadow: 0 4px 10px rgba(22, 49, 38, 0.2);
    }
    button.secondary {
      background: white;
      color: var(--ink);
      border: 1px solid var(--line);
      box-shadow: none;
    }
    button.secondary.active {
      background: #e7f2e7;
      border-color: #7ea98a;
      font-weight: 700;
    }
    button.icon-btn {
      width: 44px;
      min-width: 44px;
      padding: 10px 0;
      font-size: 18px;
      line-height: 1;
      text-align: center;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-refresh {
      border-color: #b9c8bc !important;
      background: #ffffff !important;
    }
    .btn-test {
      background: linear-gradient(135deg, #2f7e4f, #205e3a);
    }
    .btn-now {
      background: linear-gradient(135deg, #2d674d, #173f2e);
    }
    .btn-save {
      background: linear-gradient(135deg, #2b6c46, #1b4b33);
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .card-head h2 {
      margin: 0;
    }
    .card-head .buttons {
      margin-top: 0;
      justify-content: flex-end;
    }
    .card-access {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .card-access-btn {
      min-height: 56px;
      font-size: 18px;
      font-weight: 700;
      border-radius: 14px;
      background: linear-gradient(135deg, #2d674d, #173f2e);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .card-content-modal {
      width: min(920px, 100%);
      max-height: 92vh;
      overflow: auto;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 16px;
      display: grid;
      gap: 12px;
      font-size: 18px;
    }
    .next-greetings-box {
      margin-top: 8px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f9fcf7;
      min-height: 96px;
      max-height: 260px;
      overflow: auto;
      font-size: 17px;
      line-height: 1.45;
    }
    .next-greetings-box ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }
    .next-greetings-box li {
      margin: 0;
      padding: 10px 12px;
      border: 1px solid #b8c9ba;
      border-radius: 10px;
      line-height: 1.45;
      font-size: 17px;
    }
    .next-greetings-box li:nth-child(odd) {
      background: #edf5ec;
    }
    .next-greetings-box li:nth-child(even) {
      background: #e3efe1;
    }
    .status-actions {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
    }
    .status-actions button {
      white-space: nowrap;
      padding: 8px 10px;
      font-size: 14px;
      border-radius: 10px;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 18px;
    }
    .agenda-list {
      margin-top: 8px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f9fcf7;
      min-height: 98px;
      max-height: 146px;
      overflow: auto;
      font-size: 18px;
      line-height: 1.5;
    }
    #modal-lessons {
      max-height: none;
    }
    .agenda-list ul {
      margin: 0;
      padding-left: 18px;
    }
    .agenda-list li {
      margin-bottom: 4px;
    }
    .last-run-box {
      margin-top: 12px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f9fcf7;
      min-height: 88px;
    }
    .last-run-list {
      display: grid;
      gap: 6px;
      font-size: 17px;
    }
    .last-run-item b {
      color: var(--ink);
    }
    .last-run-code {
      font-family: "Courier New", monospace;
      font-size: 13px;
      word-break: break-all;
      color: #355647;
    }
    .last-run-title {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 700;
    }
    .json-editor {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--line);
    }
    .editor-grid {
      display: grid;
      gap: 10px;
    }
    .mini-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      align-items: center;
      margin-bottom: 6px;
    }
    .mini-row select,
    .mini-row input {
      height: 42px;
      min-width: 0;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 18px;
      margin-top: 10px;
    }
    .table th, .table td {
      text-align: left;
      border-bottom: 1px solid var(--line);
      padding: 8px 6px;
    }
    .table tbody tr:not(.is-editing-row):nth-child(odd) {
      background: #eaf4e8;
    }
    .table tbody tr:not(.is-editing-row):nth-child(even) {
      background: #dcebd9;
    }
    .table tr.is-editing-row {
      background: #fff7d1;
    }
    .log {
      margin-top: 10px;
      padding: 12px;
      border-radius: 12px;
      background: linear-gradient(135deg, #edf7ea, #e3f0df);
      border: 1px solid #b8cdb8;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      min-height: 48px;
      white-space: pre-wrap;
      font-size: 14px;
    }
    .log.danger {
      background: linear-gradient(135deg, #fdecea, #f8dedd);
      border-color: #dfb7b2;
    }
    .card > h2 + .row,
    .card > h2 + div,
    .card > h2 + .muted {
      margin-top: 10px;
    }
    .config-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .config-head h2 {
      margin: 0;
    }
    .config-head .buttons {
      margin-top: 0;
      flex-wrap: nowrap;
      gap: 8px;
    }
    .config-head .buttons button {
      white-space: nowrap;
      padding: 9px 12px;
    }
    .config-head + .row {
      margin-top: 12px;
    }
    .danger { color: var(--danger); }
    .status-lines-grid {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .status-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid #c8d4c8;
      border-radius: 10px;
      background: linear-gradient(180deg, #f9fcf7, #f2f8ef);
      font-size: 17px;
      line-height: 1.25;
    }
    .status-label {
      color: #486258;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.1px;
      white-space: nowrap;
    }
    .status-value {
      color: var(--ink);
      font-weight: 600;
      min-width: 0;
      text-align: right;
      word-break: break-word;
    }
    .mobile-quick {
      display: none;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(18, 33, 26, 0.45);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 90;
    }
    .modal-backdrop.open {
      display: flex;
    }
    #destination-card-modal,
    #config-card-modal,
    #agenda-card-modal {
      z-index: 100;
    }
    #editor-modal,
    #agenda-modal,
    #cycles-modal {
      z-index: 130;
    }
    #confirm-modal,
    #info-modal,
    #new-cycle-modal {
      z-index: 150;
    }
    #swap-modal {
      z-index: 160;
    }
    #effective-fix-modal {
      z-index: 170;
    }
    .modal {
      width: min(1180px, 100%);
      max-height: 92vh;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .modal .grid {
      align-items: stretch;
    }
    .modal .grid .card {
      min-height: 0;
    }
    .modal .grid .card.lessons-card {
      min-height: 0;
    }
    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .modal-head-actions {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .confirm-modal {
      width: min(520px, 100%);
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 18px;
      display: grid;
      gap: 12px;
    }
    .confirm-title {
      margin: 0;
      font-size: 22px;
    }
    .confirm-text {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 17px;
    }
    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .app-loading {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(18, 33, 26, 0.46);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      transition: opacity 220ms ease, visibility 220ms ease;
    }
    .app-loading.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .wa-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 130;
      background: rgba(4, 8, 6, 0.88);
      backdrop-filter: blur(4px) saturate(0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      transition: opacity 220ms ease, visibility 220ms ease;
    }
    .wa-login-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .wa-login-card {
      width: min(540px, 100%);
      border-radius: 16px;
      border: 1px solid #3f5a4b;
      background: #17261f;
      box-shadow: 0 26px 64px rgba(0, 0, 0, 0.55);
      padding: 18px;
      display: grid;
      gap: 12px;
      text-align: center;
      color: #e9f2eb;
    }
    .wa-login-title {
      margin: 0;
      font-size: 26px;
      color: #f2faf4;
    }
    .wa-login-text {
      margin: 0;
      color: #bcd1c4;
      line-height: 1.45;
      font-size: 17px;
    }
    .wa-login-qr-wrap {
      border: 1px solid #3b5647;
      border-radius: 14px;
      background: #102019;
      padding: 12px;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wa-login-qr {
      width: 100%;
      max-width: 300px;
      height: auto;
      image-rendering: pixelated;
      border-radius: 10px;
      border: 1px solid #d9e4d5;
      background: #fff;
    }
    .wa-login-actions {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .wa-login-feedback {
      min-height: 22px;
      font-size: 16px;
      color: #bcd1c4;
    }
    .wa-login-feedback.ok {
      color: #9fe0b2;
    }
    .wa-login-feedback.error {
      color: #ffb3aa;
    }
    .qr-connect-overlay {
      position: fixed;
      inset: 0;
      z-index: 128;
      background: rgba(10, 20, 15, 0.72);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      transition: opacity 220ms ease, visibility 220ms ease;
    }
    .qr-connect-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .qr-connect-card {
      width: min(460px, 100%);
      border-radius: 16px;
      border: 1px solid #3f5a4b;
      background: #17261f;
      box-shadow: 0 26px 64px rgba(0, 0, 0, 0.55);
      padding: 18px;
      display: grid;
      gap: 10px;
      text-align: center;
      color: #e9f2eb;
    }
    .qr-connect-title {
      margin: 0;
      font-size: 26px;
      color: #f2faf4;
    }
    .qr-connect-text {
      margin: 0;
      color: #bcd1c4;
      line-height: 1.45;
      font-size: 17px;
    }
    .lock-overlay {
      position: fixed;
      inset: 0;
      z-index: 180;
      background: rgba(4, 8, 6, 0.82);
      backdrop-filter: blur(5px) saturate(0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      transition: opacity 220ms ease, visibility 220ms ease;
    }
    .lock-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .lock-card {
      width: min(460px, 100%);
      border-radius: 16px;
      border: 1px solid #3f5a4b;
      background: #17261f;
      box-shadow: 0 26px 64px rgba(0, 0, 0, 0.55);
      padding: 18px;
      display: grid;
      gap: 10px;
      color: #e9f2eb;
    }
    .lock-title {
      margin: 0;
      font-size: 28px;
      color: #f2faf4;
      text-align: center;
    }
    .lock-text {
      margin: 0;
      color: #bcd1c4;
      text-align: center;
      font-size: 17px;
    }
    .lock-card label {
      color: #d7e7dc;
      font-size: 16px;
      margin-bottom: 4px;
    }
    .lock-card input {
      background: #f4f8f3;
      color: #173225;
    }
    .lock-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .app-loading-card {
      width: min(440px, 100%);
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 18px;
      display: grid;
      gap: 10px;
      text-align: center;
    }
    .app-loading-title {
      margin: 0;
      font-size: 24px;
    }
    .app-loading-text {
      margin: 0;
      color: var(--muted);
      font-size: 17px;
    }
    .app-loading-checklist {
      margin: 4px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f6faf4;
      text-align: left;
      display: grid;
      gap: 6px;
      font-size: 16px;
    }
    .app-loading-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
    }
    .app-loading-item.done {
      color: #1f5d3c;
      font-weight: 600;
    }
    .app-loading-icon {
      width: 18px;
      text-align: center;
      font-weight: 700;
    }
    .loader-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent);
      margin: 0 auto;
      box-shadow: 0 0 0 rgba(44, 122, 75, 0.45);
      animation: loader-pulse 1.2s infinite;
    }
    @keyframes loader-pulse {
      0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(44, 122, 75, 0.45); }
      70% { transform: scale(1); box-shadow: 0 0 0 14px rgba(44, 122, 75, 0); }
      100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(44, 122, 75, 0); }
    }
    .btn-danger {
      background: linear-gradient(135deg, #b24a3f, #8f2f24);
    }
    .info-modal {
      width: min(460px, 100%);
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 18px;
      display: grid;
      gap: 12px;
    }
    .info-title {
      margin: 0;
      font-size: 22px;
    }
    .info-text {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 17px;
    }
    .info-actions {
      display: flex;
      justify-content: flex-end;
    }
    .swap-modal {
      width: min(480px, 100%);
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 18px;
      display: grid;
      gap: 12px;
    }
    .swap-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 4px;
    }
    .is-hidden {
      display: none !important;
    }
    .students-list {
      --student-row-height: 52px;
      display: grid;
      gap: 6px;
      margin-top: 8px;
      height: calc((var(--student-row-height) * 9) + (6px * 8) + 16px);
      overflow: auto;
      padding: 8px;
      padding-right: 4px;
      align-content: start;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f9fcf7;
    }
    .student-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      min-height: var(--student-row-height);
      box-sizing: border-box;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #f7fbf5;
      font-size: 16px;
    }
    .students-list .student-item:nth-child(odd) {
      background: #eaf4e8;
    }
    .students-list .student-item:nth-child(even) {
      background: #dcebd9;
    }
    .student-actions {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .field-invalid {
      border-color: #b23d31 !important;
      box-shadow: 0 0 0 3px rgba(178, 61, 49, 0.18) !important;
      background-color: #fff2ef !important;
    }
    .field-invalid:focus {
      border-color: #caa427 !important;
      box-shadow: 0 0 0 3px rgba(248, 212, 91, 0.35) !important;
      background-color: #fff9d6 !important;
    }
    .field-dirty {
      border-color: #caa427 !important;
      box-shadow: 0 0 0 3px rgba(248, 212, 91, 0.28) !important;
      background-color: #fff8d2 !important;
    }
    .muted-small {
      color: var(--muted);
      font-size: 15px;
    }
    .inline-hint-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
      margin-bottom: 6px;
    }
    .inline-hint-row .buttons {
      margin-top: 0;
    }
    .inline-hint {
      color: var(--muted);
      font-size: 15px;
      line-height: 1.35;
    }
    .cycle-history {
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #f8fbf6;
      padding: 10px;
      min-height: 0;
      max-height: none;
      overflow: visible;
    }
    .cycle-history-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 700;
    }
    .cycle-history-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .cycle-history-head .cycle-history-title {
      margin: 0;
    }
    .cycle-history-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .cycle-history-item {
      border: 1px solid #c5d3c5;
      border-radius: 8px;
      padding: 7px 8px;
      background: #f2f8ef;
      font-size: 15px;
      color: #355647;
      line-height: 1.35;
    }
    .cycle-history-item.active {
      border-color: #9fc79f;
      background: #e3f2df;
    }
    .cycle-history-item.completed {
      border-color: #b9c8bc;
      background: #edf4ea;
    }
    .cycle-modal-controls {
      display: flex;
      align-items: end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cycle-modal-controls > div {
      min-width: 180px;
      flex: 1;
    }
    .inline-field-action {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: end;
      margin-top: 12px;
    }
    .inline-field-action .buttons {
      margin-top: 0;
      flex-wrap: nowrap;
    }
    .agenda-modal {
      width: min(760px, 100%);
      max-height: 88vh;
      overflow: auto;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #fbfcf7;
      box-shadow: 0 24px 60px rgba(10, 27, 18, 0.25);
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .agenda-modal-list {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f9fcf7;
      padding: 12px 14px;
    }
    .agenda-modal-list ul {
      margin: 0;
      padding-left: 0;
      list-style: none;
    }
    .agenda-modal-list li {
      margin-bottom: 6px;
      line-height: 1.45;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      list-style: none;
    }
    .agenda-modal-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .agenda-modal-item-text {
      min-width: 0;
      flex: 1 1 auto;
    }
    .agenda-modal-item-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    .agenda-absence-btn {
      padding: 7px 10px;
      border-radius: 10px;
      white-space: nowrap;
      font-size: 14px;
    }
    .agenda-swap-btn {
      padding: 7px 10px;
      border-radius: 10px;
      white-space: nowrap;
      font-size: 14px;
    }
    .agenda-revert-btn {
      padding: 7px 10px;
      border-radius: 10px;
      white-space: nowrap;
      font-size: 14px;
    }
    .agenda-swap-btn {
      padding: 7px 10px;
      border-radius: 10px;
      white-space: nowrap;
      font-size: 14px;
    }
    .agenda-modal-list li::before {
      content: "";
    }
    .agenda-modal-list li:nth-child(odd) {
      background: #eaf4e8;
    }
    .agenda-modal-list li:nth-child(even) {
      background: #dcebd9;
    }
    .agenda-modal-list li.done {
      background: linear-gradient(135deg, #d4ead1, #c6e0c3) !important;
      border-color: #7fae7b;
      border-left: 4px solid #2f7d42;
      color: #2f5c3d;
    }
    .agenda-modal-list li.done .agenda-check {
      color: #2f7d42;
      font-weight: 700;
    }
    .agenda-done-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #8eb88a;
      background: #e9f6e7;
      color: #2f7d42;
      font-size: 12px;
      font-weight: 700;
      vertical-align: middle;
    }
    .agenda-modal-list li .agenda-check {
      margin-right: 6px;
      color: #5b7267;
      font-weight: 700;
    }
    .agenda-modal-list li:last-child {
      margin-bottom: 0;
    }
    @media (max-width: 640px) {
      body {
        padding-bottom: 82px;
        height: auto;
        overflow: auto;
      }
      .wrap {
        height: auto;
        grid-template-rows: none;
        overflow: visible;
        padding: 14px;
        gap: 12px;
      }
      .hero {
        display: block;
        padding: 16px;
      }
      .hero-title {
        font-size: 32px;
      }
      .hero-brand {
        gap: 10px;
      }
      .hero-logo {
        width: 46px;
        height: 46px;
        font-size: 18px;
        border-radius: 12px;
      }
      .hero-subtitle {
        font-size: 15px;
      }
      .status {
        margin-top: 10px;
        width: fit-content;
      }
      .grid {
        gap: 12px;
      }
      .status-card {
        position: sticky;
        top: 8px;
        z-index: 10;
      }
      .status-line {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        font-size: 16px;
      }
      .card {
        padding: 16px;
      }
      .row {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .buttons {
        gap: 8px;
      }
      .buttons button {
        width: 100%;
      }
      .agenda-list {
        min-height: 0;
      }
      .last-run-box {
        min-height: 0;
      }
      .mobile-quick {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        position: fixed;
        left: 10px;
        right: 10px;
        bottom: 10px;
        z-index: 30;
        padding: 8px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(251, 252, 247, 0.96);
        box-shadow: 0 10px 30px rgba(22, 49, 38, 0.18);
      }
      .mobile-quick button {
        width: 100%;
        padding: 10px 8px;
        border-radius: 10px;
        font-size: 14px;
      }
      .mini-row {
        grid-template-columns: 1fr;
      }
      .inline-field-action {
        grid-template-columns: 1fr;
      }
      .inline-field-action .buttons {
        width: 100%;
      }
      .inline-field-action .buttons button {
        width: 100%;
      }
      .modal {
        max-height: 94vh;
        padding: 12px;
      }
      .status-actions {
        flex-wrap: wrap;
      }
      .card-access {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="hero-brand">
        <div class="hero-logo" aria-hidden="true"><span class="hero-logo-mark">SB</span></div>
        <div>
          <h1 class="hero-title">Saudação Bot</h1>
          <div class="hero-meta">
            <div class="hero-subtitle">Painel local para sessão, destino e disparo imediato.</div>
            <div id="hero-cycle" class="hero-cycle" style="display:none;"></div>
          </div>
        </div>
      </div>
      <div id="status-badge" class="status"><span class="dot"></span><span>Carregando...</span></div>
    </section>

    <section class="grid status-stack">
      <div class="card lessons-card">
        <div class="card-head">
          <h2>Status</h2>
          <div class="buttons status-actions">
            <button id="btn-refresh" class="secondary btn-refresh">Atualizar</button>
            <button id="btn-test" class="btn-test">Enviar Teste</button>
            <button id="btn-now" class="btn-now">Enviar Agora</button>
            <button id="btn-now-forced" class="btn-now">Enviar Forçado</button>
            <button id="btn-lock-now" class="secondary">Bloquear</button>
          </div>
        </div>
        <div id="status-lines" class="muted">Carregando...</div>
        <div id="action-log" class="log"></div>
        <div class="card-access">
          <button id="btn-open-destination-modal" class="card-access-btn">📲 Destino</button>
          <button id="btn-open-config-modal" class="card-access-btn">⚙️ Configuração</button>
          <button id="btn-open-agenda-card-modal" class="card-access-btn">📅 Agenda</button>
        </div>
      </div>

      <div class="card">
        <h2>Próximas saudações</h2>
        <div id="next-greetings" class="next-greetings-box muted">Carregando...</div>
      </div>
    </section>
  </div>

  <div id="qr-connect-overlay" class="qr-connect-overlay hidden" aria-live="polite">
    <section class="qr-connect-card" role="status">
      <div class="loader-dot"></div>
      <h2 class="qr-connect-title">Acesso em andamento</h2>
      <p id="qr-connect-text" class="qr-connect-text">QR validado. Carregando e acessando a aplicação...</p>
    </section>
  </div>

  <div id="wa-login-overlay" class="wa-login-overlay hidden" aria-live="polite">
    <section class="wa-login-card" role="status">
      <h2 class="wa-login-title">Login do WhatsApp</h2>
      <p id="wa-login-text" class="wa-login-text">Aguardando conexão do WhatsApp Web.</p>
      <div class="wa-login-qr-wrap">
        <img id="wa-login-qr" class="wa-login-qr is-hidden" alt="QR Code para login no WhatsApp Web">
        <div id="wa-login-empty" class="muted">QR Code ainda não disponível. Clique em “Gerar QR”.</div>
      </div>
      <div class="wa-login-actions">
        <button id="btn-wa-reconnect" class="btn-save">Gerar QR</button>
      </div>
      <div id="wa-login-feedback" class="wa-login-feedback"></div>
    </section>
  </div>

  <div id="app-loading" class="app-loading" aria-live="polite" aria-busy="true">
    <section class="app-loading-card" role="status">
      <div class="loader-dot"></div>
      <h2 id="app-loading-title" class="app-loading-title">Carregando aplicação</h2>
      <p id="app-loading-text" class="app-loading-text">Aguarde enquanto inicializamos o painel.</p>
      <div id="app-loading-checklist" class="app-loading-checklist"></div>
    </section>
  </div>

  <nav class="mobile-quick">
    <button id="m-btn-refresh" class="secondary">Atualizar</button>
    <button id="m-btn-test" class="btn-test">Teste</button>
    <button id="m-btn-now" class="btn-now">Agora</button>
    <button id="m-btn-now-forced" class="btn-now">Forçado</button>
  </nav>

  <div id="editor-modal" class="modal-backdrop" aria-hidden="true">
    <section class="modal">
      <div class="modal-head">
        <h2>Editor de Agenda</h2>
        <div class="modal-head-actions">
          <button id="btn-close-modal" class="secondary">Fechar</button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h2>Alunos</h2>
          <div class="row">
            <div style="grid-column: 1 / -1;">
              <label for="modal-student-name">Nome do aluno</label>
              <input id="modal-student-name" placeholder="Ex.: Angelo">
            </div>
          </div>
          <div class="buttons">
            <button id="btn-add-student" class="btn-save">Adicionar Aluno</button>
            <button id="btn-save-student-edit" class="secondary is-hidden">Salvar Edição</button>
          </div>
          <div class="muted-small" style="margin-top:6px;">Para adicionar aluno, preencha corretamente o nome do aluno.</div>
          <div id="modal-students" class="students-list"></div>
        </div>

        <div class="card">
          <h2>Aulas da Semana</h2>
          <div class="mini-row">
            <select id="modal-dia">
              <option value="1">1 - Segunda</option>
              <option value="2">2 - Terça</option>
              <option value="3">3 - Quarta</option>
              <option value="4">4 - Quinta</option>
              <option value="5">5 - Sexta</option>
              <option value="6">6 - Sábado</option>
              <option value="0">0 - Domingo</option>
            </select>
            <input id="modal-hora" type="time" step="60" autocomplete="off">
            <input id="modal-titulo" placeholder="Título da aula">
            <input id="modal-materia" placeholder="Matéria">
            <input id="modal-professor" placeholder="Professor(a)">
          </div>
          <div class="inline-hint-row">
            <div class="buttons">
              <button id="btn-add-lesson" class="btn-save">Adicionar Aula</button>
              <button id="btn-save-lesson-edit" class="secondary is-hidden">Salvar Edição</button>
              <button id="btn-cancel-lesson-edit" class="secondary is-hidden">Cancelar</button>
            </div>
            <div class="inline-hint">Clique em Editar para carregar uma aula nos campos e salvar as alterações.</div>
          </div>
          <div class="muted-small">Para adicionar aula, preencha corretamente dia, hora, título, matéria e professor.</div>
          <div id="modal-lessons" class="agenda-list" style="margin-top:8px; height:330px; max-height:none; overflow:auto;"></div>
        </div>
      </div>

    </section>
  </div>

  <div id="confirm-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <h2 id="confirm-title" class="confirm-title">Confirmar exclusão</h2>
      <p id="confirm-text" class="confirm-text">Deseja realmente excluir este item?</p>
      <div class="confirm-actions">
        <button id="confirm-cancel" class="secondary">Cancelar</button>
        <button id="confirm-ok" class="btn-danger">Excluir</button>
      </div>
    </section>
  </div>

  <div id="new-cycle-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="new-cycle-title" aria-describedby="new-cycle-text">
      <h2 id="new-cycle-title" class="confirm-title">Novo ciclo</h2>
      <p id="new-cycle-text" class="confirm-text">Defina um nome para identificar este ciclo.</p>
      <div>
        <label for="new-cycle-name">Nome do ciclo</label>
        <input id="new-cycle-name" placeholder="Ex.: Módulo 2 - Semana 1">
      </div>
      <div class="confirm-actions">
        <button id="new-cycle-cancel" class="secondary">Cancelar</button>
        <button id="new-cycle-confirm" class="btn-save">Criar ciclo</button>
      </div>
    </section>
  </div>

  <div id="info-modal" class="modal-backdrop" aria-hidden="true">
    <section class="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title" aria-describedby="info-text">
      <h2 id="info-title" class="info-title">Alteração concluída</h2>
      <p id="info-text" class="info-text">Alteração feita com sucesso.</p>
      <div class="info-actions">
        <button id="info-ok" class="btn-save">OK</button>
      </div>
    </section>
  </div>

  <div id="swap-modal" class="modal-backdrop" aria-hidden="true">
    <section class="swap-modal" role="dialog" aria-modal="true" aria-labelledby="swap-title" aria-describedby="swap-text">
      <h2 id="swap-title" class="info-title">Trocar posição do aluno</h2>
      <p id="swap-text" class="info-text">Selecione o aluno para trocar a posição no agendamento pendente.</p>
      <div>
        <label for="swap-from">Aluno selecionado</label>
        <input id="swap-from" readonly>
      </div>
      <div>
        <label for="swap-to">Trocar com</label>
        <select id="swap-to">
          <option value="">Selecione</option>
        </select>
      </div>
      <div class="swap-modal-actions">
        <button id="swap-cancel" class="secondary">Cancelar</button>
        <button id="swap-confirm" class="btn-save">Confirmar troca</button>
      </div>
    </section>
  </div>

  <div id="effective-fix-modal" class="modal-backdrop" aria-hidden="true">
    <section class="swap-modal" role="dialog" aria-modal="true" aria-labelledby="effective-fix-title" aria-describedby="effective-fix-text">
      <h2 id="effective-fix-title" class="info-title">Corrigir efetivação</h2>
      <p id="effective-fix-text" class="info-text">Informe quem realmente realizou a saudação nesta data. O aluno previsto irá para o fim da fila.</p>
      <p class="info-text">Mostrando apenas alunos vinculados ao ciclo ativo.</p>
      <div>
        <label for="effective-fix-expected">Aluno previsto</label>
        <input id="effective-fix-expected" readonly>
      </div>
      <div>
        <label for="effective-fix-performer">Aluno que realizou</label>
        <select id="effective-fix-performer">
          <option value="">Selecione</option>
        </select>
      </div>
      <div class="swap-modal-actions">
        <button id="effective-fix-cancel" class="secondary">Cancelar</button>
        <button id="effective-fix-confirm" class="btn-save">Confirmar</button>
      </div>
    </section>
  </div>

  <div id="agenda-modal" class="modal-backdrop" aria-hidden="true">
    <section class="agenda-modal" role="dialog" aria-modal="true" aria-labelledby="agenda-modal-title">
      <div class="modal-head">
        <h2 id="agenda-modal-title">Todos os agendamentos</h2>
        <button id="btn-close-agenda-modal" class="secondary">Fechar</button>
      </div>
      <div id="agenda-modal-list" class="agenda-modal-list"></div>
    </section>
  </div>

  <div id="cycles-modal" class="modal-backdrop" aria-hidden="true">
    <section class="agenda-modal" role="dialog" aria-modal="true" aria-labelledby="cycles-modal-title">
      <div class="modal-head">
        <h2 id="cycles-modal-title">Todos os ciclos</h2>
        <button id="btn-close-cycles-modal" class="secondary">Fechar</button>
      </div>
      <div class="cycle-modal-controls">
        <div>
          <label for="cycles-filter">Filtrar por status</label>
          <select id="cycles-filter">
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="completed">Concluído</option>
          </select>
        </div>
      </div>
      <div id="cycles-modal-list" class="agenda-modal-list"></div>
    </section>
  </div>

  <div id="destination-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal" role="dialog" aria-modal="true" aria-labelledby="destination-card-title">
      <div class="card-head">
        <h2 id="destination-card-title">Destino</h2>
        <div class="buttons">
          <button id="btn-save-destination" class="btn-save">Salvar Destino</button>
          <button id="btn-close-destination-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div class="row">
        <div>
          <label for="to">Número individual</label>
          <input id="to" placeholder="Ex.: 5511987654321">
        </div>
        <div>
          <label for="groupSelect">Grupo encontrado</label>
          <select id="groupSelect">
            <option value="">Carregando...</option>
          </select>
        </div>
      </div>
      <div style="margin-top:12px">
        <label for="groupName">Nome do grupo</label>
        <input id="groupName" placeholder="Nome exato do grupo">
      </div>
      <input id="groupId" type="hidden">
    </section>
  </div>

  <div id="config-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal" role="dialog" aria-modal="true" aria-labelledby="config-card-title">
      <div class="config-head">
        <h2 id="config-card-title">Configuração</h2>
        <div class="buttons">
          <button id="btn-new-cycle" class="secondary">Novo Ciclo</button>
          <button id="btn-cancel-cycle" class="secondary">Cancelar Ciclo</button>
          <button id="btn-refresh-cycle-pending" class="secondary">Atualizar Pendentes</button>
          <button id="btn-save-config" class="btn-save">Salvar Configuração</button>
          <button id="btn-close-config-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div class="row">
        <div>
          <label for="turma">Turma</label>
          <input id="turma">
        </div>
        <div>
          <label for="instituicao">Instituição</label>
          <input id="instituicao">
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label for="antecedenciaMin">Antecedência (min)</label>
          <input id="antecedenciaMin" type="number" min="0">
        </div>
        <div>
          <label for="diasUteisApenas">Dias úteis apenas</label>
          <select id="diasUteisApenas">
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label for="lockPassword">Senha de bloqueio</label>
          <input id="lockPassword" type="password" placeholder="Digite para definir/alterar">
        </div>
        <div>
          <label for="lockTimeoutMin">Tempo para bloqueio (min)</label>
          <input id="lockTimeoutMin" type="number" min="1" max="240" placeholder="Ex.: 15">
        </div>
      </div>
      <div class="inline-field-action">
        <div>
          <label for="startAluno">Aluno inicial dos envios</label>
          <select id="startAluno">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div class="buttons">
          <button id="btn-save-start-aluno" class="secondary">Definir Início</button>
        </div>
      </div>
      <div class="inline-field-action">
        <div>
          <label for="startAula">Aula inicial dos envios</label>
          <select id="startAula">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div class="buttons">
          <button id="btn-save-start-aula" class="secondary">Definir Aula Inicial</button>
        </div>
      </div>
      <div class="inline-field-action">
        <div>
          <label for="startDate">Data de início</label>
          <input id="startDate" type="date">
        </div>
        <div class="buttons">
          <button id="btn-save-start-date" class="secondary">Definir Data</button>
        </div>
      </div>
    </section>
  </div>

  <div id="lock-overlay" class="lock-overlay hidden" aria-live="polite">
    <section class="lock-card" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <h2 id="lock-title" class="lock-title">Painel bloqueado</h2>
      <p id="lock-text" class="lock-text">Digite a senha para continuar.</p>
      <label for="lock-unlock-password">Senha</label>
      <input id="lock-unlock-password" type="password" placeholder="Senha de desbloqueio">
      <div class="lock-actions">
        <button id="btn-unlock" class="btn-save">Desbloquear</button>
      </div>
      <div id="lock-feedback" class="wa-login-feedback"></div>
    </section>
  </div>

  <div id="agenda-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal" role="dialog" aria-modal="true" aria-labelledby="agenda-card-title">
      <div class="card-head">
        <h2 id="agenda-card-title">Agenda</h2>
        <div class="buttons">
          <button id="btn-close-agenda-card-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div id="agenda" class="agenda-list muted">Carregando...</div>
      <div class="buttons">
        <button id="btn-open-full-agenda" class="secondary is-hidden">Mais</button>
        <button id="btn-open-json" class="secondary">Editar Agenda</button>
      </div>
      <div id="cycle-info" class="muted-small" style="margin-top:8px;"></div>
      <div id="cycle-history" class="cycle-history"></div>
      <div class="last-run-box">
        <h3 class="last-run-title">Último envio</h3>
        <div id="last-run" class="muted">Nenhum envio ainda.</div>
      </div>
    </section>
  </div>

  <script>
    const els = {
      statusBadge: document.getElementById("status-badge"),
      statusLines: document.getElementById("status-lines"),
      actionLog: document.getElementById("action-log"),
      nextGreetings: document.getElementById("next-greetings"),
      agenda: document.getElementById("agenda"),
      lastRun: document.getElementById("last-run"),
      to: document.getElementById("to"),
      groupId: document.getElementById("groupId"),
      groupName: document.getElementById("groupName"),
      groupSelect: document.getElementById("groupSelect"),
      turma: document.getElementById("turma"),
      instituicao: document.getElementById("instituicao"),
      antecedenciaMin: document.getElementById("antecedenciaMin"),
      diasUteisApenas: document.getElementById("diasUteisApenas"),
      lockPassword: document.getElementById("lockPassword"),
      lockTimeoutMin: document.getElementById("lockTimeoutMin"),
      startAluno: document.getElementById("startAluno"),
      startAula: document.getElementById("startAula"),
      startDate: document.getElementById("startDate"),
      cycleInfo: document.getElementById("cycle-info"),
      cycleHistory: document.getElementById("cycle-history"),
      heroCycle: document.getElementById("hero-cycle")
    };
    const modalEls = {
      wrap: document.getElementById("editor-modal"),
      studentName: document.getElementById("modal-student-name"),
      students: document.getElementById("modal-students"),
      dia: document.getElementById("modal-dia"),
      hora: document.getElementById("modal-hora"),
      titulo: document.getElementById("modal-titulo"),
      materia: document.getElementById("modal-materia"),
      professor: document.getElementById("modal-professor"),
      lessons: document.getElementById("modal-lessons")
    };
    const confirmEls = {
      wrap: document.getElementById("confirm-modal"),
      title: document.getElementById("confirm-title"),
      text: document.getElementById("confirm-text"),
      cancel: document.getElementById("confirm-cancel"),
      ok: document.getElementById("confirm-ok")
    };
    const newCycleEls = {
      wrap: document.getElementById("new-cycle-modal"),
      name: document.getElementById("new-cycle-name"),
      cancel: document.getElementById("new-cycle-cancel"),
      confirm: document.getElementById("new-cycle-confirm")
    };
    const infoEls = {
      wrap: document.getElementById("info-modal"),
      title: document.getElementById("info-title"),
      text: document.getElementById("info-text"),
      ok: document.getElementById("info-ok")
    };
    const swapEls = {
      wrap: document.getElementById("swap-modal"),
      from: document.getElementById("swap-from"),
      to: document.getElementById("swap-to"),
      cancel: document.getElementById("swap-cancel"),
      confirm: document.getElementById("swap-confirm")
    };
    const effectiveFixEls = {
      wrap: document.getElementById("effective-fix-modal"),
      expected: document.getElementById("effective-fix-expected"),
      performer: document.getElementById("effective-fix-performer"),
      cancel: document.getElementById("effective-fix-cancel"),
      confirm: document.getElementById("effective-fix-confirm")
    };
    const agendaViewEls = {
      openBtn: document.getElementById("btn-open-full-agenda"),
      wrap: document.getElementById("agenda-modal"),
      list: document.getElementById("agenda-modal-list"),
      closeBtn: document.getElementById("btn-close-agenda-modal")
    };
    const cyclesViewEls = {
      wrap: document.getElementById("cycles-modal"),
      list: document.getElementById("cycles-modal-list"),
      closeBtn: document.getElementById("btn-close-cycles-modal"),
      filter: document.getElementById("cycles-filter")
    };
    const cardViewEls = {
      destination: {
        openBtn: document.getElementById("btn-open-destination-modal"),
        wrap: document.getElementById("destination-card-modal"),
        closeBtn: document.getElementById("btn-close-destination-modal")
      },
      config: {
        openBtn: document.getElementById("btn-open-config-modal"),
        wrap: document.getElementById("config-card-modal"),
        closeBtn: document.getElementById("btn-close-config-modal")
      },
      agenda: {
        openBtn: document.getElementById("btn-open-agenda-card-modal"),
        wrap: document.getElementById("agenda-card-modal"),
        closeBtn: document.getElementById("btn-close-agenda-card-modal")
      }
    };
    const loadingEl = document.getElementById("app-loading");
    const loadingTitleEl = document.getElementById("app-loading-title");
    const loadingTextEl = document.getElementById("app-loading-text");
    const loadingChecklistEl = document.getElementById("app-loading-checklist");
    const waLoginOverlayEl = document.getElementById("wa-login-overlay");
    const waLoginTextEl = document.getElementById("wa-login-text");
    const waLoginQrEl = document.getElementById("wa-login-qr");
    const waLoginEmptyEl = document.getElementById("wa-login-empty");
    const waLoginFeedbackEl = document.getElementById("wa-login-feedback");
    const qrConnectOverlayEl = document.getElementById("qr-connect-overlay");
    const qrConnectTextEl = document.getElementById("qr-connect-text");
    const btnWaReconnect = document.getElementById("btn-wa-reconnect");
    const btnLockNow = document.getElementById("btn-lock-now");
    const lockOverlayEl = document.getElementById("lock-overlay");
    const lockTextEl = document.getElementById("lock-text");
    const lockInputEl = document.getElementById("lock-unlock-password");
    const lockFeedbackEl = document.getElementById("lock-feedback");
    const btnUnlock = document.getElementById("btn-unlock");
    const MIN_APP_LOADING_MS = 3000;
    const MAX_APP_LOADING_MS = 20000;
    let appLoadingStartedAt = Date.now();
    let appLoadingHideTimer = null;
    let initialStatusLoaded = false;
    let initialGroupsLoaded = false;
    let latestStatusData = null;
    let isRefreshing = false;
    let isLoadingGroups = false;
    let isManualSendBusy = false;
    let refreshLoopTimer = null;
    let lockConfigured = false;
    let isScreenLocked = false;
    let autoLockTimer = null;
    let lockTimeoutMs = 15 * 60 * 1000;
    let lastUserActivityAt = Date.now();
    let qrConnectTimer = null;
    let lastWaPhaseForOverlay = "";
    let easyAgendaRows = [];
    let modalData = { alunos: [], lessons: [] };
    let currentScheduleItems = [];
    let editingLessonIndex = -1;
    let editingStudentIndex = -1;
    let confirmResolver = null;
    let appReadyShown = false;
    let destinationSnapshot = { to: "", groupId: "", groupName: "" };
    let configSnapshot = {
      turma: "",
      instituicao: "",
      antecedenciaMin: "0",
      diasUteisApenas: "true",
      lockTimeoutMin: "15"
    };
    let agendaPendingRowsCache = [];
    let swapTargetPendingIndex = -1;
    let swapFromAluno = "";
    let effectiveFixContext = { index: -1, itemKey: "", alunoPrevisto: "" };
    const AUTO_FOCUS_INVALID_FIELD = false;
    const DEBUG_LESSON_FLOW = true;
    const btnAddStudent = document.getElementById("btn-add-student");
    const btnSaveStudentEdit = document.getElementById("btn-save-student-edit");
    const btnAddLesson = document.getElementById("btn-add-lesson");
    const btnSaveLessonEdit = document.getElementById("btn-save-lesson-edit");
    const btnCancelLessonEdit = document.getElementById("btn-cancel-lesson-edit");
    const btnSaveDestination = document.getElementById("btn-save-destination");
    const btnSaveConfig = document.getElementById("btn-save-config");
    const btnNewCycle = document.getElementById("btn-new-cycle");
    const btnCancelCycle = document.getElementById("btn-cancel-cycle");
    const btnRefreshCyclePending = document.getElementById("btn-refresh-cycle-pending");
    const btnSaveStartAluno = document.getElementById("btn-save-start-aluno");
    const btnSaveStartAula = document.getElementById("btn-save-start-aula");
    const btnSaveStartDate = document.getElementById("btn-save-start-date");
    let agendaItemsCache = [];
    let cycleHistoryCache = [];
    let startSnapshot = { idxAluno: "", idxAula: "", dataInicio: "" };
    if (btnSaveDestination) btnSaveDestination.disabled = true;
    if (btnSaveConfig) btnSaveConfig.disabled = true;
    if (btnCancelCycle) btnCancelCycle.disabled = true;
    if (btnAddStudent) btnAddStudent.disabled = true;
    if (btnAddLesson) btnAddLesson.disabled = true;
    if (btnSaveStartAluno) btnSaveStartAluno.disabled = true;
    if (btnSaveStartAula) btnSaveStartAula.disabled = true;
    if (btnSaveStartDate) btnSaveStartDate.disabled = true;

    function setLog(text, isError) {
      els.actionLog.textContent = text || "";
      els.actionLog.classList.toggle("danger", Boolean(isError));
    }

    function updateManualSendButtonsState() {
      const hasActiveCycle = Boolean(latestStatusData?.cycle?.active);
      const enabled = hasActiveCycle && !isManualSendBusy;
      const btnNow = document.getElementById("btn-now");
      const btnNowForced = document.getElementById("btn-now-forced");
      const btnNowMobile = document.getElementById("m-btn-now");
      const btnNowForcedMobile = document.getElementById("m-btn-now-forced");
      if (btnNow) btnNow.disabled = !enabled;
      if (btnNowForced) btnNowForced.disabled = !enabled;
      if (btnNowMobile) btnNowMobile.disabled = !enabled;
      if (btnNowForcedMobile) btnNowForcedMobile.disabled = !enabled;
    }

    function onById(id, event, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(event, handler);
    }

    function pad2(value) {
      return String(value).padStart(2, "0");
    }

    function parseDateOnly(value) {
      const raw = String(value || "").trim();
      let year;
      let month;
      let day;

      const isDigits = (text) => {
        if (!text) return false;
        for (const ch of String(text)) {
          if (ch < "0" || ch > "9") return false;
        }
        return true;
      };

      if (raw.length === 10 && raw[4] === "-" && raw[7] === "-") {
        const y = raw.slice(0, 4);
        const m = raw.slice(5, 7);
        const d = raw.slice(8, 10);
        if (!isDigits(y) || !isDigits(m) || !isDigits(d)) return null;
        year = Number(y);
        month = Number(m);
        day = Number(d);
      } else if (raw.length === 10 && raw[2] === "/" && raw[5] === "/") {
        const d = raw.slice(0, 2);
        const m = raw.slice(3, 5);
        const y = raw.slice(6, 10);
        if (!isDigits(y) || !isDigits(m) || !isDigits(d)) return null;
        year = Number(y);
        month = Number(m);
        day = Number(d);
      } else {
        return null;
      }

      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    }

    function toIsoDateOnly(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
    }

    function applyTimeOnDate(baseDate, horario) {
      const time = String(horario || "").trim();
      const parts = time.split(":");
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }

    function computeNextScheduledDate(dia, horario, referenceDate) {
      const weekday = Number(dia);
      const time = String(horario || "").trim();
      const parts = time.split(":");
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);

      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

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

    function formatDatePtBr(date) {
      if (!date) return null;
      return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + date.getFullYear();
    }

    function formatDateTimePtBr(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      });
    }

    function formatCycleLine(cycle) {
      const sent = Number(cycle?.sentCount || 0);
      const total = Number(cycle?.totalAlunos || 0);
      const inicio = cycle?.start?.dataInicio || "-";
      const criadoEm = formatDateTimePtBr(cycle?.createdAt);
      const concluidoEm = cycle?.completedAt ? formatDateTimePtBr(cycle.completedAt) : "-";
      const title = String(cycle?.status || "") === "active" ? "Ativo" : "Concluído";
      const cancelado = Boolean(cycle?.canceled);
      const name = String(cycle?.name || "").trim();
      return (
        "<b>" + title + "</b>" +
        (name ? " | Nome: " + escapeHtml(name) : "") +
        (cancelado ? " (cancelado)" : "") +
        " | Início: " + inicio +
        " | Progresso: " + sent + "/" + total +
        " | Criado: " + criadoEm +
        (title === "Concluído" ? " | Finalizado: " + concluidoEm : "")
      );
    }

    function renderCycleHistorySummary() {
      if (!cycleHistoryCache.length) {
        els.cycleHistory.innerHTML = '<div class="muted-small">Sem histórico de ciclos.</div>';
        return;
      }

      const btnHtml = '<button id="btn-open-cycles-modal" class="secondary">Ver todos os ciclos</button>';

      els.cycleHistory.innerHTML =
        '<div class="cycle-history-head">' +
          '<h3 class="cycle-history-title">Histórico de ciclos</h3>' +
          btnHtml +
        "</div>" +
        '<div class="muted-small">Clique no botão para visualizar o histórico completo.</div>';

      const openBtn = document.getElementById("btn-open-cycles-modal");
      if (openBtn) {
        openBtn.addEventListener("click", () => {
          openCyclesModal();
        });
      }
    }

    function renderCyclesModal() {
      const filter = String(cyclesViewEls.filter?.value || "all");
      const filtered = cycleHistoryCache.filter((cycle) => {
        const status = String(cycle?.status || "completed");
        if (filter === "active") return status === "active";
        if (filter === "completed") return status === "completed";
        return true;
      });

      if (!filtered.length) {
        cyclesViewEls.list.innerHTML = '<div class="muted-small">Nenhum ciclo para o filtro selecionado.</div>';
        return;
      }

      const items = filtered.map((cycle) => {
        const status = String(cycle?.status || "completed");
        const className = "cycle-history-item " + (status === "active" ? "active" : "completed");
        return '<li class="' + className + '">' + formatCycleLine(cycle) + "</li>";
      }).join("");

      cyclesViewEls.list.innerHTML = '<ul class="cycle-history-list">' + items + "</ul>";
    }

    function openCyclesModal() {
      renderCyclesModal();
      cyclesViewEls.wrap.classList.add("open");
      cyclesViewEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeCyclesModal() {
      cyclesViewEls.wrap.classList.remove("open");
      cyclesViewEls.wrap.setAttribute("aria-hidden", "true");
    }

    function openCardModal(wrap) {
      if (!wrap) return;
      wrap.classList.add("open");
      wrap.setAttribute("aria-hidden", "false");
    }

    function closeCardModal(wrap) {
      if (!wrap) return;
      wrap.classList.remove("open");
      wrap.setAttribute("aria-hidden", "true");
    }

    function bindCardAccessModals() {
      Object.values(cardViewEls).forEach(({ openBtn, closeBtn, wrap }) => {
        if (!wrap) return;
        if (openBtn) {
          openBtn.addEventListener("click", () => {
            openCardModal(wrap);
          });
        }
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            closeCardModal(wrap);
          });
        }
        wrap.addEventListener("click", (event) => {
          if (event.target === wrap) {
            closeCardModal(wrap);
          }
        });
      });
    }

    function capitalizeFirst(text) {
      const value = String(text || "");
      if (!value) return value;
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function formatAgendaItem(item) {
      const diaLabelLongo = {
        "0": "domingo",
        "1": "segunda-feira",
        "2": "terça-feira",
        "3": "quarta-feira",
        "4": "quinta-feira",
        "5": "sexta-feira",
        "6": "sábado"
      };
      const diaNominal = capitalizeFirst(diaLabelLongo[String(item.dia)] || "dia não definido");
      let nextDate = null;
      if (item.scheduledDateISO) {
        const parsed = new Date(item.scheduledDateISO);
        if (!Number.isNaN(parsed.getTime())) {
          nextDate = parsed;
        }
      }
      if (!nextDate && item.scheduledDate instanceof Date) {
        nextDate = item.scheduledDate;
      }
      if (!nextDate) {
        nextDate = computeNextScheduledDate(item.dia, item.horario);
      }
      const nextDateLabel = formatDatePtBr(nextDate);
      const titulo = String(item.titulo || "").trim();
      const tituloPart = titulo ? " | Título: " + titulo : "";
      return (
        diaNominal +
        (nextDateLabel ? " (" + nextDateLabel + ")" : "") +
        " às " + item.horario +
        tituloPart +
        " | " + item.materia +
        " | " + item.professor +
        " | Próximo aluno: aluno: " + item.alunoPrevisto
      );
    }

    function resolveAgendaItemDate(item) {
      if (item?.scheduledDateISO) {
        const parsed = new Date(item.scheduledDateISO);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      if (item?.scheduledDate instanceof Date && !Number.isNaN(item.scheduledDate.getTime())) {
        return item.scheduledDate;
      }
      return null;
    }

    function buildAgendaItemKey(item) {
      const cycleId = String(latestStatusData?.cycle?.active?.id || "no-cycle");
      return [
        cycleId,
        String(item?.scheduledDateISO || ""),
        String(item?.materia || ""),
        String(item?.professor || ""),
        String(item?.horario || "")
      ].join("|");
    }

    function isAgendaItemDone(item, index, doneCount, now, revertedSet) {
      const key = buildAgendaItemKey(item);
      if (revertedSet.has(key)) return false;
      const itemDate = resolveAgendaItemDate(item);
      const doneByDate = itemDate ? itemDate.getTime() <= now : false;
      return index < doneCount || doneByDate;
    }

    function isSameLocalDay(left, right) {
      if (!(left instanceof Date) || Number.isNaN(left.getTime())) return false;
      if (!(right instanceof Date) || Number.isNaN(right.getTime())) return false;
      return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
      );
    }

    function renderAgendaPreview(items) {
      agendaItemsCache = items;
      const sentCount = Math.max(0, Number(latestStatusData?.cycle?.active?.sentCount || 0));
      const doneCount = Math.min(sentCount, items.length);
      const now = Date.now();
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );
      const pendingItems = items.filter((item, index) => {
        return !isAgendaItemDone(item, index, doneCount, now, revertedSet);
      });

      const preview = pendingItems.slice(0, 3).map((item) => "<li>" + formatAgendaItem(item) + "</li>").join("");
      els.agenda.innerHTML = preview ? "<ul>" + preview + "</ul>" : "Sem agendamentos pendentes.";
      // Mantém o acesso ao modal completo sempre visível.
      agendaViewEls.openBtn.classList.remove("is-hidden");
    }

    function renderNextGreetings(items) {
      const sentCount = Math.max(0, Number(latestStatusData?.cycle?.active?.sentCount || 0));
      const doneCount = Math.min(sentCount, items.length);
      const now = Date.now();
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );

      const pendingItems = items.filter((item, index) =>
        !isAgendaItemDone(item, index, doneCount, now, revertedSet)
      );
      const list = pendingItems.slice(0, 8).map((item) => "<li>" + formatAgendaItem(item) + "</li>").join("");
      els.nextGreetings.innerHTML = list ? "<ul>" + list + "</ul>" : "Sem próximas saudações pendentes.";
    }

    function renderAgendaModal() {
      const sentCount = Math.max(0, Number(latestStatusData?.cycle?.active?.sentCount || 0));
      const doneCount = Math.min(sentCount, agendaItemsCache.length);
      const now = Date.now();
      const linkedOrder = Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
        ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const linkedSet = new Set(linkedOrder);
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );
      let pendingIndex = 0;
      agendaPendingRowsCache = [];
      const doneRows = [];
      const pendingRows = [];
      const revertedPendingRows = [];
      const doneStudents = new Set();

      agendaItemsCache.forEach((item, index) => {
        const alunoNome = String(item?.alunoPrevisto || "").trim();
        const itemKey = buildAgendaItemKey(item);
        const wasReverted = Boolean(itemKey && revertedSet.has(itemKey));
        const done = isAgendaItemDone(item, index, doneCount, now, revertedSet);
        if (!done && linkedSet.size && alunoNome && !linkedSet.has(alunoNome)) {
          return;
        }
        if (done && alunoNome) {
          doneStudents.add(alunoNome);
        }
        if (!done && alunoNome && doneStudents.has(alunoNome)) {
          return;
        }
        const icon = done ? "☑" : "•";
        const doneBadge = done ? '<span class="agenda-done-badge">✓ Efetivado</span>' : "";
        const itemDate = resolveAgendaItemDate(item);
        const canMarkAbsence = !done && itemDate && isSameLocalDay(itemDate, new Date());
        const absenceDisabledAttr = canMarkAbsence ? "" : " disabled";
        const absenceTitle = canMarkAbsence
          ? "Marcar aluno como ausente"
          : "Disponível apenas no dia da saudação";
        const actions = done
          ? (
            '<div class="agenda-modal-item-actions">' +
              '<button class="secondary agenda-revert-btn" data-revert-effective="' + index + '" data-revert-key="' + escapeHtml(itemKey) + '">Tornar disponível</button>' +
            "</div>"
          )
          : (
            '<div class="agenda-modal-item-actions">' +
              '<button class="secondary agenda-absence-btn" title="' + escapeHtml(absenceTitle) + '"' + absenceDisabledAttr + ' data-mark-absence="' + index + '" data-mark-absence-pending="' + pendingIndex + '">Ausente</button>' +
              '<button class="secondary agenda-swap-btn" data-open-swap="' + pendingIndex + '">Trocar</button>' +
            "</div>"
          );
        if (!done) {
          agendaPendingRowsCache.push({
            pendingIndex,
            aluno: alunoNome
          });
          pendingIndex += 1;
        }
        const row = "<li class='" + (done ? "done" : "") + "'>" +
          '<div class="agenda-modal-item">' +
            '<div class="agenda-modal-item-text"><span class="agenda-check">' + icon + "</span>" + formatAgendaItem(item) + doneBadge + "</div>" +
            actions +
          "</div>" +
        "</li>";
        if (done) {
          doneRows.push(row);
        } else if (wasReverted) {
          revertedPendingRows.push(row);
        } else {
          pendingRows.push(row);
        }
      });
      const content = doneRows.concat(pendingRows, revertedPendingRows).join("");
      agendaViewEls.list.innerHTML = content
        ? "<ul>" + content + "</ul>"
        : '<div class="muted-small">Sem agenda carregada.</div>';
    }

    function openAgendaModal() {
      renderAgendaModal();
      agendaViewEls.wrap.classList.add("open");
      agendaViewEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeAgendaModal() {
      agendaViewEls.wrap.classList.remove("open");
      agendaViewEls.wrap.setAttribute("aria-hidden", "true");
    }

    function debugLesson(context, details = {}) {
      if (!DEBUG_LESSON_FLOW) return;
      const payload = { context, ...details };
      console.log("[DEBUG_AULA]", payload);
    }

    function showInfoModal(options = {}) {
      infoEls.title.textContent = options.title || "Alteração concluída";
      infoEls.text.textContent = options.message || "Alteração feita com sucesso.";
      infoEls.wrap.classList.add("open");
      infoEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeInfoModal() {
      infoEls.wrap.classList.remove("open");
      infoEls.wrap.setAttribute("aria-hidden", "true");
    }

    function openConfirmModal(options = {}) {
      confirmEls.title.textContent = options.title || "Confirmar ação";
      confirmEls.text.textContent = options.message || "Deseja continuar?";
      confirmEls.ok.textContent = options.confirmLabel || "Confirmar";
      confirmEls.wrap.classList.add("open");
      confirmEls.wrap.setAttribute("aria-hidden", "false");
      return new Promise((resolve) => {
        confirmResolver = resolve;
      });
    }

    function closeConfirmModal(confirmed) {
      confirmEls.wrap.classList.remove("open");
      confirmEls.wrap.setAttribute("aria-hidden", "true");
      const resolver = confirmResolver;
      confirmResolver = null;
      if (resolver) resolver(Boolean(confirmed));
    }

    function openNewCycleModal() {
      if (!newCycleEls.wrap) return;
      if (newCycleEls.name) {
        newCycleEls.name.value = "";
      }
      newCycleEls.wrap.classList.add("open");
      newCycleEls.wrap.setAttribute("aria-hidden", "false");
      setTimeout(() => newCycleEls.name?.focus(), 40);
    }

    function closeNewCycleModal() {
      if (!newCycleEls.wrap) return;
      newCycleEls.wrap.classList.remove("open");
      newCycleEls.wrap.setAttribute("aria-hidden", "true");
    }

    function getLinkedStudentsFromAgendaItems(pendingOnly = false) {
      const linkedOrder = Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
        ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (!pendingOnly) {
        return [...linkedOrder];
      }

      const unique = new Set(linkedOrder);
      const doneSet = new Set();
      const sentCount = Math.max(0, Number(latestStatusData?.cycle?.active?.sentCount || 0));
      const doneCount = Math.min(sentCount, agendaItemsCache.length);
      const now = Date.now();
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );

      for (let index = 0; index < (Array.isArray(agendaItemsCache) ? agendaItemsCache.length : 0); index += 1) {
        const item = agendaItemsCache[index];
        const done = isAgendaItemDone(item, index, doneCount, now, revertedSet);
        const aluno = String(item?.alunoPrevisto || "").trim();
        if (!done || !aluno || !unique.has(aluno)) continue;
        doneSet.add(aluno);
      }
      return linkedOrder.filter((name) => !doneSet.has(name));
    }

    function getPendingStudentsWithNextDate() {
      const sentCount = Math.max(0, Number(latestStatusData?.cycle?.active?.sentCount || 0));
      const doneCount = Math.min(sentCount, agendaItemsCache.length);
      const now = Date.now();
      const linkedSet = new Set(
        Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
          ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
          : []
      );
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );

      const linkedOrder = Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
        ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const doneStudents = new Set();
      const byAluno = new Map();
      for (let index = 0; index < (Array.isArray(agendaItemsCache) ? agendaItemsCache.length : 0); index += 1) {
        const item = agendaItemsCache[index];
        const done = isAgendaItemDone(item, index, doneCount, now, revertedSet);
        const aluno = String(item?.alunoPrevisto || "").trim();
        if (done) {
          if (aluno) doneStudents.add(aluno);
          continue;
        }
        if (linkedSet.size && !linkedSet.has(aluno)) continue;
        if (doneStudents.has(aluno)) continue;
        if (!aluno || byAluno.has(aluno)) continue;
        const itemDate = resolveAgendaItemDate(item);
        const nextDate = itemDate
          ? itemDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "";
        byAluno.set(aluno, nextDate);
      }

      if (linkedOrder.length) {
        return linkedOrder
          .filter((name) => byAluno.has(name))
          .map((name) => ({ name, nextDate: byAluno.get(name) || "" }));
      }
      return Array.from(byAluno.entries()).map(([name, nextDate]) => ({ name, nextDate }));
    }

    function openSwapModal(pendingIndex) {
      const idx = Number(pendingIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        setLog("Índice inválido para troca.", true);
        return;
      }
      const current = agendaPendingRowsCache.find((item) => item.pendingIndex === idx);
      if (!current || !current.aluno) {
        setLog("Aluno pendente não encontrado para troca.", true);
        return;
      }

      swapTargetPendingIndex = idx;
      swapFromAluno = current.aluno;
      swapEls.from.value = current.aluno;
      const options = agendaPendingRowsCache
        .filter((item) => item.pendingIndex !== idx && item.aluno)
        .map((item) =>
          '<option value="' + escapeHtml(item.aluno) + '">' +
            escapeHtml(item.aluno) +
          "</option>"
        );
      swapEls.to.innerHTML = '<option value="">Selecione</option>' + options.join("");
      swapEls.wrap.classList.add("open");
      swapEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeSwapModal() {
      swapTargetPendingIndex = -1;
      swapFromAluno = "";
      swapEls.from.value = "";
      swapEls.to.innerHTML = '<option value="">Selecione</option>';
      swapEls.wrap.classList.remove("open");
      swapEls.wrap.setAttribute("aria-hidden", "true");
    }

    function openEffectiveFixModal(index, itemKey, alunoPrevisto) {
      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= agendaItemsCache.length) {
        setLog("Item inválido para correção de efetivação.", true);
        return;
      }
      const pendingStudents = getPendingStudentsWithNextDate();
      if (!pendingStudents.length) {
        setLog("Não há alunos pendentes para selecionar nesta correção.", true);
        return;
      }
      const options = ['<option value="">Selecione</option>']
        .concat(pendingStudents.map(({ name, nextDate }) =>
          '<option value="' + escapeHtml(name) + '">' +
            escapeHtml(nextDate ? (name + " (próxima: " + nextDate + ")") : name) +
          "</option>"
        ));
      effectiveFixContext = {
        index: idx,
        itemKey: String(itemKey || ""),
        alunoPrevisto: String(alunoPrevisto || "")
      };
      effectiveFixEls.expected.value = String(alunoPrevisto || "");
      effectiveFixEls.performer.innerHTML = options.join("");
      effectiveFixEls.performer.value = "";
      effectiveFixEls.wrap.classList.add("open");
      effectiveFixEls.wrap.setAttribute("aria-hidden", "false");
      setTimeout(() => effectiveFixEls.performer?.focus(), 40);
    }

    function closeEffectiveFixModal() {
      effectiveFixContext = { index: -1, itemKey: "", alunoPrevisto: "" };
      if (effectiveFixEls.expected) effectiveFixEls.expected.value = "";
      if (effectiveFixEls.performer) {
        effectiveFixEls.performer.innerHTML = '<option value="">Selecione</option>';
      }
      effectiveFixEls.wrap.classList.remove("open");
      effectiveFixEls.wrap.setAttribute("aria-hidden", "true");
    }

    function escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeText(value) {
      return String(value || "").trim();
    }

    function isNullWord(value) {
      return normalizeText(value).toLowerCase() === "null";
    }

    function markInvalidField(field, message, shouldFocus = AUTO_FOCUS_INVALID_FIELD) {
      if (!field) return false;
      field.classList.add("field-invalid");
      if (shouldFocus) {
        field.focus();
      }
      if (message) setLog(message, true);
      return false;
    }

    function clearInvalidField(field) {
      if (!field) return;
      field.classList.remove("field-invalid");
    }

    function getDestinationFormState() {
      return {
        to: normalizeText(els.to.value),
        groupId: normalizeText(getGroupIdValue()),
        groupName: normalizeText(els.groupName.value)
      };
    }

    function getConfigFormState() {
      return {
        turma: normalizeText(els.turma.value),
        instituicao: normalizeText(els.instituicao.value),
        antecedenciaMin: String(Number(els.antecedenciaMin.value || 0)),
        diasUteisApenas: String(els.diasUteisApenas.value),
        lockTimeoutMin: String(Number(els.lockTimeoutMin.value || 15))
      };
    }

    function setLockFeedback(message, type) {
      if (!lockFeedbackEl) return;
      lockFeedbackEl.textContent = message || "";
      lockFeedbackEl.className = "wa-login-feedback" + (type ? " " + type : "");
    }

    function lockScreen(message) {
      if (!lockConfigured) return;
      isScreenLocked = true;
      if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
      }
      lockOverlayEl.classList.remove("hidden");
      lockTextEl.textContent = message || "Digite a senha para continuar.";
      lockInputEl.value = "";
      setLockFeedback("", "");
      setTimeout(() => lockInputEl.focus(), 40);
    }

    function unlockScreen() {
      isScreenLocked = false;
      lockOverlayEl.classList.add("hidden");
      lockInputEl.value = "";
      setLockFeedback("", "");
      lastUserActivityAt = Date.now();
      scheduleAutoLock();
    }

    function touchUserActivity() {
      if (isScreenLocked) return;
      lastUserActivityAt = Date.now();
      scheduleAutoLock();
    }

    function scheduleAutoLock() {
      if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
      }
      const currentPhase = String(latestStatusData?.whatsapp?.phase || "");
      const whatsappLoginRequired = shouldShowWhatsAppLogin(currentPhase);
      if (!lockConfigured || isScreenLocked || whatsappLoginRequired) return;
      autoLockTimer = setTimeout(() => {
        lockScreen("Tempo de bloqueio atingido. Digite a senha para continuar.");
      }, Math.max(1000, lockTimeoutMs));
    }

    function statesEqual(a, b) {
      return (
        String(a?.to ?? "") === String(b?.to ?? "") &&
        String(a?.groupId ?? "") === String(b?.groupId ?? "") &&
        String(a?.groupName ?? "") === String(b?.groupName ?? "") &&
        String(a?.turma ?? "") === String(b?.turma ?? "") &&
        String(a?.instituicao ?? "") === String(b?.instituicao ?? "") &&
        String(a?.antecedenciaMin ?? "") === String(b?.antecedenciaMin ?? "") &&
        String(a?.diasUteisApenas ?? "") === String(b?.diasUteisApenas ?? "") &&
        String(a?.lockTimeoutMin ?? "") === String(b?.lockTimeoutMin ?? "")
      );
    }

    function updateSaveButtonsState() {
      const destCurrent = getDestinationFormState();
      const cfgCurrent = getConfigFormState();
      const destDirty = !statesEqual(destCurrent, destinationSnapshot);
      const cfgDirty = !statesEqual(cfgCurrent, configSnapshot);
      const lockPasswordDirty = normalizeText(els.lockPassword?.value || "").length > 0;
      if (btnSaveDestination) btnSaveDestination.disabled = !destDirty;
      if (btnSaveConfig) btnSaveConfig.disabled = !(cfgDirty || lockPasswordDirty);
    }

    function updateStartButtonsState() {
      const currentIdxAluno = String(els.startAluno?.value || "");
      const currentIdxAula = String(els.startAula?.value || "");
      const currentDataInicio = String(els.startDate?.value || "").trim();
      const alunoDirty = currentIdxAluno !== String(startSnapshot.idxAluno || "");
      const aulaDirty = currentIdxAula !== String(startSnapshot.idxAula || "");
      const dataDirty = currentDataInicio !== String(startSnapshot.dataInicio || "");
      const pairDirty = aulaDirty || dataDirty;
      const hasStartedCycle = Number(latestStatusData?.cycle?.active?.sentCount || 0) > 0;
      const lockStartInputs = Boolean(latestStatusData?.cycle?.active) && hasStartedCycle;

      if (els.startAluno) els.startAluno.disabled = lockStartInputs;
      if (els.startAula) els.startAula.disabled = lockStartInputs;
      if (els.startDate) els.startDate.disabled = lockStartInputs;

      if (btnSaveStartAluno) btnSaveStartAluno.disabled = lockStartInputs || !alunoDirty;
      if (btnSaveStartAula) btnSaveStartAula.disabled = lockStartInputs || !pairDirty;
      if (btnSaveStartDate) btnSaveStartDate.disabled = lockStartInputs || !pairDirty;

      if (els.startAluno) els.startAluno.classList.toggle("field-dirty", alunoDirty);
      if (els.startAula) els.startAula.classList.toggle("field-dirty", aulaDirty);
      if (els.startDate) els.startDate.classList.toggle("field-dirty", dataDirty);
    }

    function validateStartAulaAndDatePair() {
      const idx = Number(els.startAula.value);
      const dataInicio = String(els.startDate.value || "").trim();
      if (!Number.isInteger(idx) || !dataInicio) {
        return true;
      }

      const selectedAula = currentScheduleItems[idx];
      if (!selectedAula) {
        return true;
      }

      const date = parseDateOnly(dataInicio);
      if (!date) {
        markInvalidField(els.startDate, "Data de início inválida.");
        return false;
      }

      const aulaDia = Number(selectedAula.dia);
      if (date.getDay() !== aulaDia) {
        const labels = {
          "0": "domingo",
          "1": "segunda-feira",
          "2": "terça-feira",
          "3": "quarta-feira",
          "4": "quinta-feira",
          "5": "sexta-feira",
          "6": "sábado"
        };
        const diaEsperado = labels[String(aulaDia)] || ("dia " + aulaDia);
        markInvalidField(
          els.startDate,
          "A data de início não corresponde ao dia da aula inicial. Para a aula selecionada, escolha uma " + diaEsperado + "."
        );
        markInvalidField(els.startAula, "");
        return false;
      }

      clearInvalidField(els.startDate);
      clearInvalidField(els.startAula);
      return true;
    }

    function alignDateToWeekday(baseDate, targetWeekday) {
      if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
      const weekday = Number(targetWeekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
      const date = new Date(baseDate);
      const diff = (weekday - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + diff);
      return date;
    }

    function findFirstLessonIndexByWeekday(weekday) {
      const day = Number(weekday);
      if (!Number.isInteger(day)) return -1;
      for (let i = 0; i < currentScheduleItems.length; i += 1) {
        if (Number(currentScheduleItems[i]?.dia) === day) {
          return i;
        }
      }
      return -1;
    }

    function refreshStudentActionButtons() {
      const editing = editingStudentIndex >= 0;
      btnSaveStudentEdit.classList.toggle("is-hidden", !editing);
      if (editing) {
        btnAddStudent.disabled = true;
      } else {
        updateAddStudentButtonState();
      }
    }

    function refreshLessonActionButtons() {
      const editing = editingLessonIndex >= 0;
      btnAddLesson.classList.toggle("is-hidden", editing);
      btnSaveLessonEdit.classList.toggle("is-hidden", !editing);
      btnCancelLessonEdit.classList.toggle("is-hidden", !editing);
      if (!editing) {
        clearLessonValidation();
        updateAddLessonButtonState();
      }
    }

    function isValidStudentName(name) {
      const normalized = normalizeText(name);
      return normalized.length >= 2 && !isNullWord(normalized);
    }

    function isValidLessonForm() {
      const dia = normalizeText(modalEls.dia.value);
      const hora = normalizeHourInput(modalEls.hora.value);
      const materia = normalizeText(modalEls.materia.value);
      const professor = normalizeText(modalEls.professor.value);
      return (
        !!dia &&
        !!hora &&
        materia.length >= 2 &&
        !isNullWord(materia) &&
        professor.length >= 2 &&
        !isNullWord(professor)
      );
    }

    function updateAddStudentButtonState() {
      if (editingStudentIndex >= 0) {
        btnAddStudent.disabled = true;
        return;
      }
      btnAddStudent.disabled = !isValidStudentName(modalEls.studentName?.value);
    }

    function updateAddLessonButtonState() {
      if (editingLessonIndex >= 0) {
        btnAddLesson.disabled = true;
        return;
      }
      btnAddLesson.disabled = !isValidLessonForm();
    }

    function clearStudentInput() {
      if (modalEls.studentName) modalEls.studentName.value = "";
      clearInvalidField(modalEls.studentName);
      updateAddStudentButtonState();
    }

    function readLessonForm() {
      return {
        dia: String(modalEls.dia?.value || "").trim(),
        hora: normalizeHourInput(modalEls.hora?.value || ""),
        titulo: normalizeText(modalEls.titulo?.value || ""),
        materia: normalizeText(modalEls.materia?.value || ""),
        professor: normalizeText(modalEls.professor?.value || "")
      };
    }

    function fillLessonForm(lesson) {
      if (!lesson) return;
      if (modalEls.dia) modalEls.dia.value = String(lesson.dia || "1");
      if (modalEls.hora) modalEls.hora.value = String(lesson.hora || "");
      if (modalEls.titulo) modalEls.titulo.value = String(lesson.titulo || "");
      if (modalEls.materia) modalEls.materia.value = String(lesson.materia || "");
      if (modalEls.professor) modalEls.professor.value = String(lesson.professor || "");
      clearLessonValidation();
      updateAddLessonButtonState();
    }

    function validateLessonFormAndMark() {
      clearLessonValidation();
      const lesson = readLessonForm();

      if (!lesson.dia) return markInvalidField(modalEls.dia, "Selecione o dia da aula.");
      if (!lesson.hora) return markInvalidField(modalEls.hora, "Hora inválida. Use formato HH:MM.");
      if (lesson.titulo && (lesson.titulo.length < 2 || isNullWord(lesson.titulo))) {
        return markInvalidField(modalEls.titulo, "Título inválido.");
      }
      if (lesson.materia.length < 2 || isNullWord(lesson.materia)) {
        return markInvalidField(modalEls.materia, "Matéria inválida.");
      }
      if (lesson.professor.length < 2 || isNullWord(lesson.professor)) {
        return markInvalidField(modalEls.professor, "Professor inválido.");
      }

      return lesson;
    }

    function clearLessonValidation() {
      clearInvalidField(modalEls.dia);
      clearInvalidField(modalEls.hora);
      clearInvalidField(modalEls.titulo);
      clearInvalidField(modalEls.materia);
      clearInvalidField(modalEls.professor);
    }

    function clearLessonInputs() {
      if (modalEls.dia) modalEls.dia.value = "1";
      if (modalEls.hora) modalEls.hora.value = "";
      if (modalEls.titulo) modalEls.titulo.value = "";
      if (modalEls.materia) modalEls.materia.value = "";
      if (modalEls.professor) modalEls.professor.value = "";
      clearLessonValidation();
      updateAddLessonButtonState();
    }

    function hydrateModalData(data) {
      const alunos = Array.isArray(data?.alunos) ? data.alunos : [];
      const agendaSemanal = data?.agendaSemanal && typeof data.agendaSemanal === "object" ? data.agendaSemanal : {};
      const lessons = [];
      Object.entries(agendaSemanal).forEach(([dia, aulas]) => {
        const arr = Array.isArray(aulas) ? aulas : [aulas];
        arr.forEach((aula) => {
          if (!aula) return;
          lessons.push({
            dia: String(dia),
            hora: String(aula.hora || ""),
            titulo: String(aula.titulo || ""),
            materia: String(aula.materia || ""),
            professor: String(aula.professor || "")
          });
        });
      });
      modalData = { alunos: [...alunos], lessons };
    }

    function buildAgendaSemanalFromLessons() {
      const agenda = {};
      (Array.isArray(modalData?.lessons) ? modalData.lessons : []).forEach((lesson) => {
        const dia = String(lesson?.dia || "");
        if (!dia) return;
        if (!agenda[dia]) agenda[dia] = [];
        const item = {
          hora: String(lesson?.hora || ""),
          materia: String(lesson?.materia || ""),
          professor: String(lesson?.professor || "")
        };
        const titulo = String(lesson?.titulo || "").trim();
        if (titulo) item.titulo = titulo;
        agenda[dia].push(item);
      });
      return agenda;
    }

    function renderModalStudents() {
      if (!modalEls.students) return;
      const rows = (Array.isArray(modalData?.alunos) ? modalData.alunos : []).map((name, index) =>
        '<div class="student-item">' +
          "<span>" + escapeHtml(String(name || "")) + "</span>" +
          '<div class="student-actions">' +
            '<button class="secondary icon-btn" title="Editar aluno" aria-label="Editar aluno" data-edit-student="' + index + '">✎</button>' +
            '<button class="secondary icon-btn" title="Excluir aluno" aria-label="Excluir aluno" data-remove-student="' + index + '">🗑</button>' +
          "</div>" +
        "</div>"
      );
      modalEls.students.innerHTML = rows.join("") || '<div class="muted">Sem alunos cadastrados.</div>';
    }

    function renderModalLessons() {
      if (!modalEls.lessons) return;
      // Base principal: data de início do ciclo/configuração.
      // Fallback: hoje (00:00) apenas se não houver data de início válida.
      const startDateRaw = String(latestStatusData?.state?.dataInicio || "").trim();
      const parsedStartDate = parseDateOnly(startDateRaw);
      const referenceDate = parsedStartDate || new Date();
      if (!parsedStartDate) {
        referenceDate.setHours(0, 0, 0, 0);
      }
      const weekdayOccurrenceMap = new Map();

      const sourceRows = (Array.isArray(modalData?.lessons) ? modalData.lessons : []).map((lesson, index) => {
        const nextDate = computeNextScheduledDate(lesson.dia, lesson.hora, referenceDate);
        const dayKey = String(lesson?.dia || "");
        const occurrenceIndex = Number(weekdayOccurrenceMap.get(dayKey) || 0);
        if (nextDate instanceof Date && occurrenceIndex > 0) {
          nextDate.setDate(nextDate.getDate() + (occurrenceIndex * 7));
        }
        weekdayOccurrenceMap.set(dayKey, occurrenceIndex + 1);
        return {
          lesson,
          index,
          nextDate,
          nextDateLabel: nextDate ? formatDatePtBr(nextDate) : "-"
        };
      });

      const rowsToRender = [...sourceRows].sort((a, b) => {
        const left = a.nextDate instanceof Date ? a.nextDate.getTime() : Number.POSITIVE_INFINITY;
        const right = b.nextDate instanceof Date ? b.nextDate.getTime() : Number.POSITIVE_INFINITY;
        if (left !== right) return left - right;
        return a.index - b.index;
      });

      const rows = rowsToRender.map(({ lesson, index, nextDateLabel }) =>
        "<tr>" +
          "<td>" + dayLabel(lesson.dia) + "</td>" +
          "<td>" + String(lesson.hora || "") + "</td>" +
          "<td>" + nextDateLabel + "</td>" +
          "<td>" + escapeHtml(String(lesson.titulo || "")) + "</td>" +
          "<td>" + String(lesson.materia || "") + "</td>" +
          "<td>" + String(lesson.professor || "") + "</td>" +
          '<td><button class="secondary icon-btn" title="Editar aula" aria-label="Editar aula" data-edit-lesson="' + index + '">✎</button></td>' +
          '<td><button class="secondary icon-btn" title="Excluir aula" aria-label="Excluir aula" data-remove-lesson="' + index + '">🗑</button></td>' +
        "</tr>"
      );
      modalEls.lessons.innerHTML =
        '<table class="table"><thead><tr><th>Dia</th><th>Hora</th><th>Próxima data</th><th>Título</th><th>Matéria</th><th>Professor</th><th></th><th></th></tr></thead><tbody>' +
        (rows.join("") || '<tr><td colspan="8" class="muted">Sem aulas cadastradas.</td></tr>') +
        "</tbody></table>";
    }

    function getGroupIdValue() {
      return els.groupId ? String(els.groupId.value || "") : "";
    }

    function setGroupIdValue(value) {
      if (els.groupId) {
        els.groupId.value = String(value || "");
      }
    }

    function clearGroupDestinationFields() {
      if (els.groupSelect) {
        els.groupSelect.value = "";
      }
      setGroupIdValue("");
      els.groupName.value = "";
      updateSaveButtonsState();
    }

    function normalizeHourInput(rawValue) {
      const original = normalizeText(rawValue);
      if (!original) return "";
      const normalizedSource = original
        .normalize("NFKC")
        .replace(/[hH\.]/g, ":")
        .replace(/[,;：﹕ː]/g, ":")
        .replace(/[-_]/g, ":");

      let hours;
      let minutes;

      // Extrai blocos numéricos sem regex para evitar inconsistências no script embutido.
      const numericParts = [];
      let current = "";
      for (const ch of normalizedSource) {
        if (ch >= "0" && ch <= "9") {
          current += ch;
        } else if (current) {
          numericParts.push(current);
          current = "";
        }
      }
      if (current) {
        numericParts.push(current);
      }

      if (numericParts.length >= 2) {
        // Ex.: 23:55, 23:55:00, 23h55
        hours = Number(numericParts[0]);
        minutes = Number(numericParts[1]);
      } else {
        // Ex.: 1600, 900
        let digitsOnly = "";
        for (const ch of normalizedSource) {
          if (ch >= "0" && ch <= "9") {
            digitsOnly += ch;
          }
        }

        if (!(digitsOnly.length === 3 || digitsOnly.length === 4)) return "";
        const hh = digitsOnly.length === 3 ? digitsOnly.slice(0, 1) : digitsOnly.slice(0, 2);
        const mm = digitsOnly.slice(-2);
        hours = Number(hh);
        minutes = Number(mm);
      }

      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";

      return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
    }

    function normalizeHourFieldValue() {
      const normalized = normalizeHourInput(modalEls.hora.value);
      if (normalized) {
        modalEls.hora.value = normalized;
        clearInvalidField(modalEls.hora);
      }
      return normalized;
    }

    function statusEmPortugues(phase) {
      const labels = {
        ready: "pronto",
        authenticated: "autenticado",
        initializing: "inicializando",
        qr: "aguardando QR",
        disconnected: "desconectado",
        auth_failure: "falha de autenticação",
        idle: "inativo"
      };

      if (labels[phase]) return labels[phase];
      if (String(phase || "").startsWith("state:")) {
        return "estado: " + phase.replace("state:", "");
      }
      return phase || "desconhecido";
    }

    function statusClasse(phase) {
      if (phase === "ready" || phase === "authenticated") return "status-ok";
      if (phase === "disconnected" || phase === "auth_failure") return "status-error";
      return "status-warn";
    }

    function setWaLoginFeedback(message, type) {
      if (!waLoginFeedbackEl) return;
      const iconMap = {
        ok: "✓",
        error: "⚠",
        info: "ℹ"
      };
      const icon = iconMap[type] || (message ? "ℹ" : "");
      waLoginFeedbackEl.textContent = message ? (icon + " " + String(message || "")) : "";
      waLoginFeedbackEl.className = "wa-login-feedback" + (type ? " " + type : "");
    }

    function showQrConnectOverlay(message) {
      if (!qrConnectOverlayEl) return;
      if (qrConnectTimer) {
        clearTimeout(qrConnectTimer);
        qrConnectTimer = null;
      }
      if (qrConnectTextEl) {
        qrConnectTextEl.textContent = message || "QR validado. Carregando e acessando a aplicação...";
      }
      qrConnectOverlayEl.classList.remove("hidden");
      qrConnectTimer = setTimeout(() => {
        qrConnectOverlayEl.classList.add("hidden");
        qrConnectTimer = null;
      }, 900);
    }

    function hideQrConnectOverlay() {
      if (!qrConnectOverlayEl) return;
      if (qrConnectTimer) {
        clearTimeout(qrConnectTimer);
        qrConnectTimer = null;
      }
      qrConnectOverlayEl.classList.add("hidden");
    }

    function shouldShowWhatsAppLogin(phase) {
      const p = String(phase || "");
      const hasSender = Boolean(String(latestStatusData?.whatsapp?.sender || "").trim());
      const hasQr = Boolean(latestStatusData?.whatsapp?.qrAvailable);

      // Exibir tela de login somente quando houver sinal explícito de reconexão.
      if (hasQr || p === "qr" || p === "disconnected" || p === "auth_failure") {
        return true;
      }

      // Sessão válida não deve cair na tela de QR.
      if (p === "ready" || p === "authenticated" || hasSender) {
        return false;
      }

      // Estados transitórios (initializing/idle/unknown) não devem forçar QR.
      return false;
    }

    function updateWhatsAppLoginOverlay(data) {
      if (!waLoginOverlayEl) return;
      const phase = String(data?.whatsapp?.phase || "");
      const show = shouldShowWhatsAppLogin(phase);
      const wasShowingLogin = shouldShowWhatsAppLogin(lastWaPhaseForOverlay);

      if (!show) {
        waLoginOverlayEl.classList.add("hidden");
        setWaLoginFeedback("", "");
        if (wasShowingLogin) {
          showQrConnectOverlay("QR validado. Carregando e acessando a aplicação...");
        }
        lastWaPhaseForOverlay = phase;
        return;
      }

      hideQrConnectOverlay();

      let text = "Aguardando conexão do WhatsApp Web.";
      if (phase === "qr") {
        text = "Escaneie o QR Code com o WhatsApp para reconectar a sessão.";
      } else if (phase === "disconnected") {
        text = "WhatsApp desconectado. Clique em “Gerar QR” para iniciar novo login.";
      } else if (phase === "auth_failure") {
        text = "Falha de autenticação. Gere um novo QR Code para reconectar.";
      } else if (phase === "initializing") {
        text = "Inicializando sessão do WhatsApp Web...";
      }

      if (waLoginTextEl) {
        waLoginTextEl.textContent = text;
      }

      const qrDataUrl = String(data?.whatsapp?.qrImageDataUrl || "");
      if (qrDataUrl) {
        waLoginQrEl.src = qrDataUrl;
        waLoginQrEl.classList.remove("is-hidden");
        waLoginEmptyEl.classList.add("is-hidden");
        setWaLoginFeedback("QR pronto. Escaneie com seu WhatsApp.", "ok");
      } else {
        waLoginQrEl.removeAttribute("src");
        waLoginQrEl.classList.add("is-hidden");
        waLoginEmptyEl.classList.remove("is-hidden");
        if (phase !== "ready" && phase !== "authenticated") {
          setWaLoginFeedback("Aguardando geração do QR...", "");
        }
      }

      waLoginOverlayEl.classList.remove("hidden");
      lastWaPhaseForOverlay = phase;
    }

    function renderState(data) {
      const phase = data.whatsapp.phase || "desconhecido";
      const whatsappReady = phase === "ready" || phase === "authenticated" || Boolean(data?.whatsapp?.sender);
      els.statusBadge.className = "status " + statusClasse(phase);
      els.statusBadge.innerHTML = '<span class="dot"></span><span>' + statusEmPortugues(phase) + '</span>';
      updateWhatsAppLoginOverlay(data);
      if (shouldShowWhatsAppLogin(phase) && isScreenLocked) {
        unlockScreen();
        setLog("Sessão do WhatsApp desconectada. Painel de QR aberto para reconexão.");
      }
      const statusRows = [
        { label: "Sessão", value: data.whatsapp.sender || "ainda não autenticada" },
        { label: "Agendador", value: data.schedulerStarted ? "ativo" : "parado" },
        { label: "QR pendente", value: data.whatsapp.qrAvailable ? "sim" : "não" },
        data.whatsapp.lastError ? { label: "Último erro", value: data.whatsapp.lastError } : null
      ].filter(Boolean);
      els.statusLines.innerHTML = '<div class="status-lines-grid">' + statusRows.map((row) =>
        '<div class="status-line"><span class="status-label">' + row.label + '</span><span class="status-value">' + row.value + "</span></div>"
      ).join("") + "</div>";

      updateManualSendButtonsState();

      els.to.value = data.settings.to || "";
      setGroupIdValue(data.settings.groupId || "");
      els.groupName.value = data.settings.groupName || "";
      els.turma.value = data.config.turma || "";
      els.instituicao.value = data.config.instituicao || "";
      els.antecedenciaMin.value = data.config.antecedenciaMin ?? 0;
      els.diasUteisApenas.value = String(Boolean(data.config.diasUteisApenas));
      els.lockTimeoutMin.value = String(Number(data.config.lockTimeoutMin || 15));
      lockConfigured = Boolean(data.config.lockConfigured);
      lockTimeoutMs = Math.max(1, Number(data.config.lockTimeoutMin || 15)) * 60 * 1000;
      btnLockNow.disabled = !lockConfigured;
      if (!lockConfigured && isScreenLocked) {
        unlockScreen();
      }
      scheduleAutoLock();
      destinationSnapshot = {
        to: normalizeText(data.settings.to || ""),
        groupId: normalizeText(data.settings.groupId || ""),
        groupName: normalizeText(data.settings.groupName || "")
      };
      configSnapshot = {
        turma: normalizeText(data.config.turma || ""),
        instituicao: normalizeText(data.config.instituicao || ""),
        antecedenciaMin: String(Number(data.config.antecedenciaMin ?? 0)),
        diasUteisApenas: String(Boolean(data.config.diasUteisApenas)),
        lockTimeoutMin: String(Number(data.config.lockTimeoutMin || 15))
      };

      const alunos = Array.isArray(data.config?.alunos) ? data.config.alunos : [];
      if (alunos.length > 0) {
        const startOptions = alunos.map((name, index) =>
          '<option value="' + index + '">' + (index + 1) + " - " + escapeHtml(name) + "</option>"
        );
        els.startAluno.innerHTML = startOptions.join("");
        const idxAtual = Number(data.state?.idxAluno || 0);
        els.startAluno.value = String(((idxAtual % alunos.length) + alunos.length) % alunos.length);
      } else {
        els.startAluno.innerHTML = '<option value="">Sem alunos cadastrados</option>';
      }

      const scheduleItems = Array.isArray(data.scheduleSummary) ? data.scheduleSummary : [];
      currentScheduleItems = scheduleItems;
      if (scheduleItems.length > 0) {
        const diaLongo = {
          "0": "domingo",
          "1": "segunda-feira",
          "2": "terça-feira",
          "3": "quarta-feira",
          "4": "quinta-feira",
          "5": "sexta-feira",
          "6": "sábado"
        };
        const aulaOptions = scheduleItems.map((item, index) => {
          const day = diaLongo[String(item.dia)] || ("dia " + item.dia);
          const label = day + " " + item.horario + " | " + item.materia;
          return '<option value="' + index + '">' + (index + 1) + " - " + escapeHtml(label) + "</option>";
        });
        els.startAula.innerHTML = aulaOptions.join("");
        const idxAulaAtual = Number(data.state?.idxAula || 0);
        els.startAula.value = String(((idxAulaAtual % scheduleItems.length) + scheduleItems.length) % scheduleItems.length);
      } else {
        els.startAula.innerHTML = '<option value="">Sem aulas cadastradas</option>';
      }

      els.startDate.value = String(data.state?.dataInicio || "");
      startSnapshot = {
        idxAluno: String(els.startAluno?.value || ""),
        idxAula: String(els.startAula?.value || ""),
        dataInicio: String(els.startDate?.value || "").trim()
      };
      updateStartButtonsState();

      const activeCycle = data?.cycle?.active || null;
      const activeSentCount = Number(activeCycle?.sentCount || 0);
      const filaReposicao = Array.isArray(data?.state?.reposicaoAlunos) ? data.state.reposicaoAlunos : [];
      if (activeCycle) {
        const sent = activeSentCount;
        const total = Number(activeCycle.totalAlunos || 0);
        const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
        const cycleName = String(activeCycle.name || "").trim();
        els.heroCycle.textContent = cycleName ? ("Ciclo atual: " + cycleName) : "Ciclo atual: sem nome";
        els.heroCycle.style.display = "";
        const cycleNameText = cycleName ? 'Nome: "' + cycleName + '". ' : "";
        els.cycleInfo.textContent = "Ciclo ativo. " + cycleNameText + sent + "/" + total + " aluno(s) enviado(s) (" + pct + "%). " +
          "Reposição pendente: " + filaReposicao.length + ".";
      } else {
        els.heroCycle.textContent = "";
        els.heroCycle.style.display = "none";
        els.cycleInfo.textContent = "Sem ciclo ativo. Você pode iniciar um novo ciclo. " +
          "Reposição pendente: " + filaReposicao.length + ".";
      }
      btnNewCycle.disabled = Boolean(activeCycle);
      btnCancelCycle.disabled = !Boolean(activeCycle);
      if (activeCycle && activeSentCount > 0) {
        setLog("Início bloqueado: o ciclo já começou. Para alterar início, cancele e crie um novo ciclo.", true);
      }

      cycleHistoryCache = Array.isArray(data?.cycle?.history) ? data.cycle.history : [];
      renderCycleHistorySummary();

      const agendaItems = Array.isArray(data.schedulePreview) && data.schedulePreview.length
        ? data.schedulePreview
        : [];
      renderAgendaPreview(agendaItems);
      renderNextGreetings(agendaItems);

      if (data.lastRun) {
        const typeLabels = {
          scheduled: "Agendado",
          forced: "Forçado",
          test: "Teste",
          custom: "Manual"
        };
        const reasonLabels = {
          fora_de_dia_util: "Fora de dia útil",
          sem_aula_no_dia: "Sem aula no dia"
        };

        const when = data.lastRun.sentAt
          ? new Date(data.lastRun.sentAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "medium"
            })
          : "-";

        const fullId = String(data.lastRun.messageId || "");
        const shortId = fullId.length > 44
          ? fullId.slice(0, 24) + "..." + fullId.slice(-16)
          : fullId;

        const rows = [
          '<div class="last-run-item"><b>Tipo:</b> ' + (typeLabels[data.lastRun.type] || data.lastRun.type || "-") + "</div>",
          '<div class="last-run-item"><b>Quando:</b> ' + when + "</div>",
          data.lastRun.aluno ? '<div class="last-run-item"><b>Aluno:</b> ' + data.lastRun.aluno + "</div>" : "",
          data.lastRun.materia ? '<div class="last-run-item"><b>Matéria:</b> ' + data.lastRun.materia + "</div>" : "",
          data.lastRun.reason ? '<div class="last-run-item"><b>Motivo:</b> ' + (reasonLabels[data.lastRun.reason] || data.lastRun.reason) + "</div>" : ""
        ].filter(Boolean);

        els.lastRun.innerHTML = '<div class="last-run-list">' + rows.join("") + "</div>";
      } else {
        els.lastRun.textContent = "Nenhum envio ainda.";
      }

      const firstGroupOptionText = String(els.groupSelect?.options?.[0]?.textContent || "");
      const groupStateNeedsRetry =
        firstGroupOptionText.toLowerCase().includes("falha ao carregar grupos") ||
        firstGroupOptionText.toLowerCase().includes("aguardando whatsapp");
      if (whatsappReady && groupStateNeedsRetry) {
        loadGroups().catch(() => {});
      }

      updateSaveButtonsState();
    }

    async function fetchJson(url, options) {
      let res;
      try {
        res = await fetch(url, options);
      } catch (error) {
        throw new Error("Falha de conexão com o dashboard. Verifique se o servidor está ligado.");
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Resposta inválida do servidor.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Falha na requisição");
      }
      return data;
    }

    async function refresh() {
      if (isRefreshing) return latestStatusData;
      isRefreshing = true;
      try {
        const data = await fetchJson("/api/status");
        latestStatusData = data;
        initialStatusLoaded = true;
        renderState(data);
        updateAppReadinessGate(data);
        return data;
      } catch (error) {
        setLog(error.message, true);
        throw error;
      } finally {
        isRefreshing = false;
      }
    }

    function startAutoRefreshLoop() {
      const run = async () => {
        try {
          await refresh();
        } catch {
          // erro já tratado em refresh()
        } finally {
          const phase = String(latestStatusData?.whatsapp?.phase || "");
          const needsQr = shouldShowWhatsAppLogin(phase);
          const delayMs = needsQr ? 1000 : 3000;
          refreshLoopTimer = setTimeout(run, delayMs);
        }
      };

      if (refreshLoopTimer) {
        clearTimeout(refreshLoopTimer);
        refreshLoopTimer = null;
      }
      run();
    }

    async function requestWhatsAppReconnect() {
      if (isRequestingWhatsAppReconnect) return;
      isRequestingWhatsAppReconnect = true;
      btnWaReconnect.disabled = true;
      showQrConnectOverlay("Solicitando QR e preparando acesso...");
      setWaLoginFeedback("Solicitando novo QR...", "");
      try {
        setLog("Solicitando reconexão do WhatsApp...");
        const data = await fetchJson("/api/whatsapp/reconnect", { method: "POST" });
        setLog(data.message || "Reconexão iniciada.");
        setWaLoginFeedback("Reconexão iniciada. Aguarde o QR aparecer.", "ok");
        await refresh();
      } catch (error) {
        setLog(error.message || "Falha ao reconectar WhatsApp.", true);
        setWaLoginFeedback(error.message || "Falha ao gerar QR.", "error");
      } finally {
        isRequestingWhatsAppReconnect = false;
        btnWaReconnect.disabled = false;
      }
    }

    function dayLabel(dia) {
      const labels = { "0": "Dom", "1": "Seg", "2": "Ter", "3": "Qua", "4": "Qui", "5": "Sex", "6": "Sáb" };
      return labels[String(dia)] || String(dia);
    }

    function rowsFromAgendaSemanal(agendaSemanal) {
      const rows = [];
      Object.entries(agendaSemanal || {}).forEach(([dia, aulas]) => {
        const list = Array.isArray(aulas) ? aulas : [aulas];
        list.forEach((aula) => {
          rows.push({
            dia: String(dia),
            hora: aula.hora || "",
            materia: aula.materia || "",
            professor: aula.professor || ""
          });
        });
      });
      return rows;
    }

    function agendaSemanalFromRows(rows) {
      const agenda = {};
      rows.forEach((row) => {
        if (!agenda[row.dia]) agenda[row.dia] = [];
        agenda[row.dia].push({
          materia: row.materia,
          professor: row.professor,
          hora: row.hora
        });
      });
      return agenda;
    }

    async function persistAgendaFromModal(successMessage) {
      const payload = {
        alunos: modalData.alunos,
        agendaSemanal: buildAgendaSemanalFromLessons()
      };

      const data = await fetchJson("/api/agenda-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      hydrateModalData(data);
      renderModalStudents();
      renderModalLessons();

      if (successMessage) {
        setLog(successMessage);
      } else {
        setLog(data.message || "Dados salvos.");
      }
      return data;
    }

    function renderEasyAgendaTable() {
      if (!easyAgendaRows.length) {
        els.easyAgendaTable.textContent = "Sem aulas.";
        return;
      }

      const lines = easyAgendaRows.map((row, index) =>
        "<tr>" +
          "<td>" + dayLabel(row.dia) + " (" + row.dia + ")</td>" +
          "<td>" + row.hora + "</td>" +
          "<td>" + row.materia + "</td>" +
          "<td>" + row.professor + "</td>" +
          '<td><button class="secondary" data-remove-row="' + index + '">Remover</button></td>' +
        "</tr>"
      ).join("");

      els.easyAgendaTable.innerHTML = "<table class='table'><thead><tr><th>Dia</th><th>Hora</th><th>Matéria</th><th>Professor</th><th></th></tr></thead><tbody>" + lines + "</tbody></table>";
    }

    async function openJsonEditor() {
      setLog("Carregando JSON...");
      try {
        const data = await fetchJson("/api/agenda-json");
        els.agendaJson.value = JSON.stringify(data, null, 2);
        els.easyAlunos.value = (data.alunos || []).join("\\n");
        easyAgendaRows = rowsFromAgendaSemanal(data.agendaSemanal);
        renderEasyAgendaTable();
        els.easyEditorWrap.style.display = "block";
        setLog("Editor carregado. Você pode editar por formulário e salvar.");
      } catch (error) {
        setLog(error.message, true);
      }
    }

    async function loadGroups() {
      if (isLoadingGroups) return;
      isLoadingGroups = true;
      const withTimeout = async (promise, timeoutMs) => {
        return await Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo limite para carregar grupos.")), timeoutMs))
        ]);
      };
      try {
        const phase = String(latestStatusData?.whatsapp?.phase || "");
        const ready = phase === "ready" || phase === "authenticated" || Boolean(String(latestStatusData?.whatsapp?.sender || ""));
        if (!ready) {
          els.groupSelect.innerHTML = '<option value="">Aguardando WhatsApp ficar pronto</option>';
          initialGroupsLoaded = true;
          updateAppReadinessGate(latestStatusData);
          return [];
        }

        const data = await withTimeout(fetchJson("/api/groups"), 30000);
        if (data?.waiting) {
          els.groupSelect.innerHTML = '<option value="">Aguardando WhatsApp ficar pronto</option>';
          initialGroupsLoaded = true;
          updateAppReadinessGate(latestStatusData);
          return [];
        }
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        const options = ['<option value="">Selecione um grupo</option>'].concat(
          groups.map((group) =>
            '<option value="' + escapeHtml(group.id) + '" data-name="' + escapeHtml(group.name) + '">' + escapeHtml(group.name) + '</option>'
          )
        );
        els.groupSelect.innerHTML = options.join("");
        if (!groups.length) {
          els.groupSelect.innerHTML = '<option value="">Nenhum grupo encontrado nesta sessão</option>';
        }

        const currentGroupId = getGroupIdValue();
        if (currentGroupId) {
          els.groupSelect.value = currentGroupId;
        } else if (els.groupName.value) {
          const option = Array.from(els.groupSelect.options).find((item) => item.dataset.name === els.groupName.value);
          if (option) {
            els.groupSelect.value = option.value;
          }
        }
        initialGroupsLoaded = true;
        updateAppReadinessGate(latestStatusData);
      } catch (error) {
        const message = String(error?.message || "");
        if (message.toLowerCase().includes("não está pronto")) {
          els.groupSelect.innerHTML = '<option value="">Aguardando WhatsApp ficar pronto</option>';
          setLog("Aguardando WhatsApp ficar pronto para listar grupos.");
        } else {
          els.groupSelect.innerHTML = '<option value="">Falha ao carregar grupos</option>';
          setLog("Falha ao carregar grupos: " + (error.message || "erro desconhecido"), true);
        }
        initialGroupsLoaded = true;
        updateAppReadinessGate(latestStatusData);
        return [];
      } finally {
        isLoadingGroups = false;
      }
    }

    async function saveDestination(autoMessage) {
      const data = await fetchJson("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: els.to.value,
          groupId: getGroupIdValue(),
          groupName: els.groupName.value
        })
      });
      destinationSnapshot = getDestinationFormState();
      updateSaveButtonsState();
      setLog(autoMessage || data.message || "Destino salvo.");
      return data;
    }

    function hideAppLoading() {
      if (!loadingEl || appReadyShown) return;
      const elapsed = Date.now() - appLoadingStartedAt;
      const remaining = Math.max(0, MIN_APP_LOADING_MS - elapsed);

      if (remaining > 0) {
        if (appLoadingHideTimer) return;
        appLoadingHideTimer = setTimeout(() => {
          appLoadingHideTimer = null;
          hideAppLoading();
        }, remaining);
        return;
      }

      appReadyShown = true;
      loadingEl.classList.add("hidden");
    }

    function forceHideAppLoading() {
      if (!loadingEl) return;
      if (appLoadingHideTimer) {
        clearTimeout(appLoadingHideTimer);
        appLoadingHideTimer = null;
      }
      appReadyShown = true;
      loadingEl.classList.add("hidden");
    }

    function showAppLoading(title, text) {
      if (!loadingEl) return;
      if (appLoadingHideTimer) {
        clearTimeout(appLoadingHideTimer);
        appLoadingHideTimer = null;
      }
      if (loadingEl.classList.contains("hidden")) {
        appLoadingStartedAt = Date.now();
      }
      if (loadingTitleEl) {
        loadingTitleEl.textContent = title || "Carregando aplicação";
      }
      if (loadingTextEl) {
        loadingTextEl.textContent = text || "Aguarde enquanto inicializamos o painel.";
      }
      loadingEl.classList.remove("hidden");
    }

    function renderLoadingChecklist(data, pending = []) {
      if (!loadingChecklistEl) return;
      const phase = data?.whatsapp?.phase || "";
      const phaseLabel = statusEmPortugues(phase || "carregando");
      const pendingSet = new Set(pending);
      const hasAgendaPending = pendingSet.has("Pelo menos 1 item de agenda");
      const hasConfigPending = pendingSet.has("Turma") || pendingSet.has("Instituição") || pendingSet.has("Pelo menos 1 aluno");

      const items = [
        { label: "Dados de status", done: initialStatusLoaded },
        { label: "Grupos do WhatsApp (opcional)", done: initialGroupsLoaded },
        { label: "Status WhatsApp (" + phaseLabel + ")", done: phase === "ready" || phase === "authenticated" },
        { label: "Itens da agenda", done: initialStatusLoaded && !hasAgendaPending },
        { label: "Configuração obrigatória", done: initialStatusLoaded && !hasConfigPending }
      ];

      loadingChecklistEl.innerHTML = items.map((item) =>
        '<div class="app-loading-item ' + (item.done ? "done" : "") + '">' +
          '<span class="app-loading-icon">' + (item.done ? "✓" : "•") + '</span>' +
          '<span>' + item.label + '</span>' +
        '</div>'
      ).join("");
    }

    function isValidLesson(aula) {
      if (!aula || typeof aula !== "object") return false;
      const dia = String(aula.dia ?? "");
      const hora = normalizeText(aula.hora);
      const materia = normalizeText(aula.materia);
      const professor = normalizeText(aula.professor);
      return ["0", "1", "2", "3", "4", "5", "6"].includes(dia) && !!hora && !!materia && !!professor;
    }

    function getPendingRequiredItems(data) {
      const pending = [];
      const config = data?.config || {};
      if (!normalizeText(config.turma)) pending.push("Turma");
      if (!normalizeText(config.instituicao)) pending.push("Instituição");

      const alunos = Array.isArray(config.alunos) ? config.alunos.map(normalizeText).filter(Boolean) : [];
      if (!alunos.length) pending.push("Pelo menos 1 aluno");

      const lessons = [];
      Object.entries(config.agendaSemanal || {}).forEach(([dia, aulas]) => {
        const list = Array.isArray(aulas) ? aulas : [aulas];
        list.forEach((aula) => {
          lessons.push({
            dia,
            hora: aula?.hora,
            materia: aula?.materia,
            professor: aula?.professor
          });
        });
      });

      const hasValidLesson = lessons.some(isValidLesson);
      if (!hasValidLesson) pending.push("Pelo menos 1 item de agenda");
      return pending;
    }

    function areMainCardsHydrated() {
      const statusText = String(els.statusLines?.textContent || "").trim();
      const nextGreetingsText = String(els.nextGreetings?.textContent || "").trim();
      return Boolean(statusText) && Boolean(nextGreetingsText);
    }

    function updateAppReadinessGate(data) {
      if (appReadyShown) return;
      const cardsHydrated = areMainCardsHydrated();
      const phase = String(data?.whatsapp?.phase || "");
      const needsQrLogin = shouldShowWhatsAppLogin(phase);

      if (needsQrLogin) {
        renderLoadingChecklist(data, []);
        showAppLoading("Aguardando login do WhatsApp", "Escaneie o QR Code para continuar.");
        hideAppLoading();
        return;
      }

      if (cardsHydrated) {
        renderLoadingChecklist(data, []);
        showAppLoading("Finalizando carregamento", "Quase pronto...");
        hideAppLoading();
        return;
      }

      if (!initialStatusLoaded) {
        const waiting = [];
        if (!initialStatusLoaded) waiting.push("status");
        renderLoadingChecklist(data, []);
        showAppLoading(
          "Carregando aplicação",
          "Aguardando: " + waiting.join(" e ") + "."
        );
        return;
      }
      if (!data) {
        renderLoadingChecklist(data, []);
        showAppLoading("Carregando aplicação", "Aguardando dados iniciais do painel.");
        return;
      }
      const whatsappReady = phase === "ready" || phase === "authenticated";
      const pending = getPendingRequiredItems(data);
      renderLoadingChecklist(data, pending);
      if (!whatsappReady) {
        showAppLoading(
          "Aguardando WhatsApp ficar pronto",
          "Status atual: " + statusEmPortugues(phase || "desconhecido") + "."
        );
        return;
      }
      if (!cardsHydrated) {
        showAppLoading(
          "Carregando cartões principais",
          "Aguardando preenchimento de Status e Próximas saudações."
        );
        return;
      }
      hideAppLoading();
    }

    onById("btn-refresh", "click", async () => {
      await refresh();
      await loadGroups();
      setLog("Atualizado.");
    });
    if (btnWaReconnect) btnWaReconnect.addEventListener("click", async () => {
      await requestWhatsAppReconnect();
    });

    onById("btn-test", "click", async () => {
      setLog("Enviando teste...");
      try {
        const data = await fetchJson("/api/send-test", { method: "POST" });
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-cancel-lesson-edit", "click", () => {
      editingLessonIndex = -1;
      refreshLessonActionButtons();
      clearLessonInputs();
      renderModalLessons();
      setLog("Edição de aula cancelada.");
    });

    if (modalEls.studentName) {
      modalEls.studentName.addEventListener("input", () => {
        clearInvalidField(modalEls.studentName);
        updateAddStudentButtonState();
      });
    }

    [modalEls.dia, modalEls.hora, modalEls.titulo, modalEls.materia, modalEls.professor].filter(Boolean).forEach((field) => {
      field.addEventListener("input", () => {
        clearInvalidField(field);
        updateAddLessonButtonState();
      });
      field.addEventListener("change", () => {
        clearInvalidField(field);
        updateAddLessonButtonState();
      });
    });

    onById("btn-add-student", "click", async () => {
      const name = normalizeText(modalEls.studentName?.value || "");
      if (!isValidStudentName(name)) {
        markInvalidField(modalEls.studentName, "Nome de aluno inválido.");
        return;
      }
      modalData.alunos.push(name);
      try {
        await persistAgendaFromModal("Aluno adicionado.");
        clearStudentInput();
        refreshStudentActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao adicionar aluno.", true);
      }
    });

    onById("btn-save-student-edit", "click", async () => {
      if (editingStudentIndex < 0) return;
      const name = normalizeText(modalEls.studentName?.value || "");
      if (!isValidStudentName(name)) {
        markInvalidField(modalEls.studentName, "Nome de aluno inválido.");
        return;
      }
      modalData.alunos[editingStudentIndex] = name;
      try {
        await persistAgendaFromModal("Aluno atualizado.");
        editingStudentIndex = -1;
        clearStudentInput();
        refreshStudentActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao salvar aluno.", true);
      }
    });

    if (modalEls.students) {
      modalEls.students.addEventListener("click", async (event) => {
        const editIdx = event.target?.dataset?.editStudent;
        const removeIdx = event.target?.dataset?.removeStudent;

        if (editIdx !== undefined) {
          const idx = Number(editIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.alunos.length) return;
          editingStudentIndex = idx;
          modalEls.studentName.value = String(modalData.alunos[idx] || "");
          clearInvalidField(modalEls.studentName);
          refreshStudentActionButtons();
          return;
        }

        if (removeIdx !== undefined) {
          const idx = Number(removeIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.alunos.length) return;
          const removed = String(modalData.alunos[idx] || "");
          const confirmed = await openConfirmModal({
            title: "Excluir aluno",
            message: 'Deseja realmente excluir o aluno "' + removed + '" da lista?',
            confirmLabel: "Excluir aluno"
          });
          if (!confirmed) return;
          modalData.alunos.splice(idx, 1);
          try {
            await persistAgendaFromModal("Aluno removido.");
            if (editingStudentIndex === idx) {
              editingStudentIndex = -1;
              clearStudentInput();
            } else if (editingStudentIndex > idx) {
              editingStudentIndex -= 1;
            }
            refreshStudentActionButtons();
          } catch (error) {
            setLog(error.message || "Falha ao remover aluno.", true);
          }
        }
      });
    }

    onById("btn-add-lesson", "click", async () => {
      const lesson = validateLessonFormAndMark();
      if (!lesson) return;
      modalData.lessons.push(lesson);
      try {
        await persistAgendaFromModal("Aula adicionada.");
        clearLessonInputs();
        editingLessonIndex = -1;
        refreshLessonActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao adicionar aula.", true);
      }
    });

    onById("btn-save-lesson-edit", "click", async () => {
      if (editingLessonIndex < 0) return;
      const lesson = validateLessonFormAndMark();
      if (!lesson) return;
      modalData.lessons[editingLessonIndex] = lesson;
      try {
        await persistAgendaFromModal("Aula atualizada.");
        editingLessonIndex = -1;
        clearLessonInputs();
        refreshLessonActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao salvar aula.", true);
      }
    });

    if (modalEls.lessons) {
      modalEls.lessons.addEventListener("click", async (event) => {
        const editIdx = event.target?.dataset?.editLesson;
        const removeIdx = event.target?.dataset?.removeLesson;

        if (editIdx !== undefined) {
          const idx = Number(editIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.lessons.length) return;
          editingLessonIndex = idx;
          fillLessonForm(modalData.lessons[idx]);
          refreshLessonActionButtons();
          return;
        }

        if (removeIdx !== undefined) {
          const idx = Number(removeIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.lessons.length) return;
          const lesson = modalData.lessons[idx] || {};
          const dayNames = {
            "0": "Domingo",
            "1": "Segunda",
            "2": "Terça",
            "3": "Quarta",
            "4": "Quinta",
            "5": "Sexta",
            "6": "Sábado"
          };
          const dayLabel = dayNames[String(lesson?.dia ?? "")] || "Dia";
          const lessonLabel = [
            dayLabel,
            String(lesson?.hora || "").trim(),
            String(lesson?.titulo || "").trim(),
            String(lesson?.materia || "").trim()
          ]
            .filter(Boolean)
            .join(" | ");
          const confirmed = await openConfirmModal({
            title: "Excluir aula",
            message: lessonLabel
              ? 'Deseja realmente excluir esta aula?\\n' + lessonLabel
              : "Deseja realmente excluir esta aula?",
            confirmLabel: "Excluir aula"
          });
          if (!confirmed) return;
          modalData.lessons.splice(idx, 1);
          try {
            await persistAgendaFromModal("Aula removida.");
            if (editingLessonIndex === idx) {
              editingLessonIndex = -1;
              clearLessonInputs();
            } else if (editingLessonIndex > idx) {
              editingLessonIndex -= 1;
            }
            refreshLessonActionButtons();
          } catch (error) {
            setLog(error.message || "Falha ao remover aula.", true);
          }
        }
      });
    }

    onById("btn-now", "click", async (event) => {
      if (isManualSendBusy) return;
      if (event?.currentTarget?.disabled) {
        setLog("Sem ciclo ativo. Inicie um novo ciclo para enviar agora.", true);
        return;
      }
      setLog("Enviando mensagem do dia...");
      isManualSendBusy = true;
      updateManualSendButtonsState();
      try {
        const data = await fetchJson("/api/send-now", { method: "POST" });
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      } finally {
        isManualSendBusy = false;
        updateManualSendButtonsState();
      }
    });

    onById("btn-now-forced", "click", async (event) => {
      if (isManualSendBusy) return;
      if (event?.currentTarget?.disabled) {
        setLog("Sem ciclo ativo. Inicie um novo ciclo para envio forçado.", true);
        return;
      }
      setLog("Enviando mensagem forçada...");
      isManualSendBusy = true;
      updateManualSendButtonsState();
      try {
        const data = await fetchJson("/api/send-now-forced", { method: "POST" });
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      } finally {
        isManualSendBusy = false;
        updateManualSendButtonsState();
      }
    });

    if (btnLockNow) btnLockNow.addEventListener("click", () => {
      if (!lockConfigured) {
        setLog("Defina uma senha de bloqueio na Configuração para usar este recurso.", true);
        return;
      }
      lockScreen("Painel bloqueado manualmente.");
    });

    if (btnUnlock) btnUnlock.addEventListener("click", async () => {
      const password = String(lockInputEl.value || "");
      if (!password) {
        setLockFeedback("Digite a senha.", "error");
        return;
      }
      btnUnlock.disabled = true;
      try {
        await fetchJson("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });
        unlockScreen();
        setLog("Painel desbloqueado.");
      } catch (error) {
        setLockFeedback(error.message || "Senha inválida.", "error");
      } finally {
        btnUnlock.disabled = false;
      }
    });

    if (lockInputEl) lockInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        btnUnlock.click();
      }
    });

    onById("btn-save-destination", "click", async () => {
      setLog("Salvando destino...");
      try {
        await saveDestination("Destino salvo.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-open-editor", "click", async () => {
      await openJsonEditor();
    });

    onById("btn-cancel-easy", "click", () => {
      els.easyEditorWrap.style.display = "none";
      els.jsonEditorWrap.style.display = "none";
      setLog("Editor fechado.");
    });

    onById("btn-open-full-agenda", "click", () => {
      openAgendaModal();
    });
    if (agendaViewEls.closeBtn) {
      agendaViewEls.closeBtn.addEventListener("click", () => closeAgendaModal());
    }
    if (agendaViewEls.wrap) {
      agendaViewEls.wrap.addEventListener("click", (event) => {
        if (event.target === agendaViewEls.wrap) closeAgendaModal();
      });
    }
    if (agendaViewEls.list) {
      agendaViewEls.list.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const revertIdxRaw = target.dataset?.revertEffective;
        if (revertIdxRaw !== undefined) {
          const idx = Number(revertIdxRaw);
          if (!Number.isInteger(idx) || idx < 0 || idx >= agendaItemsCache.length) return;
          const item = agendaItemsCache[idx];
          const aluno = String(item?.alunoPrevisto || "").trim();
          const itemKey = String(target.dataset?.revertKey || "").trim();
          openEffectiveFixModal(idx, itemKey, aluno);
          return;
        }

        const absenceIdxRaw = target.dataset?.markAbsence;
        if (absenceIdxRaw !== undefined) {
          if (target.hasAttribute("disabled")) return;
          const idx = Number(absenceIdxRaw);
          if (!Number.isInteger(idx) || idx < 0 || idx >= agendaItemsCache.length) return;
          const item = agendaItemsCache[idx];
          const pendingIndex = Number(target.dataset?.markAbsencePending);
          const aluno = String(item?.alunoPrevisto || "").trim();
          const confirmed = await openConfirmModal({
            title: "Registrar ausência",
            message: "Confirma ausência deste aluno? Ele será movido para o fim da fila.",
            confirmLabel: "Confirmar ausência"
          });
          if (!confirmed) return;
          try {
            const data = await fetchJson("/api/absence", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ aluno, pendingIndex })
            });
            setLog(data.message || "Ausência registrada.");
            await refresh();
            renderAgendaModal();
          } catch (error) {
            setLog(error.message || "Falha ao registrar ausência.", true);
          }
          return;
        }

        const openSwapRaw = target.dataset?.openSwap;
        if (openSwapRaw !== undefined) {
          openSwapModal(openSwapRaw);
        }
      });
    }

    if (cyclesViewEls.closeBtn) {
      cyclesViewEls.closeBtn.addEventListener("click", () => closeCyclesModal());
    }
    if (cyclesViewEls.filter) {
      cyclesViewEls.filter.addEventListener("change", () => renderCyclesModal());
    }
    if (cyclesViewEls.wrap) {
      cyclesViewEls.wrap.addEventListener("click", (event) => {
        if (event.target === cyclesViewEls.wrap) closeCyclesModal();
      });
    }

    if (confirmEls.cancel) {
      confirmEls.cancel.addEventListener("click", () => closeConfirmModal(false));
    }
    if (confirmEls.ok) {
      confirmEls.ok.addEventListener("click", () => closeConfirmModal(true));
    }
    if (confirmEls.wrap) {
      confirmEls.wrap.addEventListener("click", (event) => {
        if (event.target === confirmEls.wrap) closeConfirmModal(false);
      });
    }

    if (newCycleEls.cancel) {
      newCycleEls.cancel.addEventListener("click", () => closeNewCycleModal());
    }
    if (newCycleEls.wrap) {
      newCycleEls.wrap.addEventListener("click", (event) => {
        if (event.target === newCycleEls.wrap) closeNewCycleModal();
      });
    }
    if (newCycleEls.name) {
      newCycleEls.name.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          newCycleEls.confirm?.click();
        }
      });
    }
    if (newCycleEls.confirm) {
      newCycleEls.confirm.addEventListener("click", async () => {
        const name = String(newCycleEls.name?.value || "").trim();
        setLog("Criando novo ciclo...");
        try {
          const idxAluno = Number(els.startAluno?.value);
          const idxAula = Number(els.startAula?.value);
          const rawDataInicio = String(els.startDate?.value || "").trim();
          const statePayload = {};

          if (Number.isInteger(idxAluno)) {
            statePayload.idxAluno = idxAluno;
          }
          if (Number.isInteger(idxAula)) {
            statePayload.idxAula = idxAula;
          }

          if (rawDataInicio) {
            const parsedDataInicio = parseDateOnly(rawDataInicio);
            if (!parsedDataInicio) {
              markInvalidField(els.startDate, "Data de início inválida.");
              return;
            }
            let idxAulaToSave = Number.isInteger(idxAula) ? idxAula : null;
            const selectedAula = Number.isInteger(idxAula) ? currentScheduleItems[idxAula] : null;
            let dateToSave = parsedDataInicio;

            if (selectedAula && Number(parsedDataInicio.getDay()) !== Number(selectedAula.dia)) {
              const idxByDateWeekday = findFirstLessonIndexByWeekday(parsedDataInicio.getDay());
              if (idxByDateWeekday >= 0) {
                idxAulaToSave = idxByDateWeekday;
                if (els.startAula) {
                  els.startAula.value = String(idxByDateWeekday);
                }
              } else {
                const aligned = alignDateToWeekday(parsedDataInicio, Number(selectedAula.dia));
                if (!aligned) {
                  markInvalidField(els.startDate, "Não foi possível ajustar a data de início.");
                  return;
                }
                dateToSave = aligned;
              }
            }

            const iso = toIsoDateOnly(dateToSave);
            statePayload.dataInicio = iso;
            if (Number.isInteger(Number(idxAulaToSave))) {
              statePayload.idxAula = Number(idxAulaToSave);
            }
            if (els.startDate) {
              els.startDate.value = iso;
            }
            clearInvalidField(els.startDate);
            clearInvalidField(els.startAula);
          }

          if (Object.keys(statePayload).length) {
            await fetchJson("/api/state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(statePayload)
            });
          }

          const data = await fetchJson("/api/cycle/new", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
          });
          closeNewCycleModal();
          setLog(data.message || "Novo ciclo criado.");
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    }

    if (infoEls.ok) {
      infoEls.ok.addEventListener("click", () => closeInfoModal());
    }
    if (infoEls.wrap) {
      infoEls.wrap.addEventListener("click", (event) => {
        if (event.target === infoEls.wrap) closeInfoModal();
      });
    }

    if (swapEls.cancel) {
      swapEls.cancel.addEventListener("click", () => closeSwapModal());
    }
    if (swapEls.wrap) {
      swapEls.wrap.addEventListener("click", (event) => {
        if (event.target === swapEls.wrap) closeSwapModal();
      });
    }
    if (swapEls.confirm) {
      swapEls.confirm.addEventListener("click", async () => {
        if (swapTargetPendingIndex < 0) {
          setLog("Selecione um aluno pendente para troca.", true);
          return;
        }
        const toAluno = String(swapEls.to?.value || "").trim();
        if (!toAluno) {
          setLog("Selecione o aluno de destino para trocar posição.", true);
          return;
        }
        const target = agendaPendingRowsCache.find((item) => item.aluno === toAluno && item.pendingIndex !== swapTargetPendingIndex);
        if (!target) {
          setLog("Aluno de destino não encontrado na fila pendente.", true);
          return;
        }

        try {
          const data = await fetchJson("/api/swap-pending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromPendingIndex: swapTargetPendingIndex,
              toPendingIndex: target.pendingIndex,
              fromAluno: swapFromAluno,
              toAluno
            })
          });
          closeSwapModal();
          setLog(data.message || "Troca de posições aplicada.");
          await refresh();
          renderAgendaModal();
        } catch (error) {
          setLog(error.message || "Falha ao trocar posições.", true);
        }
      });
    }

    if (effectiveFixEls.cancel) {
      effectiveFixEls.cancel.addEventListener("click", () => closeEffectiveFixModal());
    }
    if (effectiveFixEls.wrap) {
      effectiveFixEls.wrap.addEventListener("click", (event) => {
        if (event.target === effectiveFixEls.wrap) closeEffectiveFixModal();
      });
    }
    if (effectiveFixEls.confirm) {
      effectiveFixEls.confirm.addEventListener("click", async () => {
        const performer = String(effectiveFixEls.performer?.value || "").trim();
        if (!performer) {
          setLog("Selecione o aluno que realizou a saudação.", true);
          return;
        }
        const linked = getLinkedStudentsFromAgendaItems(true);
        if (!linked.includes(performer)) {
          setLog("Aluno inválido para este ciclo. Selecione um aluno pendente na agenda.", true);
          return;
        }
        const item = agendaItemsCache[effectiveFixContext.index];
        if (!item) {
          setLog("Item de agenda não encontrado para correção.", true);
          return;
        }
        try {
          const data = await fetchJson("/api/revert-effective", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aluno: effectiveFixContext.alunoPrevisto,
              itemKey: effectiveFixContext.itemKey,
              performedBy: performer
            })
          });
          closeEffectiveFixModal();
          setLog(data.message || "Efetivação corrigida com sucesso.");
          await refresh();
          renderAgendaModal();
        } catch (error) {
          setLog(error.message || "Falha ao corrigir efetivação.", true);
        }
      });
    }

    onById("btn-open-json", "click", async () => {
      try {
        const data = await fetchJson("/api/agenda-json");
        hydrateModalData(data);
        editingStudentIndex = -1;
        editingLessonIndex = -1;
        clearStudentInput();
        clearLessonInputs();
        renderModalStudents();
        renderModalLessons();
        refreshStudentActionButtons();
        refreshLessonActionButtons();
        if (modalEls.wrap) {
          modalEls.wrap.classList.add("open");
          modalEls.wrap.setAttribute("aria-hidden", "false");
        }
      } catch (error) {
        setLog(error.message || "Falha ao abrir editor da agenda.", true);
      }
    });
    onById("btn-close-modal", "click", () => {
      if (modalEls.wrap) {
        modalEls.wrap.classList.remove("open");
        modalEls.wrap.setAttribute("aria-hidden", "true");
      }
    });
    if (modalEls.wrap) {
      modalEls.wrap.addEventListener("click", (event) => {
        if (event.target === modalEls.wrap) {
          modalEls.wrap.classList.remove("open");
          modalEls.wrap.setAttribute("aria-hidden", "true");
        }
      });
    }

    onById("btn-add-easy-aula", "click", () => {
      const row = {
        dia: els.easyDia.value,
        hora: els.easyHora.value.trim(),
        materia: els.easyMateria.value.trim(),
        professor: els.easyProfessor.value.trim()
      };

      if (!row.hora || !row.materia || !row.professor) {
        setLog("Preencha dia, hora, matéria e professor.", true);
        return;
      }

      easyAgendaRows.push(row);
      renderEasyAgendaTable();
      els.easyHora.value = "";
      els.easyMateria.value = "";
      els.easyProfessor.value = "";
      setLog("Aula adicionada.");
    });

    if (els.easyAgendaTable) {
      els.easyAgendaTable.addEventListener("click", (event) => {
        const idx = event.target?.dataset?.removeRow;
        if (idx === undefined) return;
        easyAgendaRows.splice(Number(idx), 1);
        renderEasyAgendaTable();
        setLog("Aula removida.");
      });
    }

    onById("btn-save-easy", "click", async () => {
      setLog("Salvando...");
      try {
        const alunos = els.easyAlunos.value.split("\\n").map((v) => v.trim()).filter(Boolean);
        const payload = {
          alunos,
          agendaSemanal: agendaSemanalFromRows(easyAgendaRows)
        };

        els.agendaJson.value = JSON.stringify(payload, null, 2);
        await fetchJson("/api/agenda-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog("Salvo com sucesso.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-json", "click", async () => {
      setLog("Salvando JSON...");
      try {
        const payload = JSON.parse(els.agendaJson.value);
        const data = await fetchJson("/api/agenda-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-config", "click", async () => {
      setLog("Salvando configuração...");
      try {
        const lockTimeoutMin = Number(els.lockTimeoutMin.value || 15);
        if (!Number.isFinite(lockTimeoutMin) || lockTimeoutMin < 1 || lockTimeoutMin > 240) {
          markInvalidField(els.lockTimeoutMin, "Tempo de bloqueio inválido. Use entre 1 e 240 minutos.");
          return;
        }
        clearInvalidField(els.lockTimeoutMin);

        const body = {
          turma: els.turma.value,
          instituicao: els.instituicao.value,
          antecedenciaMin: Number(els.antecedenciaMin.value || 0),
          diasUteisApenas: els.diasUteisApenas.value === "true",
          lockTimeoutMin
        };
        const lockPasswordValue = String(els.lockPassword.value || "");
        if (lockPasswordValue) {
          body.lockPassword = lockPasswordValue;
        }
        const data = await fetchJson("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        els.lockPassword.value = "";
        configSnapshot = getConfigFormState();
        updateSaveButtonsState();
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (btnNewCycle) {
      btnNewCycle.addEventListener("click", () => {
        openNewCycleModal();
      });
    }

    if (btnCancelCycle) {
      btnCancelCycle.addEventListener("click", async () => {
        const confirmed = await openConfirmModal({
          title: "Cancelar ciclo ativo",
          message: "Deseja cancelar o ciclo ativo agora? O ciclo será finalizado e um novo poderá ser iniciado.",
          confirmLabel: "Cancelar ciclo"
        });
        if (!confirmed) return;

        setLog("Cancelando ciclo ativo...");
        try {
          const data = await fetchJson("/api/cycle/cancel", { method: "POST" });
          setLog(data.message || "Ciclo cancelado.");
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    }

    if (btnRefreshCyclePending) {
      btnRefreshCyclePending.addEventListener("click", async () => {
        setLog("Atualizando ciclo atual (somente pendentes)...");
        try {
          const data = await fetchJson("/api/cycle/refresh-pending", { method: "POST" });
          setLog(data.message || "Pendentes do ciclo atual atualizados.");
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    }

    onById("btn-save-start-aluno", "click", async () => {
      setLog("Definindo aluno inicial...");
      try {
        const idx = Number(els.startAluno.value);
        if (!Number.isInteger(idx)) {
          throw new Error("Selecione um aluno válido.");
        }

        const data = await fetchJson("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idxAluno: idx })
        });
        setLog(data.message || "Aluno inicial atualizado.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-start-aula", "click", async () => {
      setLog("Definindo aula inicial...");
      try {
        const idx = Number(els.startAula.value);
        if (!Number.isInteger(idx)) {
          throw new Error("Selecione uma aula válida.");
        }
        const selectedAula = currentScheduleItems[idx];

        const payload = { idxAula: idx };
        const rawDataInicio = String(els.startDate.value || "").trim();
        if (rawDataInicio) {
          const parsedDataInicio = parseDateOnly(rawDataInicio);
          if (!parsedDataInicio) {
            markInvalidField(els.startDate, "Data de início inválida.");
            return;
          }
          let dateToSave = parsedDataInicio;
          if (selectedAula && Number(parsedDataInicio.getDay()) !== Number(selectedAula.dia)) {
            const aligned = alignDateToWeekday(parsedDataInicio, Number(selectedAula.dia));
            if (!aligned) {
              markInvalidField(els.startDate, "Não foi possível ajustar a data de início.");
              return;
            }
            dateToSave = aligned;
            setLog("Data ajustada automaticamente para o dia da aula inicial.");
          }
          const iso = toIsoDateOnly(dateToSave);
          payload.dataInicio = iso;
          els.startDate.value = iso;
          clearInvalidField(els.startDate);
          clearInvalidField(els.startAula);
        }

        const data = await fetchJson("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog(data.message || "Aula inicial atualizada.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-start-date", "click", async () => {
      setLog("Definindo data de início...");
      try {
        const rawDataInicio = String(els.startDate.value || "").trim();
        const parsedDataInicio = parseDateOnly(rawDataInicio);
        if (!parsedDataInicio) {
          markInvalidField(els.startDate, "Data de início inválida.");
          return;
        }
        const idx = Number(els.startAula.value);
        const selectedAula = Number.isInteger(idx) ? currentScheduleItems[idx] : null;
        let idxToSave = Number.isInteger(idx) ? idx : null;
        let dateToSave = parsedDataInicio;
        if (selectedAula && Number(parsedDataInicio.getDay()) !== Number(selectedAula.dia)) {
          const idxByDateWeekday = findFirstLessonIndexByWeekday(parsedDataInicio.getDay());
          if (idxByDateWeekday >= 0) {
            idxToSave = idxByDateWeekday;
            if (els.startAula) {
              els.startAula.value = String(idxByDateWeekday);
            }
            clearInvalidField(els.startAula);
            setLog("Aula inicial ajustada automaticamente para o mesmo dia da data escolhida.");
          } else {
            const aligned = alignDateToWeekday(parsedDataInicio, Number(selectedAula.dia));
            if (!aligned) {
              markInvalidField(els.startDate, "Não foi possível ajustar a data de início.");
              return;
            }
            dateToSave = aligned;
            setLog("Data ajustada automaticamente para o dia da aula inicial.");
          }
        }
        const dataInicio = toIsoDateOnly(dateToSave);
        els.startDate.value = dataInicio;
        clearInvalidField(els.startDate);
        clearInvalidField(els.startAula);

        const payload = { dataInicio };
        if (Number.isInteger(Number(idxToSave))) {
          payload.idxAula = Number(idxToSave);
        }
        const data = await fetchJson("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog(data.message || "Data de início atualizada.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (els.startAula) {
      els.startAula.addEventListener("change", () => {
        clearInvalidField(els.startAula);
        clearInvalidField(els.startDate);
        updateStartButtonsState();
      });
    }

    if (els.startDate) {
      els.startDate.addEventListener("change", () => {
        clearInvalidField(els.startDate);
        clearInvalidField(els.startAula);
        updateStartButtonsState();
      });
      els.startDate.addEventListener("input", () => {
        clearInvalidField(els.startDate);
        clearInvalidField(els.startAula);
        updateStartButtonsState();
      });
    }

    if (els.startAluno) {
      els.startAluno.addEventListener("change", updateStartButtonsState);
    }

    [els.to, els.groupName].filter(Boolean).forEach((field) => {
      field.addEventListener("input", updateSaveButtonsState);
      field.addEventListener("change", updateSaveButtonsState);
    });
    [els.groupSelect].filter(Boolean).forEach((field) => {
      field.addEventListener("change", updateSaveButtonsState);
    });

    [els.turma, els.instituicao, els.antecedenciaMin, els.diasUteisApenas, els.lockTimeoutMin].filter(Boolean).forEach((field) => {
      field.addEventListener("input", updateSaveButtonsState);
      field.addEventListener("change", updateSaveButtonsState);
    });
    if (els.lockPassword) {
      els.lockPassword.addEventListener("input", updateSaveButtonsState);
      els.lockPassword.addEventListener("change", updateSaveButtonsState);
    }

    if (els.groupSelect) els.groupSelect.addEventListener("change", async () => {
      if (els.groupSelect.value) {
        const selected = els.groupSelect.options[els.groupSelect.selectedIndex];
        setGroupIdValue(els.groupSelect.value);
        els.groupName.value = selected?.dataset?.name || "";
      } else {
        setGroupIdValue("");
        els.groupName.value = "";
      }

      try {
        await saveDestination("Grupo selecionado e destino salvo.");
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (els.to) els.to.addEventListener("blur", async () => {
      try {
        clearGroupDestinationFields();
        await saveDestination("Número individual salvo automaticamente.");
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (els.to) els.to.addEventListener("input", () => {
      clearGroupDestinationFields();
    });

    onById("m-btn-refresh", "click", () => {
      const btn = document.getElementById("btn-refresh");
      if (btn) btn.click();
    });
    onById("m-btn-test", "click", () => {
      const btn = document.getElementById("btn-test");
      if (btn) btn.click();
    });
    onById("m-btn-now", "click", () => {
      const btn = document.getElementById("btn-now");
      if (btn) btn.click();
    });
    onById("m-btn-now-forced", "click", () => {
      const btn = document.getElementById("btn-now-forced");
      if (btn) btn.click();
    });

    // Exibe feedback de carregamento imediatamente, mesmo em boots rápidos.
    renderLoadingChecklist(null, []);
    showAppLoading("Carregando aplicação", "Iniciando serviços do painel...");
    setTimeout(() => {
      if (!appReadyShown && loadingEl && !loadingEl.classList.contains("hidden")) {
        setLog("Inicialização demorou além do esperado. Liberando painel automaticamente.", true);
        forceHideAppLoading();
      }
    }, MAX_APP_LOADING_MS);

    bindCardAccessModals();

    Promise.all([refresh(), loadGroups()])
      .then(() => {
        // A liberação da tela inicial depende dos dados obrigatórios.
      })
      .catch((error) => {
        setLog(error.message || "Falha ao carregar dados iniciais.", true);
      });
    refreshStudentActionButtons();
    refreshLessonActionButtons();
    startAutoRefreshLoop();
  </script>
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
  const server = http.createServer(async (req, res) => {
    if (!requireDashboardAuth(req, res)) {
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (await handleApi(req, res, url.pathname)) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      sendHtml(res, pageHtml());
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });

  server.on("error", (error) => {
    console.error(`❌ Falha ao subir dashboard em http://${HOST}:${PORT}:`, error.message);
  });

  server.listen(PORT, HOST, () => {
    console.log(`🖥️ Dashboard disponível em http://${HOST}:${PORT}`);
  });

  return server;
}
