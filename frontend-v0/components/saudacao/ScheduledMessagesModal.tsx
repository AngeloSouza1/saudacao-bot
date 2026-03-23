"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Pencil, Trash2, XCircle } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput } from "./ModalShell"

interface ScheduledMessageItem {
  id: string
  title?: string
  groupName?: string
  template?: string
  scheduledDate?: string
  scheduledTime?: string
  scheduledAt?: string
  status?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  sentAt?: string | null
  error?: string
}

interface ScheduledMessagesModalProps {
  open: boolean
  onClose: () => void
  previewMode?: boolean
  groups?: Array<{ id?: string; name?: string }>
  onSaved?: () => Promise<void> | void
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

function formatPtBr(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString("pt-BR")
}

export function ScheduledMessagesModal({
  open,
  onClose,
  previewMode = false,
  groups = [],
  onSaved,
}: ScheduledMessagesModalProps) {
  const [items, setItems] = useState<ScheduledMessageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [editingId, setEditingId] = useState("")
  const [title, setTitle] = useState("")
  const [groupName, setGroupName] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [template, setTemplate] = useState("")

  const sortedGroups = useMemo(
    () =>
      Array.from(
        new Set(groups.map((group) => String(group?.name || "").trim()).filter(Boolean))
      ).sort(),
    [groups]
  )

  async function loadItems() {
    setLoading(true)
    try {
      const payload = await fetchJson<{ items?: ScheduledMessageItem[] }>("/api/scheduled-messages")
      setItems(Array.isArray(payload?.items) ? payload.items : [])
      setFeedback("")
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao carregar mensagens programadas."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadItems()
  }, [open])

  function resetForm() {
    setEditingId("")
    setTitle("")
    setGroupName("")
    setScheduledDate("")
    setScheduledTime("")
    setTemplate("")
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetchJson("/api/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          title,
          groupName,
          scheduledDate,
          scheduledTime,
          template,
        }),
      })
      resetForm()
      await loadItems()
      if (onSaved) await onSaved()
      setFeedback("Mensagem programada salva com sucesso.")
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar mensagem programada."))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: string) {
    try {
      await fetchJson("/api/scheduled-messages/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await loadItems()
      if (onSaved) await onSaved()
      setFeedback("Mensagem programada cancelada.")
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao cancelar mensagem programada."))
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetchJson("/api/scheduled-messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await loadItems()
      if (onSaved) await onSaved()
      setFeedback("Mensagem programada excluída.")
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao excluir mensagem programada."))
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      previewMode={previewMode}
      title="Mensagens programadas"
      subtitle="Agende mensagens por data e hora, sem vínculo com alunos"
      icon={<CalendarClock size={16} className="text-primary" />}
      size="xl"
    >
      <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Novo agendamento
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <UnderlineInput label="Título" value={title} onChange={setTitle} placeholder="Ex.: Aviso de prova" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grupo</label>
              <select
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
              >
                <option value="">Selecione um grupo</option>
                {sortedGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
            <UnderlineInput label="Data" type="date" value={scheduledDate} onChange={setScheduledDate} />
            <UnderlineInput label="Hora" type="time" value={scheduledTime} onChange={setScheduledTime} />
          </div>
          <div className="mt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem</label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="mt-2 min-h-[220px] w-full rounded-2xl border border-input bg-background px-4 py-4 text-[15px] leading-7 text-foreground outline-none transition-colors focus:border-primary"
              placeholder="Digite a mensagem que será enviada para o grupo na data escolhida."
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-green-deep disabled:opacity-60"
            >
              {editingId ? "Salvar alterações" : "Agendar mensagem"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Agendamentos salvos
          </p>
          <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando mensagens programadas...</p>
            ) : items.length ? (
              items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">{String(item.title || "Sem título")}</p>
                      <p className="text-sm text-muted-foreground">
                        {String(item.groupName || "Sem grupo")} · {String(item.scheduledDate || "--")} às {String(item.scheduledTime || "--:--")}
                      </p>
                    </div>
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {String(item.status || "pending")}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-foreground/80">{String(item.template || "")}</p>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    <p>Criada por: {String(item.createdBy || "sistema")}</p>
                    <p>Atualizada em: {formatPtBr(String(item.updatedAt || item.createdAt || ""))}</p>
                    {item.sentAt ? <p>Enviada em: {formatPtBr(String(item.sentAt || ""))}</p> : null}
                    {item.error ? <p className="mt-1 text-destructive">{String(item.error || "")}</p> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(String(item.id || ""))
                        setTitle(String(item.title || ""))
                        setGroupName(String(item.groupName || ""))
                        setScheduledDate(String(item.scheduledDate || ""))
                        setScheduledTime(String(item.scheduledTime || ""))
                        setTemplate(String(item.template || ""))
                        setFeedback("")
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    {String(item.status || "") === "pending" ? (
                      <button
                        type="button"
                        onClick={() => void handleCancel(String(item.id || ""))}
                        className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <XCircle size={14} />
                        Cancelar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleDelete(String(item.id || ""))}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem programada cadastrada ainda.</p>
            )}
          </div>
        </div>
      </div>

      {feedback ? <p className="px-6 pb-3 text-sm text-foreground">{feedback}</p> : null}
      <ModalActions onCancel={onClose} onConfirm={onClose} confirmLabel="Fechar" cancelLabel="" />
    </ModalShell>
  )
}
