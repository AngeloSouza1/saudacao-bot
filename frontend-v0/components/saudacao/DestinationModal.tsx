"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { ModalShell, ModalActions, UnderlineInput } from "./ModalShell"

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
  const [groupId, setGroupId] = useState("")
  const [groupName, setGroupName] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    if (!open) return
    setTo(String(initialValues?.to || ""))
    setGroupId(String(initialValues?.groupId || ""))
    setGroupName(String(initialValues?.groupName || ""))
    setFeedback("")
  }, [open, initialValues?.groupId, initialValues?.groupName, initialValues?.to])

  async function handleSave() {
    setLoading(true)
    setFeedback("")
    try {
      await postJson("/api/settings", {
        to: to.trim(),
        groupId: groupId.trim(),
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
        />
        <UnderlineInput
          label="ID do Grupo"
          value={groupId}
          onChange={setGroupId}
          placeholder="1203...@g.us"
          hint="Cole o ID do grupo do WhatsApp."
        />
        <UnderlineInput
          label="Nome do Grupo"
          value={groupName}
          onChange={setGroupName}
          placeholder="Turma Redes e Internet"
          hint="Opcional quando o ID já estiver preenchido."
        />
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Prioridade de envio: <b>Grupo ID</b> → <b>Nome do Grupo</b> → <b>Número</b>.
        </div>
      </div>

      {feedback ? <p className="px-6 pb-3 text-sm text-destructive">{feedback}</p> : null}
      <ModalActions onCancel={onClose} onConfirm={handleSave} confirmLabel="Salvar Destino" loading={loading} />
    </ModalShell>
  )
}
