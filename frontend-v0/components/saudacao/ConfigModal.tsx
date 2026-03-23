"use client"

import { useEffect, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { ModalShell, ModalActions, UnderlineInput } from "./ModalShell"
import { isNullWord, normalizeText } from "@/lib/validation"

interface ConfigModalProps {
  open: boolean
  onClose: () => void
  initialConfig?: {
    turma?: string
    instituicao?: string
    antecedenciaMin?: number
    horarioEnvio?: string
    diasUteisApenas?: boolean
    lockTimeoutMin?: number
    lockConfigured?: boolean
  }
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

export function ConfigModal({
  open,
  onClose,
  initialConfig,
  onSaved,
}: ConfigModalProps) {
  const wasOpenRef = useRef(false)
  const [turma, setTurma] = useState("RiseCode")
  const [instituicao, setInstituicao] = useState("AlphaTech")
  const [horarioEnvio, setHorarioEnvio] = useState("19:55")
  const [diasUteisApenas, setDiasUteisApenas] = useState("true")
  const [lockPassword, setLockPassword] = useState("")
  const [lockTimeoutMin, setLockTimeoutMin] = useState("1")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTurma(String(initialConfig?.turma || ""))
      setInstituicao(String(initialConfig?.instituicao || ""))
      setHorarioEnvio(String(initialConfig?.horarioEnvio || "19:55"))
      setDiasUteisApenas(String(Boolean(initialConfig?.diasUteisApenas)))
      setLockPassword("")
      setLockTimeoutMin(String(Number(initialConfig?.lockTimeoutMin ?? 15)))
      setFeedback("")
      setFieldErrors({})
    }
    wasOpenRef.current = open
  }, [open, initialConfig])

  async function handleSave() {
    const nextErrors: Record<string, string> = {}
    const turmaValue = normalizeText(turma)
    const instituicaoValue = normalizeText(instituicao)
    const lockTimeoutValue = Number(lockTimeoutMin || 0)
    const lockPasswordValue = normalizeText(lockPassword)

    if (turmaValue.length < 2 || isNullWord(turmaValue)) {
      nextErrors.turma = "Turma inválida."
    }
    if (instituicaoValue.length < 2 || isNullWord(instituicaoValue)) {
      nextErrors.instituicao = "Instituição inválida."
    }
    if (!/^\d{2}:\d{2}$/.test(horarioEnvio)) {
      nextErrors.horarioEnvio = "Horário inválido. Use HH:MM."
    }
    if (!Number.isFinite(lockTimeoutValue) || lockTimeoutValue < 1 || lockTimeoutValue > 240) {
      nextErrors.lockTimeoutMin = "Tempo de bloqueio inválido (1 a 240)."
    }
    if (lockPasswordValue && lockPasswordValue.length < 4) {
      nextErrors.lockPassword = "A senha deve ter ao menos 4 caracteres."
    }

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    setFeedback("")
    try {
      await postJson("/api/config", {
        turma: turma.trim(),
        instituicao: instituicao.trim(),
        horarioEnvio: horarioEnvio.trim(),
        diasUteisApenas: diasUteisApenas === "true",
        lockTimeoutMin: Number(lockTimeoutMin || 15),
        ...(lockPassword.trim() ? { lockPassword: lockPassword.trim() } : {}),
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
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title="Configuração"
        subtitle="Ciclo, regras e segurança"
        icon={<Settings size={16} className="text-primary" />}
        size="xl"
      >
        <div className="px-6 py-6 flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Identidade
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <UnderlineInput label="Turma" value={turma} onChange={setTurma} required error={fieldErrors.turma} />
              <UnderlineInput label="Instituição" value={instituicao} onChange={setInstituicao} required error={fieldErrors.instituicao} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Regras e segurança
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <UnderlineInput
                label="Horário de envio"
                value={horarioEnvio}
                onChange={setHorarioEnvio}
                type="text"
                placeholder="Ex.: 19:55"
                hint="Informe a hora exata no formato HH:MM."
                error={fieldErrors.horarioEnvio}
                inputClassName="font-mono"
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
                <p className="text-[11px] text-muted-foreground">
                  Define a hora exata em que o envio automático será disparado nos dias com aula.
                </p>
              </div>
              <UnderlineInput
                label="Senha de bloqueio"
                value={lockPassword}
                onChange={setLockPassword}
                type="password"
                placeholder="Digite para definir/alterar"
                error={fieldErrors.lockPassword}
              />
              <UnderlineInput
                label="Tempo para bloqueio (min)"
                value={lockTimeoutMin}
                onChange={setLockTimeoutMin}
                type="number"
                error={fieldErrors.lockTimeoutMin}
              />
            </div>
          </div>
        </div>

        {feedback ? <p className="px-6 pb-3 text-sm text-destructive">{feedback}</p> : null}
        <ModalActions onCancel={onClose} onConfirm={handleSave} confirmLabel="Salvar Configuração" loading={loading} />
      </ModalShell>
    </>
  )
}
