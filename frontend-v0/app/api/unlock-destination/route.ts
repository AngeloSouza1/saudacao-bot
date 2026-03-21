import { proxyToBackend } from "@/lib/backend-proxy"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend("/api/unlock-destination", "POST", body)
}
