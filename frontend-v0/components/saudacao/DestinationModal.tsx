"use client"

import { useEffect, useState } from "react"
import { Lock, LockOpen, Users } from "lucide-react"
import { ModalShell, ModalActions, UnderlineInput } from "./ModalShell"
import { isNullWord, isValidPhoneFallback, normalizeText } from "@/lib/validation"

interface DestinationModalProps {
  open: boolean
  onClose: () => void
  initialValues?: {
    to?: string
    groupId?: string
    groupName?: string
  }
  onSaved?: () => Promise<void> | void
}

interface GroupOption {
  id: string
  name: string
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

export function DestinationModal({ open, onClose, initialValues, onSaved }: DestinationModalProps) {
  const [to, setTo] = useState("")
  const [groupName, setGroupName] = useState("")
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroup, setSelectedGroup] = useState("")
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ to?: string; groupName?: string }>({})
  const [destinationUnlocked, setDestinationUnlocked] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState("")
  const [unlockPromptOpen, setUnlockPromptOpen] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [unlockFeedback, setUnlockFeedback] = useState("")

  useEffect(() => {
    if (!open) return
    setTo(String(initialValues?.to || ""))
    const initialGroupName = String(initialValues?.groupName || "")
    setGroupName(initialGroupName)
    setSelectedGroup(initialGroupName)
    setFeedback("")
    setFieldErrors({})
    setDestinationUnlocked(false)
    setUnlockPassword("")
    setUnlockPromptOpen(false)
    setUnlockFeedback("")
    setGroupsLoading(true)
    fetch("/api/groups")
      .then(async (res) => {
        const payload = await res.json()
        const list = Array.isArray(payload?.groups) ? payload.groups : []
        setGroups(
          list
            .map((item: { id?: string; name?: string }) => ({
              id: String(item?.id || ""),
              name: String(item?.name || ""),
            }))
            .filter((item: GroupOption) => item.name)
        )
      })
      .catch(() => {
        setGroups([])
      })
      .finally(() => {
        setGroupsLoading(false)
      })
  }, [open, initialValues?.groupName, initialValues?.to])

  async function handleUnlockDestination() {
    if (!unlockPassword.trim()) {
      setUnlockFeedback("Digite a senha para liberar a seleção.")
      return
    }

    setUnlockLoading(true)
    setUnlockFeedback("")
    try {
      const res = await fetch("/api/unlock-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: unlockPassword }),
      })
      const payload = await res.json()
      if (!res.ok || !payload?.ok) {
        throw new Error(String(payload?.error || "Senha inválida."))
      }
      setDestinationUnlocked(true)
      setUnlockPromptOpen(false)
      setUnlockPassword("")
      setUnlockFeedback("")
    } catch (error) {
      setUnlockFeedback(String((error as Error)?.message || "Falha ao validar senha."))
    } finally {
      setUnlockLoading(false)
    }
  }

  async function handleSave() {
    const nextErrors: { to?: string; groupName?: string } = {}
    const toValue = normalizeText(to)
    const groupNameValue = normalizeText(groupName)
    if (!groupNameValue && !toValue) {
      nextErrors.groupName = "Informe o nome do grupo ou um número de fallback."
      nextErrors.to = "Informe o nome do grupo ou um número de fallback."
    }
    if (groupNameValue && (groupNameValue.length < 2 || isNullWord(groupNameValue))) {
      nextErrors.groupName = "Nome do grupo inválido."
    }
    if (!isValidPhoneFallback(toValue)) {
      nextErrors.to = "Número inválido. Use entre 10 e 15 dígitos."
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    setFeedback("")
    try {
      await postJson("/api/settings", {
        to: to.trim(),
        groupId: "",
        groupName: groupName.trim(),
      })
      if (onSaved) await onSaved()
      onClose()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao salvar destino."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Destino"
      subtitle="Grupo, contato e envio"
      icon={<Users size={16} className="text-primary" />}
      size="md"
    >
      <div className="px-6 py-6 flex flex-col gap-6">
        <UnderlineInput
          label="Número (fallback)"
          value={to}
          onChange={setTo}
          placeholder="5511999990000"
          hint="Usado quando grupo não estiver definido."
          type="tel"
          error={fieldErrors.to}
        />
        <UnderlineInput
          label="Nome do Grupo"
          value={groupName}
          onChange={(v) => {
            setGroupName(v)
            setSelectedGroup(v)
          }}
          placeholder="Turma Redes e Internet"
          hint="Grupo principal para envio das saudações."
          error={fieldErrors.groupName}
          required
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Grupos disponíveis
            </label>
            <button
              type="button"
              onClick={() => {
                if (destinationUnlocked) {
                  setDestinationUnlocked(false)
                  setUnlockPromptOpen(false)
                  setUnlockPassword("")
                  setUnlockFeedback("")
                  return
                }
                setUnlockPromptOpen((current) => !current)
                setUnlockFeedback("")
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label={destinationUnlocked ? "Bloquear seleção de grupo" : "Desbloquear seleção de grupo"}
            >
              {destinationUnlocked ? <LockOpen size={12} /> : <Lock size={12} />}
              {destinationUnlocked ? "Liberado" : "Bloqueado"}
            </button>
          </div>
          <select
            value={selectedGroup}
            onChange={(e) => {
              const value = e.target.value
              setSelectedGroup(value)
              setGroupName(value)
            }}
            disabled={!destinationUnlocked}
            className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground"
          >
            <option value="">
              {groupsLoading ? "Carregando grupos..." : destinationUnlocked ? "Selecione um grupo" : "Seleção bloqueada"}
            </option>
            {groups.map((group) => (
              <option key={group.id || group.name} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
          {unlockPromptOpen && !destinationUnlocked ? (
            <div className="mt-2 rounded-xl border border-border bg-muted/20 px-3 py-3">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  Digite a senha para liberar a lista de grupos.
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Senha de desbloqueio"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUnlockDestination}
                  disabled={unlockLoading}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-green-deep disabled:opacity-60"
                >
                  Liberar
                </button>
              </div>
              {unlockFeedback ? (
                <p className="mt-2 text-[11px] text-status-err">{unlockFeedback}</p>
              ) : null}
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {destinationUnlocked
              ? "Selecione da lista ou digite manualmente no campo acima."
              : "A lista está protegida por senha. Você ainda pode digitar manualmente no campo acima."}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Prioridade de envio: <b>Nome do Grupo</b> → <b>Número</b>.
        </div>
      </div>

      {feedback ? <p className="px-6 pb-3 text-sm text-destructive">{feedback}</p> : null}
      <ModalActions onCancel={onClose} onConfirm={handleSave} confirmLabel="Salvar Destino" loading={loading} />
    </ModalShell>
  )
}
