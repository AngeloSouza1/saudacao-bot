import { NextResponse } from "next/server"
import { getPanelSession } from "@/lib/panel-auth"

export async function requireWriteAccess() {
  const session = await getPanelSession()
  if (!session.authenticated) {
    return NextResponse.json(
      { ok: false, error: "Sessão inválida." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  if (session.role === "viewer") {
    return NextResponse.json(
      { ok: false, error: "Este perfil é somente leitura e não pode alterar dados." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }

  return null
}
