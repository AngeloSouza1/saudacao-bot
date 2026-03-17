import { proxyToBackend } from "@/lib/backend-proxy"

export async function POST() {
  return proxyToBackend("/api/send-agenda-list", "POST")
}

