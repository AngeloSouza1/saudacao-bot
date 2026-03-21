"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, Calendar, Clock3, GraduationCap, NotebookText, Pencil, Search, Trash2, UserRound, Plus, X } from "lucide-react"
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
  initialSection?: AgendaSection
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

function sanitizeFilterValue(value: unknown) {
  const text = String(value ?? "").trim()
  const normalized = text.toLocaleLowerCase("pt-BR")
  if (!text || normalized === "null" || normalized === "undefined") return ""
  return text
}

function forceCleanFilterInput(input: HTMLInputElement | null, nextValue = "") {
  if (!input) return
  const sanitized = sanitizeFilterValue(nextValue)
  input.value = sanitized
  requestAnimationFrame(() => {
    if (input.value !== sanitized) input.value = sanitized
  })
}

export function ScheduleModal({ open, onClose, onSaved, initialSection = null }: ScheduleModalProps) {
  const studentFilterInputRef = useRef<HTMLInputElement | null>(null)
  const [activeSection, setActiveSection] = useState<AgendaSection>(null)
  const [studentName, setStudentName] = useState("")
  const [studentWhatsapp, setStudentWhatsapp] = useState("")
  const [studentImage, setStudentImage] = useState("")
  const [studentFilter, setStudentFilter] = useState("")
  const [lessonFilter, setLessonFilter] = useState("")
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

  const filteredStudents = useMemo(() => {
    const query = normalizeText(sanitizeFilterValue(studentFilter)).toLocaleLowerCase("pt-BR")
    if (!query) return students

    return students.filter((student) => {
      const name = normalizeText(student.name).toLocaleLowerCase("pt-BR")
      const whatsapp = normalizeText(student.whatsapp).toLocaleLowerCase("pt-BR")
      return name.includes(query) || whatsapp.includes(query)
    })
  }, [studentFilter, students])

  const filteredLessons = useMemo(() => {
    const query = normalizeText(sanitizeFilterValue(lessonFilter)).toLocaleLowerCase("pt-BR")
    if (!query) return lessons

    return lessons.filter((lesson) => {
      const titulo = normalizeText(lesson.titulo).toLocaleLowerCase("pt-BR")
      const materia = normalizeText(lesson.materia).toLocaleLowerCase("pt-BR")
      const professor = normalizeText(lesson.professor).toLocaleLowerCase("pt-BR")
      return titulo.includes(query) || materia.includes(query) || professor.includes(query)
    })
  }, [lessonFilter, lessons])

  const safeStudentFilter = sanitizeFilterValue(studentFilter)

  useEffect(() => {
    const input = studentFilterInputRef.current
    forceCleanFilterInput(input, safeStudentFilter)
  }, [safeStudentFilter])

  useEffect(() => {
    if (!open) return
    setActiveSection(initialSection)
  }, [open, initialSection])

  useEffect(() => {
    if (activeSection !== "students" && studentFilter) {
      setStudentFilter("")
    }
    if (activeSection !== "lessons" && lessonFilter) {
      setLessonFilter("")
    }
  }, [activeSection, lessonFilter, studentFilter])

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
        setActiveSection(initialSection)
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
  }, [open, initialSection])

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

  function resetLessonForm() {
    setEditingLessonId(null)
    setLessonForm({ dia: "", hora: "", titulo: "", materia: "", professor: "" })
    setLessonErrors({})
    setShowLessonForm(false)
  }

  function openCreateLessonModal() {
    resetLessonForm()
    setShowLessonForm(true)
    setActiveSection("lessons")
  }

  async function addStudent() {
    const name = studentName.trim()
    if (!isValidStudentName(name)) {
      setStudentError("Nome de aluno inválido.")
      return
    }
    const normalizedName = normalizeText(name).toLowerCase()
    const alreadyExists = students.some((s) => {
      if (editingStudentId && s.id === editingStudentId) return false
      return normalizeText(s.name).toLowerCase() === normalizedName
    })
    if (alreadyExists) {
      setStudentError("Este aluno já está cadastrado.")
      return
    }

    const nextStudents = editingStudentId
      ? sortStudentsByName(
          students.map((s) =>
            s.id === editingStudentId
              ? { ...s, name, whatsapp: studentWhatsapp.trim(), image: studentImage.trim() }
              : s
          )
        )
      : sortStudentsByName([
          ...students,
          { id: `s${Date.now()}`, name, whatsapp: studentWhatsapp.trim(), image: studentImage.trim() },
        ])

    const saved = await persistAgendaChanges(nextStudents, lessons)
    if (!saved) return

    setStudents(nextStudents)
    if (editingStudentId) {
      setEditingStudentId(null)
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

  async function confirmRemoveStudent(id: string) {
    const nextStudents = students.filter((s) => s.id !== id)
    const saved = await persistAgendaChanges(nextStudents, lessons)
    if (!saved) return
    setStudents(nextStudents)
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

  async function addLesson() {
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

    const nextLessons = editingLessonId
      ? lessons.map((l) =>
          l.id === editingLessonId
            ? { ...l, dia: lessonForm.dia, hora, titulo, materia, professor }
            : l
        )
      : [
          ...lessons,
          {
            id: `l${Date.now()}`,
            dia: lessonForm.dia,
            hora,
            titulo,
            materia,
            professor,
          },
        ]

    const saved = await persistAgendaChanges(students, nextLessons)
    if (!saved) return

    setLessons(nextLessons)
    if (editingLessonId) {
      setEditingLessonId(null)
    }
    resetLessonForm()
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

  async function confirmRemoveLesson(id: string) {
    const nextLessons = lessons.filter((l) => l.id !== id)
    const saved = await persistAgendaChanges(students, nextLessons)
    if (!saved) return
    setLessons(nextLessons)
    if (editingLessonId === id) {
      resetLessonForm()
    }
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget) return
    if (deleteTarget.kind === "student") {
      await confirmRemoveStudent(deleteTarget.id)
    } else {
      await confirmRemoveLesson(deleteTarget.id)
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

  function buildAgendaPayload(studentList: Student[], lessonList: Lesson[]) {
    const alunos = studentList.map((s) => String(s.name || "").trim()).filter(Boolean)
    const alunoDetalhes = studentList.map((s) => ({
      nome: String(s.name || "").trim(),
      whatsapp: String(s.whatsapp || "").trim(),
      imagem: String(s.image || "").trim(),
    }))
    const agendaSemanal = lessonsToAgenda(lessonList)
    return { alunos, alunoDetalhes, agendaSemanal }
  }

  async function persistAgendaChanges(
    nextStudents: Student[],
    nextLessons: Lesson[],
    options?: { closeOnSuccess?: boolean }
  ) {
    if (!nextStudents.length) {
      setFeedback("Cadastre ao menos 1 aluno antes de salvar.")
      return false
    }
    if (!nextLessons.length) {
      setFeedback("Cadastre ao menos 1 item de aula antes de salvar.")
      return false
    }

    setSaving(true)
    setFeedback("")
    try {
      const { alunos, alunoDetalhes, agendaSemanal } = buildAgendaPayload(nextStudents, nextLessons)
      await fetchJson("/api/agenda-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunos, alunoDetalhes, agendaSemanal }),
      })
      if (onSaved) await onSaved()
      if (options?.closeOnSuccess) onClose()
      return true
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar agenda."))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAgenda() {
    await persistAgendaChanges(students, lessons, { closeOnSuccess: true })
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
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[1220px] flex-col gap-1 overflow-hidden">
            <div className="-mt-3 px-5 py-4">
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
              <div className="mb-3 flex items-center gap-3 rounded-[1.25rem] border border-border bg-muted/20 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary">
                  <Search size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor="student-filter" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Filtrar alunos
                  </label>
                  <input
                    ref={studentFilterInputRef}
                    id="student-filter"
                    value={safeStudentFilter}
                    onChange={(e) => {
                      const sanitized = sanitizeFilterValue(e.target.value)
                      forceCleanFilterInput(e.currentTarget, sanitized)
                      setStudentFilter(sanitized)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault()
                        e.stopPropagation()
                        forceCleanFilterInput(e.currentTarget, "")
                        setStudentFilter("")
                        e.currentTarget.blur()
                      }
                    }}
                    onKeyUp={(e) => {
                      forceCleanFilterInput(e.currentTarget, e.currentTarget.value)
                    }}
                    onFocus={(e) => {
                      forceCleanFilterInput(e.currentTarget, e.currentTarget.value)
                    }}
                    onBlur={(e) => {
                      const sanitized = sanitizeFilterValue(e.currentTarget.value)
                      forceCleanFilterInput(e.currentTarget, sanitized)
                      if (studentFilter !== sanitized) setStudentFilter(sanitized)
                    }}
                    placeholder="Buscar por aluno ou WhatsApp"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div
                id="modal-students"
                className="h-[calc(90vh-300px)] min-h-0 overflow-y-auto overflow-x-hidden rounded-[1.4rem] border border-border bg-muted/15 p-3"
              >
                {filteredStudents.length ? (
                <div className="space-y-3">
                  {filteredStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className={cn(
                        "student-item flex items-center justify-between gap-4 rounded-[1.4rem] border border-primary/12 px-4 py-3 shadow-[0_10px_24px_rgba(20,54,34,0.04)] transition-colors hover:bg-primary/8",
                        idx % 2 === 1 ? "bg-muted/18" : "bg-primary/6"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-card/80 text-sm font-bold text-primary">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              {student.image ? (
                                <img
                                  src={student.image}
                                  alt={`Foto de ${student.name}`}
                                  className="h-11 w-11 shrink-0 rounded-2xl border border-primary/15 object-cover shadow-sm"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                  }}
                                />
                              ) : null}
                              <p className="student-name truncate text-[1.12rem] font-semibold leading-tight text-foreground">
                                {student.name}
                              </p>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <p className="uppercase tracking-[0.14em]">Registro de aluno</p>
                              {student.whatsapp ? <p>WhatsApp: {student.whatsapp}</p> : null}
                              {student.image ? <p>Imagem cadastrada</p> : null}
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
                ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center rounded-[1.4rem] border border-dashed border-border bg-card/70 px-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Nenhum aluno encontrado</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Ajuste o filtro para buscar por nome do aluno ou número de WhatsApp.
                    </p>
                  </div>
                </div>
                )}
              </div>
            </div>
            </div>
          </div>
          ) : null}

          {activeSection === "lessons" ? (
          <div className="rounded-2xl bg-card/80 p-4 flex flex-col min-h-0 h-full">
            <h3 className="text-[2rem] font-black tracking-tight text-foreground">Aulas da Semana</h3>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                onClick={openCreateLessonModal}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-green-deep"
              >
                <Plus size={14} /> Adicionar Aula
              </button>
              <div className="flex w-full max-w-[500px] items-center gap-3 rounded-[1.25rem] border border-border bg-muted/20 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary">
                  <Search size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Filtrar aulas
                  </label>
                  <input
                    value={sanitizeFilterValue(lessonFilter)}
                    onChange={(e) => setLessonFilter(sanitizeFilterValue(e.target.value))}
                    placeholder="Buscar por título, matéria ou professor"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <div
              id="modal-lessons"
              className={cn(
                "agenda-list mt-7 h-[430px] min-h-0 shrink-0 overflow-x-auto overflow-y-auto rounded-xl border border-border"
              )}
            >
              <table className="table w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[36%]" />
                  <col className="w-[17%]" />
                  <col className="w-[17%]" />
                  <col className="w-[6%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/92">
                  <tr className="h-10">
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-2">
                        <Calendar size={13} className="text-primary" />
                        Dia
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 size={13} className="text-primary" />
                        Hora
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-2">
                        <NotebookText size={13} className="text-primary" />
                        Título
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-2">
                        <BookOpen size={13} className="text-primary" />
                        Matéria
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
                      <span className="inline-flex items-center gap-2">
                        <UserRound size={13} className="text-primary" />
                        Professor
                      </span>
                    </th>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredLessons.map((lesson, idx) => (
                    <tr
                      key={lesson.id}
                      className={cn(
                        "h-14 border-b border-border/60 transition-colors hover:bg-primary/8 last:border-b-0",
                        idx % 2 ? "bg-muted/18" : "bg-primary/6"
                      )}
                    >
                      <td className="px-3 py-2 align-middle text-[15px]">
                        {(DAY_OPTIONS.find((d) => d.value === String(lesson.dia))?.label || lesson.dia).replace(/^\d+\s-\s/, "").slice(0, 3)}
                      </td>
                      <td className="px-3 py-2 align-middle text-[15px] tabular-nums">{lesson.hora}</td>
                      <td className="px-3 py-2 align-middle text-[15px]">{lesson.titulo}</td>
                      <td className="px-3 py-2 align-middle text-[15px]">{lesson.materia}</td>
                      <td className="px-3 py-2 align-middle text-[15px]">{lesson.professor}</td>
                      <td className="px-3 py-2 align-middle">
                        <button
                          className="secondary icon-btn rounded-xl border border-border bg-card px-3 py-2"
                          title="Editar aula"
                          aria-label="Editar aula"
                          onClick={() => startEditLesson(lesson)}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                      <td className="px-3 py-2 align-middle">
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
              {!filteredLessons.length ? (
                <div className="flex min-h-[180px] items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Nenhuma aula encontrada</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Ajuste o filtro para pesquisar por título, matéria ou professor.
                    </p>
                  </div>
                </div>
              ) : null}
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
                aria-label="Fechar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
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
      {isLessonFormVisible ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-transparent"
            onClick={resetLessonForm}
            aria-label="Fechar edição de aula"
          />
          <div className="relative w-full max-w-2xl rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {editingLessonId ? "Editar aula" : "Nova aula"}
                </p>
                <h4 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {editingLessonId ? "Atualizar aula" : "Cadastrar aula"}
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Preencha dia, hora, título, matéria e professor da aula.
                </p>
              </div>
              <button
                onClick={resetLessonForm}
                aria-label="Fechar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 rounded-[1.5rem] border border-primary/15 bg-muted/20 p-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dia</label>
                <select
                  value={lessonForm.dia}
                  onChange={(e) => {
                    setLessonForm((p) => ({ ...p, dia: e.target.value }))
                    setLessonErrors((prev) => ({ ...prev, dia: "" }))
                  }}
                  className={`border-0 border-b-2 outline-none py-1.5 text-sm text-foreground transition-colors ${
                    lessonErrors.dia ? "border-status-err focus:border-status-err" : "border-input focus:border-primary"
                  } ${editingLessonId ? "bg-amber-100/70 rounded-t-md px-2" : "bg-transparent"}`}
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
              <div className="md:col-span-2">
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
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={resetLessonForm}
                className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={addLesson}
                disabled={!isLessonValid}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-green-deep disabled:opacity-50"
              >
                <Plus size={15} /> {editingLessonId ? "Salvar Aula" : "Adicionar Aula"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
