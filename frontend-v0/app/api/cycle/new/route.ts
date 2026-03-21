import { proxyToBackend } from "@/lib/backend-proxy"

export async function POST(request: Request) {
  const body = await request.json()
  return proxyToBackend("/api/cycle/new", "POST", body)
}
