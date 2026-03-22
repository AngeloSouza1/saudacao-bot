import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { findStoredPanelUser, type PanelUserRole, validateStoredPanelCredentials } from "@/lib/panel-users"

export const PANEL_AUTH_COOKIE = "saudacao_panel_session"
const PANEL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

function getSessionSecret() {
  return String(process.env.PANEL_SESSION_SECRET || "saudacao-bot-panel-secret").trim()
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex")
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export async function validatePanelCredentials(username: string, password: string) {
  return await validateStoredPanelCredentials(username, password)
}

export function buildPanelSessionValue(username: string, role: PanelUserRole) {
  const normalizedUser = String(username || "").trim()
  const payload = Buffer.from(
    JSON.stringify({
      u: normalizedUser,
      r: role,
      exp: Date.now() + PANEL_SESSION_MAX_AGE_SECONDS * 1000,
    })
  ).toString("base64url")
  const signature = signValue(payload)
  return `${payload}.${signature}`
}

export async function readPanelSessionValue(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return null

  const separatorIndex = raw.lastIndexOf(".")
  if (separatorIndex <= 0) return null

  const payload = raw.slice(0, separatorIndex)
  const signature = raw.slice(separatorIndex + 1)
  if (!payload || !signature) return null

  const expected = Buffer.from(signValue(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return null
  if (!timingSafeEqual(expected, received)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: string
      r?: PanelUserRole
      exp?: number
    }
    if (!session?.u || !session?.exp) return null
    if (session.exp < Date.now()) return null
    const user = await findStoredPanelUser(session.u)
    if (!user) return null
    return {
      authenticated: true as const,
      username: user.username,
      role: user.role,
      isAdmin: user.role === "admin",
      isViewer: user.role === "viewer",
      imageUrl: user.imageUrl,
    }
  } catch {
    return null
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
  const session = await readPanelSessionValue(value)
  if (session) return session
  return {
    authenticated: false as const,
    username: "",
    role: null,
    isAdmin: false,
    isViewer: false,
    imageUrl: "",
  }
}
