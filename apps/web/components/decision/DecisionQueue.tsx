"use client"

import React, { useState } from "react"
import { DecisionCard, Priority, DecisionState } from "./DecisionCard"
import { cn } from "@/lib/utils"

export type TabState = "now" | "soon" | "monitor" | "deferred"

export interface DecisionTask {
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
  tab: TabState
}

export interface DecisionQueueProps {
  tasks: DecisionTask[]
  className?: string
  title?: string
  description?: string
}

export function DecisionQueue({
  tasks: initialTasks,
  className,
  title = "Recommended Actions",
  description = "High-leverage decisions surfaced by the intelligence engine.",
}: DecisionQueueProps) {
  const [activeTab, setActiveTab] = useState<TabState>("now")
  const [tasks, setTasks] = useState<DecisionTask[]>(initialTasks)

  const handleAccept = (id: string) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, state: "accepted" } : t))
  }

  const handleDismiss = (id: string) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, state: "dismissed" } : t))
  }

  const handleDefer = (id: string) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, state: "deferred", tab: "deferred" } : t))
  }

  const currentTasks = tasks.filter(t => t.tab === activeTab && t.state !== "dismissed")

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium tracking-tight text-zinc-100">{title}</h2>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-800 pb-px">
        {(["now", "soon", "monitor", "deferred"] as TabState[]).map(tab => {
          const count = tasks.filter(t => t.tab === tab && t.state !== "dismissed").length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-all relative",
                activeTab === tab
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="capitalize">{tab}</span>
                {count > 0 && (
                  <span className={cn(
                    "flex items-center justify-center min-w-[1.25rem] h-5 rounded-full text-[10px] px-1.5",
                    activeTab === tab
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-800/50 text-zinc-500"
                  )}>
                    {count}
                  </span>
                )}
              </div>
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-300 rounded-t-full shadow-[0_0_8px_rgba(212,212,216,0.3)]" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 min-h-[400px]">
        {currentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4 bg-zinc-900/20 rounded-lg border border-zinc-800/50 border-dashed">
            <h3 className="text-zinc-300 font-medium mb-2">Inbox Zero</h3>
            <p className="text-zinc-500 text-sm max-w-[250px]">
              No pending actions in this queue. Ensure passive monitoring systems are configured.
            </p>
          </div>
        ) : (
          currentTasks.map(task => (
            <DecisionCard
              key={task.id}
              {...task}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
              onDefer={handleDefer}
            />
          ))
        )}
      </div>
    </div>
  )
}
