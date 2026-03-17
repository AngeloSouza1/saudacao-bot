const DEFAULT_BACKEND_URL = "http://127.0.0.1:3001"

function getBackendBaseUrl() {
  return String(process.env.BACKEND_API_BASE_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, "")
}

function getBackendAuthHeader() {
  const user = String(process.env.BACKEND_API_USER || "").trim()
  const password = String(process.env.BACKEND_API_PASSWORD || "").trim()
  if (!user || !password) return ""
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
}

export async function proxyToBackend(
  pathname: string,
  method: "GET" | "POST",
  body?: unknown
) {
  const headers: Record<string, string> = { Accept: "application/json" }
  const auth = getBackendAuthHeader()
  if (auth) headers.Authorization = auth
  if (typeof body !== "undefined") {
    headers["Content-Type"] = "application/json; charset=utf-8"
  }

  const response = await fetch(`${getBackendBaseUrl()}${pathname}`, {
    method,
    cache: "no-store",
    headers,
    body: typeof body !== "undefined" ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let payload: unknown
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = {
      ok: false,
      error: `Resposta inválida do backend (${response.status}).`,
      raw: text,
    }
  }

  return new Response(JSON.stringify(payload), {
    status: response.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
