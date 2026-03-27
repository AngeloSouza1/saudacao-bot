"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Calendar, Check, GraduationCap, MessageCirclePlus, RefreshCcw } from "lucide-react"
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
import { UsersModal } from "@/components/saudacao/UsersModal"
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
    agendaSemanal?: Record<string, Array<{ data?: string; hora?: string; materia?: string }>>
    antecedenciaMin?: number
    horarioEnvio?: string
    horarioEnvioSemAula?: string
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
      ownerUsername?: string
      ownerSessionReady?: boolean
      ownerSessionPhase?: string
      ownerSessionSender?: string
      currentUserOwnsCycle?: boolean
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
  if (phase === "ready") return "ok"
  if (phase === "authenticated") return "warn"
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

type DashboardPageClientProps = {
  panelSession: {
    authenticated: true
    username: string
    role: "admin" | "user" | "viewer"
    isAdmin: boolean
    isViewer?: boolean
    imageUrl?: string
  }
}

const VIEWER_HELP: Record<string, { title: string; description: string; guidance: string }> = {
  schedule: {
    title: "Agenda",
    description: "Aqui ficam os alunos, as aulas e a organização base do fluxo de saudações.",
    guidance: "No perfil de visualização, use esta área para entender a ordem dos alunos, o calendário e a estrutura que alimenta os envios.",
  },
  messages: {
    title: "Mensagens",
    description: "Central de textos padrão, mensagens de ausência e mensagens personalizadas.",
    guidance: "Este perfil não pode editar modelos, mas pode entender como a comunicação é configurada antes do envio automático.",
  },
  destination: {
    title: "Destino",
    description: "Define para onde as mensagens são enviadas, seja número, grupo ou configuração equivalente.",
    guidance: "No modo visita, esta funcionalidade serve para inspeção e entendimento do canal configurado, sem alterar o destino real.",
  },
  config: {
    title: "Configuração",
    description: "Área com parâmetros gerais do bot, imagens, identidade visual e comportamentos do fluxo.",
    guidance: "Use esta visão para compreender como a aplicação é personalizada e quais dados sustentam o painel operacional.",
  },
  session: {
    title: "Sessão",
    description: "Mostra o estado atual da conexão com o WhatsApp, QR Code e saúde da automação.",
    guidance: "Neste perfil você pode consultar o status, mas ações manuais de envio ou reconciliação permanecem bloqueadas.",
  },
  history: {
    title: "Histórico",
    description: "Lista de ciclos anteriores, andamento e volumes já processados.",
    guidance: "Serve para demonstrar a operação passada e explicar como os ciclos evoluem ao longo do uso do sistema.",
  },
  shortcuts: {
    title: "Atalhos",
    description: "Acesso rápido a ações comuns como ciclo, mensagens e cadastro operacional.",
    guidance: "No modo visualização, os atalhos viram um guia do que o operador normalmente faria, sem executar alterações reais.",
  },
  "custom-message": {
    title: "Mensagem personalizada",
    description: "Permite montar um envio específico fora do fluxo padrão.",
    guidance: "Neste perfil ela é apresentada apenas como demonstração do recurso e do seu objetivo operacional.",
  },
  students: {
    title: "Aluno",
    description: "Cadastro e manutenção da base de alunos usada pelo ciclo.",
    guidance: "Aqui você entende como os participantes entram na fila de saudações, sem poder criar ou editar registros.",
  },
  lessons: {
    title: "Aula",
    description: "Gerencia a agenda de aulas que determina o calendário de disparos.",
    guidance: "No perfil teste, use esta área para compreender a lógica de datas, horários e vínculo com os alunos.",
  },
  cycle: {
    title: "Ciclo",
    description: "Controla o início, reinício e acompanhamento do ciclo atual.",
    guidance: "A visualização permite entender a regra do ciclo e sua rotação, mas qualquer alteração operacional permanece bloqueada.",
  },
}

const VIEWER_LAYOUTS: Record<string, { eyebrow: string; sections: Array<{ label: string; value: string }> }> = {
  session: {
    eyebrow: "Visão da sessão",
    sections: [
      { label: "Status da conexão", value: "Mostra se o WhatsApp está pronto, aguardando QR ou com erro." },
      { label: "QR Code", value: "Exibe o código de autenticação quando a sessão ainda não foi conectada." },
      { label: "Ações operacionais", value: "Permite testar envio ou reconectar a sessão no perfil administrativo." },
    ],
  },
  schedule: {
    eyebrow: "Visão da agenda",
    sections: [
      { label: "Base de alunos", value: "Controla a ordem dos participantes usados no ciclo." },
      { label: "Aulas e datas", value: "Define quando cada envio deve acontecer na operação." },
      { label: "Estrutura do ciclo", value: "Liga alunos, agenda e previsão de próximas saudações." },
    ],
  },
  messages: {
    eyebrow: "Visão das mensagens",
    sections: [
      { label: "Mensagem padrão", value: "Texto principal usado nas saudações automáticas." },
      { label: "Aviso sem aula", value: "Modelo enviado quando não existe aula programada." },
      { label: "Mensagem personalizada", value: "Fluxo manual para envios específicos fora da rotina principal." },
    ],
  },
  destination: {
    eyebrow: "Visão do destino",
    sections: [
      { label: "Número ou grupo", value: "Define para onde a aplicação envia as mensagens." },
      { label: "Validação do canal", value: "Garante que o envio esteja apontando para o destino correto." },
      { label: "Bloqueio de alteração", value: "Protege essa configuração com senha quando necessário." },
    ],
  },
  config: {
    eyebrow: "Visão da configuração",
    sections: [
      { label: "Identidade", value: "Turma e instituição usadas em mensagens e banners." },
      { label: "Horário de envio", value: "Determina a hora exata do disparo automático." },
      { label: "Regras de segurança", value: "Define bloqueios e parâmetros gerais do painel." },
    ],
  },
  history: {
    eyebrow: "Visão do histórico",
    sections: [
      { label: "Ciclos anteriores", value: "Lista execuções já concluídas ou canceladas." },
      { label: "Totais processados", value: "Mostra alunos enviados e andamento de cada ciclo." },
      { label: "Rastreabilidade", value: "Ajuda a entender quando e como a operação ocorreu." },
    ],
  },
  shortcuts: {
    eyebrow: "Visão dos atalhos",
    sections: [
      { label: "Mensagem personalizada", value: "Abre rapidamente o envio manual." },
      { label: "Aluno e aula", value: "Atalhos para manutenção da base operacional." },
      { label: "Ciclo", value: "Acesso rápido para iniciar ou revisar o ciclo atual." },
    ],
  },
  "custom-message": {
    eyebrow: "Visão do envio manual",
    sections: [
      { label: "Editor da mensagem", value: "Monta o conteúdo do envio fora do fluxo automático." },
      { label: "Mídia e banner", value: "Permite personalizar imagem, fundo e nome do arquivo." },
      { label: "Destinatário", value: "Escolhe aluno ou grupo para receber a mensagem." },
    ],
  },
  students: {
    eyebrow: "Visão do cadastro de alunos",
    sections: [
      { label: "Lista de participantes", value: "Base usada para montar a ordem do ciclo." },
      { label: "WhatsApp e imagem", value: "Dados de contato e avatar usados na operação." },
      { label: "Manutenção do cadastro", value: "Permite criar, editar e remover alunos." },
    ],
  },
  lessons: {
    eyebrow: "Visão das aulas",
    sections: [
      { label: "Datas e horários", value: "Define quando cada aula acontece." },
      { label: "Matéria e professor", value: "Contextualiza o envio para cada encontro." },
      { label: "Agenda semanal", value: "Organiza a sequência que alimenta o scheduler." },
    ],
  },
  cycle: {
    eyebrow: "Visão do ciclo",
    sections: [
      { label: "Responsável do ciclo", value: "Define qual sessão de WhatsApp será usada nos envios." },
      { label: "Fila prevista", value: "Mostra a ordem dos próximos alunos do ciclo atual." },
      { label: "Acompanhamento", value: "Permite iniciar, reiniciar e acompanhar o progresso." },
    ],
  },
}

const VIEWER_FOCUS: Record<string, { zone: "sidebar" | "content" | "shortcuts"; top: string; left?: string; right?: string; width: string; height: string; tip: string }> = {
  schedule: { zone: "sidebar", top: "188px", left: "10px", width: "220px", height: "58px", tip: "Acesse a Agenda por este item da navegação lateral." },
  messages: { zone: "sidebar", top: "246px", left: "10px", width: "220px", height: "58px", tip: "A área de Mensagens fica neste item da barra lateral." },
  destination: { zone: "sidebar", top: "304px", left: "10px", width: "220px", height: "58px", tip: "Use este item para configurar o destino dos envios." },
  config: { zone: "sidebar", top: "362px", left: "10px", width: "220px", height: "58px", tip: "A Configuração do sistema fica aqui na navegação lateral." },
  session: { zone: "sidebar", top: "420px", left: "10px", width: "220px", height: "58px", tip: "A visão de Sessão é aberta por este item." },
  history: { zone: "sidebar", top: "478px", left: "10px", width: "220px", height: "58px", tip: "O Histórico fica neste item da navegação." },
  shortcuts: { zone: "sidebar", top: "536px", left: "10px", width: "220px", height: "58px", tip: "Ative ou recolha os atalhos rápidos por este item." },
  "custom-message": { zone: "shortcuts", top: "100px", right: "18px", width: "74px", height: "50px", tip: "Este atalho abre o envio de mensagem personalizada." },
  students: { zone: "shortcuts", top: "152px", right: "18px", width: "74px", height: "50px", tip: "Aqui fica o atalho para o cadastro de alunos." },
  lessons: { zone: "shortcuts", top: "204px", right: "18px", width: "74px", height: "50px", tip: "Este atalho leva à manutenção das aulas." },
  cycle: { zone: "shortcuts", top: "256px", right: "18px", width: "74px", height: "50px", tip: "Use este atalho para abrir o controle do ciclo." },
}

export default function DashboardPageClient({ panelSession }: DashboardPageClientProps) {
  const defaultScreenAppliedRef = useRef(false)
  const qrScreenSeenRef = useRef(false)
  const authTransitionDurationMs = 7000
  const [isMounted, setIsMounted] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [justAuthenticated, setJustAuthenticated] = useState(false)
  const [showAuthTransition, setShowAuthTransition] = useState(false)
  const [authTransitionMode, setAuthTransitionMode] = useState<"login" | "whatsapp-ready">("login")
  const [authTransitionStartedAt, setAuthTransitionStartedAt] = useState(0)
  const [authTransitionProgress, setAuthTransitionProgress] = useState(0)
  const [activeItem, setActiveItem] = useState("")
  const [destinationOpen, setDestinationOpen] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [messagesInitialEditorType, setMessagesInitialEditorType] = useState<"default" | "no-class" | "custom">("default")
  const [configOpen, setConfigOpen] = useState(false)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleInitialSection, setScheduleInitialSection] = useState<"students" | "lessons" | null>(null)
  const [allSchedulesOpen, setAllSchedulesOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(true)
  const [todayLabel, setTodayLabel] = useState("")
  const [panelUserImageUrl, setPanelUserImageUrl] = useState(String(panelSession?.imageUrl || "").trim())
  const [statusData, setStatusData] = useState<DashboardStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string>("")
  const [statusPollingEnabled, setStatusPollingEnabled] = useState(true)
  const [statusRequested, setStatusRequested] = useState(false)
  const [viewerFeature, setViewerFeature] = useState<string>("session")
  const [showViewerIntro, setShowViewerIntro] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    if (typeof window === "undefined") return
    const authMarker = window.sessionStorage.getItem("saudacao.panel.just-authenticated")
    if (!authMarker) return
    setJustAuthenticated(true)
    setAuthTransitionMode("login")
    const startedAt = Date.now()
    setAuthTransitionStartedAt(startedAt)
    setAuthTransitionProgress(0)
    setShowAuthTransition(true)
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

  useEffect(() => {
    if (!isMounted || initialLoading || !showAuthTransition) return
    if (typeof window === "undefined") return
    if (authTransitionMode === "login") {
      window.sessionStorage.removeItem("saudacao.panel.just-authenticated")
    }
    const timer = window.setTimeout(() => {
      setAuthTransitionProgress(100)
      setShowAuthTransition(false)
      if (authTransitionMode === "login") {
        setJustAuthenticated(false)
      }
    }, authTransitionDurationMs)
    return () => window.clearTimeout(timer)
  }, [authTransitionDurationMs, authTransitionMode, initialLoading, isMounted, showAuthTransition])

  useEffect(() => {
    if (!showAuthTransition || !authTransitionStartedAt) return

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - authTransitionStartedAt
      const nextProgress = Math.max(0, Math.min(100, (elapsed / authTransitionDurationMs) * 100))
      setAuthTransitionProgress(nextProgress)
    }, 80)

    return () => window.clearInterval(interval)
  }, [authTransitionDurationMs, authTransitionStartedAt, showAuthTransition])

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
  const panelUserName = String(panelSession?.username || "").trim() || "painel"
  const userName = panelUserName
  const userInitials = getUserInitials(panelUserName)
  const userAvatar = panelUserImageUrl || undefined
  const whatsappPhase = String(statusData?.whatsapp?.phase || "")
  const isSystemReady = whatsappPhase === "ready"
  const activeCycleOwner = String(statusData?.cycle?.active?.ownerUsername || "").trim()
  const activeCycleOwnerReady = statusData?.cycle?.active
    ? Boolean(statusData?.cycle?.active?.ownerSessionReady)
    : true
  const currentUserOwnsCycle = Boolean(statusData?.cycle?.active?.currentUserOwnsCycle)
  const hasConfigPending = !hasRequiredConfig({
    turma: statusData?.config?.turma,
    instituicao: statusData?.config?.instituicao,
    groupName: statusData?.settings?.groupName,
    to: statusData?.settings?.to,
    scheduleCount: Array.isArray(statusData?.scheduleSummary) ? statusData?.scheduleSummary.length : 0,
  })
  const disableManualSend = !statusData?.cycle?.active || !activeCycleOwnerReady || hasConfigPending
  const isViewer = panelSession.role === "viewer"
  const viewerHelp = VIEWER_HELP[viewerFeature]
  const viewerLayout = VIEWER_LAYOUTS[viewerFeature] || VIEWER_LAYOUTS.session
  const viewerFocus = VIEWER_FOCUS[viewerFeature] || VIEWER_FOCUS.session
  const viewerShowsScheduleModal = isViewer && ["schedule", "students", "lessons"].includes(viewerFeature)
  const viewerShowsMessagesModal = isViewer && ["messages", "custom-message"].includes(viewerFeature)
  const viewerShowsDestinationModal = isViewer && viewerFeature === "destination"
  const viewerShowsConfigModal = isViewer && viewerFeature === "config"
  const viewerShowsHistoryModal = isViewer && viewerFeature === "history"
  const viewerShowsCycleModal = isViewer && viewerFeature === "cycle"
  const showSessionCard = activeItem === "session" || (isViewer && viewerFeature === "session")
  const showShortcutsCard = shortcutsOpen

  useEffect(() => {
    if (!isMounted || initialLoading) return
    if (!isViewer) return
    setShowViewerIntro(true)
  }, [initialLoading, isMounted, isViewer])

  useLayoutEffect(() => {
    if (initialLoading) return
    if (!isSystemReady) {
      qrScreenSeenRef.current = true
      return
    }
    if (justAuthenticated || showAuthTransition || !qrScreenSeenRef.current) return
    qrScreenSeenRef.current = false
    setAuthTransitionMode("whatsapp-ready")
    setAuthTransitionStartedAt(Date.now())
    setAuthTransitionProgress(0)
    setShowAuthTransition(true)
  }, [initialLoading, isSystemReady, justAuthenticated, showAuthTransition])

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

  if (showAuthTransition) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-background px-6" suppressHydrationWarning>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#e8f5ec,transparent_42%),linear-gradient(180deg,#f8fbf8_0%,#eff5f0_100%)]" />
        <div className="absolute inset-0 backdrop-blur-[5px]" />

        <div className="relative z-10 flex w-full max-w-5xl items-center justify-center">
          <div className="w-full max-w-md rounded-[2rem] border border-green-200/70 bg-white/90 px-10 py-12 text-center shadow-[0_24px_80px_rgba(20,74,45,0.14)] backdrop-blur-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-green-700/12 bg-green-50">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-white shadow-lg">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-green-700/70">
              {authTransitionMode === "whatsapp-ready" ? "Sessão conectada" : "Acesso liberado"}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
              {authTransitionMode === "whatsapp-ready" ? "WhatsApp autenticado" : "Usuário autenticado"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {authTransitionMode === "whatsapp-ready" ? (
                <>
                  A sessão do WhatsApp da conta <span className="font-semibold text-foreground">{panelUserName}</span> foi validada.
                  {" "}Preparando o painel principal para acesso.
                </>
              ) : (
                <>
                  A conta <span className="font-semibold text-foreground">{panelUserName}</span> foi validada com sucesso.
                  {isSystemReady
                    ? " Preparando o painel principal para acesso."
                    : " Agora vamos verificar a sessão do WhatsApp."}
                </>
              )}
            </p>

            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-secondary/55 px-4 py-2.5 text-sm text-foreground">
              {userAvatar ? (
                <span className="h-9 w-9 overflow-hidden rounded-full border border-border" aria-hidden="true">
                  <img src={userAvatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </span>
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ background: "oklch(0.44 0.12 155)" }}
                  aria-hidden="true"
                >
                  {userInitials}
                </span>
              )}
              <span className="font-medium">{userName}</span>
            </div>

            <div className="mt-7">
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-75 ease-linear"
                  style={{ width: `${authTransitionProgress}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                {Math.round(authTransitionProgress)}%
              </p>
            </div>

            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {authTransitionMode === "whatsapp-ready"
                ? "Redirecionando para o painel operacional"
                : isSystemReady
                  ? "Redirecionando para o painel operacional"
                  : "Redirecionando para a autenticação do WhatsApp"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (initialLoading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background" suppressHydrationWarning>
        <AppHeader
          cycleLabel="Carregando painel"
          userName={panelUserName}
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

      {isViewer ? <div className="pointer-events-none fixed inset-0 z-30 bg-slate-950/30" /> : null}

      {isViewer && showViewerIntro ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[1.75rem] border border-emerald-200/80 bg-white/98 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">Modo de visita</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Como navegar</h2>
            <p className="mt-3 text-sm leading-6 text-foreground/85">
              Este acesso é uma visita guiada. Use o menu lateral para trocar de funcionalidade e entender onde cada recurso fica na aplicação.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ao selecionar um item, você verá o modal ou a área real correspondente junto com a explicação do recurso, sem alterar dados do sistema.
            </p>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-950">
              Comece pela barra lateral e siga a explicação exibida no Tutorial guiado.
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowViewerIntro(false)}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-green-deep"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0">
        <div className={isViewer ? "relative z-40" : ""}>
          <AppSidebar
            onOpenDestination={() => (isViewer ? setViewerFeature("destination") : setDestinationOpen(true))}
            onOpenMessages={() => (isViewer ? setViewerFeature("messages") : setMessagesOpen(true))}
            onOpenConfig={() => (isViewer ? setViewerFeature("config") : setConfigOpen(true))}
            onOpenSession={() => (isViewer ? setViewerFeature("session") : setActiveItem("session"))}
            onOpenHistory={() => (isViewer ? setViewerFeature("history") : setHistoryOpen(true))}
            onOpenUsers={() => setUsersOpen(true)}
            onOpenSchedule={() => {
              if (isViewer) {
                setViewerFeature("schedule")
                return
              }
              setScheduleInitialSection(null)
              setScheduleOpen(true)
            }}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
            shortcutsOpen={shortcutsOpen}
            onToggleShortcuts={() => {
              if (isViewer) {
                setViewerFeature("shortcuts")
                setShortcutsOpen(true)
                return
              }
              setShortcutsOpen((prev) => !prev)
            }}
            canManageUsers={panelSession.isAdmin}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="relative max-w-6xl mx-auto">
            <div className={`flex flex-col gap-6 transition-all ${isViewer ? "pointer-events-none select-none" : ""}`}>
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight text-balance">Painel Operacional</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ciclo ativo{todayLabel ? ` · ${todayLabel}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {statusData?.cycle?.active ? (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                      activeCycleOwnerReady
                        ? "border border-green-200 bg-green-50 text-green-800"
                        : "border border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${activeCycleOwnerReady ? "bg-status-ok" : "bg-status-err"}`} />
                    <span className="font-medium">
                      Responsável: {activeCycleOwner || "não definido"}
                      {currentUserOwnsCycle ? " · você" : ""}
                    </span>
                  </div>
                ) : null}
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
                <div className={`lg:h-[560px] ${isViewer && viewerFeature === "session" ? "relative z-40" : ""}`}>
                  <SessionStatusCard
                    statusRows={statusRows}
                    qrAvailable={Boolean(statusData?.whatsapp?.qrAvailable)}
                    qrImageDataUrl={String(statusData?.whatsapp?.qrImageDataUrl || "")}
                    qrText={String(statusData?.whatsapp?.qrText || "")}
                    disableManualSend={disableManualSend}
                    showActions={!isViewer}
                    onSendTest={!isViewer ? () => runAction("/api/send-test", "Teste enviado.") : undefined}
                    onSendNow={!isViewer ? () => runAction("/api/send-now", "Envio imediato executado.") : undefined}
                    onSendForced={!isViewer ? () => runAction("/api/send-now-forced", "Envio forçado executado.") : undefined}
                    onClose={() => setActiveItem("")}
                  />
                </div>
              ) : null}

              <div className={`lg:h-[560px] ${showSessionCard ? "" : "lg:col-span-2"}`}>
                <UpcomingGreetingsCard items={greetingItems} onOpenAll={() => setAllSchedulesOpen(true)} />
              </div>
            </div>
            </div>

            {isViewer && !showViewerIntro ? (
              <div
                className="pointer-events-none fixed z-[80] max-w-[21rem] rounded-[1.5rem] border border-emerald-200/80 bg-white/96 p-3.5 shadow-[0_20px_70px_rgba(16,24,40,0.16)]"
                style={{ right: "112px", top: "110px" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">Tutorial guiado</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {viewerHelp?.title || "Painel demonstrativo"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-foreground/85">
                  {viewerHelp?.description}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {viewerHelp?.guidance}
                </p>
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-950">
                  {viewerFocus.tip}
                </div>
                <div className="mt-3 space-y-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
                    {viewerLayout.eyebrow}
                  </p>
                  {viewerLayout.sections.map((section) => (
                    <div key={section.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {section.label}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-slate-700">
                        {section.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {showShortcutsCard ? (
        <aside className={`fixed right-3 top-[86px] bottom-4 z-40 w-[90px] rounded-2xl px-2 py-3 flex flex-col transition-all ${isViewer ? "pointer-events-none" : ""} ${isViewer && viewerFeature === "shortcuts" ? "border border-emerald-200/90 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(240,253,250,0.72))] shadow-[0_14px_38px_rgba(16,24,40,0.12)] backdrop-blur-sm" : "bg-transparent"}`}>
          <div className="mt-1 flex flex-col gap-2">
            <button
              onClick={() => {
                if (isViewer) {
                  setViewerFeature("custom-message")
                  return
                }
                setMessagesInitialEditorType("custom")
                setMessagesOpen(true)
              }}
              className={`group w-full rounded-xl px-3 py-2.5 text-left transition ${isViewer && viewerFeature === "shortcuts" ? "border border-emerald-200/80 bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" : "bg-transparent hover:bg-muted/40"}`}
              title="Mensagem personalizada"
              aria-label="Mensagem personalizada"
            >
              <span className="inline-flex w-full items-center justify-center">
                <MessageCirclePlus size={18} className={isViewer && viewerFeature === "shortcuts" ? "text-emerald-700" : "text-primary"} />
              </span>
            </button>
            <button
              onClick={() => {
                if (isViewer) {
                  setViewerFeature("students")
                  return
                }
                setScheduleInitialSection("students")
                setScheduleOpen(true)
              }}
              className={`group w-full rounded-xl px-3 py-2.5 text-left transition ${isViewer && viewerFeature === "shortcuts" ? "border border-emerald-200/80 bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" : "bg-transparent hover:bg-muted/40"}`}
              title="Aluno"
              aria-label="Aluno"
            >
              <span className="inline-flex w-full items-center justify-center">
                <GraduationCap size={18} className={isViewer && viewerFeature === "shortcuts" ? "text-emerald-700" : "text-primary"} />
              </span>
            </button>
            <button
              onClick={() => {
                if (isViewer) {
                  setViewerFeature("lessons")
                  return
                }
                setScheduleInitialSection("lessons")
                setScheduleOpen(true)
              }}
              className={`group w-full rounded-xl px-3 py-2.5 text-left transition ${isViewer && viewerFeature === "shortcuts" ? "border border-emerald-200/80 bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" : "bg-transparent hover:bg-muted/40"}`}
              title="Aula"
              aria-label="Aula"
            >
              <span className="inline-flex w-full items-center justify-center">
                <Calendar size={18} className={isViewer && viewerFeature === "shortcuts" ? "text-emerald-700" : "text-primary"} />
              </span>
            </button>
            <button
              onClick={() => {
                if (isViewer) {
                  setViewerFeature("cycle")
                  return
                }
                setCycleOpen(true)
              }}
              className={`group w-full rounded-xl px-3 py-2.5 text-left transition ${isViewer && viewerFeature === "shortcuts" ? "border border-emerald-200/80 bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" : "bg-transparent hover:bg-muted/40"}`}
              title="Ciclo"
              aria-label="Ciclo"
            >
              <span className="inline-flex w-full items-center justify-center">
                <RefreshCcw size={18} className={isViewer && viewerFeature === "shortcuts" ? "text-emerald-700" : "text-primary"} />
              </span>
            </button>
          </div>
        </aside>
      ) : null}

      <DestinationModal
        open={destinationOpen || viewerShowsDestinationModal}
        onClose={() => setDestinationOpen(false)}
        previewMode={isViewer}
        initialValues={statusData?.settings}
        onSaved={refreshStatus}
      />
      <ConfigModal
        open={configOpen || viewerShowsConfigModal}
        onClose={() => setConfigOpen(false)}
        previewMode={isViewer}
        initialConfig={statusData?.config}
        onSaved={refreshStatus}
      />
      <CycleModal
        open={cycleOpen || viewerShowsCycleModal}
        onClose={() => setCycleOpen(false)}
        previewMode={isViewer}
        initialConfig={statusData?.config}
        initialState={statusData?.state}
        cycleActive={Boolean(statusData?.cycle?.active)}
        cycleName={String(statusData?.cycle?.active?.name || "")}
        cycleSentCount={Number(statusData?.cycle?.active?.sentCount || 0)}
        cycleTotalAlunos={Number(statusData?.cycle?.active?.totalAlunos || 0)}
        students={Array.isArray(statusData?.config?.alunos) ? statusData?.config?.alunos : []}
        scheduleSummary={Array.isArray(statusData?.scheduleSummary) ? statusData?.scheduleSummary : []}
        currentUsername={panelUserName}
        currentUserWhatsappReady={isSystemReady}
        onSaved={refreshStatus}
      />
      <MessagesModal
        open={messagesOpen || viewerShowsMessagesModal}
        onClose={() => {
          setMessagesOpen(false)
          setMessagesInitialEditorType("default")
        }}
        previewMode={isViewer}
        initialEditorType={viewerFeature === "custom-message" ? "custom" : messagesInitialEditorType}
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
        initialGreetingTextColor={String(statusData?.config?.greetingTextColor || statusData?.config?.textColor || "")}
        initialNoClassImagePath={String(statusData?.config?.noClassImagePath || "")}
        initialNoClassMediaFileName={String(statusData?.config?.noClassMediaFileName || "")}
        initialNoClassBannerTitle={String(statusData?.config?.noClassBannerTitle || "")}
        initialNoClassBackgroundColor={String(statusData?.config?.noClassBackgroundColor || statusData?.config?.backgroundColor || "")}
        initialNoClassBackgroundImagePath={String(statusData?.config?.noClassBackgroundImagePath || statusData?.config?.backgroundImagePath || "")}
        initialNoClassTextColor={String(statusData?.config?.noClassTextColor || statusData?.config?.textColor || "")}
        initialCustomImagePath={String(statusData?.config?.customImagePath || "")}
        initialCustomMediaFileName={String(statusData?.config?.customMediaFileName || "")}
        initialCustomBannerTitle={String(statusData?.config?.customBannerTitle || "")}
        initialCustomBackgroundColor={String(statusData?.config?.customBackgroundColor || statusData?.config?.backgroundColor || "")}
        initialCustomBackgroundImagePath={String(statusData?.config?.customBackgroundImagePath || statusData?.config?.backgroundImagePath || "")}
        initialCustomTextColor={String(statusData?.config?.customTextColor || statusData?.config?.textColor || "")}
        onSaved={refreshStatus}
      />
      <HistoryModal
        open={historyOpen || viewerShowsHistoryModal}
        onClose={() => setHistoryOpen(false)}
        previewMode={isViewer}
        items={Array.isArray(statusData?.cycle?.history) ? statusData?.cycle?.history : []}
      />
      <UsersModal
        open={usersOpen}
        onClose={() => {
          setUsersOpen(false)
          if (activeItem === "users") setActiveItem("")
        }}
        currentUsername={panelUserName}
        onCurrentUserUpdated={(payload) => {
          setPanelUserImageUrl(String(payload?.imageUrl || "").trim())
        }}
      />
      <ScheduleModal
        open={scheduleOpen || viewerShowsScheduleModal}
        onClose={() => {
          setScheduleOpen(false)
          setScheduleInitialSection(null)
        }}
        previewMode={isViewer}
        onSaved={refreshStatus}
        initialSection={viewerFeature === "students" ? "students" : viewerFeature === "lessons" ? "lessons" : scheduleInitialSection}
        cycleActive={Boolean(statusData?.cycle?.active)}
      />
      <AllSchedulesModal
        open={allSchedulesOpen}
        onClose={() => setAllSchedulesOpen(false)}
        items={allGreetingItems}
        onRefresh={refreshStatus}
        readOnly={isViewer}
      />
    </div>
  )
}
