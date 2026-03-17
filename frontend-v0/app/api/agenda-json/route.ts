import { proxyToBackend } from "@/lib/backend-proxy"

export async function GET() {
  return proxyToBackend("/api/agenda-json", "GET")
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  return proxyToBackend("/api/agenda-json", "POST", body)
}

