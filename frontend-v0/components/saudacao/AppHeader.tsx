"use client"

import { MessageSquareHeart } from "lucide-react"

interface AppHeaderProps {
  cycleLabel: string
  userName: string
  userInitials: string
  userAvatar?: string
}

export function AppHeader({ cycleLabel, userName, userInitials, userAvatar }: AppHeaderProps) {
  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    })
    window.location.reload()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#b8d7c3]/60 bg-[linear-gradient(180deg,rgba(231,244,235,0.98)_0%,rgba(246,251,247,0.98)_100%)] backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-white shadow-md">
            <img src="/logo1.png" alt="Saudação Bot" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight tracking-tight truncate">
              Saudação Bot
            </h1>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              Automação de mensagens de boas-vindas
            </p>
          </div>
        </div>

        {/* Right: Status chips */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <Chip
            icon={<MessageSquareHeart size={13} className="text-primary" />}
            label="Painel Operacional"
            className="bg-green-soft text-green-deep border border-border"
          />
          <Chip
            icon={<span className="w-2 h-2 rounded-full bg-status-ok animate-pulse inline-block" />}
            label={cycleLabel}
            className="bg-gold-light text-accent-foreground border border-gold/30"
          />
          <UserChip name={userName} initials={userInitials} avatarUrl={userAvatar} />
          <button
            type="button"
            onClick={() => {
              void handleLogout()
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}

function Chip({
  icon,
  label,
  className,
}: {
  icon?: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${className ?? ""}`}
    >
      {icon}
      {label}
    </span>
  )
}

function UserChip({ name, initials, avatarUrl }: { name: string; initials: string; avatarUrl?: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
      {avatarUrl ? (
        <span className="w-5 h-5 rounded-full overflow-hidden border border-border" aria-hidden="true">
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        </span>
      ) : (
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground"
          style={{ background: "oklch(0.44 0.12 155)" }}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      {name}
    </span>
  )
}
