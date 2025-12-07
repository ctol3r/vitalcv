'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, AlertCircle, Shield, Users, FileCheck } from 'lucide-react'

export type EscalationStage = {
  id: string
  stage: 'micro-signal' | 'anomaly' | 'safety-signal' | 'fppe' | 'committee'
  label: string
  description: string
  status: 'active' | 'completed' | 'pending'
  timestamp?: string
  metadata?: Record<string, unknown>
}

export type EscalationLadderProps = {
  stages: EscalationStage[]
  currentStage: EscalationStage['stage']
  className?: string
  title?: string
  description?: string
  onStageClick?: (stage: EscalationStage) => void
  interactive?: boolean
}

const STAGE_ICONS: Record<EscalationStage['stage'], typeof AlertCircle> = {
  'micro-signal': AlertCircle,
  anomaly: AlertCircle,
  'safety-signal': Shield,
  fppe: FileCheck,
  committee: Users,
}

const STAGE_ORDER: EscalationStage['stage'][] = ['micro-signal', 'anomaly', 'safety-signal', 'fppe', 'committee']

const STAGE_LABELS: Record<EscalationStage['stage'], string> = {
  'micro-signal': 'Micro-signal',
  anomaly: 'Anomaly',
  'safety-signal': 'Safety signal',
  fppe: 'FPPE',
  committee: 'Committee',
}

const STATUS_COLORS: Record<EscalationStage['status'], string> = {
  active: 'bg-amber-50 text-amber-900 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  pending: 'bg-slate-50 text-slate-900 border-slate-200',
}

export function EscalationLadder({
  stages,
  currentStage,
  className,
  title = 'Escalation path',
  description = 'Progression from micro-signal to committee review',
  onStageClick,
  interactive = true,
}: EscalationLadderProps) {
  const orderedStages = STAGE_ORDER.map((stageId) => stages.find((s) => s.stage === stageId)).filter(Boolean) as EscalationStage[]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="list" aria-label="Escalation stages">
          {orderedStages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.stage]
            const isCurrent = stage.stage === currentStage
            const isCompleted = stage.status === 'completed'
            const isActive = stage.status === 'active'
            const isLast = index === orderedStages.length - 1

            return (
              <div key={stage.id} role="listitem" className="relative">
                {!isLast && (
                  <div
                    className={cn(
                      'absolute left-6 top-12 h-full w-0.5',
                      isCompleted ? 'bg-emerald-300' : isActive ? 'bg-amber-300' : 'bg-slate-200',
                    )}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    'relative flex items-start gap-4 rounded-lg border p-4 transition-colors',
                    isCurrent && 'ring-2 ring-primary',
                    isActive && 'bg-amber-50/50',
                    isCompleted && 'bg-emerald-50/30',
                    interactive && 'cursor-pointer hover:bg-muted/50',
                  )}
                  onClick={() => interactive && onStageClick && onStageClick(stage)}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2',
                      isCompleted && 'bg-emerald-100 border-emerald-300',
                      isActive && 'bg-amber-100 border-amber-300',
                      !isActive && !isCompleted && 'bg-slate-100 border-slate-300',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-6 w-6',
                        isCompleted && 'text-emerald-700',
                        isActive && 'text-amber-700',
                        !isActive && !isCompleted && 'text-slate-600',
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{STAGE_LABELS[stage.stage]}</h3>
                      <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[stage.status])}>
                        {stage.status}
                      </Badge>
                      {isCurrent && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                    {stage.timestamp && (
                      <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(stage.timestamp)}</p>
                    )}
                    {stage.metadata && Object.keys(stage.metadata).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {Object.entries(stage.metadata).map(([key, value]) => (
                          <span key={key} className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!isLast && (
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Current stage: {STAGE_LABELS[currentStage]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {orderedStages.find((s) => s.stage === currentStage)?.description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(input: string) {
  const target = new Date(input)
  const now = new Date()
  const diffMs = now.getTime() - target.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
}

