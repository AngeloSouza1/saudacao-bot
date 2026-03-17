import { proxyToBackend } from "@/lib/backend-proxy"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  return proxyToBackend("/api/swap-pending", "POST", body)
}

