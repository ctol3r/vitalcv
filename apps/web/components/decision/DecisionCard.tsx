"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, FileText } from "lucide-react"

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

  if (state === "dismissed") return null

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all duration-200",
        state === "accepted" ? "opacity-75 border-green-500/30 bg-green-950/20" : "hover:border-zinc-700 hover:bg-zinc-900/80",
        className
      )}
    >
      {/* State Badge (if completed/accepted) */}
      {state === "accepted" && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-zinc-900 rounded-full p-0.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        {/* Left: Action & Target */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-medium tracking-tight",
              state === "accepted" ? "text-zinc-400" : "text-zinc-200"
            )}>
              {action}
            </h4>
            <span className="text-zinc-500 text-sm">→</span>
            <span className="text-zinc-300 text-sm">{entity}</span>
            {state === "new" && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border",
              priorityColors[priority]
            )}>
              {priorityIcons[priority]}
              {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {confidence}% CONFIDENCE
            </span>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timing}
            </span>
          </div>
        </div>

        {/* Right: Quick Actions */}
        {state === "new" && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onAccept?.(id)}
              className="p-1.5 text-zinc-400 hover:text-green-400 hover:bg-green-500/10 rounded-md transition-colors"
              title="Accept & Escalate"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDefer?.(id)}
              className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
              title="Defer Action"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDismiss?.(id)}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              title="Dismiss"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Rationale & Expansion */}
      <div className="mt-1">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-start gap-2 text-sm text-zinc-400 hover:text-zinc-300 text-left transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
          )}
          <span className="leading-snug">{rationale}</span>
        </button>

        {expanded && (
          <div className="mt-3 pl-6 pr-2 pb-1 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Key Drivers</p>
              <ul className="space-y-1.5">
                {drivers.map((driver, idx) => (
                  <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                    <span className="text-zinc-600 mt-0.5">•</span>
                    {driver}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/50">
              <span className="text-xs text-zinc-500">Supporting Evidence:</span>
              <button className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded-md">
                <FileText className="w-3 h-3" />
                {signalCount} signals
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
