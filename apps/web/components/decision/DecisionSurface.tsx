"use client"

import React, { useState } from "react"
import { DecisionCard, Priority, DecisionState } from "./DecisionCard"
import { cn } from "@/lib/utils"
import { Activity, Bell } from "lucide-react"

export interface DecisionSurfaceTask {
  id: string
  action: string
  entity: string
  priority: Priority
  confidence: number
  rationale: string
  signalCount: number
  timing: string
  state: DecisionState
  drivers: string[]
}

export interface DecisionSurfaceProps {
  primaryTask?: DecisionSurfaceTask
  secondaryTasks?: DecisionSurfaceTask[]
  watchItems?: { id: string, entity: string, reason: string }[]
  title?: string
  className?: string
}

export function DecisionSurface({
  primaryTask,
  secondaryTasks = [],
  watchItems = [],
  title = "Recommended Actions",
  className,
}: DecisionSurfaceProps) {
  const [tasks, setTasks] = useState<{ primary?: DecisionSurfaceTask, secondary: DecisionSurfaceTask[] }>({
    primary: primaryTask,
    secondary: secondaryTasks,
  })

  const [expanded, setExpanded] = useState(false)

  const handleAccept = (id: string, type: "primary" | "secondary") => {
    setTasks(prev => {
      if (type === "primary" && prev.primary?.id === id) {
        return { ...prev, primary: { ...prev.primary, state: "accepted" } }
      }
      return {
        ...prev,
        secondary: prev.secondary.map(t => t.id === id ? { ...t, state: "accepted" } : t)
      }
    })
  }

  const handleDismiss = (id: string, type: "primary" | "secondary") => {
    setTasks(prev => {
      if (type === "primary" && prev.primary?.id === id) {
        return { ...prev, primary: { ...prev.primary, state: "dismissed" } }
      }
      return {
        ...prev,
        secondary: prev.secondary.map(t => t.id === id ? { ...t, state: "dismissed" } : t)
      }
    })
  }

  const handleDefer = (id: string, type: "primary" | "secondary") => {
    setTasks(prev => {
      if (type === "primary" && prev.primary?.id === id) {
        return { ...prev, primary: { ...prev.primary, state: "deferred" } }
      }
      return {
        ...prev,
        secondary: prev.secondary.map(t => t.id === id ? { ...t, state: "deferred" } : t)
      }
    })
  }

  if (!tasks.primary && tasks.secondary.every(t => t.state === "dismissed")) {
    return null
  }

  return (
    <div className={cn("flex flex-col gap-4 border border-zinc-800 bg-zinc-950/50 rounded-xl p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-200 font-medium tracking-tight flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" />
          {title}
        </h3>
        {tasks.secondary.length > 0 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {expanded ? "Collapse All" : "View Secondary"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {tasks.primary && tasks.primary.state !== "dismissed" && (
          <DecisionCard
            key={tasks.primary.id}
            {...tasks.primary}
            onAccept={() => handleAccept(tasks.primary!.id, "primary")}
            onDismiss={() => handleDismiss(tasks.primary!.id, "primary")}
            onDefer={() => handleDefer(tasks.primary!.id, "primary")}
          />
        )}

        {(expanded || !tasks.primary) && tasks.secondary.filter(t => t.state !== "dismissed").map(task => (
          <DecisionCard
            key={task.id}
            {...task}
            onAccept={() => handleAccept(task.id, "secondary")}
            onDismiss={() => handleDismiss(task.id, "secondary")}
            onDefer={() => handleDefer(task.id, "secondary")}
          />
        ))}

        {expanded && watchItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Watch Items</h4>
            <ul className="flex flex-col gap-2">
               {watchItems.map(item => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-zinc-400">
                  <Bell className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-600" />
                  <span className="font-medium text-zinc-300">{item.entity}:</span>
                  {item.reason}
                </li>
               ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
