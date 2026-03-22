import { NextResponse } from "next/server"
import {
  buildPanelSessionValue,
  getPanelCookieOptions,
  PANEL_AUTH_COOKIE,
  validatePanelCredentials,
} from "@/lib/panel-auth"

const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown"
  return request.headers.get("x-real-ip") || "unknown"
}

function getLimiterState(ip: string) {
  const now = Date.now()
  const current = loginAttempts.get(ip)
  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + LOGIN_WINDOW_MS }
    loginAttempts.set(ip, fresh)
    return fresh
  }
  return current
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request)
  const limiterState = getLimiterState(clientIp)
  if (limiterState.count >= MAX_LOGIN_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.max(1, Math.ceil((limiterState.resetAt - Date.now()) / 1000))),
        },
      }
    )
  }

  const body = await request.json().catch(() => ({}))
  const username = String(body?.username || "").trim()
  const password = String(body?.password || "")

  const authenticatedUser = await validatePanelCredentials(username, password)
  if (!authenticatedUser) {
    limiterState.count += 1
    return NextResponse.json(
      { ok: false, error: "Usuário ou senha inválidos." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  const response = NextResponse.json(
    { ok: true, authenticated: true },
    { headers: { "Cache-Control": "no-store" } }
  )

  loginAttempts.delete(clientIp)
  response.cookies.set({
    name: PANEL_AUTH_COOKIE,
    value: buildPanelSessionValue(authenticatedUser.username, authenticatedUser.role),
    ...getPanelCookieOptions(),
  })

  return response
}
