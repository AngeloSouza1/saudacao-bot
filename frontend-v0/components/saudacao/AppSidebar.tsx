"use client"

import { useState } from "react"
import {
  MessageSquare,
  MessagesSquare,
  Send,
  Settings,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarItem {
  id: string
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick?: () => void
}

interface SidebarProps {
  onOpenDestination: () => void
  onOpenConfig: () => void
  onOpenSchedule: () => void
  onOpenMessages: () => void
  activeItem: string
  setActiveItem: (id: string) => void
  shortcutsOpen: boolean
  onToggleShortcuts: () => void
}

export function AppSidebar({
  onOpenDestination,
  onOpenConfig,
  onOpenSchedule,
  onOpenMessages,
  activeItem,
  setActiveItem,
  shortcutsOpen,
  onToggleShortcuts,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true)

  const items: SidebarItem[] = [
    {
      id: "schedule",
      icon: <Calendar size={18} />,
      title: "Agenda",
      subtitle: "Horários e turmas",
      onClick: onOpenSchedule,
    },
    {
      id: "messages",
      icon: <MessagesSquare size={18} />,
      title: "Mensagens",
      subtitle: "Padrão e avisos",
      onClick: onOpenMessages,
    },
    {
      id: "destination",
      icon: <Send size={18} />,
      title: "Destino",
      subtitle: "Configurar destinatários",
      onClick: onOpenDestination,
    },
    {
      id: "config",
      icon: <Settings size={18} />,
      title: "Configuração",
      subtitle: "Parâmetros do bot",
      onClick: onOpenConfig,
    },
    {
      id: "session",
      icon: <MessageSquare size={18} />,
      title: "Sessão",
      subtitle: "Status da conexão",
    },
    {
      id: "shortcuts",
      icon: <Sparkles size={18} />,
      title: "Atalhos",
      subtitle: "Ações rápidas",
    },
  ]

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out relative shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
      aria-label="Menu lateral"
    >
      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Navegação
          </p>
        </div>
      )}

      {/* Items */}
      <nav className="flex-1 px-2 pt-4 flex flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const isShortcuts = item.id === "shortcuts"
          const isActive = isShortcuts ? shortcutsOpen : activeItem === item.id
          return (
          <button
            key={item.id}
            onClick={() => {
              if (isShortcuts) {
                onToggleShortcuts()
                return
              }
              setActiveItem(activeItem === item.id ? "" : item.id)
              item.onClick?.()
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group",
              isActive && !isShortcuts
                ? "bg-primary text-primary-foreground shadow-sm"
                : isActive && isShortcuts
                  ? "bg-amber-100 text-amber-950 ring-1 ring-amber-300 shadow-sm hover:bg-amber-100 hover:text-amber-950"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            title={collapsed ? item.title : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex-shrink-0 transition-colors",
                isActive && !isShortcuts
                  ? "text-primary-foreground"
                  : isActive && isShortcuts
                    ? "text-amber-700"
                    : "text-muted-foreground group-hover:text-primary"
              )}
            >
              {item.icon}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{item.title}</span>
                <span
                  className={cn(
                    "block text-[11px] leading-tight truncate",
                    isActive && !isShortcuts
                      ? "text-primary-foreground/70"
                      : isActive && isShortcuts
                        ? "text-amber-800/80"
                        : "text-muted-foreground"
                  )}
                >
                  {item.subtitle}
                </span>
              </span>
            )}
          </button>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <p className="text-[10px] text-muted-foreground text-center">
            Saudação Bot v2.2.0
          </p>
        </div>
      )}
    </aside>
  )
}
