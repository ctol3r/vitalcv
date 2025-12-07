'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Zap, TrendingDown, TrendingUp, RotateCcw, CheckCircle2 } from 'lucide-react'

export type Intervention = {
  id: string
  name: string
  description: string
  category: 'credential' | 'training' | 'enrollment' | 'compliance' | 'other'
  action: string
  enabled: boolean
}

export type ProjectedOutcome = {
  risk7d: number
  risk14d: number
  risk30d: number
  risk60d: number
  privilegeReadiness?: number
  enrollmentStability?: number
  compactValidity?: number
}

type InterventionSimulatorProps = {
  interventions: Intervention[]
  baselineOutcome: ProjectedOutcome
  onInterventionChange?: (interventionId: string, enabled: boolean) => void
  onSimulate?: (enabledInterventions: string[], projectedOutcome: ProjectedOutcome) => void
  className?: string
  title?: string
  description?: string
}

const CATEGORY_LABELS: Record<Intervention['category'], string> = {
  credential: 'Credential',
  training: 'Training',
  enrollment: 'Enrollment',
  compliance: 'Compliance',
  other: 'Other',
}

const CATEGORY_COLORS: Record<Intervention['category'], string> = {
  credential: 'bg-blue-50 text-blue-900 border-blue-200',
  training: 'bg-purple-50 text-purple-900 border-purple-200',
  enrollment: 'bg-green-50 text-green-900 border-green-200',
  compliance: 'bg-amber-50 text-amber-900 border-amber-200',
  other: 'bg-slate-50 text-slate-900 border-slate-200',
}

// Mock impact calculation - in production, this would call the forecast engine
function calculateImpact(
  baseline: ProjectedOutcome,
  enabledInterventions: Intervention[],
): ProjectedOutcome {
  // Simple mock: each intervention reduces risk by a small amount
  const reductionFactor = enabledInterventions.length * 0.05 // 5% per intervention, max 25%
  const multiplier = 1 - Math.min(reductionFactor, 0.25)

  return {
    risk7d: Math.max(0, baseline.risk7d * multiplier),
    risk14d: Math.max(0, baseline.risk14d * multiplier),
    risk30d: Math.max(0, baseline.risk30d * multiplier),
    risk60d: Math.max(0, baseline.risk60d * multiplier),
    privilegeReadiness: baseline.privilegeReadiness
      ? Math.min(100, baseline.privilegeReadiness + enabledInterventions.length * 2)
      : undefined,
    enrollmentStability: baseline.enrollmentStability
      ? Math.min(100, baseline.enrollmentStability + enabledInterventions.length * 3)
      : undefined,
    compactValidity: baseline.compactValidity
      ? Math.min(100, baseline.compactValidity + enabledInterventions.length * 5)
      : undefined,
  }
}

export function InterventionSimulator({
  interventions,
  baselineOutcome,
  onInterventionChange,
  onSimulate,
  className,
  title = 'Intervention simulator',
  description = 'Change future conditions to see projected outcomes',
}: InterventionSimulatorProps) {
  const [localInterventions, setLocalInterventions] = useState<Intervention[]>(interventions)
  const [isSimulating, setIsSimulating] = useState(false)

  const enabledInterventions = useMemo(() => {
    return localInterventions.filter((i) => i.enabled)
  }, [localInterventions])

  const projectedOutcome = useMemo(() => {
    if (enabledInterventions.length === 0) return baselineOutcome
    return calculateImpact(baselineOutcome, enabledInterventions)
  }, [baselineOutcome, enabledInterventions])

  const toggleIntervention = (id: string) => {
    setLocalInterventions((prev) =>
      prev.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)),
    )
    onInterventionChange?.(id, !localInterventions.find((i) => i.id === id)?.enabled ?? false)
  }

  const handleSimulate = () => {
    setIsSimulating(true)
    setTimeout(() => {
      setIsSimulating(false)
      onSimulate?.(enabledInterventions.map((i) => i.id), projectedOutcome)
    }, 500)
  }

  const reset = () => {
    setLocalInterventions((prev) => prev.map((i) => ({ ...i, enabled: false })))
  }

  const riskImprovement = {
    risk7d: baselineOutcome.risk7d - projectedOutcome.risk7d,
    risk14d: baselineOutcome.risk14d - projectedOutcome.risk14d,
    risk30d: baselineOutcome.risk30d - projectedOutcome.risk30d,
    risk60d: baselineOutcome.risk60d - projectedOutcome.risk60d,
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={enabledInterventions.length === 0}>
              <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSimulate} disabled={isSimulating || enabledInterventions.length === 0}>
              {isSimulating ? 'Simulating...' : 'Simulate'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Interventions list */}
        <div className="space-y-3">
          {localInterventions.map((intervention) => {
            const Icon = intervention.enabled ? CheckCircle2 : Zap

            return (
              <article
                key={intervention.id}
                className={cn(
                  'rounded-lg border p-4 transition-all cursor-pointer',
                  intervention.enabled
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'bg-background hover:bg-muted/50',
                )}
                onClick={() => toggleIntervention(intervention.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                      intervention.enabled
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30',
                    )}
                  >
                    {intervention.enabled && <Icon className="h-3 w-3" aria-hidden="true" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{intervention.name}</h4>
                      <Badge variant="outline" className={cn('text-xs', CATEGORY_COLORS[intervention.category])}>
                        {CATEGORY_LABELS[intervention.category]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{intervention.description}</p>
                    <p className="text-xs font-medium text-muted-foreground">Action: {intervention.action}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Projected outcomes */}
        {enabledInterventions.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Projected outcomes</h4>
              <Badge variant="outline" className="text-xs">
                {enabledInterventions.length} intervention{enabledInterventions.length !== 1 ? 's' : ''} active
              </Badge>
            </div>

            {/* Risk metrics */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Risk forecast</h5>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['7d', '14d', '30d', '60d'] as const).map((horizon) => {
                  const key = `risk${horizon}` as keyof typeof projectedOutcome
                  const baseline = baselineOutcome[key] as number
                  const projected = projectedOutcome[key] as number
                  const improvement = riskImprovement[key]
                  const hasImprovement = improvement > 0

                  return (
                    <div key={horizon} className="space-y-1">
                      <dt className="text-xs text-muted-foreground">{horizon}</dt>
                      <dd className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold">{Math.round(projected)}</span>
                        <span className="text-xs text-muted-foreground">%</span>
                        {hasImprovement && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                            <TrendingDown className="h-3 w-3" aria-hidden="true" />
                            {Math.round(improvement)}%
                          </span>
                        )}
                      </dd>
                      {baseline !== projected && (
                        <p className="text-xs text-muted-foreground line-through">{Math.round(baseline)}%</p>
                      )}
                    </div>
                  )
                })}
              </dl>
            </div>

            {/* Additional metrics */}
            {(projectedOutcome.privilegeReadiness !== undefined ||
              projectedOutcome.enrollmentStability !== undefined ||
              projectedOutcome.compactValidity !== undefined) && (
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Additional metrics</h5>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {projectedOutcome.privilegeReadiness !== undefined && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Privilege readiness</dt>
                      <dd className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold">{Math.round(projectedOutcome.privilegeReadiness)}</span>
                        <span className="text-xs text-muted-foreground">%</span>
                        {baselineOutcome.privilegeReadiness !== undefined &&
                          projectedOutcome.privilegeReadiness > baselineOutcome.privilegeReadiness && (
                            <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                              <TrendingUp className="h-3 w-3" aria-hidden="true" />
                              +{Math.round(projectedOutcome.privilegeReadiness - baselineOutcome.privilegeReadiness)}%
                            </span>
                          )}
                      </dd>
                    </div>
                  )}
                  {projectedOutcome.enrollmentStability !== undefined && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Enrollment stability</dt>
                      <dd className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold">{Math.round(projectedOutcome.enrollmentStability)}</span>
                        <span className="text-xs text-muted-foreground">%</span>
                        {baselineOutcome.enrollmentStability !== undefined &&
                          projectedOutcome.enrollmentStability > baselineOutcome.enrollmentStability && (
                            <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                              <TrendingUp className="h-3 w-3" aria-hidden="true" />
                              +{Math.round(projectedOutcome.enrollmentStability - baselineOutcome.enrollmentStability)}%
                            </span>
                          )}
                      </dd>
                    </div>
                  )}
                  {projectedOutcome.compactValidity !== undefined && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Compact validity</dt>
                      <dd className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold">{Math.round(projectedOutcome.compactValidity)}</span>
                        <span className="text-xs text-muted-foreground">%</span>
                        {baselineOutcome.compactValidity !== undefined &&
                          projectedOutcome.compactValidity > baselineOutcome.compactValidity && (
                            <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                              <TrendingUp className="h-3 w-3" aria-hidden="true" />
                              +{Math.round(projectedOutcome.compactValidity - baselineOutcome.compactValidity)}%
                            </span>
                          )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        {enabledInterventions.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Select interventions above to see projected outcomes.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

