import { getPanelSession } from "@/lib/panel-auth"

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
  const session = await getPanelSession()
  if (!session.authenticated) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Sessão do painel expirada. Faça login novamente.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    )
  }

  const headers: Record<string, string> = { Accept: "application/json" }
  const auth = getBackendAuthHeader()
  if (auth) headers.Authorization = auth
  headers["X-Panel-User"] = String(session.username || "").trim()
  if (typeof body !== "undefined") {
    headers["Content-Type"] = "application/json; charset=utf-8"
  }

  let response: Response
  try {
    response = await fetch(`${getBackendBaseUrl()}${pathname}`, {
      method,
      cache: "no-store",
      headers,
      body: typeof body !== "undefined" ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    const message = String((error as Error)?.message || "").toLowerCase()
    const isOfflineError =
      message.includes("fetch failed") ||
      message.includes("econnrefused") ||
      message.includes("connect")

    return new Response(
      JSON.stringify({
        ok: false,
        error: isOfflineError
          ? "O backend do painel está offline no momento. Inicie o serviço em 127.0.0.1:3001 e tente novamente."
          : "Não foi possível comunicar com o backend do painel.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    )
  }

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
