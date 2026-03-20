"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, GraduationCap, Pencil, Trash2, Plus } from "lucide-react"
import { ModalShell, UnderlineInput } from "./ModalShell"
import { cn } from "@/lib/utils"
import { isNullWord, isValidStudentName, normalizeHourInput, normalizeText } from "@/lib/validation"

interface Student {
  id: string
  name: string
  whatsapp: string
  image: string
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

type AgendaSection = "students" | "lessons" | null

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
  alunoDetalhes?: Array<{ nome?: string; whatsapp?: string; imagem?: string }>
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
  const [activeSection, setActiveSection] = useState<AgendaSection>(null)
  const [studentName, setStudentName] = useState("")
  const [studentWhatsapp, setStudentWhatsapp] = useState("")
  const [studentImage, setStudentImage] = useState("")
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
  const isStudentModalOpen = showStudentForm || Boolean(editingStudentId)
  const headerActions = activeSection ? (
    <>
      <button
        onClick={() => setActiveSection((current) => (current === "students" ? null : "students"))}
        aria-label="Abrir card de alunos"
        title="Abrir card de alunos"
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
          activeSection === "students"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted"
        )}
      >
        <GraduationCap size={18} />
      </button>
      <button
        onClick={() => setActiveSection((current) => (current === "lessons" ? null : "lessons"))}
        aria-label="Abrir card de aulas da semana"
        title="Abrir card de aulas da semana"
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
          activeSection === "lessons"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted"
        )}
      >
        <Calendar size={18} />
      </button>
    </>
  ) : null

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
        const rawDetails = Array.isArray(data?.alunoDetalhes) ? data.alunoDetalhes : []
        const detailMap = new Map(
          rawDetails
            .map((item) => [String(item?.nome || "").trim(), item] as const)
            .filter(([name]) => Boolean(name))
        )
        setStudents(
          sortStudentsByName(
            rawStudents.map((name, idx) => {
              const normalizedName = String(name)
              const detail = detailMap.get(normalizedName)
              return {
                id: `s-${idx}-${normalizedName}`,
                name: normalizedName,
                whatsapp: String(detail?.whatsapp || "").trim(),
                image: String(detail?.imagem || "").trim(),
              }
            })
          )
        )
        setLessons(agendaToLessons(data?.agendaSemanal))
        setStudentError("")
        setLessonErrors({})
        setActiveSection(null)
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

  function resetStudentForm() {
    setEditingStudentId(null)
    setStudentName("")
    setStudentWhatsapp("")
    setStudentImage("")
    setStudentError("")
    setShowStudentForm(false)
  }

  function openCreateStudentModal() {
    resetStudentForm()
    setShowStudentForm(true)
    setActiveSection("students")
  }

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
        sortStudentsByName(
          prev.map((s) => (s.id === editingStudentId
            ? { ...s, name, whatsapp: studentWhatsapp.trim(), image: studentImage.trim() }
            : s))
        )
      )
      setEditingStudentId(null)
    } else {
      setStudents((prev) => sortStudentsByName([
        ...prev,
        { id: `s${Date.now()}`, name, whatsapp: studentWhatsapp.trim(), image: studentImage.trim() },
      ]))
    }
    setStudentName("")
    setStudentWhatsapp("")
    setStudentImage("")
    setStudentError("")
    setShowStudentForm(false)
    setEditingStudentId(null)
    setActiveSection("students")
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
      resetStudentForm()
    }
  }

  function startEditStudent(student: Student) {
    setActiveSection("students")
    setEditingStudentId(student.id)
    setStudentName(student.name)
    setStudentWhatsapp(student.whatsapp || "")
    setStudentImage(student.image || "")
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
    setActiveSection("lessons")
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
    setActiveSection("lessons")
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
      const alunoDetalhes = students.map((s) => ({
        nome: String(s.name || "").trim(),
        whatsapp: String(s.whatsapp || "").trim(),
        imagem: String(s.image || "").trim(),
      }))
      const agendaSemanal = lessonsToAgenda(lessons)
      await fetchJson("/api/agenda-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunos, alunoDetalhes, agendaSemanal }),
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
      size={activeSection ? "xxl" : "md"}
      bodyClassName="overflow-hidden"
      headerActions={headerActions}
    >
      <div className="max-h-[calc(90vh-96px)] bg-background px-6 pt-6 pb-5 flex flex-col min-h-0">
        <div className={cn("shrink-0", activeSection ? "mb-0" : "flex flex-1 items-center justify-center py-2")}>
          {!activeSection ? (
            <div className="mx-auto inline-flex min-h-[160px] w-auto items-center justify-center rounded-[2rem] border border-border bg-card px-10 py-8 shadow-lg">
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setActiveSection((current) => (current === "students" ? null : "students"))}
                  aria-label="Abrir card de alunos"
                  title="Abrir card de alunos"
                  className="inline-flex h-[112px] w-[112px] flex-col items-center justify-center gap-2 rounded-[1.9rem] border border-primary/15 bg-primary/5 px-3 text-center text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/10"
                >
                  <GraduationCap size={34} className="text-primary" />
                  <span className="text-xs font-semibold leading-none">Alunos</span>
                </button>
                <button
                  onClick={() => setActiveSection((current) => (current === "lessons" ? null : "lessons"))}
                  aria-label="Abrir card de aulas da semana"
                  title="Abrir card de aulas da semana"
                  className="inline-flex h-[112px] w-[112px] flex-col items-center justify-center gap-2 rounded-[1.9rem] border border-border bg-muted/30 px-3 text-center text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-muted"
                >
                  <Calendar size={34} className="text-primary" />
                  <span className="text-xs font-semibold leading-none">Aulas</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {!activeSection ? (
          <div className="sr-only">
            <div className="max-w-xl">
              <h3 className="text-2xl font-black tracking-tight text-foreground">Escolha uma seção do editor</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Use os botões acima para abrir o card de alunos ou o card de aulas da semana.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0">
          {activeSection === "students" ? (
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[1220px] flex-col gap-3 overflow-hidden">
            <div className="mt-2 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Resumo da turma</p>
                  <h3 className="mt-2 text-[2rem] font-black tracking-tight text-foreground">Alunos</h3>
                </div>
                <span className="w-fit rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  {students.length} cadastrados
                </span>
              </div>
            </div>

            <div className="grid h-full min-h-0 gap-4 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="flex h-full min-h-0 max-h-[calc(90vh-260px)] flex-col gap-4 self-start rounded-[1.6rem] border border-border bg-card/90 p-5 shadow-sm">
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    Gestão de alunos
                  </p>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    Organize a lista de alunos do ciclo. Você pode adicionar novos nomes, editar cadastros existentes e remover entradas sem perder clareza na fila.
                  </p>
                </div>

                {!showStudentForm && !editingStudentId ? (
                  <div className="flex justify-center">
                    <button
                      onClick={openCreateStudentModal}
                      className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-green-deep"
                    >
                      <Plus size={15} /> Adicionar Aluno
                    </button>
                  </div>
                ) : null}

                <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/15 p-5 text-center">
                  <p className="text-sm font-semibold text-foreground">Próximo passo</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Selecione um aluno na lista para editar os dados ou use o botão acima para cadastrar um novo nome.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 max-h-[calc(90vh-260px)] self-start overflow-hidden rounded-[1.6rem] border border-border bg-card/90 p-4 shadow-sm">
              <div
                id="modal-students"
                className="h-[calc(90vh-300px)] min-h-0 overflow-y-auto overflow-x-hidden rounded-[1.4rem] border border-border bg-muted/15 p-3"
              >
                <div className="space-y-3">
                  {students.map((student, idx) => (
                    <div
                      key={student.id}
                      className={cn(
                        "student-item flex items-center justify-between gap-4 rounded-[1.4rem] border border-primary/15 px-4 py-3 shadow-[0_10px_24px_rgba(20,54,34,0.04)]",
                        idx % 2 === 1 ? "bg-green-soft/70" : "bg-green-soft"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-card/80 text-sm font-bold text-primary">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <p className="student-name truncate text-[1.12rem] font-semibold leading-tight text-foreground">
                              {student.name}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <p className="uppercase tracking-[0.14em]">Registro de aluno</p>
                              {student.whatsapp ? <p>WhatsApp: {student.whatsapp}</p> : null}
                              {student.image ? <p className="truncate">Imagem: {student.image}</p> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="student-actions flex items-center gap-2">
                        <button
                          className="secondary icon-btn rounded-2xl border border-border bg-card px-3 py-2.5 text-sm"
                          title="Editar aluno"
                          aria-label="Editar aluno"
                          onClick={() => startEditStudent(student)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="secondary icon-btn rounded-2xl border border-border bg-card px-3 py-2.5 text-sm"
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
            </div>
          </div>
          ) : null}

          {activeSection === "lessons" ? (
          <div className="rounded-2xl bg-card/80 p-4 flex flex-col min-h-0 h-full">
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
          ) : null}
        </div>
        {loading ? <p className="pt-3 text-sm text-muted-foreground shrink-0">Carregando agenda...</p> : null}
        {feedback ? <p className="pt-3 text-sm text-destructive shrink-0">{feedback}</p> : null}
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-transparent"
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
      {isStudentModalOpen ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-transparent"
            onClick={resetStudentForm}
            aria-label="Fechar edição de aluno"
          />
          <div className="relative w-full max-w-xl rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {editingStudentId ? "Editar aluno" : "Novo aluno"}
                </p>
                <h4 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {editingStudentId ? "Atualizar cadastro" : "Cadastrar aluno"}
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Preencha nome, WhatsApp e imagem do aluno. Os campos extras são opcionais.
                </p>
              </div>
              <button
                onClick={resetStudentForm}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Fechar
              </button>
            </div>
            <div className="space-y-4 rounded-[1.5rem] border border-primary/15 bg-muted/20 p-4">
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
                inputClassName="bg-amber-100/70 rounded-t-md px-2"
              />
              <UnderlineInput
                label="WhatsApp"
                value={studentWhatsapp}
                onChange={(v) => setStudentWhatsapp(v)}
                placeholder="Ex.: 5581999999999"
                inputClassName="bg-amber-100/70 rounded-t-md px-2"
              />
              <UnderlineInput
                label="Imagem"
                value={studentImage}
                onChange={(v) => setStudentImage(v)}
                placeholder="URL ou caminho da imagem"
                inputClassName="bg-amber-100/70 rounded-t-md px-2"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={resetStudentForm}
                className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={addStudent}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-green-deep"
              >
                <Plus size={15} /> {editingStudentId ? "Salvar Aluno" : "Adicionar Aluno"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
