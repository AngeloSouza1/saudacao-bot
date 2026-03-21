import { NextResponse } from "next/server"
import { buildPanelSessionValue, PANEL_AUTH_COOKIE, validatePanelCredentials } from "@/lib/panel-auth"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const username = String(body?.username || "").trim()
  const password = String(body?.password || "")

  if (!validatePanelCredentials(username, password)) {
    return NextResponse.json(
      { ok: false, error: "Usuário ou senha inválidos." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  const response = NextResponse.json(
    { ok: true, authenticated: true },
    { headers: { "Cache-Control": "no-store" } }
  )

  response.cookies.set({
    name: PANEL_AUTH_COOKIE,
    value: buildPanelSessionValue(username),
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 12,
  })

  return response
}
