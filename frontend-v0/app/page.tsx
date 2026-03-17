"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AppHeader } from "@/components/saudacao/AppHeader"
import { AppSidebar } from "@/components/saudacao/AppSidebar"
import { SessionStatusCard, type SystemStatus } from "@/components/saudacao/SessionStatusCard"
import { UpcomingGreetingsCard, type GreetingItem } from "@/components/saudacao/UpcomingGreetingsCard"
import { DestinationModal } from "@/components/saudacao/DestinationModal"
import { ConfigModal } from "@/components/saudacao/ConfigModal"
import { ScheduleModal } from "@/components/saudacao/ScheduleModal"

type DashboardStatusResponse = {
  settings?: {
    to?: string
    groupId?: string
    groupName?: string
  }
  config?: {
    turma?: string
    instituicao?: string
    antecedenciaMin?: number
    diasUteisApenas?: boolean
    lockTimeoutMin?: number
    lockConfigured?: boolean
    alunos?: string[]
  }
  scheduleSummary?: Array<{ dia?: string | number; horario?: string; materia?: string }>
  schedulerStarted?: boolean
  schedulePreview?: Array<{
    dia?: string | number
    horario?: string
    titulo?: string
    materia?: string
    professor?: string
    alunoPrevisto?: string
    scheduledDateISO?: string
    manualEfetivado?: boolean
  }>
  state?: {
    idxAluno?: number
    idxAula?: number
    dataInicio?: string
    revertidosEfetivados?: string[]
  }
  cycle?: {
    active?: {
      id?: string
      name?: string
      sentCount?: number
      totalAlunos?: number
    } | null
  }
  whatsapp?: {
    phase?: string
    sender?: string
    qrAvailable?: boolean
    lastError?: string
    userName?: string
    userAvatar?: string
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(String(data?.error || "Falha na requisição."))
  }
  return data as T
}

function getUserInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return "SB"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase()
}

function phaseToStatus(phase: string): SystemStatus {
  if (phase === "ready" || phase === "authenticated") return "ok"
  if (phase === "disconnected" || phase === "auth_failure" || phase === "error") return "error"
  if (phase === "qr" || phase === "initializing") return "warn"
  return "idle"
}

function formatDatePtBr(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "--/--/----"
  return d.toLocaleDateString("pt-BR")
}

function dayName(dia: string | number | undefined) {
  const labels: Record<string, string> = {
    "0": "Domingo",
    "1": "Segunda-feira",
    "2": "Terça-feira",
    "3": "Quarta-feira",
    "4": "Quinta-feira",
    "5": "Sexta-feira",
    "6": "Sábado",
  }
  return labels[String(dia ?? "")] || "Dia"
}

function mapGreetingItems(data: DashboardStatusResponse | null): GreetingItem[] {
  const preview = Array.isArray(data?.schedulePreview) ? data!.schedulePreview : []
  const reverted = new Set(
    Array.isArray(data?.state?.revertidosEfetivados) ? data!.state!.revertidosEfetivados!.map(String) : []
  )

  const pending = preview.filter((item) => {
    if (item?.manualEfetivado) return false
    const key = [
      String(data?.cycle?.active?.id || "no-cycle"),
      String(item?.scheduledDateISO || ""),
      String(item?.materia || ""),
      String(item?.professor || ""),
      String(item?.horario || ""),
    ].join("|")
    return !reverted.has(key)
  })

  return pending.slice(0, 12).map((item, index) => {
    const date = String(item?.scheduledDateISO || "")
    const title = String(item?.titulo || "").trim()
    const materia = String(item?.materia || "").trim()
    const professor = String(item?.professor || "").trim()
    const classInfo = [title ? `Título: ${title}` : "", materia, professor].filter(Boolean).join(" | ")
    const studentName = String(item?.alunoPrevisto || "").trim() || "Aluno não definido"

    return {
      id: `${date}-${item?.horario || "--:--"}-${index}`,
      studentName,
      date: formatDatePtBr(date),
      time: String(item?.horario || "--:--"),
      classInfo: classInfo || "Sem dados da aula",
      nextStudent: index < pending.length - 1 ? String(pending[index + 1]?.alunoPrevisto || "—") : "—",
      isNext: index === 0,
    }
  })
}

export default function DashboardPage() {
  const [activeItem, setActiveItem] = useState("session")
  const [destinationOpen, setDestinationOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [statusData, setStatusData] = useState<DashboardStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string>("")

  const refreshStatus = useCallback(async () => {
    try {
      const data = await fetchJson<DashboardStatusResponse>("/api/status")
      setStatusData(data)
      setStatusError("")
    } catch (error) {
      setStatusError(String((error as Error)?.message || "Falha ao atualizar status."))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      if (cancelled) return
      await refreshStatus()
      timer = setTimeout(run, 3000)
    }

    run()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [refreshStatus])

  const runAction = useCallback(
    async (path: "/api/send-test" | "/api/send-now" | "/api/send-now-forced", fallbackMessage: string) => {
      const payload = await fetchJson<{ message?: string }>(path, { method: "POST" })
      await refreshStatus()
      return String(payload?.message || fallbackMessage)
    },
    [refreshStatus]
  )

  const statusRows = useMemo<{ label: string; value: string; status: SystemStatus }[]>(() => {
    if (!statusData) {
      return [
        { label: "Sessão", value: "carregando...", status: "idle" as SystemStatus },
        { label: "Agendador", value: "carregando...", status: "idle" as SystemStatus },
        { label: "QR pendente", value: "carregando...", status: "idle" as SystemStatus },
      ]
    }

    const phase = String(statusData?.whatsapp?.phase || "")
    const cycle = statusData?.cycle?.active
    const sent = Number(cycle?.sentCount || 0)
    const total = Number(cycle?.totalAlunos || 0)

    return [
      {
        label: "Sessão",
        value: String(statusData?.whatsapp?.sender || "ainda não autenticada"),
        status: phaseToStatus(phase),
      },
      {
        label: "Agendador",
        value: statusData?.schedulerStarted ? "ativo" : "parado",
        status: statusData?.schedulerStarted ? "ok" : "warn",
      },
      {
        label: "QR pendente",
        value: statusData?.whatsapp?.qrAvailable ? "sim" : "não",
        status: statusData?.whatsapp?.qrAvailable ? "warn" : "ok",
      },
      {
        label: "Ciclo",
        value: cycle ? `${sent}/${total}` : "sem ciclo ativo",
        status: cycle ? "ok" : "idle",
      },
      statusData?.whatsapp?.lastError
        ? {
            label: "Último erro",
            value: String(statusData.whatsapp.lastError),
            status: "error" as SystemStatus,
          }
        : {
            label: "Último erro",
            value: "nenhum",
            status: "ok" as SystemStatus,
          },
    ]
  }, [statusData])

  const greetingItems = useMemo(() => mapGreetingItems(statusData), [statusData])

  const cycleName = String(statusData?.cycle?.active?.name || "").trim()
  const cycleLabel = cycleName ? `Ciclo atual: ${cycleName}` : "Sem ciclo ativo"
  const userName =
    String(statusData?.whatsapp?.userName || "").trim() ||
    (statusData?.whatsapp?.sender ? `+${statusData.whatsapp.sender}` : "Sem sessão")
  const userInitials = getUserInitials(userName)
  const userAvatar = String(statusData?.whatsapp?.userAvatar || "").trim() || undefined
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const whatsappPhase = String(statusData?.whatsapp?.phase || "")
  const isSystemReady = whatsappPhase === "ready" || whatsappPhase === "authenticated" || Boolean(statusData?.whatsapp?.sender)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <AppHeader
        cycleLabel={cycleLabel}
        userName={userName}
        userInitials={userInitials}
        userAvatar={userAvatar}
      />

      <div className="flex flex-1 min-h-0">
        <AppSidebar
          onOpenDestination={() => setDestinationOpen(true)}
          onOpenConfig={() => setConfigOpen(true)}
          onOpenSchedule={() => setScheduleOpen(true)}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight text-balance">Painel Operacional</h1>
                <p className="text-muted-foreground mt-1 text-sm">Ciclo ativo · {todayLabel}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`w-2 h-2 rounded-full inline-block ${isSystemReady ? "bg-status-ok animate-pulse" : "bg-status-warn"}`}
                />
                {isSystemReady ? "Sistema operacional" : "Aguardando WhatsApp"}
              </div>
            </div>

            {statusError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {statusError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="lg:h-[520px]">
                <SessionStatusCard
                  statusRows={statusRows}
                  disableManualSend={!statusData?.cycle?.active}
                  onSendTest={() => runAction("/api/send-test", "Teste enviado.")}
                  onSendNow={() => runAction("/api/send-now", "Envio imediato executado.")}
                  onSendForced={() => runAction("/api/send-now-forced", "Envio forçado executado.")}
                />
              </div>

              <div className="lg:h-[520px]">
                <UpcomingGreetingsCard items={greetingItems} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuickCard
                title="Destino"
                description="Configurar destinatários das saudações"
                color="bg-green-soft"
                textColor="text-green-deep"
                onClick={() => setDestinationOpen(true)}
              />
              <QuickCard
                title="Configurações"
                description="Parâmetros de operação do bot"
                color="bg-gold-light"
                textColor="text-accent-foreground"
                onClick={() => setConfigOpen(true)}
              />
              <QuickCard
                title="Agenda"
                description="Alunos e horários de aulas"
                color="bg-secondary"
                textColor="text-secondary-foreground"
                onClick={() => setScheduleOpen(true)}
              />
            </div>
          </div>
        </main>
      </div>

      <DestinationModal
        open={destinationOpen}
        onClose={() => setDestinationOpen(false)}
        initialValues={statusData?.settings}
        onSaved={refreshStatus}
      />
      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        initialConfig={statusData?.config}
        initialState={statusData?.state}
        students={Array.isArray(statusData?.config?.alunos) ? statusData?.config?.alunos : []}
        scheduleSummary={Array.isArray(statusData?.scheduleSummary) ? statusData?.scheduleSummary : []}
        onSaved={refreshStatus}
      />
      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSaved={refreshStatus} />
    </div>
  )
}

function QuickCard({
  title,
  description,
  color,
  textColor,
  onClick,
}: {
  title: string
  description: string
  color: string
  textColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-2xl border border-border ${color} hover:brightness-95 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-ring outline-none`}
    >
      <p className={`text-base font-semibold ${textColor} mb-1`}>{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </button>
  )
}
