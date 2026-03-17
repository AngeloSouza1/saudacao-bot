"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings } from "lucide-react"
import { ModalShell, ModalActions, UnderlineInput } from "./ModalShell"

interface ConfigModalProps {
  open: boolean
  onClose: () => void
  initialConfig?: {
    turma?: string
    instituicao?: string
    antecedenciaMin?: number
    diasUteisApenas?: boolean
    lockTimeoutMin?: number
    lockConfigured?: boolean
  }
  initialState?: {
    idxAluno?: number
    idxAula?: number
    dataInicio?: string
  }
  students?: string[]
  scheduleSummary?: Array<{ dia?: string | number; horario?: string; materia?: string }>
  onSaved?: () => Promise<void> | void
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await res.json()
  if (!res.ok) throw new Error(String(payload?.error || "Falha ao salvar."))
  return payload
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

export function ConfigModal({
  open,
  onClose,
  initialConfig,
  initialState,
  students = [],
  scheduleSummary = [],
  onSaved,
}: ConfigModalProps) {
  const [turma, setTurma] = useState("RiseCode")
  const [instituicao, setInstituicao] = useState("AlphaTech")
  const [antecedenciaMin, setAntecedenciaMin] = useState("600")
  const [diasUteisApenas, setDiasUteisApenas] = useState("true")
  const [lockPassword, setLockPassword] = useState("")
  const [lockTimeoutMin, setLockTimeoutMin] = useState("1")
  const [startAluno, setStartAluno] = useState("0")
  const [startAula, setStartAula] = useState("0")
  const [startDate, setStartDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    if (!open) return
    setTurma(String(initialConfig?.turma || ""))
    setInstituicao(String(initialConfig?.instituicao || ""))
    setAntecedenciaMin(String(Number(initialConfig?.antecedenciaMin ?? 0)))
    setDiasUteisApenas(String(Boolean(initialConfig?.diasUteisApenas)))
    setLockPassword("")
    setLockTimeoutMin(String(Number(initialConfig?.lockTimeoutMin ?? 15)))
    setStartAluno(String(Number(initialState?.idxAluno ?? 0)))
    setStartAula(String(Number(initialState?.idxAula ?? 0)))
    setStartDate(String(initialState?.dataInicio || ""))
    setFeedback("")
  }, [open, initialConfig, initialState])

  const aulasOptions = useMemo(() => {
    return (Array.isArray(scheduleSummary) ? scheduleSummary : []).map((item, idx) => ({
      value: String(idx),
      label: `${idx + 1} - ${DIA_LONGO[String(item?.dia ?? "")] || "dia"} ${String(item?.horario || "--:--")} | ${String(item?.materia || "")}`,
    }))
  }, [scheduleSummary])

  async function handleSave() {
    setLoading(true)
    setFeedback("")
    try {
      await postJson("/api/config", {
        turma: turma.trim(),
        instituicao: instituicao.trim(),
        antecedenciaMin: Number(antecedenciaMin || 0),
        diasUteisApenas: diasUteisApenas === "true",
        lockTimeoutMin: Number(lockTimeoutMin || 15),
        ...(lockPassword.trim() ? { lockPassword: lockPassword.trim() } : {}),
      })
      await postJson("/api/state", {
        idxAluno: Number(startAluno || 0),
        idxAula: Number(startAula || 0),
        dataInicio: startDate,
      })
      if (onSaved) await onSaved()
      onClose()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar configuração."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Configuração"
      subtitle="Ciclo, regras e segurança"
      icon={<Settings size={16} className="text-primary" />}
      size="xl"
    >
      <div className="px-6 py-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UnderlineInput label="Turma" value={turma} onChange={setTurma} />
          <UnderlineInput label="Instituição" value={instituicao} onChange={setInstituicao} />
          <UnderlineInput
            label="Antecedência (min)"
            value={antecedenciaMin}
            onChange={setAntecedenciaMin}
            type="number"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dias úteis apenas</label>
            <select
              value={diasUteisApenas}
              onChange={(e) => setDiasUteisApenas(e.target.value)}
              className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>
          <UnderlineInput
            label="Senha de bloqueio"
            value={lockPassword}
            onChange={setLockPassword}
            type="password"
            placeholder="Digite para definir/alterar"
          />
          <UnderlineInput
            label="Tempo para bloqueio (min)"
            value={lockTimeoutMin}
            onChange={setLockTimeoutMin}
            type="number"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aluno inicial dos envios</label>
            <select
              value={startAluno}
              onChange={(e) => setStartAluno(e.target.value)}
              className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
            >
              {(students || []).map((student, idx) => (
                <option key={`${student}-${idx}`} value={String(idx)}>
                  {idx + 1} - {student}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aula inicial dos envios</label>
            <select
              value={startAula}
              onChange={(e) => setStartAula(e.target.value)}
              className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
            >
              {aulasOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <UnderlineInput label="Data de início" value={startDate} onChange={setStartDate} type="date" />
        </div>
      </div>

      {feedback ? <p className="px-6 pb-3 text-sm text-destructive">{feedback}</p> : null}
      <ModalActions onCancel={onClose} onConfirm={handleSave} confirmLabel="Salvar Configuração" loading={loading} />
    </ModalShell>
  )
}
