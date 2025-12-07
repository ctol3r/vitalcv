'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Network,
  RefreshCw,
  Shield,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface FraudScoreResponse {
  clinicianId: string
  fraudScore: number
  tamper: {
    tamperLikelihood: number
    reasons: string[]
    signals: {
      fontInstability: number
      pixelManipulation: number
      templateDeviation: number
    }
    evaluatedAt: string
  }
  crossSource: {
    mismatches: Array<{
      field: string
      expected: string
      provided: string
      source: string
      score: number
    }>
    mismatchRatio: number
    evaluatedAt: string
  }
  sanctions: {
    eventsPerQuarter: number
    normalizedFrequency: number
  }
  clinician: {
    npi?: string | null
    fullName?: string | null
    specialty?: string | null
    state?: string | null
  }
  warnings: string[]
  recommendedSteps: string[]
  evaluatedAt: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'

export default function ClinicianFraudPanel() {
  const params = useParams<{ id: string }>()
  const clinicianId = params?.id
  const [fraudData, setFraudData] = useState<FraudScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicianId) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const target = `${API_BASE.replace(/\/$/, '')}/api/fraud/clinicians/${clinicianId}`
    fetch(target, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.message ?? 'Unable to load fraud signals.')
        }
        setFraudData(payload as FraudScoreResponse)
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return
        console.error(fetchError)
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load fraud data.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [clinicianId])

  const consolidatedReasons = useMemo(() => {
    if (!fraudData) return []
    return Array.from(new Set([...(fraudData.warnings ?? []), ...(fraudData.tamper?.reasons ?? [])]))
  }, [fraudData])

  if (!clinicianId) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Missing clinician id</CardTitle>
            <CardDescription>Unable to locate clinician context.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <p className="text-sm text-muted-foreground">Recruiter intelligence</p>
        <h1 className="text-3xl font-semibold tracking-tight">Fraud indicators</h1>
        <p className="text-muted-foreground">
          Compare document fingerprints with registry sources and prioritize human-in-the-loop
          reviews before scheduling.
        </p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Evaluating risk...</CardTitle>
            <CardDescription>Running tamper and cross-source checks.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Collecting signals</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-destructive">Unable to load fraud telemetry</CardTitle>
              <CardDescription className="text-destructive">{error}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                setError(null)
                setLoading(true)
                setFraudData(null)
                // trigger refetch by resetting clinicianId dependency
                setTimeout(() => setLoading(false), 10)
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : fraudData ? (
        <>
          <SummaryRow fraudData={fraudData} />
          <div className="grid gap-4 lg:grid-cols-3">
            <TamperCard data={fraudData.tamper} />
            <CrossSourceCard data={fraudData.crossSource} />
            <SanctionsCard data={fraudData.sanctions} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk rationale</CardTitle>
              <CardDescription>Signals that triggered elevated fraud likelihood.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {consolidatedReasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No critical reasons recorded.</p>
              ) : (
                consolidatedReasons.map((reason) => (
                  <div key={reason} className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 text-amber-500" />
                    <p className="text-sm text-muted-foreground">{reason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended next steps</CardTitle>
              <CardDescription>Automated guidance for the recruiter HITL queue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fraudData.recommendedSteps.map((step) => (
                <div key={step} className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Confirm escalations in the HITL console so downstream auditors can trace review
                outcomes.
              </div>
            </CardContent>
          </Card>

          {fraudData.crossSource.mismatches.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Cross-source mismatches</CardTitle>
                <CardDescription>Fields diverging from board, state, or NPPES sources.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fraudData.crossSource.mismatches.map((mismatch) => (
                  <div key={`${mismatch.field}-${mismatch.source}`} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{mismatch.field}</Badge>
                      <Badge variant="secondary">{mismatch.source.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">
                        drift {(mismatch.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1 text-muted-foreground">
                      <p>Provided: {mismatch.provided || '—'}</p>
                      <p>Expected: {mismatch.expected || '—'}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function SummaryRow({ fraudData }: { fraudData: FraudScoreResponse }) {
  const score = Math.round((fraudData.fraudScore ?? 0) * 100)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-2xl">
            {fraudData.clinician?.fullName ?? `Clinician ${fraudData.clinicianId}`}
          </CardTitle>
          <CardDescription className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>NPI {fraudData.clinician?.npi ?? 'unknown'}</span>
            {fraudData.clinician?.specialty ? (
              <>
                <span>•</span>
                <span>{fraudData.clinician.specialty}</span>
              </>
            ) : null}
            {fraudData.clinician?.state ? (
              <>
                <span>•</span>
                <span>{fraudData.clinician.state}</span>
              </>
            ) : null}
          </CardDescription>
        </div>
        <Badge className={cn('text-base px-4 py-1.5', score > 70 && 'bg-red-600 hover:bg-red-600')}>
          Fraud score {score}%
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Tamper likelihood</p>
          <p className="text-3xl font-semibold">{Math.round(fraudData.tamper.tamperLikelihood * 100)}%</p>
          <Progress value={fraudData.tamper.tamperLikelihood * 100} className="mt-2" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Data mismatch ratio</p>
          <p className="text-3xl font-semibold">
            {(fraudData.crossSource.mismatchRatio * 100).toFixed(1)}%
          </p>
          <Progress value={fraudData.crossSource.mismatchRatio * 100} className="mt-2" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Sanctions velocity</p>
          <p className="text-3xl font-semibold">{(fraudData.sanctions.normalizedFrequency).toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">events / year (normalized)</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TamperCard({ data }: { data: FraudScoreResponse['tamper'] }) {
  const signals = [
    {
      label: 'Font instability',
      value: data.signals.fontInstability,
    },
    {
      label: 'Pixel manipulation',
      value: data.signals.pixelManipulation,
    },
    {
      label: 'Template deviation',
      value: data.signals.templateDeviation,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Tamper heuristics
        </CardTitle>
        <CardDescription>Document fingerprint anomalies</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signals.map((signal) => (
          <div key={signal.label}>
            <div className="flex items-center justify-between text-sm">
              <span>{signal.label}</span>
              <span className="text-muted-foreground">{Math.round(signal.value * 100)}%</span>
            </div>
            <Progress value={signal.value * 100} className="mt-1" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function CrossSourceCard({ data }: { data: FraudScoreResponse['crossSource'] }) {
  const severity = data.mismatchRatio > 0.35 ? 'high' : data.mismatchRatio > 0.15 ? 'medium' : 'low'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          Cross-source drift
        </CardTitle>
        <CardDescription>External registry alignment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-semibold capitalize">Mismatch level: {severity}</p>
          <p className="text-muted-foreground">
            {(data.mismatchRatio * 100).toFixed(1)}% of monitored fields diverge from authority data.
          </p>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Evaluated {new Date(data.evaluatedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}

function SanctionsCard({ data }: { data: FraudScoreResponse['sanctions'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Sanctions cadence
        </CardTitle>
        <CardDescription>Signals from privilege safety feed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold">{data.eventsPerQuarter.toFixed(2)}</p>
          <span className="text-sm text-muted-foreground">events / quarter</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Normalized annual frequency {data.normalizedFrequency.toFixed(2)}
        </p>
      </CardContent>
    </Card>
  )
}










