"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, Pencil, Trash2, Plus } from "lucide-react"
import { ModalShell, ModalActions, UnderlineInput } from "./ModalShell"
import { cn } from "@/lib/utils"
import { isNullWord, isValidStudentName, normalizeHourInput, normalizeText } from "@/lib/validation"

interface Student {
  id: string
  name: string
}

interface Lesson {
  id: string
  dia: string
  hora: string
  titulo: string
  materia: string
  professor: string
}

interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => Promise<void> | void
}

type DeleteTarget =
  | { kind: "student"; id: string; label: string }
  | { kind: "lesson"; id: string; label: string }

const DAY_OPTIONS = [
  { value: "", label: "Selecione o dia" },
  { value: "1", label: "1 - Segunda" },
  { value: "2", label: "2 - Terça" },
  { value: "3", label: "3 - Quarta" },
  { value: "4", label: "4 - Quinta" },
  { value: "5", label: "5 - Sexta" },
  { value: "6", label: "6 - Sábado" },
  { value: "0", label: "0 - Domingo" },
]

type AgendaJsonPayload = {
  alunos?: string[]
  agendaSemanal?: Record<string, Array<{ hora?: string; titulo?: string; materia?: string; professor?: string }>>
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const payload = await res.json()
  if (!res.ok) throw new Error(String(payload?.error || "Falha na requisição."))
  return payload as T
}

function agendaToLessons(agendaSemanal: AgendaJsonPayload["agendaSemanal"]): Lesson[] {
  const list: Lesson[] = []
  const source = agendaSemanal || {}
  for (const [dia, aulas] of Object.entries(source)) {
    for (const aula of Array.isArray(aulas) ? aulas : []) {
      list.push({
        id: `l-${dia}-${String(aula?.hora || "--:--")}-${String(aula?.titulo || "")}-${Math.random().toString(36).slice(2, 7)}`,
        dia,
        hora: String(aula?.hora || ""),
        titulo: String(aula?.titulo || ""),
        materia: String(aula?.materia || ""),
        professor: String(aula?.professor || ""),
      })
    }
  }
  return list
}

function lessonsToAgenda(lessons: Lesson[]): AgendaJsonPayload["agendaSemanal"] {
  const out: NonNullable<AgendaJsonPayload["agendaSemanal"]> = {}
  for (const lesson of lessons) {
    const dia = String(lesson.dia || "").trim()
    if (!dia) continue
    if (!out[dia]) out[dia] = []
    out[dia].push({
      hora: String(lesson.hora || "").trim(),
      titulo: String(lesson.titulo || "").trim(),
      materia: String(lesson.materia || "").trim(),
      professor: String(lesson.professor || "").trim(),
    })
  }
  return out
}

function sortStudentsByName(list: Student[]): Student[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  )
}

export function ScheduleModal({ open, onClose, onSaved }: ScheduleModalProps) {
  const [studentName, setStudentName] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [lessonForm, setLessonForm] = useState({
    dia: "",
    hora: "",
    titulo: "",
    materia: "",
    professor: "",
  })
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [showLessonForm, setShowLessonForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [studentError, setStudentError] = useState("")
  const [lessonErrors, setLessonErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const isLessonFormVisible = showLessonForm || Boolean(editingLessonId)

  const isLessonValid = useMemo(() => {
    const titulo = normalizeText(lessonForm.titulo)
    const hora = normalizeHourInput(lessonForm.hora)
    const materia = normalizeText(lessonForm.materia)
    const professor = normalizeText(lessonForm.professor)
    return (
      Boolean(lessonForm.dia) &&
      Boolean(hora) &&
      (!titulo || (titulo.length >= 2 && !isNullWord(titulo))) &&
      Boolean(materia) &&
      materia.length >= 2 &&
      !isNullWord(materia) &&
      Boolean(professor) &&
      professor.length >= 2 &&
      !isNullWord(professor)
    )
  }, [lessonForm])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setFeedback("")
    fetchJson<AgendaJsonPayload>("/api/agenda-json")
      .then((data) => {
        if (!active) return
        const rawStudents = Array.isArray(data?.alunos) ? data.alunos : []
        setStudents(
          sortStudentsByName(rawStudents.map((name, idx) => ({ id: `s-${idx}-${name}`, name: String(name) })))
        )
        setLessons(agendaToLessons(data?.agendaSemanal))
        setStudentError("")
        setLessonErrors({})
        setEditingStudentId(null)
        setShowStudentForm(false)
        setEditingLessonId(null)
        setShowLessonForm(false)
      })
      .catch((error) => {
        if (!active) return
        setFeedback(String((error as Error)?.message || "Falha ao carregar agenda."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open])

  function addStudent() {
    const name = studentName.trim()
    if (!isValidStudentName(name)) {
      setStudentError("Nome de aluno inválido.")
      return
    }
    const alreadyExists = students.some((s) => normalizeText(s.name).toLowerCase() === name.toLowerCase())
    if (alreadyExists) {
      setStudentError("Este aluno já está cadastrado.")
      return
    }
    if (editingStudentId) {
      setStudents((prev) =>
        sortStudentsByName(prev.map((s) => (s.id === editingStudentId ? { ...s, name } : s)))
      )
      setEditingStudentId(null)
    } else {
      setStudents((prev) => sortStudentsByName([...prev, { id: `s${Date.now()}`, name }]))
    }
    setStudentName("")
    setStudentError("")
    setShowStudentForm(false)
  }

  function removeStudent(id: string) {
    const student = students.find((s) => s.id === id)
    setDeleteTarget({
      kind: "student",
      id,
      label: student?.name?.trim() || "aluno",
    })
  }

  function confirmRemoveStudent(id: string) {
    setStudents((prev) => prev.filter((s) => s.id !== id))
    if (editingStudentId === id) {
      setEditingStudentId(null)
      setStudentName("")
      setShowStudentForm(false)
    }
  }

  function startEditStudent(student: Student) {
    setEditingStudentId(student.id)
    setStudentName(student.name)
    setStudentError("")
    setShowStudentForm(true)
  }

  function addLesson() {
    const nextErrors: Record<string, string> = {}
    const hora = normalizeHourInput(lessonForm.hora)
    const titulo = normalizeText(lessonForm.titulo)
    const materia = normalizeText(lessonForm.materia)
    const professor = normalizeText(lessonForm.professor)
    if (!lessonForm.dia) nextErrors.dia = "Selecione o dia da aula."
    if (!hora) nextErrors.hora = "Hora inválida. Use HH:MM."
    if (titulo && (titulo.length < 2 || isNullWord(titulo))) nextErrors.titulo = "Título inválido."
    if (materia.length < 2 || isNullWord(materia)) nextErrors.materia = "Matéria inválida."
    if (professor.length < 2 || isNullWord(professor)) nextErrors.professor = "Professor inválido."
    setLessonErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !isLessonValid) return

    if (editingLessonId) {
      setLessons((prev) =>
        prev.map((l) =>
          l.id === editingLessonId
            ? { ...l, dia: lessonForm.dia, hora, titulo, materia, professor }
            : l
        )
      )
      setEditingLessonId(null)
    } else {
      setLessons((prev) => [
        ...prev,
        {
          id: `l${Date.now()}`,
          dia: lessonForm.dia,
          hora,
          titulo,
          materia,
          professor,
        },
      ])
    }
    setLessonForm({ dia: "", hora: "", titulo: "", materia: "", professor: "" })
    setLessonErrors({})
    setShowLessonForm(false)
  }

  function removeLesson(id: string) {
    const lesson = lessons.find((l) => l.id === id)
    setDeleteTarget({
      kind: "lesson",
      id,
      label: lesson?.titulo?.trim() || "aula",
    })
  }

  function confirmRemoveLesson(id: string) {
    setLessons((prev) => prev.filter((l) => l.id !== id))
    if (editingLessonId === id) {
      setEditingLessonId(null)
      setLessonForm({ dia: "", hora: "", titulo: "", materia: "", professor: "" })
      setShowLessonForm(false)
    }
  }

  function confirmDeleteTarget() {
    if (!deleteTarget) return
    if (deleteTarget.kind === "student") {
      confirmRemoveStudent(deleteTarget.id)
    } else {
      confirmRemoveLesson(deleteTarget.id)
    }
    setDeleteTarget(null)
  }

  function startEditLesson(lesson: Lesson) {
    setEditingLessonId(lesson.id)
    setLessonForm({
      dia: lesson.dia,
      hora: lesson.hora,
      titulo: lesson.titulo,
      materia: lesson.materia,
      professor: lesson.professor,
    })
    setLessonErrors({})
    setShowLessonForm(true)
  }

  async function handleSaveAgenda() {
    if (!students.length) {
      setFeedback("Cadastre ao menos 1 aluno antes de salvar.")
      return
    }
    if (!lessons.length) {
      setFeedback("Cadastre ao menos 1 item de aula antes de salvar.")
      return
    }

    setSaving(true)
    setFeedback("")
    try {
      const alunos = students.map((s) => String(s.name || "").trim()).filter(Boolean)
      const agendaSemanal = lessonsToAgenda(lessons)
      await fetchJson("/api/agenda-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunos, agendaSemanal }),
      })
      if (onSaved) await onSaved()
      onClose()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar agenda."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Editor de Agenda"
      subtitle="Aulas, histórico e acompanhamento"
      icon={<Calendar size={16} className="text-primary" />}
      size="xxl"
      bodyClassName="overflow-hidden"
    >
      <div className="h-full px-6 py-5 flex flex-col min-h-0">
        <div className="grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-5 flex-1 min-h-0">
          <div className="rounded-2xl bg-card/80 p-4 flex flex-col min-h-0">
            <h3 className="text-[2rem] font-black tracking-tight text-foreground">Alunos</h3>
            {showStudentForm || editingStudentId ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="w-full max-w-[640px]">
                  <UnderlineInput
                    label="Nome do aluno"
                    value={studentName}
                    onChange={(v) => {
                      setStudentName(v)
                      if (studentError) setStudentError("")
                    }}
                    placeholder="Ex.: Angelo"
                    error={studentError || undefined}
                    required
                    inputClassName={showStudentForm || editingStudentId ? "bg-amber-100/70 rounded-t-md px-2" : ""}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={addStudent}
                    className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep"
                  >
                    <Plus size={14} /> {editingStudentId ? "Salvar Aluno" : "Adicionar Aluno"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingStudentId(null)
                      setStudentName("")
                      setStudentError("")
                      setShowStudentForm(false)
                    }}
                    className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    Cancelar edição
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-start">
                <button
                  onClick={() => {
                    setEditingStudentId(null)
                    setStudentName("")
                    setStudentError("")
                    setShowStudentForm(true)
                  }}
                  className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep"
                >
                  <Plus size={14} /> Adicionar Aluno
                </button>
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">Para adicionar aluno, preencha corretamente o nome do aluno.</p>

            <div
              id="modal-students"
              className="mt-3 min-h-0 overflow-auto rounded-xl border border-border p-2"
              style={{ maxHeight: "455px" }}
            >
              <div className="space-y-2">
                {students.map((student, idx) => (
                  <div
                    key={student.id}
                    className={cn(
                      "student-item flex items-center justify-between rounded-2xl border border-primary/15 bg-green-soft px-4 py-3",
                      idx % 2 === 1 && "bg-green-soft/70"
                    )}
                  >
                    <span className="student-name text-[1.1rem] font-semibold text-foreground leading-tight">{student.name}</span>
                    <div className="student-actions flex items-center gap-2">
                      <button
                        className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        title="Editar aluno"
                        aria-label="Editar aluno"
                        onClick={() => startEditStudent(student)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        title="Excluir aluno"
                        aria-label="Excluir aluno"
                        onClick={() => removeStudent(student.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card/80 p-4 flex flex-col min-h-0">
            <h3 className="text-[2rem] font-black tracking-tight text-foreground">Aulas da Semana</h3>
            {isLessonFormVisible ? (
              <>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dia</label>
                    <select
                      value={lessonForm.dia}
                      onChange={(e) => {
                        setLessonForm((p) => ({ ...p, dia: e.target.value }))
                        setLessonErrors((prev) => ({ ...prev, dia: "" }))
                      }}
                      className={`${editingLessonId ? "bg-amber-100/70 rounded-t-md px-2" : "bg-transparent"} border-0 border-b-2 outline-none py-1.5 text-sm text-foreground transition-colors ${
                        lessonErrors.dia ? "border-status-err focus:border-status-err" : "border-input focus:border-primary"
                      }`}
                    >
                      {DAY_OPTIONS.map((d) => (
                        <option key={d.value || "ph"} value={d.value} disabled={!d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    {lessonErrors.dia ? <p className="text-[11px] text-status-err">{lessonErrors.dia}</p> : null}
                  </div>
                  <UnderlineInput
                    label="Hora"
                    value={lessonForm.hora}
                    onChange={(v) => {
                      setLessonForm((p) => ({ ...p, hora: v }))
                      setLessonErrors((prev) => ({ ...prev, hora: "" }))
                    }}
                    type="time"
                    required
                    error={lessonErrors.hora}
                    inputClassName={editingLessonId ? "bg-amber-100/70 rounded-t-md px-2" : ""}
                  />
                  <UnderlineInput
                    label="Título da aula"
                    value={lessonForm.titulo}
                    onChange={(v) => {
                      setLessonForm((p) => ({ ...p, titulo: v }))
                      setLessonErrors((prev) => ({ ...prev, titulo: "" }))
                    }}
                    error={lessonErrors.titulo}
                    inputClassName={editingLessonId ? "bg-amber-100/70 rounded-t-md px-2" : ""}
                  />
                  <UnderlineInput
                    label="Matéria"
                    value={lessonForm.materia}
                    onChange={(v) => {
                      setLessonForm((p) => ({ ...p, materia: v }))
                      setLessonErrors((prev) => ({ ...prev, materia: "" }))
                    }}
                    required
                    error={lessonErrors.materia}
                    inputClassName={editingLessonId ? "bg-amber-100/70 rounded-t-md px-2" : ""}
                  />
                  <UnderlineInput
                    label="Professor(a)"
                    value={lessonForm.professor}
                    onChange={(v) => {
                      setLessonForm((p) => ({ ...p, professor: v }))
                      setLessonErrors((prev) => ({ ...prev, professor: "" }))
                    }}
                    required
                    error={lessonErrors.professor}
                    inputClassName={editingLessonId ? "bg-amber-100/70 rounded-t-md px-2" : ""}
                  />
                  <div className="flex items-end justify-start md:justify-end gap-2">
                    <button
                      onClick={addLesson}
                      disabled={!isLessonValid}
                      className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep disabled:opacity-50"
                    >
                      <Plus size={14} /> {editingLessonId ? "Salvar Aula" : "Adicionar Aula"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingLessonId(null)
                        setLessonForm({ dia: "", hora: "", titulo: "", materia: "", professor: "" })
                        setLessonErrors({})
                        setShowLessonForm(false)
                      }}
                      className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                    >
                      Cancelar edição
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">Preencha dia, hora, título, matéria e professor.</p>
                </div>
              </>
            ) : (
              <div className="mt-3 flex justify-start">
                <button
                  onClick={() => {
                    setEditingLessonId(null)
                    setLessonForm({ dia: "", hora: "", titulo: "", materia: "", professor: "" })
                    setLessonErrors({})
                    setShowLessonForm(true)
                  }}
                  className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep"
                >
                  <Plus size={14} /> Adicionar Aula
                </button>
              </div>
            )}

            <div
              id="modal-lessons"
              className={cn(
                "agenda-list mt-7 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-border",
                isLessonFormVisible ? "flex-none max-h-[264px]" : "flex-1"
              )}
            >
              <table className="table w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">Dia</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">Hora</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">Título</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">Matéria</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">Professor</th>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson, idx) => (
                    <tr key={lesson.id} className={idx % 2 ? "bg-green-soft/60" : "bg-green-soft"}>
                      <td className="px-3 py-2 text-[15px]">
                        {(DAY_OPTIONS.find((d) => d.value === String(lesson.dia))?.label || lesson.dia).replace(/^\d+\s-\s/, "").slice(0, 3)}
                      </td>
                      <td className="px-3 py-2 text-[15px] tabular-nums">{lesson.hora}</td>
                      <td className="px-3 py-2 text-[15px]">{lesson.titulo}</td>
                      <td className="px-3 py-2 text-[15px]">{lesson.materia}</td>
                      <td className="px-3 py-2 text-[15px]">{lesson.professor}</td>
                      <td className="px-3 py-2">
                        <button
                          className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2"
                          title="Editar aula"
                          aria-label="Editar aula"
                          onClick={() => startEditLesson(lesson)}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2"
                          title="Excluir aula"
                          aria-label="Excluir aula"
                          onClick={() => removeLesson(lesson.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {loading ? <p className="pt-3 text-sm text-muted-foreground shrink-0">Carregando agenda...</p> : null}
        {feedback ? <p className="pt-3 text-sm text-destructive shrink-0">{feedback}</p> : null}
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
            onClick={() => setDeleteTarget(null)}
            aria-label="Fechar confirmação de exclusão"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h4 className="text-lg font-bold text-foreground">Confirmar exclusão</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteTarget.kind === "student"
                ? `Deseja realmente excluir o aluno "${deleteTarget.label}"?`
                : `Deseja realmente excluir a aula "${deleteTarget.label}"?`}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteTarget}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-semibold text-status-err hover:bg-destructive/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
