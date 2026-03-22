import { NextResponse } from "next/server"
import { getPanelSession } from "@/lib/panel-auth"
import { createPanelUser, listPanelUsers } from "@/lib/panel-users"

export async function GET() {
  const session = await getPanelSession()
  if (!session.authenticated || !session.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Acesso restrito ao administrador." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }

  const users = await listPanelUsers()
  return NextResponse.json({ ok: true, users }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const session = await getPanelSession()
  if (!session.authenticated || !session.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Acesso restrito ao administrador." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }

  const body = await request.json().catch(() => ({}))

  try {
    const user = await createPanelUser({
      username: String(body?.username || ""),
      password: String(body?.password || ""),
      role: body?.role === "admin" ? "admin" : body?.role === "viewer" ? "viewer" : "user",
      imageUrl: String(body?.imageUrl || ""),
    })
    return NextResponse.json(
      { ok: true, user },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message || "Falha ao criar usuário.") },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}
