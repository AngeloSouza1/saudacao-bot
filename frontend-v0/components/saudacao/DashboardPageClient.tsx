"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Calendar, GraduationCap, MessageCirclePlus, RefreshCcw } from "lucide-react"
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
import { CycleModal } from "@/components/saudacao/CycleModal"
import { hasRequiredConfig } from "@/lib/validation"

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
    bannerTitle?: string
    backgroundColor?: string
    backgroundImagePath?: string
    greetingImagePath?: string
    greetingMediaFileName?: string
    greetingBannerTitle?: string
    greetingBackgroundColor?: string
    greetingBackgroundImagePath?: string
    noClassImagePath?: string
    noClassMediaFileName?: string
    noClassBannerTitle?: string
    noClassBackgroundColor?: string
    noClassBackgroundImagePath?: string
    customImagePath?: string
    customMediaFileName?: string
    customBannerTitle?: string
    customBackgroundColor?: string
    customBackgroundImagePath?: string
    lockTimeoutMin?: number
    lockConfigured?: boolean
    alunos?: string[]
    alunoDetalhes?: Array<{ nome?: string; whatsapp?: string; imagem?: string }>
  }
  scheduleSummary?: Array<{ data?: string; dia?: string | number; horario?: string; materia?: string }>
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
    loggedStudentMatch?: {
      nome?: string
      whatsapp?: string
    } | null
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
  })
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

function mapGreetingItems(data: DashboardStatusResponse | null, limit = 12): GreetingItem[] {
  const preview = Array.isArray(data?.schedulePreview) ? data.schedulePreview : []
  const details = Array.isArray(data?.config?.alunoDetalhes) ? data.config.alunoDetalhes : []
  const imageByStudent = new Map(
    details
      .map((item) => [String(item?.nome || "").trim().toLocaleLowerCase("pt-BR"), String(item?.imagem || "").trim()] as const)
      .filter(([name, image]) => Boolean(name) && Boolean(image))
  )
  const reverted = new Set(
    Array.isArray(data?.state?.revertidosEfetivados) ? data.state.revertidosEfetivados.map(String) : []
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

export default function DashboardPageClient() {
  const defaultScreenAppliedRef = useRef(false)
  const [isMounted, setIsMounted] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [activeItem, setActiveItem] = useState("")
  const [destinationOpen, setDestinationOpen] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [messagesInitialEditorType, setMessagesInitialEditorType] = useState<"default" | "no-class" | "custom">("default")
  const [configOpen, setConfigOpen] = useState(false)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleInitialSection, setScheduleInitialSection] = useState<"students" | "lessons" | null>(null)
  const [allSchedulesOpen, setAllSchedulesOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(true)
  const [todayLabel, setTodayLabel] = useState("")
  const [statusData, setStatusData] = useState<DashboardStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string>("")
  const [statusPollingEnabled, setStatusPollingEnabled] = useState(true)
  const [statusRequested, setStatusRequested] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const data = await fetchJson<DashboardStatusResponse>("/api/status")
      setStatusData(data)
      setStatusError("")
      setStatusPollingEnabled(true)
    } catch (error) {
      const message = String((error as Error)?.message || "Falha ao atualizar status.")
      setStatusError(message)
      if (/backend do painel está offline|econnrefused|fetch failed/i.test(message)) {
        setStatusPollingEnabled(false)
      }
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
    if (!isMounted || statusRequested) return
    setStatusRequested(true)
    void (async () => {
      try {
        await refreshStatus()
      } finally {
        setInitialLoading(false)
      }
    })()
  }, [isMounted, refreshStatus, statusRequested])

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
        { label: "Sessão", value: "não consultado", status: "idle" as SystemStatus },
        { label: "Agendador", value: "não consultado", status: "idle" as SystemStatus },
        { label: "QR pendente", value: "não consultado", status: "idle" as SystemStatus },
      ]
    }

    const phase = String(statusData?.whatsapp?.phase || "")
    const cycle = statusData?.cycle?.active
    const sent = Number(cycle?.sentCount || 0)
    const total = Number(cycle?.totalAlunos || 0)
    const loggedStudentMatch = statusData?.whatsapp?.loggedStudentMatch

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
      loggedStudentMatch
        ? {
            label: "Número logado",
            value: `coincide com ${String(loggedStudentMatch?.nome || "aluno")}`,
            status: "warn" as SystemStatus,
          }
        : {
            label: "Número logado",
            value: "não coincide com alunos",
            status: "ok" as SystemStatus,
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

  useEffect(() => {
    if (!isSystemReady || defaultScreenAppliedRef.current) return
    setActiveItem("")
    setShortcutsOpen(true)
    defaultScreenAppliedRef.current = true
  }, [isSystemReady])

  useEffect(() => {
    if (!statusRequested || !statusPollingEnabled) return

    const timer = setInterval(() => {
      void refreshStatus()
    }, 5000)

    return () => clearInterval(timer)
  }, [refreshStatus, statusPollingEnabled, statusRequested])

  if (!isMounted) {
    return <div className="h-screen bg-background" suppressHydrationWarning />
  }

  if (initialLoading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background" suppressHydrationWarning>
        <AppHeader
          cycleLabel="Carregando painel"
          userName="Aguardando sessão"
          userInitials="SB"
        />

        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card/90 px-8 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Carregando aplicação</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Aguarde enquanto a sessão, a configuração e os agendamentos ficam disponíveis.
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (!isSystemReady) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background" suppressHydrationWarning>
        <AppHeader
          cycleLabel={cycleLabel}
          userName={userName}
          userInitials={userInitials}
          userAvatar={userAvatar}
        />

        <main className="flex flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto flex w-full max-w-[1720px] items-center justify-center">
            <div className="w-full">
            <div className="mb-5 text-center">
              <h1 className="text-[2rem] font-bold tracking-tight text-foreground">Autenticação do WhatsApp</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Conecte a sessão para liberar o painel operacional e os envios automáticos da aplicação.
              </p>
            </div>

            <div className="mx-auto grid items-stretch gap-8 lg:grid-cols-2">
              <section className="flex min-h-[460px] h-full flex-col justify-center rounded-3xl border border-border bg-card/90 p-7 shadow-sm">
                <span className="inline-flex rounded-full border border-green-soft bg-green-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-deep">
                  Saudação Bot
                </span>
                <h2 className="mt-4 max-w-lg text-4xl font-bold leading-tight text-foreground">
                  Conecte o WhatsApp para liberar o painel
                </h2>
                <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  Sua conta do painel já foi autenticada. Agora conecte a sessão do WhatsApp para liberar os envios automáticos e o uso completo da aplicação.
                </p>
                <div className="mt-6 w-full max-w-2xl space-y-3">
                  {[
                    {
                      title: "Abra o WhatsApp no celular.",
                      desc: "Tenha o aplicativo disponível em seu smartphone.",
                    },
                    {
                      title: "Escaneie o QR Code exibido ao lado.",
                      desc: "Use a câmera ou o recurso de leitura do WhatsApp.",
                    },
                    {
                      title: "Após a validação, o painel operacional será carregado automaticamente.",
                      desc: "A sessão será estabelecida em poucos segundos.",
                    },
                  ].map((step, index) => (
                    <div key={step.title} className="flex gap-4 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                      <div className="pt-0.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <span className="text-sm font-semibold text-primary-foreground">{index + 1}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[15px] font-medium text-foreground">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex min-h-[460px] h-full w-full items-stretch justify-center">
                <SessionStatusCard
                  title="Login necessário"
                  subtitle="Escaneie o QR Code para liberar o uso da aplicação"
                  statusRows={statusRows}
                  qrAvailable={Boolean(statusData?.whatsapp?.qrAvailable)}
                  qrImageDataUrl={String(statusData?.whatsapp?.qrImageDataUrl || "")}
                  qrText={String(statusData?.whatsapp?.qrText || "")}
                  qrPhase={String(statusData?.whatsapp?.phase || "")}
                  lastError={String(statusData?.whatsapp?.lastError || "")}
                  showStatusRows={false}
                  showActions={false}
                  showOverallBadge={false}
                />
              </div>
            </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background" suppressHydrationWarning>
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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${isSystemReady ? "bg-status-ok animate-pulse" : "bg-status-warn"}`}
                  />
                  {isSystemReady ? "Sistema operacional" : "Aguardando WhatsApp"}
                </div>
              </div>
            </div>

            {statusError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <span>{statusError}</span>
                {!statusPollingEnabled ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setStatusRequested(true)
                      setStatusPollingEnabled(true)
                      await refreshStatus()
                    }}
                    className="rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                  >
                    Tentar novamente
                  </button>
                ) : null}
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
            <button
              onClick={() => setCycleOpen(true)}
              className="group w-full rounded-xl bg-transparent px-3 py-2.5 text-left transition hover:bg-muted/40"
              title="Ciclo"
              aria-label="Ciclo"
            >
              <span className="inline-flex w-full items-center justify-center">
                <RefreshCcw size={18} className="text-primary" />
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
        onSaved={refreshStatus}
      />
      <CycleModal
        open={cycleOpen}
        onClose={() => setCycleOpen(false)}
        initialConfig={statusData?.config}
        initialState={statusData?.state}
        cycleActive={Boolean(statusData?.cycle?.active)}
        cycleName={String(statusData?.cycle?.active?.name || "")}
        cycleSentCount={Number(statusData?.cycle?.active?.sentCount || 0)}
        cycleTotalAlunos={Number(statusData?.cycle?.active?.totalAlunos || 0)}
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
        initialTurma={String(statusData?.config?.turma || "")}
        initialInstituicao={String(statusData?.config?.instituicao || "")}
        initialDefaultMessage={String(statusData?.config?.defaultGreetingMessage || "")}
        initialNoClassMessage={String(statusData?.config?.defaultNoClassMessage || "")}
        initialCustomMessage={String(statusData?.config?.customMessageTemplate || "")}
        students={Array.isArray(statusData?.config?.alunoDetalhes) ? statusData?.config?.alunoDetalhes : []}
        loggedStudentMatch={statusData?.whatsapp?.loggedStudentMatch || null}
        initialImagePath={String(statusData?.config?.imagePath || "")}
        initialMediaFileName={String(statusData?.config?.mediaFileName || "")}
        initialBannerTitle={String(statusData?.config?.bannerTitle || "")}
        initialGreetingImagePath={String(statusData?.config?.greetingImagePath || "")}
        initialGreetingMediaFileName={String(statusData?.config?.greetingMediaFileName || "")}
        initialGreetingBannerTitle={String(statusData?.config?.greetingBannerTitle || "")}
        initialGreetingBackgroundColor={String(statusData?.config?.greetingBackgroundColor || statusData?.config?.backgroundColor || "")}
        initialGreetingBackgroundImagePath={String(statusData?.config?.greetingBackgroundImagePath || statusData?.config?.backgroundImagePath || "")}
        initialNoClassImagePath={String(statusData?.config?.noClassImagePath || "")}
        initialNoClassMediaFileName={String(statusData?.config?.noClassMediaFileName || "")}
        initialNoClassBannerTitle={String(statusData?.config?.noClassBannerTitle || "")}
        initialNoClassBackgroundColor={String(statusData?.config?.noClassBackgroundColor || statusData?.config?.backgroundColor || "")}
        initialNoClassBackgroundImagePath={String(statusData?.config?.noClassBackgroundImagePath || statusData?.config?.backgroundImagePath || "")}
        initialCustomImagePath={String(statusData?.config?.customImagePath || "")}
        initialCustomMediaFileName={String(statusData?.config?.customMediaFileName || "")}
        initialCustomBannerTitle={String(statusData?.config?.customBannerTitle || "")}
        initialCustomBackgroundColor={String(statusData?.config?.customBackgroundColor || statusData?.config?.backgroundColor || "")}
        initialCustomBackgroundImagePath={String(statusData?.config?.customBackgroundImagePath || statusData?.config?.backgroundImagePath || "")}
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
        cycleActive={Boolean(statusData?.cycle?.active)}
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
