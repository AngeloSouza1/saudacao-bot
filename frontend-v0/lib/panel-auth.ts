import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const PANEL_AUTH_COOKIE = "saudacao_panel_session"
const PANEL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

function getPanelUser() {
  return String(process.env.PANEL_LOGIN_USER || "admin").trim()
}

function getPanelPassword() {
  return String(process.env.PANEL_LOGIN_PASSWORD || "admin").trim()
}

function getPanelPasswordSha256() {
  return String(process.env.PANEL_LOGIN_PASSWORD_SHA256 || "").trim().toLowerCase()
}

function getSessionSecret() {
  return String(process.env.PANEL_SESSION_SECRET || "saudacao-bot-panel-secret").trim()
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex")
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function validatePanelCredentials(username: string, password: string) {
  const normalizedUser = String(username || "").trim()
  const normalizedPassword = String(password || "")
  if (!safeEquals(normalizedUser, getPanelUser())) return false

  const configuredPasswordHash = getPanelPasswordSha256()
  if (configuredPasswordHash) {
    return safeEquals(sha256(normalizedPassword), configuredPasswordHash)
  }

  return safeEquals(normalizedPassword, getPanelPassword())
}

export function buildPanelSessionValue(username: string) {
  const normalizedUser = String(username || "").trim()
  const payload = Buffer.from(
    JSON.stringify({
      u: normalizedUser,
      exp: Date.now() + PANEL_SESSION_MAX_AGE_SECONDS * 1000,
    })
  ).toString("base64url")
  const signature = signValue(payload)
  return `${payload}.${signature}`
}

export function isPanelSessionValid(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return false

  const separatorIndex = raw.lastIndexOf(".")
  if (separatorIndex <= 0) return false

  const payload = raw.slice(0, separatorIndex)
  const signature = raw.slice(separatorIndex + 1)
  if (!payload || !signature) return false

  const expected = Buffer.from(signValue(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false
  if (!timingSafeEqual(expected, received)) return false

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: string
      exp?: number
    }
    if (!session?.u || !session?.exp) return false
    if (!safeEquals(session.u, getPanelUser())) return false
    if (session.exp < Date.now()) return false
    return true
  } catch {
    return false
  }
}

export function getPanelCookieOptions(maxAge = PANEL_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

export async function getPanelSession() {
  const store = await cookies()
  const value = String(store.get(PANEL_AUTH_COOKIE)?.value || "")
  return {
    authenticated: isPanelSessionValid(value),
    username: getPanelUser(),
  }
}
