import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const PANEL_AUTH_COOKIE = "saudacao_panel_session"

function getPanelUser() {
  return String(process.env.PANEL_LOGIN_USER || "admin").trim()
}

function getPanelPassword() {
  return String(process.env.PANEL_LOGIN_PASSWORD || "admin").trim()
}

function getSessionSecret() {
  return String(process.env.PANEL_SESSION_SECRET || "saudacao-bot-panel-secret").trim()
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex")
}

export function validatePanelCredentials(username: string, password: string) {
  return username === getPanelUser() && password === getPanelPassword()
}

export function buildPanelSessionValue(username: string) {
  const normalizedUser = String(username || "").trim()
  const signature = signValue(normalizedUser)
  return `${normalizedUser}.${signature}`
}

export function isPanelSessionValid(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return false

  const separatorIndex = raw.lastIndexOf(".")
  if (separatorIndex <= 0) return false

  const username = raw.slice(0, separatorIndex)
  const signature = raw.slice(separatorIndex + 1)
  if (!username || !signature) return false
  if (username !== getPanelUser()) return false

  const expected = Buffer.from(signValue(username))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}

export async function getPanelSession() {
  const store = await cookies()
  const value = String(store.get(PANEL_AUTH_COOKIE)?.value || "")
  return {
    authenticated: isPanelSessionValid(value),
    username: getPanelUser(),
  }
}
