import { proxyToBackend } from "@/lib/backend-proxy"
import { requireWriteAccess } from "@/lib/panel-access"

export async function POST(request: Request) {
  const denial = await requireWriteAccess()
  if (denial) return denial
  const body = await request.json().catch(() => ({}))
  return proxyToBackend("/api/scheduled-messages/delete", "POST", body)
}
