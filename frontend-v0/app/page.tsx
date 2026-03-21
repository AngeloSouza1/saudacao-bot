"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AppHeader } from "@/components/saudacao/AppHeader"
import { AppSidebar } from "@/components/saudacao/AppSidebar"
import { SessionStatusCard, type SystemStatus } from "@/components/saudacao/SessionStatusCard"
import { UpcomingGreetingsCard, type GreetingItem } from "@/components/saudacao/UpcomingGreetingsCard"
import { DestinationModal } from "@/components/saudacao/DestinationModal"
import { ConfigModal } from "@/components/saudacao/ConfigModal"
import { ScheduleModal } from "@/components/saudacao/ScheduleModal"
import { AllSchedulesModal } from "@/components/saudacao/AllSchedulesModal"
import { MessagesModal } from "@/components/saudacao/MessagesModal"
import { HistoryModal } from "@/components/saudacao/HistoryModal"
import { hasRequiredConfig } from "@/lib/validation"
import { Calendar, GraduationCap, MessageCirclePlus } from "lucide-react"

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
    defaultGreetingMessage?: string
    defaultNoClassMessage?: string
    customMessageTemplate?: string
    imagePath?: string
    mediaFileName?: string
    lockTimeoutMin?: number
    lockConfigured?: boolean
    alunos?: string[]
    alunoDetalhes?: Array<{ nome?: string; whatsapp?: string; imagem?: string }>
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
    history?: Array<{
      id?: string
      name?: string
      status?: string
      canceled?: boolean
      sentCount?: number
      totalAlunos?: number
      createdAt?: string
      completedAt?: string | null
    }>
  }
  whatsapp?: {
    phase?: string
    sender?: string
    qrAvailable?: boolean
    qrImageDataUrl?: string
    qrText?: string
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

function mapGreetingItems(data: DashboardStatusResponse | null, limit = 12): GreetingItem[] {
  const preview = Array.isArray(data?.schedulePreview) ? data!.schedulePreview : []
  const details = Array.isArray(data?.config?.alunoDetalhes) ? data!.config!.alunoDetalhes! : []
  const imageByStudent = new Map(
    details
      .map((item) => [String(item?.nome || "").trim().toLocaleLowerCase("pt-BR"), String(item?.imagem || "").trim()] as const)
      .filter(([name, image]) => Boolean(name) && Boolean(image))
  )
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

  return pending.slice(0, limit).map((item, index) => {
    const date = String(item?.scheduledDateISO || "")
    const title = String(item?.titulo || "").trim()
    const materia = String(item?.materia || "").trim()
    const professor = String(item?.professor || "").trim()
    const classInfo = [title ? `Título: ${title}` : "", materia, professor].filter(Boolean).join(" | ")
    const studentName = String(item?.alunoPrevisto || "").trim() || "Aluno não definido"
    const studentImage = imageByStudent.get(studentName.toLocaleLowerCase("pt-BR")) || undefined

    return {
      id: `${date}-${item?.horario || "--:--"}-${index}`,
      studentName,
      studentImage,
      date: formatDatePtBr(date),
      time: String(item?.horario || "--:--"),
      classInfo: classInfo || "Sem dados da aula",
      nextStudent: index < pending.length - 1 ? String(pending[index + 1]?.alunoPrevisto || "—") : "—",
      isNext: index === 0,
      pendingIndex: index,
    }
  })
}

export default function DashboardPage() {
  const [isMounted, setIsMounted] = useState(false)
  const [activeItem, setActiveItem] = useState("")
  const [destinationOpen, setDestinationOpen] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [messagesInitialEditorType, setMessagesInitialEditorType] = useState<"default" | "no-class" | "custom">("default")
  const [configOpen, setConfigOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleInitialSection, setScheduleInitialSection] = useState<"students" | "lessons" | null>(null)
  const [allSchedulesOpen, setAllSchedulesOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(true)
  const [todayLabel, setTodayLabel] = useState("")
  const [statusData, setStatusData] = useState<DashboardStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string>("")

  useEffect(() => {
    setIsMounted(true)
  }, [])

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
    setTodayLabel(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    )
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

  const greetingItems = useMemo(() => mapGreetingItems(statusData, 12), [statusData])
  const allGreetingItems = useMemo(() => mapGreetingItems(statusData, 500), [statusData])

  const cycleName = String(statusData?.cycle?.active?.name || "").trim()
  const cycleLabel = cycleName ? `Ciclo atual: ${cycleName}` : "Sem ciclo ativo"
  const userName =
    String(statusData?.whatsapp?.userName || "").trim() ||
    (statusData?.whatsapp?.sender ? `+${statusData.whatsapp.sender}` : "Sem sessão")
  const userInitials = getUserInitials(userName)
  const userAvatar = String(statusData?.whatsapp?.userAvatar || "").trim() || undefined
  const whatsappPhase = String(statusData?.whatsapp?.phase || "")
  const isSystemReady = whatsappPhase === "ready" || whatsappPhase === "authenticated" || Boolean(statusData?.whatsapp?.sender)
  const hasConfigPending = !hasRequiredConfig({
    turma: statusData?.config?.turma,
    instituicao: statusData?.config?.instituicao,
    groupName: statusData?.settings?.groupName,
    to: statusData?.settings?.to,
    scheduleCount: Array.isArray(statusData?.scheduleSummary) ? statusData?.scheduleSummary.length : 0,
  })
  const disableManualSend = !statusData?.cycle?.active || !isSystemReady || hasConfigPending
  const showSessionCard = activeItem === "session"
  const showShortcutsCard = shortcutsOpen

  if (!isMounted) {
    return <div className="h-screen bg-background" suppressHydrationWarning />
  }

  if (!isSystemReady) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <AppHeader
          cycleLabel={cycleLabel}
          userName={userName}
          userInitials={userInitials}
          userAvatar={userAvatar}
        />

        <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Autenticação do WhatsApp</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Conecte a sessão para liberar o painel operacional e os envios automáticos da aplicação.
              </p>
            </div>

            {statusError ? (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {statusError}
              </div>
            ) : null}

            <div className="grid items-stretch gap-6 lg:grid-cols-[0.95fr_1.25fr]">
              <section className="rounded-3xl border border-border bg-card/90 p-8 shadow-sm">
                <span className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Saudação Bot
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">
                  Mensagens automáticas com controle operacional simples
                </h2>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Esta aplicação organiza os alunos, a agenda semanal e a fila de saudações para enviar mensagens
                  no momento certo pelo WhatsApp.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">1. Escaneie o QR Code</p>
                    <p className="mt-1 text-sm text-muted-foreground">Abra o WhatsApp no celular e conecte esta sessão.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">2. Libere o painel</p>
                    <p className="mt-1 text-sm text-muted-foreground">Após a autenticação, o painel e os atalhos serão desbloqueados automaticamente.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">3. Continue de onde parou</p>
                    <p className="mt-1 text-sm text-muted-foreground">Sua sessão fica pronta para operar envios, ciclos e agenda do bot.</p>
                  </div>
                </div>
              </section>

              <div className="mx-auto h-[680px] w-full max-w-2xl">
                <SessionStatusCard
                  title="Login necessário"
                  subtitle="Escaneie o QR Code para liberar o uso da aplicação"
                  statusRows={statusRows}
                  qrAvailable={Boolean(statusData?.whatsapp?.qrAvailable)}
                  qrImageDataUrl={String(statusData?.whatsapp?.qrImageDataUrl || "")}
                  qrText={String(statusData?.whatsapp?.qrText || "")}
                  showStatusRows={false}
                  showActions={false}
                  showOverallBadge={false}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

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
          onOpenMessages={() => setMessagesOpen(true)}
          onOpenConfig={() => setConfigOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSchedule={() => {
            setScheduleInitialSection(null)
            setScheduleOpen(true)
          }}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
          shortcutsOpen={shortcutsOpen}
          onToggleShortcuts={() => setShortcutsOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight text-balance">Painel Operacional</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ciclo ativo{todayLabel ? ` · ${todayLabel}` : ""}
                </p>
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
            {hasConfigPending ? (
              <div className="rounded-xl border border-status-warn/40 bg-yellow-50 px-4 py-3 text-sm text-amber-700">
                Pendências obrigatórias: revise Destino, Configuração e Agenda (mínimo 1 aula) antes do envio.
              </div>
            ) : null}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {showSessionCard ? (
                <div className="lg:h-[560px]">
                  <SessionStatusCard
                    statusRows={statusRows}
                    qrAvailable={Boolean(statusData?.whatsapp?.qrAvailable)}
                    qrImageDataUrl={String(statusData?.whatsapp?.qrImageDataUrl || "")}
                    qrText={String(statusData?.whatsapp?.qrText || "")}
                    disableManualSend={disableManualSend}
                    onSendTest={() => runAction("/api/send-test", "Teste enviado.")}
                    onSendNow={() => runAction("/api/send-now", "Envio imediato executado.")}
                    onSendForced={() => runAction("/api/send-now-forced", "Envio forçado executado.")}
                    onClose={() => setActiveItem("")}
                  />
                </div>
              ) : null}

              <div className={`lg:h-[560px] ${showSessionCard ? "" : "lg:col-span-2"}`}>
                <UpcomingGreetingsCard items={greetingItems} onOpenAll={() => setAllSchedulesOpen(true)} />
              </div>
            </div>

          </div>
        </main>
      </div>

      {showShortcutsCard ? (
        <aside className="fixed right-3 top-[86px] bottom-4 z-40 w-[90px] rounded-2xl bg-transparent px-2 py-3 flex flex-col">
          <div className="mt-1 flex flex-col gap-2">
            <button
              onClick={() => {
                setMessagesInitialEditorType("custom")
                setMessagesOpen(true)
              }}
              className="group w-full rounded-xl bg-transparent px-3 py-2.5 text-left transition hover:bg-muted/40"
              title="Mensagem personalizada"
              aria-label="Mensagem personalizada"
            >
              <span className="inline-flex w-full items-center justify-center">
                <MessageCirclePlus size={18} className="text-primary" />
              </span>
            </button>
            <button
              onClick={() => {
                setScheduleInitialSection("students")
                setScheduleOpen(true)
              }}
              className="group w-full rounded-xl bg-transparent px-3 py-2.5 text-left transition hover:bg-muted/40"
              title="Aluno"
              aria-label="Aluno"
            >
              <span className="inline-flex w-full items-center justify-center">
                <GraduationCap size={18} className="text-primary" />
              </span>
            </button>
            <button
              onClick={() => {
                setScheduleInitialSection("lessons")
                setScheduleOpen(true)
              }}
              className="group w-full rounded-xl bg-transparent px-3 py-2.5 text-left transition hover:bg-muted/40"
              title="Aula"
              aria-label="Aula"
            >
              <span className="inline-flex w-full items-center justify-center">
                <Calendar size={18} className="text-primary" />
              </span>
            </button>
          </div>
        </aside>
      ) : null}

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
        cycleActive={Boolean(statusData?.cycle?.active)}
        cycleName={String(statusData?.cycle?.active?.name || "")}
        students={Array.isArray(statusData?.config?.alunos) ? statusData?.config?.alunos : []}
        scheduleSummary={Array.isArray(statusData?.scheduleSummary) ? statusData?.scheduleSummary : []}
        onSaved={refreshStatus}
      />
      <MessagesModal
        open={messagesOpen}
        onClose={() => {
          setMessagesOpen(false)
          setMessagesInitialEditorType("default")
        }}
        initialEditorType={messagesInitialEditorType}
        initialDefaultMessage={String(statusData?.config?.defaultGreetingMessage || "")}
        initialNoClassMessage={String(statusData?.config?.defaultNoClassMessage || "")}
        initialCustomMessage={String(statusData?.config?.customMessageTemplate || "")}
        students={Array.isArray(statusData?.config?.alunoDetalhes) ? statusData?.config?.alunoDetalhes : []}
        initialImagePath={String(statusData?.config?.imagePath || "")}
        initialMediaFileName={String(statusData?.config?.mediaFileName || "")}
        onSaved={refreshStatus}
      />
      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={Array.isArray(statusData?.cycle?.history) ? statusData?.cycle?.history : []}
      />
      <ScheduleModal
        open={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false)
          setScheduleInitialSection(null)
        }}
        onSaved={refreshStatus}
        initialSection={scheduleInitialSection}
      />
      <AllSchedulesModal
        open={allSchedulesOpen}
        onClose={() => setAllSchedulesOpen(false)}
        items={allGreetingItems}
        onRefresh={refreshStatus}
      />
    </div>
  )
}
