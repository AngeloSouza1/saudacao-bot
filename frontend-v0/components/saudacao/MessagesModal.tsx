"use client"

import { useEffect, useRef, useState } from "react"
import { CircleHelp, Eye, FileText, MessagesSquare, Megaphone, MessageCircleMore, Pencil } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput, WhatsAppFormattingToolbar } from "./ModalShell"
import { ScheduledMessagesModal } from "./ScheduledMessagesModal"

interface MessagesModalProps {
  open: boolean
  onClose: () => void
  previewMode?: boolean
  initialEditorType?: "default" | "no-class" | "custom"
  initialTurma?: string
  initialInstituicao?: string
  initialDefaultMessage?: string
  initialNoClassMessage?: string
  initialCustomMessage?: string
  students?: Array<{ nome?: string; whatsapp?: string; imagem?: string }>
  loggedStudentMatch?: { nome?: string; whatsapp?: string } | null
  initialImagePath?: string
  initialMediaFileName?: string
  initialBannerTitle?: string
  initialGreetingImagePath?: string
  initialGreetingMediaFileName?: string
  initialGreetingBannerTitle?: string
  initialGreetingBackgroundColor?: string
  initialGreetingBackgroundImagePath?: string
  initialGreetingTextColor?: string
  initialNoClassImagePath?: string
  initialNoClassMediaFileName?: string
  initialNoClassBannerTitle?: string
  initialNoClassBackgroundColor?: string
  initialNoClassBackgroundImagePath?: string
  initialNoClassTextColor?: string
  initialCustomImagePath?: string
  initialCustomMediaFileName?: string
  initialCustomBannerTitle?: string
  initialCustomBackgroundColor?: string
  initialCustomBackgroundImagePath?: string
  initialCustomTextColor?: string
  onSaved?: () => Promise<void> | void
}

interface GroupOption {
  id: string
  name: string
}

const DEFAULT_MESSAGE_FALLBACK = `Turma: *{{turmaLinha}}*
Matéria: *{{materia}}*
Título: *{{titulo}}*
Professor: *{{professor}}*
Aluno: *{{alunoNome}}*
Horário: *{{horario}}*

Olá, *{{alunoNome}}*! Chegou a sua vez de fazer a saudação de hoje. Contamos com você!

*Texto sugerido (ler no início):*

*Modelo simples:*
*1. Cumprimento*
_“Bom dia, professor.” ou “Boa tarde, professor.”_

*2. Identificação da turma*
_“Somos a turma [nome ou curso].”_

*3. Situação de presença*
_“Hoje estamos com a turma completa.” ou “Hoje tivemos algumas ausências, mas a maioria está presente.”_

*4. Transição para a aula*
_“A turma está pronta para a aula. Pode começar quando quiser.”_

*Estrutura resumida:*
_Cumprimento → Turma → Presença → Passar a palavra_

*Exemplo pronto para usar:*
_“{{exemploPronto}}”_
*— {{alunoNome}} ({{materia}})*`

const DEFAULT_NO_CLASS_MESSAGE_FALLBACK = `*📢 Aviso da turma*

Turma: *{{turmaLinha}}*

{{cumprimento}}, pessoal.

*HOJE NÃO HAVERÁ AULA.*

Aproveitem este tempo para colocar os estudos em dia, revisar os conteúdos já vistos e reforçar os pontos que ainda geram dúvida.

Uma boa revisão hoje pode fazer diferença no entendimento das próximas aulas.

*Sigam firmes nos estudos. Constância e dedicação trazem resultado.*`

const DEFAULT_CUSTOM_MESSAGE_FALLBACK = `Olá, *{{alunoNome}}*!

Esta é uma mensagem personalizada do Saudação Bot.

Turma: *{{turmaLinha}}*
Matéria: *{{materia}}*
Professor: *{{professor}}*
Horário: *{{horario}}*`

const DEFAULT_MODEL_BY_EDITOR = {
  default: `Turma: *{{turmaLinha}}*
Matéria: *{{materia}}*
Título: *{{titulo}}*
Professor: *{{professor}}*
Aluno: *{{alunoNome}}*
Horário: *{{horario}}*

Olá, *{{alunoNome}}*!

Sua saudação de hoje será para a aula de *{{materia}}*.
Se desejar, você pode iniciar com:
_{{exemploPronto}}_

Bom envio!`,
  "no-class": `*📢 Aviso da turma*

Turma: *{{turmaLinha}}*

{{cumprimento}}, pessoal.

Informamos que *não haverá aula hoje*.

Use este período para revisar o conteúdo, organizar suas atividades e reforçar os pontos mais importantes.

*Mensagem da turma:*
{{aulaContexto}}`,
  custom: `Olá, *{{alunoNome}}*!

Segue uma mensagem personalizada da turma *{{turmaLinha}}*.

Matéria: *{{materia}}*
Professor: *{{professor}}*
Horário: *{{horario}}*

Mensagem:
{{aulaContexto}}`,
} as const

const PREVIEW_SAMPLE_DEFAULT = {
  turma: "RiseCode",
  instituicao: "AlphaTech",
  materia: "Redes e Internet",
  titulo: "DNS (Domain Name System)",
  professor: "Prof. Kenji",
  alunoNome: "Daniel Lucas",
  horario: "20:00",
  cumprimento: "Boa noite",
  aulaContexto: "Hoje nossa saudação é para a aula *DNS (Domain Name System)*, da matéria Redes e Internet.",
  exemploPronto:
    "Boa noite, professor(a) Prof. Kenji. Aqui é a turma RiseCode. Hoje nossa saudação é para a aula *DNS (Domain Name System)*, da matéria Redes e Internet. Hoje estamos com a maioria presente. A turma está pronta, pode começar quando quiser.",
  chatTime: "20:01",
} as const

const AVAILABLE_VARIABLES = [
  { token: "{{turma}}", description: "Nome da turma definido na configuração." },
  { token: "{{instituicao}}", description: "Nome da instituição definida na configuração." },
  { token: "{{turmaLinha}}", description: "Nome completo da turma com instituição." },
  { token: "{{materia}}", description: "Matéria da aula." },
  { token: "{{titulo}}", description: "Título do conteúdo da aula." },
  { token: "{{professor}}", description: "Nome do professor." },
  { token: "{{alunoNome}}", description: "Nome do aluno destinatário." },
  { token: "{{horario}}", description: "Horário da aula." },
  { token: "{{cumprimento}}", description: "Cumprimento automático conforme o horário." },
  { token: "{{aulaContexto}}", description: "Resumo curto do contexto da aula." },
  { token: "{{exemploPronto}}", description: "Exemplo pronto de saudação preenchido." },
]

function renderPreviewTemplate(template: string, previewSample: Record<string, string>) {
  return Object.entries(previewSample).reduce(
    (text, [token, value]) => text.split(`{{${token}}}`).join(value),
    String(template || "")
  )
}

function resolvePreviewMediaUrl(value: string) {
  const normalized = String(value || "").trim()
  if (!normalized) return ""
  if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith("data:")) return normalized
  return `/api/media-preview?path=${encodeURIComponent(normalized)}`
}

function normalizeCustomSendError(rawError: string, targetType: "student" | "group", recipient: string) {
  const message = String(rawError || "").trim()
  const normalized = message.toLowerCase()

  if (!message || normalized === "not_found") {
    return targetType === "group"
      ? `Não foi possível enviar para o grupo "${recipient}". Verifique se o backend foi reiniciado e se o grupo ainda existe no WhatsApp.`
      : `Não foi possível enviar para o aluno selecionado. Verifique se o backend foi reiniciado e se o cadastro do aluno está válido.`
  }

  if (normalized.includes("grupo não encontrado")) {
    return `Grupo não encontrado no WhatsApp: "${recipient}". Atualize a lista de grupos e selecione um destino válido.`
  }

  if (normalized.includes("sem whatsapp") || normalized.includes("whatsapp cadastrado")) {
    return `O aluno selecionado não possui WhatsApp cadastrado para receber a mensagem.`
  }

  if (normalized.includes("não há cliente do whatsapp conectado")) {
    return "O WhatsApp não está conectado no momento. Reconecte a sessão antes de enviar."
  }

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Não foi possível comunicar com o backend do painel para enviar a mensagem."
  }

  return message
}

function mediaByEditorType<T>(
  editorType: "default" | "no-class" | "custom",
  greetingValue: T,
  noClassValue: T,
  customValue: T
) {
  return editorType === "default" ? greetingValue : editorType === "no-class" ? noClassValue : customValue
}

export function MessagesModal({
  open,
  onClose,
  previewMode = false,
  initialEditorType = "default",
  initialTurma,
  initialInstituicao,
  initialDefaultMessage,
  initialNoClassMessage,
  initialCustomMessage,
  students = [],
  loggedStudentMatch,
  initialImagePath,
  initialMediaFileName,
  initialBannerTitle,
  initialGreetingImagePath,
  initialGreetingMediaFileName,
  initialGreetingBannerTitle,
  initialGreetingBackgroundColor,
  initialGreetingBackgroundImagePath,
  initialGreetingTextColor,
  initialNoClassImagePath,
  initialNoClassMediaFileName,
  initialNoClassBannerTitle,
  initialNoClassBackgroundColor,
  initialNoClassBackgroundImagePath,
  initialNoClassTextColor,
  initialCustomImagePath,
  initialCustomMediaFileName,
  initialCustomBannerTitle,
  initialCustomBackgroundColor,
  initialCustomBackgroundImagePath,
  initialCustomTextColor,
  onSaved,
}: MessagesModalProps) {
  const wasOpenRef = useRef(false)
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorType, setEditorType] = useState<"default" | "no-class" | "custom">("default")
  const [defaultMessage, setDefaultMessage] = useState(DEFAULT_MESSAGE_FALLBACK)
  const [noClassMessage, setNoClassMessage] = useState(DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
  const [customMessage, setCustomMessage] = useState(DEFAULT_CUSTOM_MESSAGE_FALLBACK)
  const [greetingImagePath, setGreetingImagePath] = useState("")
  const [greetingMediaFileName, setGreetingMediaFileName] = useState("")
  const [greetingBannerTitle, setGreetingBannerTitle] = useState("")
  const [greetingBackgroundColor, setGreetingBackgroundColor] = useState("#123d37")
  const [greetingBackgroundImagePath, setGreetingBackgroundImagePath] = useState("")
  const [greetingTextColor, setGreetingTextColor] = useState("#ffffff")
  const [noClassImagePath, setNoClassImagePath] = useState("")
  const [noClassMediaFileName, setNoClassMediaFileName] = useState("")
  const [noClassBannerTitle, setNoClassBannerTitle] = useState("")
  const [noClassBackgroundColor, setNoClassBackgroundColor] = useState("#123d37")
  const [noClassBackgroundImagePath, setNoClassBackgroundImagePath] = useState("")
  const [noClassTextColor, setNoClassTextColor] = useState("#ffffff")
  const [customImagePath, setCustomImagePath] = useState("")
  const [customMediaFileName, setCustomMediaFileName] = useState("")
  const [customBannerTitle, setCustomBannerTitle] = useState("")
  const [customBackgroundColor, setCustomBackgroundColor] = useState("#123d37")
  const [customBackgroundImagePath, setCustomBackgroundImagePath] = useState("")
  const [customTextColor, setCustomTextColor] = useState("#ffffff")
  const [modelHelpOpen, setModelHelpOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [variablesHelpOpen, setVariablesHelpOpen] = useState(false)
  const [scheduledMessagesOpen, setScheduledMessagesOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendCustomLoading, setSendCustomLoading] = useState(false)
  const [customTargetType, setCustomTargetType] = useState<"student" | "group">("student")
  const [customRecipient, setCustomRecipient] = useState("")
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsLoadError, setGroupsLoadError] = useState("")
  const [feedback, setFeedback] = useState("")

  const resetEditorState = () => {
    setEditorOpen(false)
    setEditorType("default")
    setFeedback("")
    setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
    setNoClassMessage(String(initialNoClassMessage || "").trim() || DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
    setCustomMessage(String(initialCustomMessage || "").trim() || DEFAULT_CUSTOM_MESSAGE_FALLBACK)
    setCustomTargetType("student")
    setCustomRecipient("")
    setGreetingImagePath(String(initialGreetingImagePath || initialImagePath || "").trim())
    setGreetingMediaFileName(String(initialGreetingMediaFileName || initialMediaFileName || "").trim())
    setGreetingBannerTitle(String(initialGreetingBannerTitle || initialBannerTitle || "").trim())
    setGreetingBackgroundColor(String(initialGreetingBackgroundColor || "#123d37").trim() || "#123d37")
    setGreetingBackgroundImagePath(String(initialGreetingBackgroundImagePath || "").trim())
    setGreetingTextColor(String(initialGreetingTextColor || "#ffffff").trim() || "#ffffff")
    setNoClassImagePath(String(initialNoClassImagePath || initialImagePath || "").trim())
    setNoClassMediaFileName(String(initialNoClassMediaFileName || initialMediaFileName || "").trim())
    setNoClassBannerTitle(String(initialNoClassBannerTitle || initialBannerTitle || "").trim())
    setNoClassBackgroundColor(String(initialNoClassBackgroundColor || "#123d37").trim() || "#123d37")
    setNoClassBackgroundImagePath(String(initialNoClassBackgroundImagePath || "").trim())
    setNoClassTextColor(String(initialNoClassTextColor || "#ffffff").trim() || "#ffffff")
    setCustomImagePath(String(initialCustomImagePath || initialImagePath || "").trim())
    setCustomMediaFileName(String(initialCustomMediaFileName || initialMediaFileName || "").trim())
    setCustomBannerTitle(String(initialCustomBannerTitle || initialBannerTitle || "").trim())
    setCustomBackgroundColor(String(initialCustomBackgroundColor || "#123d37").trim() || "#123d37")
    setCustomBackgroundImagePath(String(initialCustomBackgroundImagePath || "").trim())
    setCustomTextColor(String(initialCustomTextColor || "#ffffff").trim() || "#ffffff")
    setModelHelpOpen(false)
    setPreviewOpen(false)
    setVariablesHelpOpen(false)
  }

  const closeEditorToMessages = () => {
    resetEditorState()
  }

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setEditorOpen(initialEditorType === "custom")
      setEditorType(initialEditorType)
      setFeedback("")
      setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
      setNoClassMessage(String(initialNoClassMessage || "").trim() || DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
      setCustomMessage(String(initialCustomMessage || "").trim() || DEFAULT_CUSTOM_MESSAGE_FALLBACK)
      setCustomTargetType("student")
      setCustomRecipient("")
      setGreetingImagePath(String(initialGreetingImagePath || initialImagePath || "").trim())
      setGreetingMediaFileName(String(initialGreetingMediaFileName || initialMediaFileName || "").trim())
      setGreetingBannerTitle(String(initialGreetingBannerTitle || initialBannerTitle || "").trim())
      setGreetingBackgroundColor(String(initialGreetingBackgroundColor || "#123d37").trim() || "#123d37")
      setGreetingBackgroundImagePath(String(initialGreetingBackgroundImagePath || "").trim())
      setNoClassImagePath(String(initialNoClassImagePath || initialImagePath || "").trim())
      setNoClassMediaFileName(String(initialNoClassMediaFileName || initialMediaFileName || "").trim())
      setNoClassBannerTitle(String(initialNoClassBannerTitle || initialBannerTitle || "").trim())
      setNoClassBackgroundColor(String(initialNoClassBackgroundColor || "#123d37").trim() || "#123d37")
      setNoClassBackgroundImagePath(String(initialNoClassBackgroundImagePath || "").trim())
      setCustomImagePath(String(initialCustomImagePath || initialImagePath || "").trim())
      setCustomMediaFileName(String(initialCustomMediaFileName || initialMediaFileName || "").trim())
      setCustomBannerTitle(String(initialCustomBannerTitle || initialBannerTitle || "").trim())
      setCustomBackgroundColor(String(initialCustomBackgroundColor || "#123d37").trim() || "#123d37")
      setCustomBackgroundImagePath(String(initialCustomBackgroundImagePath || "").trim())
      setModelHelpOpen(false)
      setPreviewOpen(false)
      setVariablesHelpOpen(false)
    }
    wasOpenRef.current = open
  }, [open, initialEditorType, initialDefaultMessage, initialNoClassMessage, initialCustomMessage, initialImagePath, initialMediaFileName, initialBannerTitle, initialGreetingImagePath, initialGreetingMediaFileName, initialGreetingBannerTitle, initialGreetingBackgroundColor, initialGreetingBackgroundImagePath, initialGreetingTextColor, initialNoClassImagePath, initialNoClassMediaFileName, initialNoClassBannerTitle, initialNoClassBackgroundColor, initialNoClassBackgroundImagePath, initialNoClassTextColor, initialCustomImagePath, initialCustomMediaFileName, initialCustomBannerTitle, initialCustomBackgroundColor, initialCustomBackgroundImagePath, initialCustomTextColor, students])

  useEffect(() => {
    if (!open) return
    setGroupsLoading(true)
    setGroupsLoadError("")
    fetch("/api/groups")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Não foi possível carregar os grupos.")
        }
        const payload = await res.json()
        const list = Array.isArray(payload?.groups) ? payload.groups : []
        setGroups(
          list
            .map((item: { id?: string; name?: string }) => ({
              id: String(item?.id || ""),
              name: String(item?.name || ""),
            }))
            .filter((item: GroupOption) => item.name)
        )
        setGroupsLoadError("")
      })
      .catch(() => {
        setGroups([])
        setGroupsLoadError("Não foi possível carregar os grupos agora.")
      })
      .finally(() => setGroupsLoading(false))
  }, [open])

  async function persistMessagesConfig() {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultGreetingMessage: defaultMessage,
        defaultNoClassMessage: noClassMessage,
        customMessageTemplate: customMessage,
        greetingImagePath,
        greetingMediaFileName,
        greetingBannerTitle,
        greetingBackgroundColor,
        greetingBackgroundImagePath,
        greetingTextColor,
        noClassImagePath,
        noClassMediaFileName,
        noClassBannerTitle,
        noClassBackgroundColor,
        noClassBackgroundImagePath,
        noClassTextColor,
        customImagePath,
        customMediaFileName,
        customBannerTitle,
        customBackgroundColor,
        customBackgroundImagePath,
        customTextColor,
      }),
    })
    const payload = await res.json()
    if (!res.ok) {
      throw new Error(String(payload?.error || "Falha ao salvar mensagem."))
    }
    return payload
  }

  async function handleSaveDefaultMessage(closeAfterSave = true) {
    setLoading(true)
    setFeedback("")
    try {
      const payload = await persistMessagesConfig()
      if (onSaved) await onSaved()
      if (closeAfterSave) {
        closeEditorToMessages()
      }
      setFeedback(String(payload?.message || "Mensagem padrão salva com sucesso."))
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar mensagem."))
    } finally {
      setLoading(false)
    }
  }

  async function handleSendCustomMessage() {
    if (!customRecipient.trim()) {
      setFeedback("Selecione o destinatário da mensagem personalizada.")
      return
    }
    setSendCustomLoading(true)
    setFeedback("")
    try {
      await persistMessagesConfig()
      if (onSaved) await onSaved()
      const res = await fetch("/api/send-custom-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: customTargetType,
          targetValue: customRecipient,
          template: customMessage,
          imagePath: customImagePath,
          mediaFileName: customMediaFileName,
          bannerTitle: customBannerTitle,
          imageStyle: "banner",
          backgroundColor: customBackgroundColor,
          backgroundImagePath: customBackgroundImagePath,
          textColor: customTextColor,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(
          normalizeCustomSendError(
            String(payload?.error || ""),
            customTargetType,
            customRecipient
          )
        )
      }
      if (onSaved) await onSaved()
      setFeedback(String(payload?.message || "Mensagem personalizada enviada com sucesso."))
    } catch (error) {
      setFeedback(
        normalizeCustomSendError(
          String((error as Error)?.message || ""),
          customTargetType,
          customRecipient
        )
      )
    } finally {
      setSendCustomLoading(false)
    }
  }

  const currentEditorTitle =
    editorType === "default"
      ? "Editor da mensagem padrão"
      : editorType === "no-class"
        ? "Editor da mensagem sem aula"
        : "Editor da mensagem personalizada"
  const currentEditorSubtitle =
    editorType === "default"
      ? "Edite o conteúdo enviado nas saudações dos alunos"
      : editorType === "no-class"
        ? "Edite o conteúdo padrão enviado quando não houver aula"
        : "Edite uma mensagem personalizada para uso manual"
  const currentMessage =
    editorType === "default" ? defaultMessage : editorType === "no-class" ? noClassMessage : customMessage
  const setCurrentMessage =
    editorType === "default" ? setDefaultMessage : editorType === "no-class" ? setNoClassMessage : setCustomMessage
  const currentImagePath = mediaByEditorType(editorType, greetingImagePath, noClassImagePath, customImagePath)
  const currentMediaFileName = mediaByEditorType(
    editorType,
    greetingMediaFileName,
    noClassMediaFileName,
    customMediaFileName
  )
  const currentBannerTitle = mediaByEditorType(
    editorType,
    greetingBannerTitle,
    noClassBannerTitle,
    customBannerTitle
  )
  const currentBackgroundColor = mediaByEditorType(
    editorType,
    greetingBackgroundColor,
    noClassBackgroundColor,
    customBackgroundColor
  )
  const currentBackgroundImagePath = mediaByEditorType(
    editorType,
    greetingBackgroundImagePath,
    noClassBackgroundImagePath,
    customBackgroundImagePath
  )
  const currentTextColor = mediaByEditorType(
    editorType,
    greetingTextColor,
    noClassTextColor,
    customTextColor
  )
  const hasBackgroundColor = Boolean(String(currentBackgroundColor || "").trim())
  const colorPickerValue = currentBackgroundColor || "#123d37"
  const currentImagePreviewUrl = resolvePreviewMediaUrl(currentImagePath)
  const currentBackgroundImagePreviewUrl = resolvePreviewMediaUrl(currentBackgroundImagePath)
  const loggedStudentWhatsappDigits = String(loggedStudentMatch?.whatsapp || "").replace(/\D/g, "")
  const studentsWithWhatsapp = (students || []).filter((student) =>
    Boolean(String(student?.whatsapp || "").trim()) &&
    String(student?.whatsapp || "").replace(/\D/g, "") !== loggedStudentWhatsappDigits
  )
  useEffect(() => {
    if (customTargetType !== "student") return
    if (!customRecipient) return
    const stillAvailable = studentsWithWhatsapp.some(
      (student) => String(student?.nome || "") === customRecipient
    )
    if (!stillAvailable) {
      setCustomRecipient("")
    }
  }, [customTargetType, customRecipient, studentsWithWhatsapp])
  const setCurrentImagePath = (value: string) => {
    if (editorType === "default") setGreetingImagePath(value)
    else if (editorType === "no-class") setNoClassImagePath(value)
    else setCustomImagePath(value)
  }
  const setCurrentMediaFileName = (value: string) => {
    if (editorType === "default") setGreetingMediaFileName(value)
    else if (editorType === "no-class") setNoClassMediaFileName(value)
    else setCustomMediaFileName(value)
  }
  const setCurrentBannerTitle = (value: string) => {
    if (editorType === "default") setGreetingBannerTitle(value)
    else if (editorType === "no-class") setNoClassBannerTitle(value)
    else setCustomBannerTitle(value)
  }
  const setCurrentBackgroundColor = (value: string) => {
    if (editorType === "default") setGreetingBackgroundColor(value)
    else if (editorType === "no-class") setNoClassBackgroundColor(value)
    else setCustomBackgroundColor(value)
  }
  const setCurrentBackgroundImagePath = (value: string) => {
    if (editorType === "default") setGreetingBackgroundImagePath(value)
    else if (editorType === "no-class") setNoClassBackgroundImagePath(value)
    else setCustomBackgroundImagePath(value)
  }
  const setCurrentTextColor = (value: string) => {
    if (editorType === "default") setGreetingTextColor(value)
    else if (editorType === "no-class") setNoClassTextColor(value)
    else setCustomTextColor(value)
  }
  const hasMessageContent = Boolean(String(currentMessage || "").trim())
  const canSendCustomMessage =
    editorType === "custom" &&
    Boolean(String(customImagePath || "").trim()) &&
    Boolean(String(customBannerTitle || "").trim()) &&
    Boolean(String(customMediaFileName || "").trim()) &&
    Boolean(String(customTargetType || "").trim()) &&
    Boolean(String(customRecipient || "").trim()) &&
    Boolean(String(customMessage || "").trim()) &&
    !(customTargetType === "group" && groupsLoading)
  const previewTurma = String(initialTurma || "").trim() || PREVIEW_SAMPLE_DEFAULT.turma
  const previewInstituicao = String(initialInstituicao || "").trim() || PREVIEW_SAMPLE_DEFAULT.instituicao
  const previewSample = {
    ...PREVIEW_SAMPLE_DEFAULT,
    turma: previewTurma,
    instituicao: previewInstituicao,
    turmaLinha: [previewTurma, previewInstituicao].filter(Boolean).join(" — "),
  }

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        previewMode={previewMode}
        title="Mensagens"
        subtitle="Mensagem padrão e mensagens de avisos"
        icon={<MessagesSquare size={16} className="text-primary" />}
        size="lg"
      >
        <div className="flex flex-col gap-4 px-6 py-6">
          <button
            type="button"
            onClick={() => {
              setEditorType("default")
              setEditorOpen(true)
              setFeedback("")
            }}
            className="rounded-2xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageCircleMore size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Mensagem padrão</h3>
              </div>
              <Pencil size={14} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Clique para abrir, editar e salvar o texto atual enviado nas saudações dos alunos.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorType("no-class")
              setEditorOpen(true)
              setFeedback("")
            }}
            className="rounded-2xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Mensagem sem aula</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Clique para editar a mensagem padrão usada quando não houver aula.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorType("custom")
              setEditorOpen(true)
              setFeedback("")
            }}
            className="rounded-2xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <MessagesSquare size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Mensagem personalizada</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Clique para montar um terceiro modelo de mensagem customizada.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setScheduledMessagesOpen(true)
              setFeedback("")
            }}
            className="rounded-2xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <MessagesSquare size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Mensagens programadas</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Agende mensagens independentes do ciclo para um grupo específico, com data e hora definidas.
            </p>
          </button>

          {feedback ? (
            <p className={`text-sm ${feedback.toLowerCase().includes("falha") ? "text-destructive" : "text-primary"}`}>
              {feedback}
            </p>
          ) : null}
        </div>

        <ModalActions
          onCancel={onClose}
          onConfirm={onClose}
          confirmLabel="Fechar"
          cancelLabel=""
          loading={false}
        />
      </ModalShell>

      <ModalShell
        open={editorOpen}
        onClose={closeEditorToMessages}
        title={currentEditorTitle}
        subtitle={currentEditorSubtitle}
        icon={<Pencil size={16} className="text-primary" />}
        size="xl"
      >
        <div className="px-6 py-6">
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mídia do envio
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr_1.15fr_1fr_1.15fr_1.15fr]">
              <UnderlineInput
                label="Banner / imagem"
                value={currentImagePath}
                onChange={setCurrentImagePath}
                placeholder="https://site/imagem.jpg"
                hint="Aceita arquivo local ou link. Se não alterar, o banner atual continua sendo usado."
              />
              <UnderlineInput
                label="Imagem de fundo"
                value={currentBackgroundImagePath}
                onChange={setCurrentBackgroundImagePath}
                placeholder="https://site/fundo.jpg"
                hint="Opcional. Usa esta imagem no fundo do banner."
              />
              <UnderlineInput
                label="Título do banner"
                value={currentBannerTitle}
                onChange={setCurrentBannerTitle}
                placeholder="Ex.: 🤖 Saudação de hoje"
                hint="Texto exibido ao lado da imagem no banner gerado."
              />
              <UnderlineInput
                label="Nome do arquivo"
                value={currentMediaFileName}
                onChange={setCurrentMediaFileName}
                placeholder="Ex.: Saudacao-RiseCode.png"
                hint="Opcional. Define o nome do arquivo quando a mídia for enviada."
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cor de fundo
                </label>
                <div
                  className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left transition-colors hover:border-primary"
                >
                  <input
                    type="color"
                    value={colorPickerValue}
                    onChange={(e) => setCurrentBackgroundColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-sm text-foreground">{currentBackgroundColor || "#123d37"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Define a cor do fundo do banner desta mensagem.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cor do texto
                </label>
                <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left transition-colors hover:border-primary">
                  <input
                    type="color"
                    value={currentTextColor || "#ffffff"}
                    onChange={(e) => setCurrentTextColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-sm text-foreground">{currentTextColor || "#ffffff"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Define a cor do texto exibido no banner desta mensagem.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Texto da mensagem
              </p>
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Edite o conteúdo que será enviado aos alunos.
                </p>
                <button
                  type="button"
                  onClick={() => setModelHelpOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <FileText size={15} />
                  Modelo
                </button>
                <button
                  type="button"
                  onClick={() => setVariablesHelpOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <CircleHelp size={15} />
                  Variáveis
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen((current) => !current)}
                  disabled={!hasMessageContent}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye size={15} />
                  {previewOpen ? "Ocultar prévia" : "Pré-visualizar"}
                </button>
              </div>
            </div>
          </div>
          <WhatsAppFormattingToolbar
            value={currentMessage}
            onChange={setCurrentMessage}
            textareaRef={editorTextareaRef}
          />
          <textarea
            ref={editorTextareaRef}
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            className="mt-3 min-h-[220px] w-full rounded-2xl border border-input bg-background px-4 py-4 font-mono text-[15px] leading-7 text-foreground outline-none transition-colors focus:border-primary"
          />

          {editorType === "custom" ? (
            <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Destinatário
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Tipo
                    </label>
                    <select
                      value={customTargetType}
                      onChange={(e) => {
                        const nextType = e.target.value as "student" | "group"
                        setCustomTargetType(nextType)
                        setCustomRecipient("")
                      }}
                      className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
                    >
                      <option value="student">Aluno</option>
                      <option value="group">Grupo</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {customTargetType === "student" ? "Aluno" : "Grupo"}
                    </label>
                    <select
                      value={customRecipient}
                      onChange={(e) => setCustomRecipient(e.target.value)}
                      disabled={customTargetType === "group" && groupsLoading}
                      className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
                    >
                      <option value="">
                        {customTargetType === "student"
                          ? "Selecione um aluno"
                          : groupsLoading
                            ? "Carregando grupos..."
                            : "Selecione um grupo"}
                      </option>
                      {customTargetType === "student"
                        ? studentsWithWhatsapp.map((student, idx) => (
                            <option key={`${student?.nome || "student"}-${idx}`} value={String(student?.nome || "")}>
                              {String(student?.nome || "Aluno")} • {String(student?.whatsapp || "")}
                            </option>
                          ))
                        : groups.map((group, idx) => (
                            <option key={`${group.id || group.name}-${idx}`} value={group.name}>
                              {group.name}
                            </option>
                          ))}
                    </select>
                    {customTargetType === "group" ? (
                      <p className="text-[11px] text-muted-foreground">
                        {groupsLoading
                          ? "Buscando grupos do WhatsApp..."
                          : groupsLoadError
                            ? groupsLoadError
                            : `${groups.length} grupo(s) disponível(is).`}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendCustomMessage}
                  disabled={sendCustomLoading || !canSendCustomMessage}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-green-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendCustomLoading
                    ? "Enviando..."
                    : customTargetType === "student"
                      ? "Enviar para aluno"
                      : "Enviar para grupo"}
                </button>
              </div>
            </div>
          ) : null}
          {feedback ? (
            <p
              className={`mt-4 text-sm ${
                /falha|não foi possível|não possui|não está conectado|não encontrado/i.test(feedback)
                  ? "text-destructive"
                  : "text-primary"
              }`}
            >
              {feedback}
            </p>
          ) : null}
        </div>
        <ModalActions
          onCancel={closeEditorToMessages}
          onSecondaryConfirm={() => handleSaveDefaultMessage(false)}
          secondaryConfirmLabel="Salvar e continuar"
          onConfirm={() => handleSaveDefaultMessage(true)}
          confirmLabel="Salvar e fechar"
          cancelLabel="Cancelar"
          loading={loading}
        />
      </ModalShell>

      <ModalShell
        open={modelHelpOpen}
        onClose={() => setModelHelpOpen(false)}
        title="Modelo de mensagem"
        subtitle="Use este exemplo como base e adapte o texto com as variáveis"
        icon={<FileText size={16} className="text-primary" />}
        size="lg"
      >
        <div className="px-6 py-6">
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Modelo sugerido
            </p>
            <textarea
              readOnly
              value={DEFAULT_MODEL_BY_EDITOR[editorType]}
              className="mt-3 min-h-[260px] w-full rounded-2xl border border-input bg-background px-4 py-4 font-mono text-[15px] leading-7 text-foreground outline-none"
            />
          </div>
        </div>
        <ModalActions
          onCancel={() => setModelHelpOpen(false)}
          onConfirm={() => {
            setCurrentMessage(DEFAULT_MODEL_BY_EDITOR[editorType])
            setModelHelpOpen(false)
          }}
          confirmLabel="Usar modelo"
          cancelLabel="Fechar"
        />
      </ModalShell>

      <ModalShell
        open={variablesHelpOpen}
        onClose={() => setVariablesHelpOpen(false)}
        title="Variáveis disponíveis"
        subtitle="Use estes placeholders no texto da mensagem"
        icon={<CircleHelp size={16} className="text-primary" />}
        size="xs"
        bodyClassName="max-h-[48vh] overflow-y-auto"
      >
        <div className="space-y-2 px-4 py-4">
          {AVAILABLE_VARIABLES.map((item) => (
            <div key={item.token} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <p className="font-mono text-[13px] font-semibold text-foreground">{item.token}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <ModalActions
          onCancel={() => setVariablesHelpOpen(false)}
          onConfirm={() => setVariablesHelpOpen(false)}
          confirmLabel="Fechar"
          cancelLabel=""
        />
      </ModalShell>

      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Pré-visualização"
        subtitle="Exemplo com dados fictícios de aluno, aula e professor"
        icon={<Eye size={16} className="text-primary" />}
        size="lg"
      >
        <div className="flex justify-center px-6 py-6">
          <div className="w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-border bg-[#e7ded0] shadow-sm">
            <div className="flex items-center justify-between bg-[#0b141a] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202c33] text-sm font-semibold">
                  SB
                </div>
                <div>
                  <p className="text-sm font-semibold">Saudação Bot</p>
                  <p className="text-xs text-white/70">Prévia da mensagem para {previewSample.alunoNome}</p>
                </div>
              </div>
              <div className="text-right text-[11px] text-white/65">
                <p>{previewSample.chatTime}</p>
              </div>
            </div>

            <div
              className="space-y-4 px-4 py-5"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            >
              <div className="mx-auto w-fit rounded-full bg-white/75 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                Hoje
              </div>

              <div className="ml-auto max-w-[88%] rounded-[18px] rounded-tr-md bg-[#d9fdd3] px-4 py-3 text-[#111b21] shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                <div
                  className="relative mb-3 min-h-[300px] overflow-hidden rounded-2xl border border-emerald-300/50"
                  style={{
                    backgroundColor: currentBackgroundColor || "#123d37",
                  }}
                >
                  {currentBackgroundImagePreviewUrl ? (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${currentBackgroundImagePreviewUrl})`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                          filter: "blur(10px)",
                          transform: "scale(1.12)",
                          opacity: 0.32,
                        }}
                      />
                      <img
                        src={currentBackgroundImagePreviewUrl}
                        alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ transform: "scale(1.08)" }}
                          referrerPolicy="no-referrer"
                        />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,25,33,0.10),rgba(7,25,33,0.28))]" />
                  )}
                  <div className="relative flex min-h-[300px] items-start gap-5 rounded-2xl px-4 py-4">
                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/55 bg-white/10 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                      {currentImagePreviewUrl ? (
                        <img
                          src={currentImagePreviewUrl}
                          alt="Banner"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10 text-lg font-semibold text-white">
                          SB
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                        <p
                          className="line-clamp-3 font-serif text-[34px] font-bold leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                          style={{ color: currentTextColor || "#ffffff" }}
                        >
                          {currentBannerTitle || "🤖 Saudação de hoje"}
                        </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80">
                        <span>{currentMediaFileName || "nome automático"}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-full border border-white/60"
                            style={{ backgroundColor: currentBackgroundColor }}
                          />
                          {currentBackgroundColor}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-3 rounded-2xl border border-emerald-200/80 bg-white/55 px-3 py-2 text-xs text-slate-600">
                  <p>
                    Banner: <span className="font-medium text-slate-800">{currentImagePath || "padrão atual"}</span>
                  </p>
                  <p className="mt-1">
                    Fundo: <span className="font-medium text-slate-800">{currentBackgroundImagePath || "sem imagem"}</span>
                  </p>
                </div>

                <pre className="whitespace-pre-wrap break-words bg-transparent p-0 text-sm leading-6 text-[#111b21]">
                  {renderPreviewTemplate(currentMessage, previewSample)}
                </pre>

                <div className="mt-2 text-right text-[11px] text-slate-500">
                  {previewSample.chatTime}
                </div>
              </div>
            </div>
          </div>
        </div>
        <ModalActions
          onCancel={() => setPreviewOpen(false)}
          onConfirm={() => setPreviewOpen(false)}
          confirmLabel="Fechar"
          cancelLabel=""
        />
      </ModalShell>

      <ScheduledMessagesModal
        open={scheduledMessagesOpen}
        onClose={() => setScheduledMessagesOpen(false)}
        previewMode={previewMode}
        groups={groups}
        onSaved={onSaved}
      />
    </>
  )
}
