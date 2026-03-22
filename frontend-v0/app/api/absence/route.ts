import { proxyToBackend } from "@/lib/backend-proxy"
import { requireWriteAccess } from "@/lib/panel-access"

export async function POST(req: Request) {
  const denial = await requireWriteAccess()
  if (denial) return denial
  const body = await req.json().catch(() => ({}))
  return proxyToBackend("/api/absence", "POST", body)
}
