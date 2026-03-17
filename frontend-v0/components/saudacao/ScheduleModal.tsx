"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, Pencil, Trash2, Plus } from "lucide-react"
import { ModalShell, ModalActions, UnderlineInput } from "./ModalShell"
import { cn } from "@/lib/utils"

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

export function ScheduleModal({ open, onClose, onSaved }: ScheduleModalProps) {
  const [studentName, setStudentName] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [lessonForm, setLessonForm] = useState({
    dia: "",
    hora: "",
    titulo: "",
    materia: "",
    professor: "",
  })
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState("")

  const isLessonValid = useMemo(() => {
    return (
      Boolean(lessonForm.dia) &&
      Boolean(lessonForm.hora) &&
      Boolean(lessonForm.titulo.trim()) &&
      Boolean(lessonForm.materia.trim()) &&
      Boolean(lessonForm.professor.trim())
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
        setStudents(rawStudents.map((name, idx) => ({ id: `s-${idx}-${name}`, name: String(name) })))
        setLessons(agendaToLessons(data?.agendaSemanal))
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
    if (!name) return
    setStudents((prev) => [...prev, { id: `s${Date.now()}`, name }])
    setStudentName("")
  }

  function removeStudent(id: string) {
    setStudents((prev) => prev.filter((s) => s.id !== id))
  }

  function addLesson() {
    if (!isLessonValid) return
    setLessons((prev) => [
      ...prev,
      {
        id: `l${Date.now()}`,
        dia: lessonForm.dia,
        hora: lessonForm.hora,
        titulo: lessonForm.titulo.trim(),
        materia: lessonForm.materia.trim(),
        professor: lessonForm.professor.trim(),
      },
    ])
    setLessonForm({ dia: "", hora: "", titulo: "", materia: "", professor: "" })
  }

  function removeLesson(id: string) {
    setLessons((prev) => prev.filter((l) => l.id !== id))
  }

  async function handleSaveAgenda() {
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
      size="xl"
    >
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 min-h-[66vh]">
          <div className="rounded-2xl border border-border bg-card/80 p-4 flex flex-col min-h-0">
            <h3 className="text-3xl font-black tracking-tight text-foreground">Alunos</h3>
            <div className="mt-3">
              <UnderlineInput
                label="Nome do aluno"
                value={studentName}
                onChange={setStudentName}
                placeholder="Ex.: Angelo"
              />
            </div>
            <button
              onClick={addStudent}
              className="mt-3 inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep"
            >
              <Plus size={14} /> Adicionar Aluno
            </button>
            <p className="mt-3 text-sm text-muted-foreground">Para adicionar aluno, preencha corretamente o nome do aluno.</p>

            <div id="modal-students" className="mt-3 flex-1 min-h-0 overflow-auto rounded-xl border border-border p-2">
              <div className="space-y-2">
                {students.map((student, idx) => (
                  <div
                    key={student.id}
                    className={cn(
                      "student-item flex items-center justify-between rounded-2xl border border-primary/15 bg-green-soft px-4 py-3",
                      idx % 2 === 1 && "bg-green-soft/70"
                    )}
                  >
                    <span className="student-name text-xl font-semibold text-foreground">{student.name}</span>
                    <div className="student-actions flex items-center gap-2">
                      <button className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2 text-sm" title="Editar aluno" aria-label="Editar aluno">
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

          <div className="rounded-2xl border border-border bg-card/80 p-4 flex flex-col min-h-0">
            <h3 className="text-3xl font-black tracking-tight text-foreground">Aulas da Semana</h3>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dia</label>
                <select
                  value={lessonForm.dia}
                  onChange={(e) => setLessonForm((p) => ({ ...p, dia: e.target.value }))}
                  className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value || "ph"} value={d.value} disabled={!d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <UnderlineInput
                label="Hora"
                value={lessonForm.hora}
                onChange={(v) => setLessonForm((p) => ({ ...p, hora: v }))}
                type="time"
              />
              <UnderlineInput
                label="Título da aula"
                value={lessonForm.titulo}
                onChange={(v) => setLessonForm((p) => ({ ...p, titulo: v }))}
              />
              <UnderlineInput
                label="Matéria"
                value={lessonForm.materia}
                onChange={(v) => setLessonForm((p) => ({ ...p, materia: v }))}
              />
              <UnderlineInput
                label="Professor(a)"
                value={lessonForm.professor}
                onChange={(v) => setLessonForm((p) => ({ ...p, professor: v }))}
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={addLesson}
                disabled={!isLessonValid}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep disabled:opacity-50"
              >
                <Plus size={14} /> Adicionar Aula
              </button>
              <p className="text-xs text-muted-foreground">Preencha dia, hora, título, matéria e professor.</p>
            </div>

            <div id="modal-lessons" className="agenda-list mt-3 flex-1 min-h-0 overflow-auto rounded-xl border border-border">
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
                        <button className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2" title="Editar aula" aria-label="Editar aula">
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
      </div>

      {loading ? <p className="px-6 pb-3 text-sm text-muted-foreground">Carregando agenda...</p> : null}
      {feedback ? <p className="px-6 pb-3 text-sm text-destructive">{feedback}</p> : null}
      <ModalActions onCancel={onClose} onConfirm={handleSaveAgenda} confirmLabel="Salvar Agenda" loading={saving} />
    </ModalShell>
  )
}
