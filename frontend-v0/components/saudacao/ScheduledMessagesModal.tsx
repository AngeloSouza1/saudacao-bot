"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Eye, Pencil, Trash2, XCircle } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput, WhatsAppFormattingToolbar } from "./ModalShell"

interface ScheduledMessageItem {
  id: string
  title?: string
  groupName?: string
  template?: string
  imagePath?: string
  mediaFileName?: string
  bannerTitle?: string
  backgroundColor?: string
  backgroundImagePath?: string
  textColor?: string
  titleBackgroundColor?: string
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

function formatDateDisplay(value: string) {
  const normalized = String(value || "").trim()
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return normalized || "--"
  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

function formatStatusLabel(status: string) {
  const normalized = String(status || "").trim().toLowerCase()
  if (normalized === "pending") return "Pendente"
  if (normalized === "sent") return "Enviada"
  if (normalized === "failed") return "Falhou"
  if (normalized === "canceled") return "Cancelada"
  return normalized || "Pendente"
}

function resolvePreviewMediaUrl(value: string) {
  const normalized = String(value || "").trim()
  if (!normalized) return ""
  if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith("data:")) return normalized
  return `/api/media-preview?path=${encodeURIComponent(normalized)}`
}

function withAlpha(hex: string, alpha: number) {
  const normalized = String(hex || "").trim().replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return `rgba(7, 25, 33, ${alpha})`
  }
  const value = Number.parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function ScheduledMessagesModal({
  open,
  onClose,
  previewMode = false,
  groups = [],
  onSaved,
}: ScheduledMessagesModalProps) {
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [items, setItems] = useState<ScheduledMessageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [editingId, setEditingId] = useState("")
  const [title, setTitle] = useState("")
  const [groupName, setGroupName] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [scheduledTime, setScheduledTime] = useState("")
  const [template, setTemplate] = useState("")
  const [imagePath, setImagePath] = useState("")
  const [backgroundImagePath, setBackgroundImagePath] = useState("")
  const [bannerTitle, setBannerTitle] = useState("")
  const [mediaFileName, setMediaFileName] = useState("")
  const [backgroundColor, setBackgroundColor] = useState("#123d37")
  const [textColor, setTextColor] = useState("#ffffff")
  const [titleBackgroundColor, setTitleBackgroundColor] = useState("#0b141a")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imageFieldVisible, setImageFieldVisible] = useState(false)
  const [backgroundImageFieldVisible, setBackgroundImageFieldVisible] = useState(false)
  const [bannerTitleFieldVisible, setBannerTitleFieldVisible] = useState(false)
  const [fileNameFieldVisible, setFileNameFieldVisible] = useState(false)

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
    setSelectedDates([])
    setScheduledTime("")
    setTemplate("")
    setImagePath("")
    setImageFieldVisible(false)
    setBackgroundImagePath("")
    setBackgroundImageFieldVisible(false)
    setBannerTitle("")
    setBannerTitleFieldVisible(false)
    setMediaFileName("")
    setFileNameFieldVisible(false)
    setBackgroundColor("#123d37")
    setTextColor("#ffffff")
    setTitleBackgroundColor("#0b141a")
  }

  function addSelectedDate() {
    const value = String(scheduledDate || "").trim()
    if (!value) {
      setFeedback("Selecione uma data antes de adicionar.")
      return
    }
    setSelectedDates((current) => {
      if (current.includes(value)) return current
      return [...current, value].sort()
    })
    setScheduledDate("")
    setFeedback("")
  }

  function removeSelectedDate(date: string) {
    setSelectedDates((current) => current.filter((item) => item !== date))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const datesToSave = editingId
        ? [String(scheduledDate || "").trim()]
        : Array.from(new Set([...selectedDates, String(scheduledDate || "").trim()].filter(Boolean))).sort()

      if (!datesToSave.length) {
        throw new Error("Selecione pelo menos uma data para o agendamento.")
      }

      for (const date of datesToSave) {
        await fetchJson("/api/scheduled-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId || undefined,
            title,
            groupName,
            scheduledDate: date,
            scheduledTime,
            template,
            imagePath,
            backgroundImagePath,
            bannerTitle,
            mediaFileName,
            backgroundColor,
            textColor,
            titleBackgroundColor,
          }),
        })
      }
      resetForm()
      await loadItems()
      if (onSaved) await onSaved()
      setFeedback(
        editingId || datesToSave.length === 1
          ? "Mensagem programada salva com sucesso."
          : `${datesToSave.length} mensagens programadas salvas com sucesso.`
      )
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

  const hasPreviewContent = Boolean(String(template || "").trim())
  const previewTitle = String(title || "").trim() || "Mensagem programada"
  const previewGroup = String(groupName || "").trim() || "Grupo de destino"
  const previewDate = String(scheduledDate || "").trim() || selectedDates[0] || ""
  const imagePreviewUrl = resolvePreviewMediaUrl(imagePath)
  const backgroundImagePreviewUrl = resolvePreviewMediaUrl(backgroundImagePath)

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        previewMode={previewMode}
        title="Mensagens programadas"
        subtitle="Agende mensagens por data e hora, sem vínculo com alunos"
        icon={<CalendarClock size={16} className="text-primary" />}
        size="xxl"
        bodyClassName="overflow-x-hidden"
      >
        <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1.34fr_minmax(280px,0.66fr)]">
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
              <div className="flex flex-col gap-2">
                <UnderlineInput label="Data" type="date" value={scheduledDate} onChange={setScheduledDate} />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Adicione várias datas para repetir a mesma mensagem.
                  </p>
                  <button
                    type="button"
                    onClick={addSelectedDate}
                    disabled={Boolean(editingId)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Adicionar data
                  </button>
                </div>
              </div>
              <UnderlineInput label="Hora" type="time" value={scheduledTime} onChange={setScheduledTime} />
            </div>
            {!editingId && selectedDates.length ? (
              <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Datas selecionadas
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground"
                    >
                      {formatDateDisplay(date)}
                      <button
                        type="button"
                        onClick={() => removeSelectedDate(date)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remover data ${date}`}
                        title="Remover data"
                      >
                        <XCircle size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Mídia do envio
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1.1fr_1.2fr_1.05fr]">
                {imageFieldVisible || Boolean(String(imagePath || "").trim()) ? (
                  <UnderlineInput
                    label="Banner / imagem"
                    value={imagePath}
                    onChange={(value) => {
                      setImagePath(value)
                      setImageFieldVisible(Boolean(String(value || "").trim()))
                    }}
                    placeholder="https://site/imagem.jpg"
                    hint="Opcional. Aceita arquivo local ou link."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setImageFieldVisible(true)}
                    className="flex min-h-[68px] items-center rounded-2xl border border-dashed border-border bg-background px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Adicionar banner ou imagem
                  </button>
                )}
                {backgroundImageFieldVisible || Boolean(String(backgroundImagePath || "").trim()) ? (
                  <UnderlineInput
                    label="Imagem de fundo"
                    value={backgroundImagePath}
                    onChange={(value) => {
                      setBackgroundImagePath(value)
                      setBackgroundImageFieldVisible(Boolean(String(value || "").trim()))
                    }}
                    placeholder="https://site/fundo.jpg"
                    hint="Opcional. Usa esta imagem no fundo do banner."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setBackgroundImageFieldVisible(true)}
                    className="flex min-h-[68px] items-center rounded-2xl border border-dashed border-border bg-background px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Adicionar imagem de fundo
                  </button>
                )}
                {bannerTitleFieldVisible || Boolean(String(bannerTitle || "").trim()) ? (
                  <UnderlineInput
                    label="Título do banner"
                    value={bannerTitle}
                    onChange={(value) => {
                      setBannerTitle(value)
                      setBannerTitleFieldVisible(Boolean(String(value || "").trim()))
                    }}
                    placeholder="Ex.: Aviso importante"
                    hint="Opcional. Se ficar vazio, o banner será enviado sem título."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setBannerTitleFieldVisible(true)}
                    className="flex min-h-[68px] items-center rounded-2xl border border-dashed border-border bg-background px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Adicionar título ao banner
                  </button>
                )}
                {fileNameFieldVisible || Boolean(String(mediaFileName || "").trim()) ? (
                  <UnderlineInput
                    label="Nome do arquivo"
                    value={mediaFileName}
                    onChange={(value) => {
                      setMediaFileName(value)
                      setFileNameFieldVisible(Boolean(String(value || "").trim()))
                    }}
                    placeholder="aviso.png"
                    hint="Opcional. Define o nome do arquivo enviado."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFileNameFieldVisible(true)}
                    className="flex min-h-[68px] items-center rounded-2xl border border-dashed border-border bg-background px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Adicionar nome do arquivo
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cor de fundo
                  </label>
                  <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2">
                    <input
                      type="color"
                      value={backgroundColor || "#123d37"}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-sm text-foreground">{backgroundColor || "#123d37"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Define a cor do fundo do banner desta mensagem.
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cor do texto
                  </label>
                  <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2">
                    <input
                      type="color"
                      value={textColor || "#ffffff"}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-sm text-foreground">{textColor || "#ffffff"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Define a cor do texto exibido no banner desta mensagem.
                  </p>
                </div>
                {Boolean(String(bannerTitle || "").trim()) ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Fundo do título
                    </label>
                    <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2">
                      <input
                        type="color"
                        value={titleBackgroundColor || "#0b141a"}
                        onChange={(e) => setTitleBackgroundColor(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <span className="font-mono text-sm text-foreground">{titleBackgroundColor || "#0b141a"}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Define a faixa atrás do título do banner.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem</label>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!hasPreviewContent}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye size={15} />
                  Pré-visualizar
                </button>
              </div>
              <div className="mt-2">
                <WhatsAppFormattingToolbar
                  value={template}
                  onChange={setTemplate}
                  textareaRef={templateTextareaRef}
                />
              </div>
              <textarea
                ref={templateTextareaRef}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="mt-3 min-h-[220px] w-full rounded-2xl border border-input bg-background px-4 py-4 text-[15px] leading-7 text-foreground outline-none transition-colors focus:border-primary"
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Fechar
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
          </div>

          <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Agendamentos salvos
            </p>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 max-h-[70vh]">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando mensagens programadas...</p>
              ) : items.length ? (
                items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-background px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[1.05rem] font-semibold leading-6 text-foreground">{String(item.title || "Sem título")}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {String(item.groupName || "Sem grupo")} · {formatDateDisplay(String(item.scheduledDate || "--"))} às {String(item.scheduledTime || "--:--")}
                        </p>
                        {item.imagePath ? (
                          <p className="mt-1 text-xs text-muted-foreground">Com mídia configurada</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatStatusLabel(String(item.status || "pending"))}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-4 text-sm leading-7 text-foreground/80 break-words">{String(item.template || "")}</p>
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      <p>Criada por: {String(item.createdBy || "sistema")}</p>
                      <p>Atualizada em: {formatPtBr(String(item.updatedAt || item.createdAt || ""))}</p>
                      {item.sentAt ? <p>Enviada em: {formatPtBr(String(item.sentAt || ""))}</p> : null}
                      {item.error ? <p className="mt-1 text-destructive">{String(item.error || "")}</p> : null}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(String(item.id || ""))
                          setTitle(String(item.title || ""))
                          setGroupName(String(item.groupName || ""))
                          setScheduledDate(String(item.scheduledDate || ""))
                          setSelectedDates([])
                          setScheduledTime(String(item.scheduledTime || ""))
                          setTemplate(String(item.template || ""))
                          setImagePath(String(item.imagePath || ""))
                          setImageFieldVisible(Boolean(String(item.imagePath || "").trim()))
                          setBackgroundImagePath(String(item.backgroundImagePath || ""))
                          setBackgroundImageFieldVisible(Boolean(String(item.backgroundImagePath || "").trim()))
                          setBannerTitle(String(item.bannerTitle || ""))
                          setBannerTitleFieldVisible(Boolean(String(item.bannerTitle || "").trim()))
                          setMediaFileName(String(item.mediaFileName || ""))
                          setFileNameFieldVisible(Boolean(String(item.mediaFileName || "").trim()))
                          setBackgroundColor(String(item.backgroundColor || "#123d37") || "#123d37")
                          setTextColor(String(item.textColor || "#ffffff") || "#ffffff")
                          setTitleBackgroundColor(String(item.titleBackgroundColor || "#0b141a") || "#0b141a")
                          setFeedback("")
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {String(item.status || "") === "pending" ? (
                        <button
                          type="button"
                          onClick={() => void handleCancel(String(item.id || ""))}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
                          aria-label="Cancelar"
                          title="Cancelar"
                        >
                          <XCircle size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleDelete(String(item.id || ""))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:border-destructive hover:text-destructive"
                        aria-label="Excluir"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
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
      </ModalShell>

      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Pré-visualização"
        subtitle="Exemplo da mensagem programada no grupo"
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
                  <p className="text-xs text-white/70">Prévia da mensagem para {previewGroup}</p>
                </div>
              </div>
              <div className="text-right text-[11px] text-white/65">
                <p>{scheduledTime || "--:--"}</p>
              </div>
            </div>

            <div
              className="space-y-4 px-4 py-5"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            >
              <div className="mx-auto w-fit rounded-full bg-white/75 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                {previewDate ? formatDateDisplay(previewDate) : "Data agendada"}
              </div>

              <div className="ml-auto max-w-[88%] rounded-[18px] rounded-tr-md bg-[#d9fdd3] px-4 py-3 text-[#111b21] shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                {(imagePath || bannerTitle) ? (
                  <div className="mb-3 overflow-hidden rounded-2xl border border-emerald-300/50 bg-white/70">
                    <div
                      className="relative flex min-h-[300px] items-center gap-5 px-4 py-4"
                      style={{ background: backgroundColor || "#123d37" }}
                    >
                      {backgroundImagePreviewUrl ? (
                        <>
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${backgroundImagePreviewUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                              filter: "blur(10px)",
                              transform: "scale(1.12)",
                              opacity: 0.32,
                            }}
                          />
                          <img
                            src={backgroundImagePreviewUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ transform: "scale(1.08)" }}
                            referrerPolicy="no-referrer"
                          />
                        </>
                      ) : null}
                      {imagePreviewUrl ? (
                        <div className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl border-2 border-white/55 bg-white/80 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                          <img
                            src={imagePreviewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : null}
                      <div className="relative flex min-h-[72px] min-w-0 flex-1 items-center justify-center text-white">
                        {bannerTitle ? (
                          <div
                            className="mx-auto inline-flex max-w-[78%] flex-col items-center rounded-2xl px-5 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                            style={{ backgroundColor: withAlpha(titleBackgroundColor || "#0b141a", 0.26) }}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                              Mensagem programada
                            </p>
                            <p
                              className="mt-1 translate-y-0.5 text-[34px] font-semibold leading-tight"
                              style={{ color: textColor || "#ffffff" }}
                            >
                              {bannerTitle}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <p className="whitespace-pre-wrap text-[15px] leading-7">
                  {template || "Digite a mensagem para visualizar a prévia."}
                </p>

                <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-[#667781]">
                  <span>{scheduledTime || "--:--"}</span>
                  <span>✓✓</span>
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
    </>
  )
}
