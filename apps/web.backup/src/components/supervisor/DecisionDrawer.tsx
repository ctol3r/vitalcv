'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Clock, FileText, Shield, XCircle } from 'lucide-react'

type TaskStatus = 'PLANNED' | 'EXECUTED' | 'BLOCKED' | 'PENDING'

interface SupervisorTask {
  id: string
  runId: string
  queueType: string
  status: TaskStatus
  scheduledAt: string
  executedAt?: string | null
  blockedReason?: string | null
  decisionMetadata?: {
    rulesTriggered?: string[]
    signalsUsed?: Array<{
      type: string
      severity: string
      value: number
    }>
  } | null
}

export type DecisionDrawerProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  task: SupervisorTask
}

const SEVERITY_BADGES: Record<string, string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
  low: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  info: 'bg-slate-50 text-slate-900 border-slate-200',
}

const STATUS_BADGES: Record<TaskStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-900 border-slate-200',
  EXECUTED: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  BLOCKED: 'bg-rose-50 text-rose-900 border-rose-200',
  PENDING: 'bg-amber-50 text-amber-900 border-amber-200',
}

export function DecisionDrawer({ open, onOpenChange, task }: DecisionDrawerProps) {
  const rulesTriggered = task.decisionMetadata?.rulesTriggered ?? []
  const signalsUsed = task.decisionMetadata?.signalsUsed ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 right-0 left-auto h-screen max-h-screen w-full max-w-4xl translate-x-0 translate-y-0 space-y-6 overflow-y-auto rounded-none border-l bg-background px-6 py-8 shadow-2xl focus-visible:outline-hidden sm:px-10"
        showCloseButton
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold">Supervisor Decision Details</DialogTitle>
          <DialogDescription className="text-base">
            Task: {task.queueType} • {task.id.slice(0, 12)}…
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-wrap items-center gap-4">
          <Badge variant="outline" className={cn('text-xs font-semibold', STATUS_BADGES[task.status])}>
            {task.status}
          </Badge>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Scheduled at {new Date(task.scheduledAt).toLocaleString()}
            {task.executedAt && ` • Executed at ${new Date(task.executedAt).toLocaleString()}`}
          </p>
        </section>

        {task.blockedReason && (
          <section aria-label="Blocked reason" className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Blocked Reason
            </div>
            <p className="text-sm text-rose-800">{task.blockedReason}</p>
          </section>
        )}

        <section aria-label="Rules triggered" className="space-y-4">
          <header className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <p className="text-sm font-semibold uppercase tracking-wide">Rules Triggered</p>
          </header>
          {rulesTriggered.length > 0 ? (
            <div className="space-y-3 rounded-lg border">
              {rulesTriggered.map((rule, index) => (
                <article key={index} className="border-b last:border-b-0 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <p className="font-semibold text-sm">{rule}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              No rules were triggered for this task.
            </div>
          )}
        </section>

        <section aria-label="Signals used" className="space-y-4">
          <header className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <p className="text-sm font-semibold uppercase tracking-wide">Signals Used</p>
          </header>
          {signalsUsed.length > 0 ? (
            <div className="space-y-3 rounded-lg border">
              {signalsUsed.map((signal, index) => (
                <article key={index} className="border-b last:border-b-0 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-semibold',
                        SEVERITY_BADGES[signal.severity.toLowerCase()] || SEVERITY_BADGES.info
                      )}
                    >
                      {signal.severity.toUpperCase()}
                    </Badge>
                    <p className="font-semibold">{signal.type}</p>
                    <span className="text-xs text-muted-foreground">Value: {signal.value}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              No signals were used in this decision.
            </div>
          )}
        </section>

        <section aria-label="Task metadata" className="space-y-3">
          <header className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <p className="text-sm font-semibold uppercase tracking-wide">Timeline</p>
          </header>
          <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scheduled:</span>
              <span className="font-medium">{new Date(task.scheduledAt).toLocaleString()}</span>
            </div>
            {task.executedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Executed:</span>
                <span className="font-medium">{new Date(task.executedAt).toLocaleString()}</span>
              </div>
            )}
            {task.executedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">
                  {Math.round((new Date(task.executedAt).getTime() - new Date(task.scheduledAt).getTime()) / 1000)}s
                </span>
              </div>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}

