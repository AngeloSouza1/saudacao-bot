import { NextResponse } from "next/server"
import { getPanelSession } from "@/lib/panel-auth"
import { deletePanelUser, updatePanelUser } from "@/lib/panel-users"

type RouteContext = {
  params: Promise<{
    username: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getPanelSession()
  if (!session.authenticated || !session.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Acesso restrito ao administrador." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }

  const body = await request.json().catch(() => ({}))
  const params = await context.params
  const targetUsername = String(params?.username || "")

  if (targetUsername === session.username) {
    const nextUsername = typeof body?.username === "string" ? body.username.trim().toLowerCase() : targetUsername
    const nextRole =
      body?.role === "admin" ? "admin" : body?.role === "viewer" ? "viewer" : body?.role === "user" ? "user" : session.role
    if (nextUsername !== session.username || nextRole !== session.role) {
      return NextResponse.json(
        { ok: false, error: "A sessão atual só permite alterar a própria senha." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
  }

  try {
    const user = await updatePanelUser(targetUsername, {
      nextUsername: typeof body?.username === "string" ? body.username : undefined,
      nextPassword: typeof body?.password === "string" ? body.password : undefined,
      nextRole: body?.role === "admin" ? "admin" : body?.role === "viewer" ? "viewer" : body?.role === "user" ? "user" : undefined,
      nextImageUrl: typeof body?.imageUrl === "string" ? body.imageUrl : undefined,
    })
    return NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message || "Falha ao atualizar usuário.") },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getPanelSession()
  if (!session.authenticated || !session.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Acesso restrito ao administrador." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }

  const params = await context.params
  const targetUsername = String(params?.username || "")

  if (targetUsername === session.username) {
    return NextResponse.json(
      { ok: false, error: "Não é possível excluir o usuário da sessão atual." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }

  try {
    const user = await deletePanelUser(targetUsername)
    return NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message || "Falha ao excluir usuário.") },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}
