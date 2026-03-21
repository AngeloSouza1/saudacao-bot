import { proxyToBackend } from "@/lib/backend-proxy"

export async function GET() {
  const response = await proxyToBackend("/api/status", "GET")

  if (response.status !== 503) {
    return response
  }

  return new Response(
    JSON.stringify({
      ok: false,
      schedulerStarted: false,
      scheduleSummary: [],
      schedulePreview: [],
      cycle: {
        active: null,
        history: [],
      },
      config: {
        alunos: [],
        alunoDetalhes: [],
      },
      whatsapp: {
        phase: "offline",
        sender: "",
        qrAvailable: false,
        qrImageDataUrl: "",
        qrText: "",
        lastError: "Backend offline",
        loggedStudentMatch: null,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  )
}
