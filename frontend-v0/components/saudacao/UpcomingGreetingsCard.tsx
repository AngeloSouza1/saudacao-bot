"use client"

import { Bell, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

export interface GreetingItem {
  id: string
  studentName: string
  studentImage?: string
  date: string
  time: string
  classInfo: string
  nextStudent: string
  isNext: boolean
  pendingIndex?: number
}

interface UpcomingGreetingsCardProps {
  items: GreetingItem[]
  onOpenAll?: () => void
}

export function UpcomingGreetingsCard({ items, onOpenAll }: UpcomingGreetingsCardProps) {
  return (
    <div className="flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 px-6 py-4 border-b border-border bg-card flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center">
          <Bell size={16} className="text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">
            Próximas Saudações
          </h2>
          <p className="text-xs text-muted-foreground">Fila de envio programado</p>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gold-light text-accent-foreground border border-gold/30">
              {items.length} na fila
            </span>
            {onOpenAll && items.length > 0 ? (
              <button
                onClick={onOpenAll}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors"
              >
                Ver todos
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 border-b border-border bg-muted/40 shrink-0">
        <div className="grid grid-cols-[minmax(220px,1.3fr)_110px_90px_minmax(420px,2.4fr)] gap-x-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Aluno</span>
          <span className="text-center">Data</span>
          <span className="text-center">Hora</span>
          <span>Aula</span>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <GraduationCap size={40} className="text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Nenhuma saudação programada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <GreetingRow key={item.id} item={item} isEven={idx % 2 === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GreetingRow({ item, isEven }: { item: GreetingItem; isEven: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(220px,1.3fr)_110px_90px_minmax(420px,2.4fr)] gap-x-4 items-center px-5 py-4 transition-colors hover:bg-primary/5 group border-b border-border/70 last:border-b-0",
        isEven ? "bg-card" : "bg-muted/20"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {item.isNext && (
          <span className="shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-md bg-primary text-primary-foreground uppercase tracking-widest">
            Próx
          </span>
        )}
        {item.studentImage ? (
          <img
            src={item.studentImage}
            alt={`Foto de ${item.studentName}`}
            className="h-10 w-10 shrink-0 rounded-xl border border-primary/15 object-cover shadow-sm"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : null}
        <span
          className={cn(
            "text-lg font-semibold truncate",
            item.isNext ? "text-primary font-semibold" : "text-foreground"
          )}
        >
          {item.studentName}
        </span>
      </div>

      <span className="text-base text-muted-foreground tabular-nums whitespace-nowrap text-center">
        {item.date}
      </span>

      <span
        className={cn(
          "text-base font-semibold tabular-nums whitespace-nowrap text-center",
          item.isNext ? "text-primary" : "text-foreground"
        )}
      >
        {item.time}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <GraduationCap size={15} className="text-muted-foreground shrink-0" />
        <span className="text-base text-muted-foreground truncate">{item.classInfo}</span>
      </div>
    </div>
  )
}
