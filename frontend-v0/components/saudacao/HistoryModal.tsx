"use client"

import { History } from "lucide-react"
import { ModalActions, ModalShell } from "./ModalShell"

interface CycleHistoryItem {
  id?: string
  name?: string
  status?: string
  canceled?: boolean
  sentCount?: number
  totalAlunos?: number
  createdAt?: string
  completedAt?: string | null
}

interface HistoryModalProps {
  open: boolean
  onClose: () => void
  previewMode?: boolean
  items?: CycleHistoryItem[]
}

function formatDateTime(value?: string | null) {
  const raw = String(value || "").trim()
  if (!raw) return "—"
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleString("pt-BR")
}

export function HistoryModal({ open, onClose, previewMode = false, items = [] }: HistoryModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      previewMode={previewMode}
      title="Histórico"
      subtitle="Ciclos anteriores e status de execução"
      icon={<History size={16} className="text-primary" />}
      size="lg"
      bodyClassName="max-h-[70vh] overflow-y-auto"
    >
      <div className="px-6 py-6">
        {items.length ? (
          <div className="flex flex-col gap-3">
            {items.map((item, index) => {
              const sent = Number(item?.sentCount || 0)
              const total = Number(item?.totalAlunos || 0)
              const canceled = Boolean(item?.canceled)
              return (
                <section
                  key={item?.id || `${item?.name || "cycle"}-${index}`}
                  className="rounded-2xl border border-border bg-muted/20 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {String(item?.name || "Ciclo sem nome")}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {canceled ? "Cancelado manualmente" : "Finalizado"} • {sent}/{total} alunos
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        canceled
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {canceled ? "Cancelado" : "Concluído"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <p>Início: {formatDateTime(item?.createdAt)}</p>
                    <p>Fim: {formatDateTime(item?.completedAt)}</p>
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum ciclo anterior encontrado.
          </div>
        )}
      </div>
      <ModalActions onCancel={onClose} onConfirm={onClose} confirmLabel="Fechar" cancelLabel="Fechar" />
    </ModalShell>
  )
}
