import { NextResponse } from "next/server"
import { getPanelCookieOptions, PANEL_AUTH_COOKIE } from "@/lib/panel-auth"

export async function POST() {
  const response = NextResponse.json(
    { ok: true, authenticated: false },
    { headers: { "Cache-Control": "no-store" } }
  )

  response.cookies.set({
    name: PANEL_AUTH_COOKIE,
    value: "",
    ...getPanelCookieOptions(0),
  })

  return response
}
