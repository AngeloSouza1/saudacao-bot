"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RefreshCcw } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput } from "./ModalShell"

interface CycleModalProps {
  open: boolean
  onClose: () => void
  initialState?: {
    idxAluno?: number
    idxAula?: number
  }
  initialConfig?: {
    agendaSemanal?: Record<string, Array<{ data?: string; hora?: string; materia?: string }>>
  }
  cycleActive?: boolean
  cycleName?: string
  cycleSentCount?: number
  cycleTotalAlunos?: number
  students?: string[]
  scheduleSummary?: Array<{ data?: string; dia?: string | number; horario?: string; materia?: string }>
  onSaved?: () => Promise<void> | void
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await res.json()
  if (!res.ok) throw new Error(String(payload?.error || "Falha ao salvar."))
  return payload
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const DIA_LONGO: Record<string, string> = {
  "0": "domingo",
  "1": "segunda-feira",
  "2": "terça-feira",
  "3": "quarta-feira",
  "4": "quinta-feira",
  "5": "sexta-feira",
  "6": "sábado",
}

function formatDatePtBr(dateOnly: string) {
  const parsed = new Date(`${String(dateOnly || "").trim()}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateOnly || "--/--/----"
  return parsed.toLocaleDateString("pt-BR")
}

function toDateOnly(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function nextDateForWeekday(dayIndex: string) {
  const numericDay = Number(dayIndex)
  if (!Number.isInteger(numericDay) || numericDay < 0 || numericDay > 6) return ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delta = (numericDay - today.getDay() + 7) % 7
  const next = new Date(today)
  next.setDate(today.getDate() + delta)
  return toDateOnly(next)
}

function buildLessonOptions(agendaSemanal: NonNullable<CycleModalProps["initialConfig"]>["agendaSemanal"]) {
  const source = agendaSemanal || {}
  const lessons = Object.entries(source).flatMap(([dia, items]) => {
    const lessonItems = Array.isArray(items) ? items : [items]
    return lessonItems.map((item) => ({
      originalDay: String(dia),
      data: String(item?.data || "").trim() || nextDateForWeekday(String(dia)),
      horario: String(item?.hora || "").trim(),
      materia: String(item?.materia || "").trim(),
    }))
  })

  return lessons
    .filter((item) => Boolean(item.data))
    .sort((a, b) => {
      const dateA = new Date(`${a.data}T${a.horario || "00:00"}:00`).getTime()
      const dateB = new Date(`${b.data}T${b.horario || "00:00"}:00`).getTime()
      if (dateA !== dateB) return dateA - dateB
      return a.materia.localeCompare(b.materia, "pt-BR")
    })
    .map((item, idx) => ({
      value: String(idx),
      data: item.data,
      label: `${idx + 1} - ${formatDatePtBr(item.data)} · ${DIA_LONGO[item.originalDay] || "dia"} ${item.horario || "--:--"} | ${item.materia || ""}`,
    }))
}

function buildLessonOptionsFromSummary(scheduleSummary: CycleModalProps["scheduleSummary"]) {
  return (Array.isArray(scheduleSummary) ? scheduleSummary : [])
    .map((item, idx) => {
      const data = String(item?.data || "").trim()
      if (!data) return null
      return {
        value: String(idx),
        data,
        label: `${idx + 1} - ${formatDatePtBr(data)} · ${DIA_LONGO[String(item?.dia ?? "")] || "dia"} ${String(item?.horario || "--:--")} | ${String(item?.materia || "")}`,
      }
    })
    .filter(Boolean) as Array<{ value: string; data: string; label: string }>
}

export function CycleModal({
  open,
  onClose,
  initialState,
  initialConfig,
  cycleActive = false,
  cycleName = "",
  cycleSentCount = 0,
  cycleTotalAlunos = 0,
  students = [],
  scheduleSummary = [],
  onSaved,
}: CycleModalProps) {
  const wasOpenRef = useRef(false)
  const [startAluno, setStartAluno] = useState("0")
  const [startAula, setStartAula] = useState("0")
  const [cycleLabel, setCycleLabel] = useState("")
  const [loading, setLoading] = useState(false)
  const [cancelCycleLoading, setCancelCycleLoading] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStartAluno(String(Number(initialState?.idxAluno ?? 0)))
      setStartAula(String(Number(initialState?.idxAula ?? 0)))
      setCycleLabel(String(cycleName || "").trim())
      setFeedback("")
      setFieldErrors({})
      setCancelConfirmOpen(false)
      setRestartConfirmOpen(false)
    }
    wasOpenRef.current = open
  }, [open, initialState, cycleName])

  const aulasOptions = useMemo(() => {
    const agendaOptions = buildLessonOptions(initialConfig?.agendaSemanal)
    if (agendaOptions.length) return agendaOptions
    return buildLessonOptionsFromSummary(scheduleSummary)
  }, [initialConfig?.agendaSemanal, scheduleSummary])

  useEffect(() => {
    if (!open) return
    if (!aulasOptions.length) {
      setStartAula("0")
      return
    }

    const currentIndex = Number(startAula || 0)
    const hasValidCurrentLesson =
      Number.isInteger(currentIndex) && aulasOptions.some((item) => Number(item.value) === currentIndex)

    if (hasValidCurrentLesson) return

    setStartAula(String(aulasOptions[0]?.value || "0"))
  }, [open, aulasOptions, startAula])

  async function handleStartOrRestartCycle() {
    const nextErrors: Record<string, string> = {}
    const alunoIdx = Number(startAluno || -1)
    const aulaIdx = Number(startAula || -1)
    const cycleLabelValue = String(cycleLabel || "").trim()

    if (!Number.isInteger(alunoIdx) || alunoIdx < 0 || alunoIdx >= students.length) {
      nextErrors.startAluno = "Selecione um aluno inicial válido."
    }
    const selectedAulaOption = aulasOptions.find((item) => Number(item.value) === aulaIdx)
    if (!Number.isInteger(aulaIdx) || aulaIdx < 0 || !selectedAulaOption) {
      nextErrors.startAula = "Selecione uma aula inicial válida."
    }
    const selectedLessonDate = String(selectedAulaOption?.data || "").trim()
    if (!selectedLessonDate) {
      nextErrors.startAula = "A aula inicial precisa ter uma data válida."
    }
    if (cycleLabelValue && cycleLabelValue.length < 3) {
      nextErrors.cycleLabel = "Use ao menos 3 caracteres para nomear o ciclo."
    }

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    setFeedback("")
    try {
      await postJson("/api/state", {
        idxAluno: Number(startAluno || 0),
        idxAula: Number(startAula || 0),
        dataInicio: selectedLessonDate,
      })

      if (cycleActive) {
        await postJson("/api/cycle/cancel", {})
      }

      const payload = await postJson("/api/cycle/new", {
        ...(cycleLabelValue ? { name: cycleLabelValue } : {}),
      })
      if (onSaved) {
        await onSaved()
        await wait(250)
        await onSaved()
      }
      setFeedback(String(payload?.message || (cycleActive ? "Ciclo reiniciado com sucesso." : "Ciclo iniciado com sucesso.")))
      onClose()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao iniciar o ciclo."))
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelCycle() {
    if (!cycleActive) return
    setCancelCycleLoading(true)
    setFeedback("")
    try {
      const payload = await postJson("/api/cycle/cancel", {})
      if (onSaved) await onSaved()
      setCancelConfirmOpen(false)
      setFeedback(String(payload?.message || "Ciclo ativo cancelado com sucesso."))
      onClose()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao cancelar ciclo."))
    } finally {
      setCancelCycleLoading(false)
    }
  }

  function handlePrimaryAction() {
    if (cycleActive) {
      setRestartConfirmOpen(true)
      return
    }
    void handleStartOrRestartCycle()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ciclo"
      subtitle="Início, reinício e controle do ciclo"
      icon={<RefreshCcw size={16} className="text-primary" />}
      size="xl"
    >
      <div className="px-6 py-6 flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ponto de partida
          </p>
          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aluno inicial dos envios</label>
              <select
                value={startAluno}
                onChange={(e) => setStartAluno(e.target.value)}
                className={`bg-transparent border-0 border-b-2 outline-none py-1.5 text-sm text-foreground transition-colors ${
                  fieldErrors.startAluno ? "border-status-err focus:border-status-err" : "border-input focus:border-primary"
                }`}
              >
                {(students || []).map((student, idx) => (
                  <option key={`${student}-${idx}`} value={String(idx)}>
                    {idx + 1} - {student}
                  </option>
                ))}
              </select>
              {fieldErrors.startAluno ? <p className="text-[11px] text-status-err">{fieldErrors.startAluno}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aula inicial dos envios</label>
              <select
                value={startAula}
                onChange={(e) => setStartAula(e.target.value)}
                className={`bg-transparent border-0 border-b-2 outline-none py-1.5 text-sm text-foreground transition-colors ${
                  fieldErrors.startAula ? "border-status-err focus:border-status-err" : "border-input focus:border-primary"
                }`}
              >
                {aulasOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldErrors.startAula ? <p className="text-[11px] text-status-err">{fieldErrors.startAula}</p> : null}
              {!fieldErrors.startAula ? (
                <p className="text-[11px] text-muted-foreground">O ciclo sempre começa a partir da data da aula selecionada.</p>
              ) : null}
            </div>
            <UnderlineInput
              label="Nome do ciclo"
              value={cycleLabel}
              onChange={(value) => {
                setCycleLabel(value)
                setFieldErrors((prev) => ({ ...prev, cycleLabel: "" }))
              }}
              placeholder="Ex.: Ciclo de março"
              hint="Opcional. Se deixar vazio, o sistema gera um nome automático."
              error={fieldErrors.cycleLabel}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Ciclo ativo
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {cycleActive ? cycleName || "Ciclo em andamento" : "Nenhum ciclo ativo no momento."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cycleActive
                  ? `${cycleSentCount} envio(s) realizado(s) de ${cycleTotalAlunos} aluno(s) previstos.`
                  : "Inicie um novo ciclo a partir do ponto de partida selecionado."}
              </p>
            </div>
            {cycleActive ? (
              <button
                onClick={() => setCancelConfirmOpen(true)}
                disabled={cancelCycleLoading || loading}
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-semibold text-status-err transition hover:bg-destructive/20 disabled:opacity-60"
              >
                Cancelar ciclo ativo
              </button>
            ) : null}
          </div>
        </div>

        {feedback ? <p className="text-sm text-primary">{feedback}</p> : null}
      </div>

      <ModalActions
        onCancel={onClose}
        onConfirm={handlePrimaryAction}
        confirmLabel={cycleActive ? "Reiniciar ciclo" : "Iniciar ciclo"}
        loading={loading || cancelCycleLoading}
      />

      <ModalShell
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Cancelar ciclo"
        subtitle="Confirme a interrupção do ciclo atual"
        icon={<RefreshCcw size={16} className="text-status-err" />}
        size="sm"
      >
        <div className="px-6 py-6">
          <p className="text-sm text-foreground">
            {cycleName
              ? `Deseja realmente cancelar o ciclo "${cycleName}"?`
              : "Deseja realmente cancelar o ciclo atual?"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            O ciclo será encerrado e deixará de aparecer como ativo no painel.
          </p>
        </div>
        <ModalActions
          onCancel={() => setCancelConfirmOpen(false)}
          onConfirm={handleCancelCycle}
          confirmLabel={cancelCycleLoading ? "Cancelando..." : "Confirmar cancelamento"}
          cancelLabel="Voltar"
          confirmVariant="danger"
          loading={cancelCycleLoading}
        />
      </ModalShell>

      <ModalShell
        open={restartConfirmOpen}
        onClose={() => setRestartConfirmOpen(false)}
        title="Reiniciar ciclo"
        subtitle="Confirme a recriação do ciclo atual"
        icon={<RefreshCcw size={16} className="text-primary" />}
        size="sm"
      >
        <div className="px-6 py-6">
          <p className="text-sm text-foreground">
            {cycleName
              ? `Deseja realmente reiniciar o ciclo "${cycleName}"?`
              : "Deseja realmente reiniciar o ciclo atual?"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            O ciclo atual será encerrado e um novo ciclo será criado a partir do aluno e da aula selecionados.
          </p>
        </div>
        <ModalActions
          onCancel={() => setRestartConfirmOpen(false)}
          onConfirm={async () => {
            setRestartConfirmOpen(false)
            await handleStartOrRestartCycle()
          }}
          confirmLabel={loading ? "Reiniciando..." : "Confirmar reinício"}
          cancelLabel="Voltar"
          loading={loading}
        />
      </ModalShell>
    </ModalShell>
  )
}
