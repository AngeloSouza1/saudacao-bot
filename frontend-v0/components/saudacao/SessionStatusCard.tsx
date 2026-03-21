"use client"

import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
  Zap,
  RefreshCw,
  QrCode,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type SystemStatus = "ok" | "warn" | "error" | "idle"

interface StatusRow {
  label: string
  value: string
  status: SystemStatus
}

interface SessionStatusCardProps {
  statusRows: StatusRow[]
  qrAvailable?: boolean
  qrImageDataUrl?: string
  qrText?: string
  qrPhase?: string
  lastError?: string
  title?: string
  subtitle?: string
  showStatusRows?: boolean
  showActions?: boolean
  showOverallBadge?: boolean
  onSendTest?: () => Promise<string>
  onSendNow?: () => Promise<string>
  onSendForced?: () => Promise<string>
  disableManualSend?: boolean
  onClose?: () => void
}

export function SessionStatusCard({
  statusRows,
  qrAvailable = false,
  qrImageDataUrl,
  qrText,
  qrPhase,
  lastError,
  title = "Status da Sessão",
  subtitle = "Saúde do sistema em tempo real",
  showStatusRows = true,
  showActions = true,
  showOverallBadge = true,
  onSendTest,
  onSendNow,
  onSendForced,
  disableManualSend = false,
  onClose,
}: SessionStatusCardProps) {
  const [lastFeedback, setLastFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<"ok" | "err">("ok")
  const [loading, setLoading] = useState<string | null>(null)
  const qrMode = !showStatusRows && !showActions && !showOverallBadge

  const getQrVisualState = () => {
    const phase = String(qrPhase || "").toLowerCase()
    if (phase === "ready" || phase === "authenticated") return "authenticated"
    if (phase === "error" || phase === "auth_failure" || phase === "disconnected") return "error"
    if (phase === "qr") return "ready"
    if (phase === "initializing") return qrAvailable ? "ready" : "loading"
    if (qrAvailable) return "ready"
    return "loading"
  }

  const qrState = getQrVisualState()

  const getQrStatusText = () => {
    switch (qrState) {
      case "loading":
        return "Gerando QR Code..."
      case "ready":
        return "Aguardando leitura do QR Code"
      case "authenticated":
        return "Sessão autenticada. Carregando painel..."
      case "error":
        return "Erro ao gerar QR Code"
      default:
        return ""
    }
  }

  const getQrStatusColor = () => {
    switch (qrState) {
      case "authenticated":
        return "text-green-mid"
      case "error":
        return "text-destructive"
      default:
        return "text-muted-foreground"
    }
  }

  const handleAction = async (action: string, runner?: () => Promise<string>) => {
    if (!runner) return
    setLoading(action)
    try {
      const message = await runner()
      setFeedbackType("ok")
      setLastFeedback(message)
    } catch (error) {
      setFeedbackType("err")
      setLastFeedback(String((error as Error)?.message || "Falha ao executar ação."))
    } finally {
      setLoading(null)
    }
  }

  if (qrMode) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border px-6 pb-6 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {onClose ? (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar autenticação"
              title="Fechar"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          {qrState === "loading" ? (
            <div className="w-full space-y-4">
              <div className="flex justify-center">
                <div className="h-48 w-48 animate-pulse rounded-lg bg-muted" />
              </div>
              <p className="text-center text-sm text-muted-foreground">Preparando QR Code...</p>
            </div>
          ) : null}

          {qrState === "error" ? (
            <div className="w-full space-y-4">
              <div className="flex justify-center">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
                  <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                </div>
              </div>
              <p className="text-center text-sm text-destructive">
                {lastError || "Não foi possível gerar o QR Code no momento."}
              </p>
            </div>
          ) : null}

          {(qrState === "ready" || qrState === "authenticated") ? (
            <div className="relative flex flex-col items-center gap-4">
              <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
                {qrImageDataUrl ? (
                  <img
                    src={qrImageDataUrl}
                    alt="QR Code para autenticar WhatsApp Web"
                    className={cn(
                      "h-40 w-40 rounded object-contain transition-opacity",
                      qrState === "authenticated" ? "opacity-60" : "opacity-100"
                    )}
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                    Gerando imagem do QR...
                  </div>
                )}
              </div>

              {qrState === "authenticated" ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
                  <div className="text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green-mid" />
                    <p className="text-sm font-medium text-foreground">Autenticado</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-border px-6 pb-6 pt-5">
          <div className={cn("flex items-center gap-2 text-sm font-medium", getQrStatusColor())}>
            {qrState === "authenticated" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : qrState === "error" ? (
              <AlertCircle className="h-5 w-5" />
            ) : qrState === "loading" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <QrCode className="h-5 w-5" />
            )}
            <span>{getQrStatusText()}</span>
          </div>
          {qrText && qrState === "ready" ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{qrText}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-full">
      {/* Card header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <RefreshCw size={16} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2">
            {showOverallBadge ? <OverallBadge rows={statusRows} /> : null}
            {onClose ? (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Fechar status da sessão"
                title="Fechar"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status rows */}
      <div className="flex-1 px-6 py-4 flex flex-col gap-1 overflow-y-auto">
        {showStatusRows
          ? statusRows.map((row) => (
              <StatusRowItem key={row.label} row={row} />
            ))
          : null}
        {qrAvailable ? (
          <div
            className={cn(
              "rounded-2xl border border-border bg-muted/20 p-4",
              showStatusRows ? "mt-3" : "mt-0 flex flex-1 items-center justify-center"
            )}
          >
            {qrImageDataUrl ? (
              <div className="flex w-full max-w-[560px] items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
                <img
                  src={qrImageDataUrl}
                  alt="QR Code para autenticar WhatsApp Web"
                  className="h-[360px] w-[360px] rounded-xl object-contain"
                />
              </div>
            ) : (
              <div className="w-full max-w-[560px] rounded-2xl border border-dashed border-border bg-card px-3 py-10 text-center text-xs text-muted-foreground">
                Gerando imagem do QR...
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Action buttons */}
      {showActions ? (
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Ações</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              label="Enviar Teste"
              icon={<Send size={13} />}
              variant="secondary"
              loading={loading === "test"}
              onClick={() => handleAction("test", onSendTest)}
            />
            <ActionButton
              label="Enviar Agora"
              icon={<Zap size={13} />}
              variant="primary"
              loading={loading === "now"}
              disabled={disableManualSend}
              onClick={() => handleAction("now", onSendNow)}
            />
            <ActionButton
              label="Forçar Envio"
              icon={<RefreshCw size={13} />}
              variant="danger"
              loading={loading === "force"}
              disabled={disableManualSend}
              onClick={() => handleAction("force", onSendForced)}
            />
          </div>
        </div>
      ) : null}

      {/* Feedback area */}
      {showActions ? (
        <div className={cn(
          "px-6 py-3 text-xs transition-all border-t border-border",
          lastFeedback ? "opacity-100" : "opacity-0 pointer-events-none",
          feedbackType === "ok" ? "bg-green-soft text-green-deep" : "bg-red-50 text-destructive"
        )}>
          <span className="font-medium">Última ação:</span> {lastFeedback ?? "—"}
        </div>
      ) : null}
    </div>
  )
}

function StatusRowItem({ row }: { row: StatusRow }) {
  const icons: Record<SystemStatus, React.ReactNode> = {
    ok: <CheckCircle2 size={15} className="text-status-ok" />,
    warn: <AlertCircle size={15} className="text-status-warn" />,
    error: <XCircle size={15} className="text-status-err" />,
    idle: <Clock size={15} className="text-muted-foreground" />,
  }
  const valueCls: Record<SystemStatus, string> = {
    ok: "text-status-ok",
    warn: "text-status-warn",
    error: "text-status-err",
    idle: "text-muted-foreground",
  }
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl even:bg-muted/40 gap-4">
      <div className="flex items-center gap-2 min-w-0">
        {icons[row.status]}
        <span className="text-sm text-foreground truncate">{row.label}</span>
      </div>
      <span className={cn("text-sm font-medium tabular-nums shrink-0", valueCls[row.status])}>
        {row.value}
      </span>
    </div>
  )
}

function OverallBadge({ rows }: { rows: StatusRow[] }) {
  const hasError = rows.some((r) => r.status === "error")
  const hasWarn = rows.some((r) => r.status === "warn")
  if (hasError)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-status-err border border-red-200">
        Com erros
      </span>
    )
  if (hasWarn)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-status-warn border border-yellow-200">
        Atenção
      </span>
    )
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-soft text-status-ok border border-green-200">
      Operacional
    </span>
  )
}

interface ActionButtonProps {
  label: string
  icon?: React.ReactNode
  variant: "primary" | "secondary" | "danger"
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}

function ActionButton({ label, icon, variant, loading, disabled, onClick }: ActionButtonProps) {
  const variantCls = {
    primary:
      "bg-primary text-primary-foreground hover:bg-green-deep active:scale-95 focus-visible:ring-2 focus-visible:ring-primary",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-muted border border-border active:scale-95 focus-visible:ring-2 focus-visible:ring-primary",
    danger:
      "bg-destructive/10 text-status-err hover:bg-destructive/20 border border-destructive/30 active:scale-95 focus-visible:ring-2 focus-visible:ring-destructive",
  }
  return (
    <button
      onClick={onClick}
      disabled={Boolean(loading || disabled)}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed",
        variantCls[variant]
      )}
    >
      {loading ? (
        <RefreshCw size={13} className="animate-spin" />
      ) : (
        icon
      )}
      {label}
    </button>
  )
}
