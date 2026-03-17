"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
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

  useEffect(() => {
    if (!open) return
    setTo(String(initialValues?.to || ""))
    const initialGroupName = String(initialValues?.groupName || "")
    setGroupName(initialGroupName)
    setSelectedGroup(initialGroupName)
    setFeedback("")
    setFieldErrors({})
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grupos disponíveis</label>
          <select
            value={selectedGroup}
            onChange={(e) => {
              const value = e.target.value
              setSelectedGroup(value)
              setGroupName(value)
            }}
            className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground transition-colors"
          >
            <option value="">
              {groupsLoading ? "Carregando grupos..." : "Selecione um grupo"}
            </option>
            {groups.map((group) => (
              <option key={group.id || group.name} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Selecione da lista ou digite manualmente no campo acima.
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
