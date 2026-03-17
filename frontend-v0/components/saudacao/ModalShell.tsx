"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReactNode, useEffect } from "react"

interface ModalShellProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  icon?: ReactNode
}

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  icon,
}: ModalShellProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full bg-card rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div>
              <h2
                id="modal-title"
                className="text-lg font-semibold text-foreground leading-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// Reusable underline input style
export function UnderlineInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-0 border-b-2 border-input focus:border-primary outline-none py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Modal footer action bar
export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel = "Salvar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  loading = false,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: "primary" | "danger"
  loading?: boolean
}) {
  const confirmCls =
    confirmVariant === "danger"
      ? "bg-destructive/10 text-status-err border border-destructive/30 hover:bg-destructive/20"
      : "bg-primary text-primary-foreground hover:bg-green-deep"

  return (
    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
      <button
        onClick={onCancel}
        className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className={cn(
          "px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-60",
          confirmCls
        )}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
