'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, Loader2, TrendingUp } from 'lucide-react'

export type FeatureContribution = {
  feature: string
  contribution: number // -1 to 1, negative reduces risk, positive increases
  evidence?: string[]
}

export type SignalExplanationProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  signalId: string
  predictedRisk: number
  horizon: '7d' | '14d' | '30d' | '60d'
  features?: FeatureContribution[]
  privilegeName?: string
}

const HORIZON_LABELS: Record<SignalExplanationProps['horizon'], string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '60d': '60 days',
}

export function SignalExplanationDrawer({
  open,
  onOpenChange,
  signalId,
  predictedRisk,
  horizon,
  features = [],
  privilegeName,
}: SignalExplanationProps) {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !explanation && features.length > 0) {
      fetchExplanation()
    }
  }, [open, signalId, features])

  const fetchExplanation = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Call the AI explain API endpoint
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: 'predictive_signal',
          subjectId: signalId,
          context: {
            predictedRisk,
            horizon,
            features: features.map((f) => ({
              name: f.feature,
              contribution: f.contribution,
            })),
            privilegeName,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch explanation')
      }

      const data = await response.json()
      setExplanation(data.explanation || data.result || 'Explanation generated successfully.')
    } catch (err) {
      console.error('Error fetching explanation:', err)
      setError('Failed to load explanation. Please try again.')
      // Fallback to a simple explanation
      setExplanation(generateFallbackExplanation())
    } finally {
      setIsLoading(false)
    }
  }

  const generateFallbackExplanation = (): string => {
    const topFeatures = [...features]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3)

    const increasing = topFeatures.filter((f) => f.contribution > 0)
    const decreasing = topFeatures.filter((f) => f.contribution < 0)

    let text = `The predicted risk of ${Math.round(predictedRisk)}% over ${HORIZON_LABELS[horizon]} is primarily driven by:`

    if (increasing.length > 0) {
      text += `\n\nFactors increasing risk: ${increasing.map((f) => f.feature).join(', ')}.`
    }

    if (decreasing.length > 0) {
      text += `\n\nFactors reducing risk: ${decreasing.map((f) => f.feature).join(', ')}.`
    }

    return text
  }

  const sortedFeatures = [...features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 right-0 left-auto h-screen max-h-screen w-full max-w-3xl translate-x-0 translate-y-0 space-y-6 overflow-y-auto rounded-none border-l bg-background px-6 py-8 shadow-2xl focus-visible:outline-hidden sm:px-10"
        showCloseButton
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold">Signal explanation</DialogTitle>
          <DialogDescription className="text-base">
            Feature contributions to predicted risk for {privilegeName || 'selected privilege'} over {HORIZON_LABELS[horizon]}.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Predicted risk</p>
                <p className="text-3xl font-bold">{Math.round(predictedRisk)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Forecast horizon</p>
                <Badge variant="outline" className="mt-1">
                  {HORIZON_LABELS[horizon]}
                </Badge>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>Generating explanation...</span>
            </div>
          ) : error && !explanation ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-rose-900">Error loading explanation</p>
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            explanation && (
              <section aria-label="AI-generated explanation" className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-semibold uppercase tracking-wide">AI explanation</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{explanation}</p>
                </div>
              </section>
            )
          )}

          {features.length > 0 && (
            <section aria-label="Feature contributions" className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-semibold uppercase tracking-wide">Top contributing features</p>
              </div>

              <div className="space-y-2">
                {sortedFeatures.map((feature, index) => {
                  const isPositive = feature.contribution > 0
                  const magnitude = Math.abs(feature.contribution)
                  const percentage = Math.round(magnitude * 100)

                  return (
                    <div key={feature.feature} className="rounded-lg border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {index + 1}
                            </span>
                            <p className="font-semibold">{feature.feature}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                isPositive ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200',
                              )}
                            >
                              {isPositive ? '+' : '-'}{percentage}%
                            </Badge>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div
                                className={cn(
                                  'h-2 rounded-full transition-all',
                                  isPositive ? 'bg-rose-500' : 'bg-emerald-500',
                                )}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                                aria-hidden="true"
                              />
                            </div>
                          </div>

                          {feature.evidence && feature.evidence.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {feature.evidence.map((ev, idx) => (
                                <li key={idx} className="rounded-full bg-muted px-2 py-0.5">
                                  {ev}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

