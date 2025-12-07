'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, FileText, TrendingDown, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FusionScoreBadge, type FusionScoreBreakdown, type FusionScoreSignal } from '@/components/fusion/FusionScoreBadge'
import { TrendChart } from '@/components/oppe/TrendChart'
import { cn } from '@/lib/utils'

export type CompetencyDomain = 'Clinical Skills' | 'Patient Safety' | 'Communication' | 'Professionalism' | 'Quality Metrics'

export type PrivilegeRecommendation = {
  type: 'expansion' | 'restriction' | 'maintain'
  privilege: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
  evidence: string[]
}

export type CompetencySummaryData = {
  clinician: {
    name: string
    credentialId: string
    specialty: string
    npi: string
  }
  cci: {
    current: number
    trend: number
    percentile: number
    history: Array<{ label: string; value: number; date?: string }>
  }
  fusionScore: {
    current: number
    percentile: number
    breakdown: FusionScoreBreakdown[]
    signals: FusionScoreSignal[]
  }
  risk: {
    level: 'low' | 'medium' | 'high'
    factors: Array<{ domain: CompetencyDomain; severity: 'medium' | 'high'; description: string }>
  }
  strengths: Array<{ domain: CompetencyDomain; score: number; evidence: string[] }>
  privilegeRecommendations: PrivilegeRecommendation[]
}

export type CompetencySummaryProps = {
  data: CompetencySummaryData
  className?: string
}

export function CompetencySummary({ data, className }: CompetencySummaryProps) {
  const riskColor = useMemo(() => {
    switch (data.risk.level) {
      case 'high':
        return 'border-rose-200 bg-rose-50'
      case 'medium':
        return 'border-amber-200 bg-amber-50'
      case 'low':
        return 'border-emerald-200 bg-emerald-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }, [data.risk.level])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          Competency Summary
        </CardTitle>
        <CardDescription>
          Packet includes CCI trend, risk assessment, strengths, and recommended privilege expansion/restrictions for {data.clinician.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold">CCI: {data.cci.current.toFixed(1)}</p>
              {data.cci.trend >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" aria-label="Trending up" />
              ) : (
                <TrendingDown className="h-5 w-5 text-rose-600" aria-label="Trending down" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {data.cci.percentile}th percentile • {data.cci.trend >= 0 ? '+' : ''}
              {data.cci.trend.toFixed(1)} vs last quarter
            </p>
            <div className="h-32">
              <TrendChart
                title=""
                description=""
                data={data.cci.history}
                valueFormatter={(value) => `${Math.round(value)}`}
                unitLabel="CCI"
                srHint="CCI trend chart showing historical competency index"
              />
            </div>
          </div>

          <div className="space-y-3">
            <FusionScoreBadge
              score={data.fusionScore.current}
              label="Fusion Score"
              percentile={data.fusionScore.percentile}
              breakdown={data.fusionScore.breakdown}
              signals={data.fusionScore.signals}
            />
          </div>
        </section>

        <section className={cn('rounded-lg border p-4', riskColor)}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle
              className={cn(
                'h-5 w-5',
                data.risk.level === 'high' ? 'text-rose-600' : data.risk.level === 'medium' ? 'text-amber-600' : 'text-emerald-600',
              )}
              aria-hidden="true"
            />
            <h3 className="font-semibold">Risk Assessment: {data.risk.level.toUpperCase()}</h3>
          </div>
          {data.risk.factors.length > 0 ? (
            <ul className="space-y-2">
              {data.risk.factors.map((factor, idx) => (
                <li key={idx} className="text-sm">
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={factor.severity === 'high' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {factor.severity}
                    </Badge>
                    <div>
                      <span className="font-medium">{factor.domain}:</span> {factor.description}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No significant risk factors identified.</p>
          )}
        </section>

        <section>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Strengths
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {data.strengths.map((strength, idx) => (
              <div key={idx} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-emerald-900 text-sm">{strength.domain}</p>
                  <Badge className="bg-emerald-600 text-white text-xs">{strength.score}</Badge>
                </div>
                <ul className="list-disc list-inside text-xs text-emerald-800 space-y-1">
                  {strength.evidence.slice(0, 2).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-semibold mb-3">Privilege Recommendations</h3>
          <div className="space-y-3">
            {data.privilegeRecommendations.map((rec, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg border p-3',
                  rec.type === 'expansion'
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : rec.type === 'restriction'
                    ? 'border-rose-200 bg-rose-50/50'
                    : 'border-blue-200 bg-blue-50/50',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={
                          rec.type === 'expansion'
                            ? 'default'
                            : rec.type === 'restriction'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {rec.type === 'expansion' ? 'Expand' : rec.type === 'restriction' ? 'Restrict' : 'Maintain'}
                      </Badge>
                      <Badge
                        variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'outline' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.priority} priority
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm">{rec.privilege}</p>
                    <p className="text-sm text-muted-foreground mt-1">{rec.rationale}</p>
                  </div>
                </div>
                {rec.evidence.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Evidence</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                      {rec.evidence.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {data.privilegeRecommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">No privilege changes recommended at this time.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-muted/30 p-4">
          <h3 className="font-semibold mb-2 text-sm">Clinician Information</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
              <p className="font-medium">{data.clinician.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Credential ID</p>
              <p className="font-medium">{data.clinician.credentialId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Specialty</p>
              <p className="font-medium">{data.clinician.specialty}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">NPI</p>
              <p className="font-medium">{data.clinician.npi}</p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

