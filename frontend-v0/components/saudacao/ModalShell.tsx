"use client"

import { Bold, Code2, Italic, Link2, Pilcrow, Strikethrough, Video, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReactNode, RefObject } from "react"

interface ModalShellProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl"
  icon?: ReactNode
  bodyClassName?: string
  headerActions?: ReactNode
  previewMode?: boolean
}

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  icon,
  bodyClassName,
  headerActions,
  previewMode = false,
}: ModalShellProps) {
  if (!open) return null

  const sizeClasses = {
    xs: "max-w-[26rem]",
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-[94rem]",
    xxl: "max-w-[98vw]",
  }

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", previewMode ? "pointer-events-none" : "")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={previewMode ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative mt-10 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh]",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border bg-card px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-xl border border-primary/10 bg-primary/10 flex items-center justify-center">
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
          <div className="flex items-center gap-3">
            {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={cn("flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
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
  error,
  required = false,
  inputClassName = "",
  disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
  error?: string
  required?: boolean
  inputClassName?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label} {required ? <span className="text-status-err">*</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`bg-transparent border-0 border-b-2 outline-none py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors ${
          error ? "border-status-err focus:border-status-err" : "border-input focus:border-primary"
        } disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`}
      />
      {error ? <p className="text-[11px] text-status-err">{error}</p> : null}
      {!error && hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

// Modal footer action bar
export function ModalActions({
  onCancel,
  onConfirm,
  onSecondaryConfirm,
  confirmLabel = "Salvar",
  secondaryConfirmLabel,
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  secondaryConfirmVariant = "secondary",
  loading = false,
  confirmDisabled = false,
}: {
  onCancel: () => void
  onConfirm: () => void
  onSecondaryConfirm?: () => void
  confirmLabel?: string
  secondaryConfirmLabel?: string
  cancelLabel?: string
  confirmVariant?: "primary" | "danger"
  secondaryConfirmVariant?: "secondary" | "danger"
  loading?: boolean
  confirmDisabled?: boolean
}) {
  const confirmCls =
    confirmVariant === "danger"
      ? "bg-destructive/10 text-status-err border border-destructive/30 hover:bg-destructive/20"
      : "bg-primary text-primary-foreground hover:bg-green-deep"
  const secondaryConfirmCls =
    secondaryConfirmVariant === "danger"
      ? "bg-destructive/10 text-status-err border border-destructive/30 hover:bg-destructive/20"
      : "border border-border bg-background text-foreground hover:border-primary hover:text-primary"
  const hasCancel = Boolean(String(cancelLabel || "").trim())
  const hasSecondaryConfirm = Boolean(String(secondaryConfirmLabel || "").trim()) && Boolean(onSecondaryConfirm)

  return (
    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
      {hasCancel ? (
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          {cancelLabel}
        </button>
      ) : null}
      {hasSecondaryConfirm ? (
        <button
          onClick={onSecondaryConfirm}
          disabled={loading}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-60",
            secondaryConfirmCls
          )}
        >
          {secondaryConfirmLabel}
        </button>
      ) : null}
      <button
        onClick={onConfirm}
        disabled={loading || confirmDisabled}
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

function replaceTextareaSelection(
  textarea: HTMLTextAreaElement,
  nextValue: string,
  selectionStart: number,
  selectionEnd: number
) {
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionEnd)
  })
  return nextValue
}

function applyWrappedFormat(
  value: string,
  textarea: HTMLTextAreaElement,
  marker: string,
  placeholder: string,
  onChange: (nextValue: string) => void
) {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const selected = value.slice(start, end) || placeholder
  const nextValue = `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`
  onChange(replaceTextareaSelection(textarea, nextValue, start + marker.length, start + marker.length + selected.length))
}

function applyInsertedFormat(
  value: string,
  textarea: HTMLTextAreaElement,
  snippet: string,
  cursorOffset: number,
  onChange: (nextValue: string) => void
) {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const nextValue = `${value.slice(0, start)}${snippet}${value.slice(end)}`
  onChange(replaceTextareaSelection(textarea, nextValue, start + cursorOffset, start + cursorOffset))
}

export function WhatsAppFormattingToolbar({
  value,
  onChange,
  textareaRef,
}: {
  value: string
  onChange: (nextValue: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const actions = [
    {
      label: "Negrito",
      icon: Bold,
      run: (textarea: HTMLTextAreaElement) => applyWrappedFormat(value, textarea, "*", "texto", onChange),
    },
    {
      label: "Itálico",
      icon: Italic,
      run: (textarea: HTMLTextAreaElement) => applyWrappedFormat(value, textarea, "_", "texto", onChange),
    },
    {
      label: "Riscado",
      icon: Strikethrough,
      run: (textarea: HTMLTextAreaElement) => applyWrappedFormat(value, textarea, "~", "texto", onChange),
    },
    {
      label: "Monoespaçado",
      icon: Code2,
      run: (textarea: HTMLTextAreaElement) => applyWrappedFormat(value, textarea, "```", "texto", onChange),
    },
    {
      label: "Quebra de linha",
      icon: Pilcrow,
      run: (textarea: HTMLTextAreaElement) => applyInsertedFormat(value, textarea, "\n", 1, onChange),
    },
    {
      label: "Link",
      icon: Link2,
      run: (textarea: HTMLTextAreaElement) =>
        applyInsertedFormat(value, textarea, "https://seu-link-aqui.com", "https://".length, onChange),
    },
    {
      label: "Vídeo",
      icon: Video,
      run: (textarea: HTMLTextAreaElement) =>
        applyInsertedFormat(value, textarea, "https://link-do-video", "https://".length, onChange),
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/20 px-3 py-3">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Formatação WhatsApp
      </span>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              const textarea = textareaRef.current
              if (!textarea) return
              action.run(textarea)
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label={action.label}
            title={action.label}
          >
            <Icon size={14} />
            <span>{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
