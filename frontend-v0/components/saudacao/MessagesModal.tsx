"use client"

import { useEffect, useState } from "react"
import { Eye, MessagesSquare, Megaphone, MessageCircleMore, Pencil } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput } from "./ModalShell"

interface MessagesModalProps {
  open: boolean
  onClose: () => void
  initialDefaultMessage?: string
  initialNoClassMessage?: string
  initialCustomMessage?: string
  initialImagePath?: string
  initialMediaFileName?: string
  onSaved?: () => Promise<void> | void
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

const PREVIEW_SAMPLE = {
  turmaLinha: "RiseCode — AlphaTech",
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
}

function renderPreviewTemplate(template: string) {
  return Object.entries(PREVIEW_SAMPLE).reduce(
    (text, [token, value]) => text.split(`{{${token}}}`).join(value),
    String(template || "")
  )
}

export function MessagesModal({
  open,
  onClose,
  initialDefaultMessage,
  initialNoClassMessage,
  initialCustomMessage,
  initialImagePath,
  initialMediaFileName,
  onSaved,
}: MessagesModalProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorType, setEditorType] = useState<"default" | "no-class" | "custom">("default")
  const [defaultMessage, setDefaultMessage] = useState(DEFAULT_MESSAGE_FALLBACK)
  const [noClassMessage, setNoClassMessage] = useState(DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
  const [customMessage, setCustomMessage] = useState(DEFAULT_CUSTOM_MESSAGE_FALLBACK)
  const [imagePath, setImagePath] = useState("")
  const [mediaFileName, setMediaFileName] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    if (!open) return
    setEditorOpen(false)
    setEditorType("default")
    setFeedback("")
    setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
    setNoClassMessage(String(initialNoClassMessage || "").trim() || DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
    setCustomMessage(String(initialCustomMessage || "").trim() || DEFAULT_CUSTOM_MESSAGE_FALLBACK)
    setImagePath(String(initialImagePath || "").trim())
    setMediaFileName(String(initialMediaFileName || "").trim())
    setPreviewOpen(false)
  }, [open, initialDefaultMessage, initialNoClassMessage, initialCustomMessage, initialImagePath, initialMediaFileName])

  async function handleSaveDefaultMessage() {
    setLoading(true)
    setFeedback("")
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultGreetingMessage:
            editorType === "default"
              ? defaultMessage
              : String(initialDefaultMessage || "").trim(),
          defaultNoClassMessage:
            editorType === "no-class"
              ? noClassMessage
              : String(initialNoClassMessage || "").trim(),
          customMessageTemplate:
            editorType === "custom"
              ? customMessage
              : String(initialCustomMessage || "").trim(),
          imagePath,
          mediaFileName,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(String(payload?.error || "Falha ao salvar mensagem."))
      }
      if (onSaved) await onSaved()
      setEditorOpen(false)
      setFeedback(String(payload?.message || "Mensagem padrão salva com sucesso."))
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar mensagem."))
    } finally {
      setLoading(false)
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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
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
        cancelLabel="Fechar"
        loading={false}
      />

      <ModalShell
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditorType("default")
          setFeedback("")
          setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
          setNoClassMessage(String(initialNoClassMessage || "").trim() || DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
          setCustomMessage(String(initialCustomMessage || "").trim() || DEFAULT_CUSTOM_MESSAGE_FALLBACK)
          setImagePath(String(initialImagePath || "").trim())
          setMediaFileName(String(initialMediaFileName || "").trim())
          setPreviewOpen(false)
        }}
        title={currentEditorTitle}
        subtitle={currentEditorSubtitle}
        icon={<Pencil size={16} className="text-primary" />}
        size="lg"
      >
        <div className="px-6 py-6">
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mídia do envio
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <UnderlineInput
                label="Banner / imagem"
                value={imagePath}
                onChange={setImagePath}
                placeholder="Ex.: risecode.png, /caminho/banner.png ou https://site/imagem.jpg"
                hint="Aceita arquivo local ou link. Se não alterar, o banner atual continua sendo usado."
              />
              <UnderlineInput
                label="Nome do arquivo"
                value={mediaFileName}
                onChange={setMediaFileName}
                placeholder="Ex.: Saudacao-RiseCode.png"
                hint="Opcional. Define o nome do arquivo quando a mídia for enviada."
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Variáveis disponíveis
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{turmaLinha}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{materia}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{titulo}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{professor}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{alunoNome}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{horario}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{cumprimento}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{aulaContexto}}'}</code>
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{'{{exemploPronto}}'}</code>
                </div>
              </div>
              <div className="md:pt-5">
                <button
                  type="button"
                  onClick={() => setPreviewOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Eye size={15} />
                  {previewOpen ? "Ocultar prévia" : "Pré-visualizar"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Texto da mensagem
              </p>
              <p className="text-xs text-muted-foreground">
                Edite o conteúdo que será enviado aos alunos.
              </p>
            </div>
          </div>
          <textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            className="min-h-[220px] w-full rounded-2xl border border-input bg-background px-4 py-4 font-mono text-[15px] leading-7 text-foreground outline-none transition-colors focus:border-primary"
          />
          {feedback ? (
            <p className={`mt-4 text-sm ${feedback.toLowerCase().includes("falha") ? "text-destructive" : "text-primary"}`}>
              {feedback}
            </p>
          ) : null}
        </div>
        <ModalActions
          onCancel={() => {
            setEditorOpen(false)
            setEditorType("default")
            setFeedback("")
            setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
            setNoClassMessage(String(initialNoClassMessage || "").trim() || DEFAULT_NO_CLASS_MESSAGE_FALLBACK)
            setCustomMessage(String(initialCustomMessage || "").trim() || DEFAULT_CUSTOM_MESSAGE_FALLBACK)
            setImagePath(String(initialImagePath || "").trim())
            setMediaFileName(String(initialMediaFileName || "").trim())
            setPreviewOpen(false)
          }}
          onConfirm={handleSaveDefaultMessage}
          confirmLabel="Salvar mensagem"
          cancelLabel="Cancelar"
          loading={loading}
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
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-border bg-[#e7ded0] shadow-sm">
            <div className="flex items-center justify-between bg-[#0b141a] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202c33] text-sm font-semibold">
                  SB
                </div>
                <div>
                  <p className="text-sm font-semibold">Saudação Bot</p>
                  <p className="text-xs text-white/70">Prévia da mensagem para {PREVIEW_SAMPLE.alunoNome}</p>
                </div>
              </div>
              <div className="text-right text-[11px] text-white/65">
                <p>{PREVIEW_SAMPLE.chatTime}</p>
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
                <div className="mb-3 rounded-2xl border border-emerald-200/80 bg-white/55 px-3 py-2 text-xs text-slate-600">
                  <p>
                    Banner: <span className="font-medium text-slate-800">{imagePath || "padrão atual"}</span>
                  </p>
                  <p className="mt-1">
                    Arquivo: <span className="font-medium text-slate-800">{mediaFileName || "nome automático"}</span>
                  </p>
                </div>

                <pre className="whitespace-pre-wrap break-words bg-transparent p-0 text-sm leading-6 text-[#111b21]">
                  {renderPreviewTemplate(currentMessage)}
                </pre>

                <div className="mt-2 text-right text-[11px] text-slate-500">
                  {PREVIEW_SAMPLE.chatTime}
                </div>
              </div>
            </div>
          </div>
        </div>
        <ModalActions
          onCancel={() => setPreviewOpen(false)}
          onConfirm={() => setPreviewOpen(false)}
          confirmLabel="Fechar"
          cancelLabel="Voltar"
        />
      </ModalShell>
    </ModalShell>
  )
}
