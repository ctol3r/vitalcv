'use client'

import { useEffect, useState } from 'react'
import {
  ClipboardCopy,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'

interface CandidateApiRecord {
  clinicianId: string
  readinessScore: number
  sanctionsClear: boolean
  psvCurrent: boolean
  npdbClear: boolean
  compactEligibility: string
  updatedAt: string
}

interface CandidatesResponse {
  candidates: CandidateApiRecord[]
}

interface MultiSignalResult {
  finalScore: number
  components: Record<string, number>
  metadata: {
    trustWeight: number
    readinessScore: number
    marketPressure: number
    ehrCompliance: number
    blockers: string[]
  }
}

interface MarketContext {
  pressure: 'tight' | 'balanced' | 'surplus'
  recommendedAction: string
}

interface HireLikelihood {
  hireLikelihood: number
  confidenceBand: { lower: number; upper: number }
  drivers: string[]
}

interface MatchRecord {
  jobId: string
  title: string | null
  organization: string | null
  specialty?: string | null
  matchScore: number
  multiSignal: MultiSignalResult
  market: MarketContext
  explanation: { summary: string }
  hireLikelihood?: HireLikelihood
  fhirSuitability?: Record<string, unknown>
}

interface SuperMatchRow extends CandidateApiRecord {
  matches: MatchRecord[]
}

export default function SuperMatchConsole() {
  const [rows, setRows] = useState<SuperMatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    void loadConsole()
  }, [])

  async function loadConsole() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/recruiter/candidates?ready=true`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(`Unable to load candidate telemetry (${response.status})`)
      }
      const payload = (await response.json()) as CandidatesResponse
      const seed = payload.candidates.slice(0, 3)
      const enriched = await Promise.all(
        seed.map(async (candidate) => {
          try {
            const matchRes = await fetch(
              `${API_BASE}/api/matching/jobs/${candidate.clinicianId}?limit=3`,
            )
            if (!matchRes.ok) {
              throw new Error('match_fetch_failed')
            }
            const matchData = await matchRes.json()
            return {
              ...candidate,
              matches: (matchData.matches as MatchRecord[]) ?? [],
            }
          } catch (fetchError) {
            console.warn('Unable to fetch matches for', candidate.clinicianId, fetchError)
            return {
              ...candidate,
              matches: [],
            }
          }
        }),
      )
      setRows(enriched)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load SuperMatch console')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyFhir = async (match: MatchRecord) => {
    if (!match.fhirSuitability || typeof navigator === 'undefined') return
    try {
      await navigator.clipboard.writeText(JSON.stringify(match.fhirSuitability, null, 2))
      setCopiedId(match.jobId)
      setTimeout(() => setCopiedId(null), 2500)
    } catch (error) {
      console.warn('FHIR copy failed', error)
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SuperMatch Console</h1>
          <p className="text-muted-foreground">
            Live blending of readiness, fairness, market pressure, and EHR privilege alignment for
            recruiter-ready clinicians.
          </p>
        </div>
        <Button variant="outline" onClick={loadConsole} disabled={loading}>
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>SuperMatch unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        rows.map((row) => (
          <Card key={row.clinicianId}>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg">Clinician #{row.clinicianId.slice(0, 8)}</CardTitle>
                <CardDescription>
                  Readiness {(row.readinessScore * 100).toFixed(1)}% · Compact{' '}
                  {row.compactEligibility}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Sanctions" ok={row.sanctionsClear} />
                <StatusBadge label="PSV" ok={row.psvCurrent} />
                <StatusBadge label="NPDB" ok={row.npdbClear} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {row.matches.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No AI matches yet — readiness telemetry logged {new Date(row.updatedAt).toLocaleDateString()}.
                </div>
              ) : (
                row.matches.map((match) => (
                  <div
                    key={`${row.clinicianId}-${match.jobId}`}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-base font-semibold">{match.title ?? 'Role'}</p>
                        <p className="text-sm text-muted-foreground">
                          {match.organization ?? 'Partner'} ·{' '}
                          {(match.matchScore ?? 0).toFixed(1)}% suitability
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={marketVariant(match.market.pressure)}>
                          {match.market.pressure}
                        </Badge>
                        <Badge variant="secondary">
                          {formatPercent(match.hireLikelihood?.hireLikelihood ?? match.multiSignal.finalScore)} hire likelihood
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      <MultiSignalStack components={match.multiSignal.components} />
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Hire drivers</p>
                        <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                          {(match.hireLikelihood?.drivers ?? []).slice(0, 2).map((driver) => (
                            <li key={`${match.jobId}-${driver}`}>{driver}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Summary</p>
                        <p className="text-sm">{match.explanation.summary}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyFhir(match)}
                        disabled={!match.fhirSuitability}
                      >
                        {copiedId === match.jobId ? (
                          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                        ) : (
                          <ClipboardCopy className="mr-2 h-4 w-4" />
                        )}
                        {copiedId === match.jobId ? 'FHIR copied' : 'Copy FHIR suitability'}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Export PractitionerRole with suitability extension for ATS handoff.
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
          <Users className="h-5 w-5" />
          <p>No recruiter-ready clinicians yet.</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge variant={ok ? 'outline' : 'destructive'} className="text-xs">
      {ok ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <ShieldAlert className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  )
}

function MultiSignalStack({ components }: { components: Record<string, number> }) {
  const pairs = Object.entries(components)
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">Signals</p>
      <div className="mt-2 space-y-2">
        {pairs.map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{key}</span>
              <span>{formatPercent(value)}</span>
            </div>
            <Progress value={Math.min(100, Math.max(0, value * 100))} />
          </div>
        ))}
      </div>
    </div>
  )
}

function marketVariant(pressure: MarketContext['pressure']) {
  if (pressure === 'tight') return 'destructive'
  if (pressure === 'surplus') return 'secondary'
  return 'outline'
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Gauge, Loader2, Shield, Sparkles, Target, Users } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '')
const DEFAULT_JOB = 'demo-job-992'

interface SuperMatchResponse {
  job: {
    id: string
    title: string
    specialty: string
    organization: string
    requiredStates?: string[]
  }
  market?: {
    pressure: 'tight' | 'balanced' | 'surplus'
    recommendedAction: string
    projectedFillTimeDays: number
    equilibriumScore: number
  }
  candidates: SuperMatchCandidate[]
  fairnessOverlay: {
    totalAlerts: number
    representation: {
      specialty: Array<{ group: string; share: number }>
      gender: Array<{ group: string; share: number }>
      region: Array<{ group: string; share: number }>
    }
  }
  generatedAt: string
}

interface SuperMatchCandidate {
  clinicianId: string
  name: string
  specialty: string
  state?: string
  readinessScore: number
  scheduleFit: number
  fairness?: {
    fairnessScore: number
    biasAlerts: string[]
  }
  prediction: {
    score: number
    rationale: {
      contributions: Record<string, number>
      confidenceBand: { lower: number; upper: number }
      factors: string[]
    }
  }
  multiSignal?: {
    finalScore: number
    components: Record<string, number>
    metadata: {
      marketPressure: string
      blockers: string[]
    }
  } | null
  market?: {
    pressure: string
    recommendedAction: string
  }
  hireLikelihood?: {
    hireLikelihood: number
    confidenceBand: { lower: number; upper: number }
    drivers: string[]
  }
  skillGaps?: Array<{ id: string; title: string; detail: string; priority: string }>
  explanation?: {
    summary: string
    highlights: Array<{ title: string; detail: string; sentiment: string }>
  } | null
}

export default function SuperMatchConsole() {
  const [jobId, setJobId] = useState(DEFAULT_JOB)
  const [payload, setPayload] = useState<SuperMatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSuperMatch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/matching/predictive/${jobId}?limit=12`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(`SuperMatch feed failed (${response.status})`)
      }
      const data = (await response.json()) as SuperMatchResponse
      setPayload(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load SuperMatch console'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void fetchSuperMatch()
  }, [fetchSuperMatch])

  const topCandidate = useMemo(() => payload?.candidates?.[0], [payload])

  return (
    <div className="space-y-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SuperMatch Console</h1>
          <p className="text-muted-foreground">
            Title VII–aware matching that blends readiness, trust, fairness, and market demand for recruiters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            placeholder="Job ID"
            className="w-48"
          />
          <Button onClick={fetchSuperMatch} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load SuperMatch</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Job snapshot</CardTitle>
            <CardDescription>{payload?.job.organization ?? '—'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Role:{' '}
              <span className="font-medium text-foreground">
                {payload?.job.title ?? 'Loading'}
              </span>
            </p>
            <p>Specialty: {payload?.job.specialty ?? '—'}</p>
            <p>
              Generated:{' '}
              {payload ? new Date(payload.generatedAt).toLocaleString() : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Market signal</CardTitle>
            <CardDescription>Equilibrium + recruiter playbook</CardDescription>
          </CardHeader>
          <CardContent>
            {payload?.market ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <Badge
                  variant={
                    payload.market.pressure === 'tight'
                      ? 'destructive'
                      : payload.market.pressure === 'surplus'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {payload.market.pressure}
                </Badge>
                <p className="text-foreground">{payload.market.recommendedAction}</p>
                <p>Projected fill: {payload.market.projectedFillTimeDays} days</p>
              </div>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fairness overlay</CardTitle>
            <CardDescription>{payload?.fairnessOverlay.totalAlerts ?? 0} bias alerts</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4 text-sm text-muted-foreground">
            {['specialty', 'gender', 'region'].map((dimension) => (
              <div key={dimension} className="space-y-1">
                <p className="text-xs uppercase">{dimension}</p>
                <div className="space-y-1">
                  {(payload?.fairnessOverlay.representation[dimension as keyof SuperMatchResponse['fairnessOverlay']['representation']] ?? [])
                    .slice(0, 2)
                    .map((entry) => (
                      <div key={`${dimension}-${entry.group}`}>{entry.group}: {entry.share}%</div>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Ranked clinicians</CardTitle>
            <CardDescription>
              Hire likelihood blends multi-signal fit, predictive telemetry, fairness guardrails, and market pressure.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {payload?.candidates.length ?? 0} surfaced
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingTable />
          ) : (
            <CandidateTable candidates={payload?.candidates ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CandidateTable({ candidates }: { candidates: SuperMatchCandidate[] }) {
  if (!candidates.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Shield className="h-6 w-6" />
        <p>No candidates surfaced yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clinician</TableHead>
            <TableHead>Multi-signal</TableHead>
            <TableHead>Hire likelihood</TableHead>
            <TableHead>Fairness</TableHead>
            <TableHead>Skill actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.clinicianId}>
              <TableCell>
                <div className="font-semibold">{candidate.name}</div>
                <div className="text-xs text-muted-foreground">
                  {candidate.specialty} · {candidate.state ?? '—'}
                </div>
              </TableCell>
              <TableCell>
                <ScorePill
                  label="Multi-signal"
                  value={candidate.multiSignal?.finalScore ?? candidate.prediction.score}
                  subtitle={candidate.multiSignal?.metadata.marketPressure}
                />
              </TableCell>
              <TableCell>
                <ScorePill
                  label="Hire likelihood"
                  value={candidate.hireLikelihood?.hireLikelihood ?? candidate.prediction.score}
                  subtitle={
                    candidate.hireLikelihood
                      ? `${Math.round(candidate.hireLikelihood.confidenceBand.lower * 100)}%–${Math.round(candidate.hireLikelihood.confidenceBand.upper * 100)}%`
                      : undefined
                  }
                />
              </TableCell>
              <TableCell>
                {candidate.fairness ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <Badge
                      variant={candidate.fairness.biasAlerts.length ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {candidate.fairness.biasAlerts.length ? `${candidate.fairness.biasAlerts.length} alerts` : 'Clear'}
                    </Badge>
                    <p>Score {(candidate.fairness.fairnessScore * 100).toFixed(0)}%</p>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting overlay</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(candidate.skillGaps ?? []).slice(0, 2).map((gap) => (
                    <Badge
                      key={`${candidate.clinicianId}-${gap.id}`}
                      variant={gap.priority === 'high' ? 'destructive' : 'outline'}
                      className="w-fit"
                    >
                      {gap.title}
                    </Badge>
                  ))}
                  {!candidate.skillGaps?.length && <span>No actions</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ScorePill({ label, value, subtitle }: { label: string; value?: number; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{((value ?? 0) * 100).toFixed(1)}%</span>
      </div>
      <Progress value={(value ?? 0) * 100} />
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function LoadingTable() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`supermatch-loading-${index}`} className="h-20 w-full" />
      ))}
    </div>
  )
}

