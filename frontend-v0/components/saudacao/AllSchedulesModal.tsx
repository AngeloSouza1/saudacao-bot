"use client"

import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"
import { ModalShell, ModalActions } from "./ModalShell"
import type { GreetingItem } from "./UpcomingGreetingsCard"

interface AllSchedulesModalProps {
  open: boolean
  onClose: () => void
  items: GreetingItem[]
  onRefresh?: () => Promise<void> | void
}

export function AllSchedulesModal({ open, onClose, items, onRefresh }: AllSchedulesModalProps) {
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [swapFromIndex, setSwapFromIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      setSwapFromIndex(null)
      setFeedback("")
      setSending(false)
    }
  }, [open])

  async function handleSendPending() {
    setSending(true)
    setFeedback("")
    try {
      const res = await fetch("/api/send-agenda-list", { method: "POST" })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(String(payload?.error || "Falha ao enviar lista pendente."))
      }
      setFeedback(String(payload?.message || "Lista de agendamentos enviada pelo WhatsApp."))
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao enviar lista pendente."))
    } finally {
      setSending(false)
    }
  }

  async function handleMarkAbsent(item: GreetingItem) {
    if (!Number.isInteger(item.pendingIndex)) return
    setSending(true)
    setFeedback("")
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno: item.studentName,
          pendingIndex: item.pendingIndex,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(String(payload?.error || "Falha ao registrar ausência."))
      }
      setFeedback(String(payload?.message || "Ausência registrada com sucesso."))
      if (onRefresh) await onRefresh()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao registrar ausência."))
    } finally {
      setSending(false)
    }
  }

  async function handleSwap(item: GreetingItem) {
    if (!Number.isInteger(item.pendingIndex)) return
    if (swapFromIndex === null) {
      setSwapFromIndex(Number(item.pendingIndex))
      setFeedback(`Selecione o segundo aluno para trocar com ${item.studentName}.`)
      return
    }
    if (swapFromIndex === item.pendingIndex) {
      setSwapFromIndex(null)
      setFeedback("Troca cancelada.")
      return
    }
    const from = items.find((entry) => entry.pendingIndex === swapFromIndex)
    const to = item
    if (!from || !Number.isInteger(from.pendingIndex) || !Number.isInteger(to.pendingIndex)) {
      setSwapFromIndex(null)
      setFeedback("Não foi possível identificar os alunos para troca.")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/swap-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPendingIndex: from.pendingIndex,
          toPendingIndex: to.pendingIndex,
          fromAluno: from.studentName,
          toAluno: to.studentName,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(String(payload?.error || "Falha ao trocar alunos."))
      }
      setFeedback(String(payload?.message || "Posição dos alunos atualizada."))
      setSwapFromIndex(null)
      if (onRefresh) await onRefresh()
    } catch (error) {
      setFeedback(String((error as Error)?.message || "Falha ao trocar alunos."))
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Todos os agendamentos"
      subtitle="Lista completa de saudações"
      icon={<CalendarDays size={16} className="text-primary" />}
      size="xl"
    >
      <div className="px-6 py-5">
        <div className="rounded-2xl border border-border overflow-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Aluno</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Data</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Hora</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Detalhes</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-muted-foreground" colSpan={5}>
                    Sem agendamentos pendentes.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-green-soft/50" : "bg-card"}>
                    <td className="px-4 py-3 font-semibold">{item.studentName}</td>
                    <td className="px-4 py-3 tabular-nums">{item.date}</td>
                    <td className="px-4 py-3 tabular-nums">{item.time}</td>
                    <td className="px-4 py-3">{item.classInfo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkAbsent(item)}
                          disabled={sending || !Number.isInteger(item.pendingIndex)}
                          className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          Ausente
                        </button>
                        <button
                          onClick={() => handleSwap(item)}
                          disabled={sending || !Number.isInteger(item.pendingIndex)}
                          className={`rounded-xl border px-3 py-1.5 text-xs disabled:opacity-50 ${
                            swapFromIndex === item.pendingIndex
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          {swapFromIndex === item.pendingIndex ? "Selecionado" : "Trocar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {feedback ? (
          <p
            className={`mt-3 text-sm ${
              feedback.toLowerCase().includes("falha") || feedback.toLowerCase().includes("erro")
                ? "text-destructive"
                : "text-green-deep"
            }`}
          >
            {feedback}
          </p>
        ) : null}
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={handleSendPending}
        confirmLabel="Enviar pendentes"
        cancelLabel="Fechar"
        loading={sending}
      />
    </ModalShell>
  )
}
