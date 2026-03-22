import { NextResponse } from "next/server"
import { findPanelUser } from "@/lib/panel-users"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const username = String(url.searchParams.get("username") || "").trim()
  if (!username) {
    return NextResponse.json(
      { ok: true, user: null },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const user = await findPanelUser(username)
  return NextResponse.json(
    {
      ok: true,
      user: user ? { username: user.username, imageUrl: user.imageUrl || "" } : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
