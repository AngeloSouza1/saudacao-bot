"use client"

import { Bell, ChevronRight, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

export interface GreetingItem {
  id: string
  studentName: string
  date: string
  time: string
  classInfo: string
  nextStudent: string
  isNext: boolean
}

interface UpcomingGreetingsCardProps {
  items: GreetingItem[]
}

export function UpcomingGreetingsCard({ items }: UpcomingGreetingsCardProps) {
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
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gold-light text-accent-foreground border border-gold/30">
            {items.length} na fila
          </span>
        </div>
      </div>

      {/* Table header */}
      <div className="px-6 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-x-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Aluno</span>
          <span className="text-center">Data</span>
          <span className="text-center">Hora</span>
          <span>Turma</span>
          <span className="text-right">Próximo</span>
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
        "grid grid-cols-[1fr_auto_auto_1fr_auto] gap-x-4 items-center px-6 py-3 transition-colors hover:bg-primary/5 group",
        isEven ? "bg-card" : "bg-muted/20"
      )}
    >
      {/* Student name */}
      <div className="flex items-center gap-2.5 min-w-0">
        {item.isNext && (
          <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-primary text-primary-foreground uppercase tracking-widest">
            Próx
          </span>
        )}
        <span
          className={cn(
            "text-sm font-medium truncate",
            item.isNext ? "text-primary font-semibold" : "text-foreground"
          )}
        >
          {item.studentName}
        </span>
      </div>

      {/* Date */}
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap text-center">
        {item.date}
      </span>

      {/* Time */}
      <span
        className={cn(
          "text-xs font-semibold tabular-nums whitespace-nowrap text-center",
          item.isNext ? "text-primary" : "text-foreground"
        )}
      >
        {item.time}
      </span>

      {/* Class info */}
      <div className="flex items-center gap-1.5 min-w-0">
        <GraduationCap size={12} className="text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{item.classInfo}</span>
      </div>

      {/* Next student */}
      <div className="flex items-center gap-1 justify-end min-w-0">
        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{item.nextStudent}</span>
      </div>
    </div>
  )
}
