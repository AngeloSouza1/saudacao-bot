import { proxyToBackend } from "@/lib/backend-proxy"
import { requireWriteAccess } from "@/lib/panel-access"

export async function POST() {
  const denial = await requireWriteAccess()
  if (denial) return denial
  return proxyToBackend("/api/send-test", "POST")
}
