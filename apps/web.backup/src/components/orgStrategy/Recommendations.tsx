'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertCircle, Calendar, CheckCircle2, FileWarning, Shield, TrendingUp, Users, Zap } from 'lucide-react'

export type Recommendation = {
  id: string
  type: 'renew_early' | 'onboard' | 'expand_privileges' | 'renegotiate_payer' | 'preempt_safety'
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  affectedCount: number
  impactDate: string
  estimatedBenefit: string
}

type RecommendationsProps = {
  recommendations: Recommendation[]
  className?: string
  title?: string
  description?: string
  onRecommendationClick?: (recommendation: Recommendation) => void
}

const TYPE_ICONS: Record<Recommendation['type'], typeof Calendar> = {
  renew_early: Calendar,
  onboard: Users,
  expand_privileges: Shield,
  renegotiate_payer: FileWarning,
  preempt_safety: AlertCircle,
}

const TYPE_LABELS: Record<Recommendation['type'], string> = {
  renew_early: 'Renew Early',
  onboard: 'Onboard',
  expand_privileges: 'Expand Privileges',
  renegotiate_payer: 'Renegotiate Payer',
  preempt_safety: 'Preempt Safety Risk',
}

const PRIORITY_COLORS: Record<Recommendation['priority'], string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
  low: 'bg-slate-50 text-slate-900 border-slate-200',
}

const PRIORITY_ORDER: Record<Recommendation['priority'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function Recommendations({
  recommendations,
  className,
  title = 'Strategic Action Recommendations',
  description = 'Top recommended actions to optimize workforce readiness and reduce risk',
  onRecommendationClick,
}: RecommendationsProps) {
  const [selectedPriority, setSelectedPriority] = useState<Recommendation['priority'] | 'all'>('all')
  const [selectedType, setSelectedType] = useState<Recommendation['type'] | 'all'>('all')

  const filteredRecommendations = useMemo(() => {
    return recommendations
      .filter((r) => {
        if (selectedPriority !== 'all' && r.priority !== selectedPriority) return false
        if (selectedType !== 'all' && r.type !== selectedType) return false
        return true
      })
      .sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return new Date(a.impactDate).getTime() - new Date(b.impactDate).getTime()
      })
  }, [recommendations, selectedPriority, selectedType])

  const priorityCounts = useMemo(() => {
    const counts: Record<Recommendation['priority'], number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    filteredRecommendations.forEach((r) => {
      counts[r.priority]++
    })
    return counts
  }, [filteredRecommendations])

  if (filteredRecommendations.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recommendations available for selected filters.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="flex gap-2">
            <Button
              variant={selectedPriority === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPriority('all')}
              className="text-xs"
            >
              All Priorities
            </Button>
            {(['critical', 'high', 'medium', 'low'] as const).map((priority) => (
              <Button
                key={priority}
                variant={selectedPriority === priority ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPriority(priority)}
                className="text-xs"
              >
                {priority} ({priorityCounts[priority]})
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('all')}
              className="text-xs"
            >
              All Types
            </Button>
            {(Object.keys(TYPE_LABELS) as Recommendation['type'][]).map((type) => {
              const count = filteredRecommendations.filter((r) => r.type === type).length
              return (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className="text-xs"
                >
                  {TYPE_LABELS[type]} {count > 0 && `(${count})`}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-4 text-sm mt-2">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Recommendations</span>
            <p className="font-semibold text-lg">{filteredRecommendations.length}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Critical</span>
            <p className="font-semibold text-lg text-rose-600">{priorityCounts.critical}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">High Priority</span>
            <p className="font-semibold text-lg text-amber-600">{priorityCounts.high}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredRecommendations.map((rec) => {
            const TypeIcon = TYPE_ICONS[rec.type]
            return (
              <div
                key={rec.id}
                className={cn(
                  'p-4 border rounded-lg transition-all hover:shadow-md cursor-pointer',
                  rec.priority === 'critical' && 'border-rose-200 bg-rose-50/50',
                  rec.priority === 'high' && 'border-amber-200 bg-amber-50/50',
                )}
                onClick={() => onRecommendationClick?.(rec)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg">{rec.title}</h3>
                      <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[rec.priority])}>
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[rec.type]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {rec.affectedCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{rec.affectedCount}</span>
                          <span className="text-muted-foreground">affected</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Impact:</span>
                        <span className="font-medium">{formatDate(rec.impactDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-600 font-medium">{rec.estimatedBenefit}</span>
                      </div>
                    </div>
                  </div>
                  {onRecommendationClick && (
                    <Button variant="outline" size="sm" className="shrink-0">
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(input: string) {
  const date = new Date(input)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
