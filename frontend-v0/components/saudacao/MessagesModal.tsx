"use client"

import { useEffect, useState } from "react"
import { MessagesSquare, Megaphone, MessageCircleMore, Pencil } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput } from "./ModalShell"

interface MessagesModalProps {
  open: boolean
  onClose: () => void
  initialDefaultMessage?: string
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

export function MessagesModal({
  open,
  onClose,
  initialDefaultMessage,
  initialImagePath,
  initialMediaFileName,
  onSaved,
}: MessagesModalProps) {
  const [editingDefault, setEditingDefault] = useState(false)
  const [defaultMessage, setDefaultMessage] = useState(DEFAULT_MESSAGE_FALLBACK)
  const [imagePath, setImagePath] = useState("")
  const [mediaFileName, setMediaFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    if (!open) return
    setEditingDefault(false)
    setFeedback("")
    setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
    setImagePath(String(initialImagePath || "").trim())
    setMediaFileName(String(initialMediaFileName || "").trim())
  }, [open, initialDefaultMessage, initialImagePath, initialMediaFileName])

  async function handleSaveDefaultMessage() {
    setLoading(true)
    setFeedback("")
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultGreetingMessage: defaultMessage,
          imagePath,
          mediaFileName,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(String(payload?.error || "Falha ao salvar mensagem."))
      }
      if (onSaved) await onSaved()
      setEditingDefault(false)
      setFeedback(String(payload?.message || "Mensagem padrão salva com sucesso."))
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar mensagem."))
    } finally {
      setLoading(false)
    }
  }

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
            setEditingDefault(true)
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

        {editingDefault ? (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Editor da mensagem padrão</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <UnderlineInput
                label="Banner / imagem"
                value={imagePath}
                onChange={setImagePath}
                placeholder="Ex.: risecode.png ou /caminho/banner.png"
                hint="Se mantiver como está, o banner atual continua sendo usado no envio."
              />
              <UnderlineInput
                label="Nome do arquivo"
                value={mediaFileName}
                onChange={setMediaFileName}
                placeholder="Ex.: Saudacao-RiseCode.png"
                hint="Opcional. Define o nome do arquivo quando a mídia for enviada."
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Variáveis disponíveis: <code>{'{{turmaLinha}}'}</code>, <code>{'{{materia}}'}</code>, <code>{'{{titulo}}'}</code>, <code>{'{{professor}}'}</code>, <code>{'{{alunoNome}}'}</code>, <code>{'{{horario}}'}</code>, <code>{'{{cumprimento}}'}</code>, <code>{'{{aulaContexto}}'}</code>, <code>{'{{exemploPronto}}'}</code>.
            </p>
            <textarea
              value={defaultMessage}
              onChange={(e) => setDefaultMessage(e.target.value)}
              className="mt-3 min-h-[320px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </section>
        ) : null}

        <section className="rounded-2xl border border-border bg-muted/20 p-4 opacity-80">
          <div className="flex items-center gap-2">
            <Megaphone size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Mensagens de avisos</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Área reservada para mensagens complementares, lembretes e avisos operacionais.
          </p>
        </section>

        {feedback ? (
          <p className={`text-sm ${feedback.toLowerCase().includes("falha") ? "text-destructive" : "text-primary"}`}>
            {feedback}
          </p>
        ) : null}
      </div>

      <ModalActions
        onCancel={() => {
          if (editingDefault) {
            setEditingDefault(false)
            setFeedback("")
            setDefaultMessage(String(initialDefaultMessage || "").trim() || DEFAULT_MESSAGE_FALLBACK)
            setImagePath(String(initialImagePath || "").trim())
            setMediaFileName(String(initialMediaFileName || "").trim())
            return
          }
          onClose()
        }}
        onConfirm={editingDefault ? handleSaveDefaultMessage : onClose}
        confirmLabel={editingDefault ? "Salvar mensagem" : "Fechar"}
        cancelLabel={editingDefault ? "Cancelar" : "Fechar"}
        loading={loading}
      />
    </ModalShell>
  )
}
