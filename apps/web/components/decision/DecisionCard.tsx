"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { systemVoice } from "@/lib/systemVoice"
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, Clock, FileText } from "lucide-react"
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter"
import { ActionBar } from "@/components/ui/ActionBar"

export type Priority = "urgent" | "high" | "medium" | "low"
export type DecisionState = "new" | "accepted" | "dismissed" | "deferred" | "completed"

export interface DecisionCardProps {
  id: string
  action: string
  entity: string
  priority: Priority
  confidence: number
  rationale: string
  signalCount: number
  timing: string
  state?: DecisionState
  drivers?: string[]
  className?: string
  onAccept?: (id: string) => void
  onDismiss?: (id: string) => void
  onDefer?: (id: string) => void
}

export function DecisionCard({
  id,
  action,
  entity,
  priority,
  confidence,
  rationale,
  signalCount,
  timing,
  state = "new",
  drivers = [],
  className,
  onAccept,
  onDismiss,
  onDefer,
}: DecisionCardProps) {
  const [expanded, setExpanded] = useState(false)

  const priorityColors = {
    urgent: "bg-red-500/10 text-red-500 border-red-500/20",
    high: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  }

  const priorityIcons = {
    urgent: <AlertTriangle className="w-3.5 h-3.5" />,
    high: <AlertTriangle className="w-3.5 h-3.5" />,
    medium: <Clock className="w-3.5 h-3.5" />,
    low: <CheckCircle2 className="w-3.5 h-3.5" />,
  }

  const statusLabel = state === "new"
    ? systemVoice.recommendationReady
    : state === "accepted"
      ? systemVoice.signalResolved
      : systemVoice.standby

  if (state === "dismissed") return null

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border p-4",
        "border-[var(--control-border)] bg-[var(--control-surface-raised)]",
        "instant-transition",
        state === "accepted"
          ? "opacity-75 border-green-500/30 bg-green-950/20"
          : "hover:border-[var(--control-border-hover)]",
        className
      )}
    >
      {/* State Badge (if completed/accepted) */}
      {state === "accepted" && (
        <div className="absolute -top-2 -right-2 bg-[var(--control-success)] text-zinc-900 rounded-full p-0.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      )}

      {/* Status label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--control-text-subtle)]">
          {statusLabel}
        </span>
        <ConfidenceMeter value={confidence} size="sm" />
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* Left: Action & Target */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-medium tracking-tight",
              state === "accepted" ? "text-[var(--control-text-muted)]" : "text-[var(--control-text)]"
            )}>
              {action}
            </h4>
            <span className="text-[var(--control-text-subtle)] text-sm">→</span>
            <span className="text-[var(--control-text)] text-sm opacity-80">{entity}</span>
            {state === "new" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--control-accent)] ml-1 shadow-[0_0_8px_var(--control-accent)]" />
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border",
              priorityColors[priority]
            )}>
              {priorityIcons[priority]}
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
            <span className="text-xs text-[var(--control-text-subtle)] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timing}
            </span>
          </div>
        </div>
      </div>

      {/* Rationale & Expansion */}
      <div className="mt-1">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-start gap-2 text-sm text-[var(--control-text-muted)] hover:text-[var(--control-text)] text-left instant-transition"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-[var(--control-text-subtle)]" />
          ) : (
            <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-[var(--control-text-subtle)]" />
          )}
          <span className="leading-snug">{rationale}</span>
        </button>

        {expanded && (
          <div className="mt-3 pl-6 pr-2 pb-1 space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[var(--control-text-subtle)] uppercase tracking-[0.12em]">
                Key Drivers
              </p>
              <ul className="space-y-1.5">
                {drivers.map((driver, idx) => (
                  <li key={idx} className="text-sm text-[var(--control-text)] opacity-80 flex items-start gap-2">
                    <span className="text-[var(--control-text-subtle)] mt-0.5">•</span>
                    {driver}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex items-center gap-3 pt-2 border-t border-[var(--control-border)]">
              <span className="text-[10px] text-[var(--control-text-subtle)] uppercase tracking-wider">
                Evidence:
              </span>
              <button className="inline-flex items-center gap-1.5 text-xs text-[var(--control-accent)] hover:brightness-125 instant-transition bg-[var(--control-accent)]/10 px-2 py-1 rounded-md">
                <FileText className="w-3 h-3" />
                {signalCount} signals
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar — 1 primary, 1 secondary */}
      {state === "new" && (
        <ActionBar
          primary={{
            label: systemVoice.executeRecommendation,
            onClick: () => onAccept?.(id),
          }}
          secondary={{
            label: systemVoice.deferSignal,
            onClick: () => onDefer?.(id),
          }}
        />
      )}
    </div>
  )
}
