'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  Shield,
  ClipboardCopy,
  CheckCircle2,
  AlertTriangle,
  Activity,
  TrendingUp,
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
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')
const DEMO_CLINICIAN = 'demo-78123'
const MATCH_SUITABILITY_URL =
  'https://vitalcv.health/fhir/StructureDefinition/match-suitability'

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
  marketRatio: number
  projectedFillTimeDays: number
  recommendedAction: string
}

interface SkillGapRecommendation {
  id: string
  type: 'cme' | 'certification' | 'compact'
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
}

interface MatchHighlight {
  title: string
  detail: string
  sentiment: 'positive' | 'neutral' | 'warning'
}

interface MatchExplanation {
  summary: string
  highlights: MatchHighlight[]
  recommendedActions: Array<{ label: string; detail: string }>
}

interface HireLikelihoodResult {
  hireLikelihood: number
  confidenceBand: { lower: number; upper: number }
  drivers: string[]
}

interface MatchRecord {
  jobId: string
  title: string | null
  organization: string | null
  specialty?: string | null
  location?: Record<string, unknown> | null
  modality?: string | null
  matchScore: number
  multiSignal: MultiSignalResult
  market: MarketContext
  skillGaps: SkillGapRecommendation[]
  explanation: MatchExplanation
  hireLikelihood?: HireLikelihoodResult
  fhirSuitability?: Record<string, unknown>
}

interface MatchesResponse {
  clinicianId: string
  generatedAt: string
  matches: MatchRecord[]
}

export default function RecommendedRolesPage() {
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    void loadMatches()
  }, [])

  async function loadMatches() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        buildApiUrl(`/api/matching/jobs/${DEMO_CLINICIAN}?limit=4`),
        { cache: 'no-store' },
      )
      if (!response.ok) {
        throw new Error(`Recommendations unavailable (${response.status})`)
      }
      const payload = (await response.json()) as MatchesResponse
      setMatches(payload.matches ?? [])
    } catch (err) {
      console.warn('Recommended roles API failed, loading mock data', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch live recommendations — showing cached snapshot.',
      )
      setMatches(buildMockMatches())
    } finally {
      setLoading(false)
    }
  }

  const topMatch = useMemo(() => matches[0], [matches])

  const handleCopyFhir = async (match: MatchRecord) => {
    if (!match.fhirSuitability || typeof navigator === 'undefined') return
    try {
      await navigator.clipboard.writeText(JSON.stringify(match.fhirSuitability, null, 2))
      setCopiedId(match.jobId)
      setTimeout(() => setCopiedId(null), 2500)
    } catch (err) {
      console.warn('Clipboard copy failed', err)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet</p>
          <h1 className="text-3xl font-bold">Recommended Roles</h1>
          <p className="text-muted-foreground max-w-2xl">
            Multi-signal suitability for your credential wallet. Scores blend specialty fit,
            readiness telemetry, trust, market pressure, and EHR privilege coverage.
          </p>
        </div>
        <Button variant="outline" onClick={loadMatches} disabled={loading}>
          {loading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {topMatch && (
        <Card className="bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Spotlight Role
            </CardTitle>
            <CardDescription>
              {(topMatch.title ?? 'Role')} · {(topMatch.organization ?? 'Partner')} —{' '}
              {(topMatch.matchScore ?? 0).toFixed(1)}% suitability
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Hire likelihood</p>
              <p className="text-3xl font-bold">
                {formatPercent(topMatch.hireLikelihood?.hireLikelihood ?? topMatch.multiSignal.finalScore)}
              </p>
              <p className="text-xs text-muted-foreground">
                Confidence band:{' '}
                {formatPercent(topMatch.hireLikelihood?.confidenceBand.lower ?? topMatch.multiSignal.finalScore - 0.05)}{' '}
                –{' '}
                {formatPercent(topMatch.hireLikelihood?.confidenceBand.upper ?? topMatch.multiSignal.finalScore + 0.05)}
              </p>
            </div>
            <Separator className="hidden md:block" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Market pressure</p>
              <Badge variant={marketBadgeVariant(topMatch.market.pressure)}>
                {topMatch.market.pressure.toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {topMatch.market.recommendedAction}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Key takeaway</p>
              <p className="text-sm">{topMatch.explanation.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
            <Shield className="h-5 w-5" />
            No recommendations ready yet.
          </div>
        ) : (
          matches.map((match) => (
            <MatchCard
              key={match.jobId}
              match={match}
              copied={copiedId === match.jobId}
              onCopyFhir={() => handleCopyFhir(match)}
            />
          ))
        )}
      </section>
    </div>
  )
}

function MatchCard({
  match,
  copied,
  onCopyFhir,
}: {
  match: MatchRecord
  copied: boolean
  onCopyFhir: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-xl">{match.title ?? 'Unnamed role'}</CardTitle>
          <CardDescription className="flex flex-wrap gap-2 text-sm">
            <span>{match.organization ?? 'Partner org'}</span>
            {match.specialty && (
              <>
                <span>•</span>
                <span>{match.specialty}</span>
              </>
            )}
            {match.modality && (
              <>
                <span>•</span>
                <span className="capitalize">{match.modality}</span>
              </>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{(match.matchScore ?? 0).toFixed(1)}% match</Badge>
          <Badge variant={marketBadgeVariant(match.market.pressure)}>{match.market.pressure}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Multi-signal score</p>
              <span className="text-2xl font-bold">
                {formatPercent(match.multiSignal.finalScore)}
              </span>
            </div>
            <MultiSignalBreakdown components={match.multiSignal.components} />
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Hire likelihood</p>
              <span className="text-2xl font-bold">
                {formatPercent(match.hireLikelihood?.hireLikelihood ?? match.multiSignal.finalScore)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Drivers:{' '}
              {(match.hireLikelihood?.drivers ?? []).slice(0, 2).join(' · ') ||
                'Readiness + market alignment'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-semibold text-muted-foreground">Explanation</p>
            <p className="text-sm">{match.explanation.summary}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {match.explanation.highlights.slice(0, 3).map((highlight) => (
                <li key={highlight.title} className={highlightClass(highlight.sentiment)}>
                  {highlight.detail}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Skill gap actions</p>
              <Badge variant="outline">{match.skillGaps.length || 'Clear'}</Badge>
            </div>
            <div className="mt-3 space-y-3">
              {match.skillGaps.length === 0 && (
                <p className="text-sm text-muted-foreground">No remediation required.</p>
              )}
              {match.skillGaps.map((gap) => (
                <div key={gap.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{gap.title}</span>
                    <Badge variant={priorityVariant(gap.priority)}>{gap.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{gap.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCopyFhir} disabled={!match.fhirSuitability}>
            {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
            {copied ? 'FHIR copied' : 'Copy FHIR PractitionerRole'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Includes suitability extension for downstream ATS/EHR export.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function MultiSignalBreakdown({ components }: { components: Record<string, number> }) {
  const entries = Object.entries(components)
  return (
    <div className="mt-3 space-y-2">
      {entries.map(([label, value]) => (
        <div key={label}>
          <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
            <span>{label}</span>
            <span>{formatPercent(value)}</span>
          </div>
          <Progress value={Math.min(100, Math.max(0, value * 100))} />
        </div>
      ))}
    </div>
  )
}

function priorityVariant(priority: SkillGapRecommendation['priority']) {
  switch (priority) {
    case 'high':
      return 'destructive'
    case 'medium':
      return 'secondary'
    default:
      return 'outline'
  }
}

function marketBadgeVariant(pressure: MarketContext['pressure']) {
  if (pressure === 'tight') return 'destructive'
  if (pressure === 'surplus') return 'secondary'
  return 'outline'
}

function highlightClass(sentiment: MatchHighlight['sentiment']) {
  if (sentiment === 'warning') {
    return 'text-sm text-amber-600'
  }
  if (sentiment === 'positive') {
    return 'text-sm text-emerald-600'
  }
  return 'text-sm text-muted-foreground'
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function buildMockMatches(): MatchRecord[] {
  const now = new Date()
  return [
    {
      jobId: 'mock-cardiology',
      title: 'Interventional Cardiologist',
      organization: 'Northstar Health',
      specialty: 'Cardiology',
      matchScore: 91.4,
      modality: 'hybrid',
      multiSignal: {
        finalScore: 0.91,
        components: {
          skill: 0.94,
          readiness: 0.9,
          trust: 0.88,
          market: 0.86,
          ehr: 0.82,
        },
        metadata: {
          trustWeight: 0.88,
          readinessScore: 0.9,
          marketPressure: 0.86,
          ehrCompliance: 0.82,
          blockers: [],
        },
      },
      market: {
        pressure: 'tight',
        marketRatio: 1.34,
        projectedFillTimeDays: 42,
        recommendedAction: 'Escalate signing incentives within 30 days to stay competitive.',
      },
      skillGaps: [
        {
          id: 'cme-structural',
          type: 'cme',
          title: 'Structural Heart CME',
          detail: 'Enroll in the 2025 valve symposium to keep registry eligibility current.',
          priority: 'medium',
        },
        {
          id: 'compact-followup',
          type: 'compact',
          title: 'IMLC renewal',
          detail: 'Renew compact packet to unlock telehealth coverage for TX, CO, and WA.',
          priority: 'high',
        },
      ],
      explanation: {
        summary: '91% suitability with high specialty overlap and balanced readiness telemetry.',
        highlights: [
          {
            title: 'Specialty',
            detail: 'Primary specialty matches cath lab taxonomy with recent TAVR logs.',
            sentiment: 'positive',
          },
          {
            title: 'Readiness',
            detail: 'PSV refreshed last month with no sanctions detected.',
            sentiment: 'positive',
          },
          {
            title: 'EHR',
            detail: 'Epic super-user privileges missing at destination facility.',
            sentiment: 'warning',
          },
        ],
        recommendedActions: [
          { label: 'Upload Epic training proof', detail: 'Attach super-user attestation.' },
        ],
      },
      hireLikelihood: {
        hireLikelihood: 0.82,
        confidenceBand: { lower: 0.72, upper: 0.9 },
        drivers: ['Multi-signal alignment in top quintile', 'Market demand elevated'],
      },
      fhirSuitability: {
        resourceType: 'PractitionerRole',
        id: 'mock-cardiology',
        extension: [
          {
            url: MATCH_SUITABILITY_URL,
            extension: [{ url: 'score', valueDecimal: 0.91 }],
          },
        ],
      },
    },
    {
      jobId: 'mock-telehospitalist',
      title: 'Telehospitalist (Night)',
      organization: 'Pulse Remote Care',
      specialty: 'Hospitalist',
      modality: 'telehealth',
      matchScore: 87.2,
      multiSignal: {
        finalScore: 0.87,
        components: {
          skill: 0.88,
          readiness: 0.82,
          trust: 0.84,
          market: 0.9,
          ehr: 0.75,
        },
        metadata: {
          trustWeight: 0.84,
          readinessScore: 0.82,
          marketPressure: 0.9,
          ehrCompliance: 0.75,
          blockers: ['Tele-ICU privileges (Epic)'],
        },
      },
      market: {
        pressure: 'balanced',
        marketRatio: 1.08,
        projectedFillTimeDays: 35,
        recommendedAction: 'Balanced demand — maintain current comp plan and close within 45 days.',
      },
      skillGaps: [
        {
          id: 'ehr-teleicu',
          type: 'certification',
          title: 'Tele-ICU privileges',
          detail: 'Provide Epic telehealth credentialing letter to unlock cross-hospital routing.',
          priority: 'high',
        },
      ],
      explanation: {
        summary: '87% suitability; remote readiness strong but EHR proof pending.',
        highlights: [
          {
            title: 'Market',
            detail: 'Balanced market — little pricing pressure.',
            sentiment: 'neutral',
          },
          {
            title: 'EHR',
            detail: 'Telehealth privileges missing for Tele-ICU workflows.',
            sentiment: 'warning',
          },
          {
            title: 'Trust',
            detail: 'Chain-of-trust telemetry current and verified.',
            sentiment: 'positive',
          },
        ],
        recommendedActions: [
          { label: 'Upload telehealth letter', detail: 'Epic Tele-ICU privileges pending upload.' },
        ],
      },
      hireLikelihood: {
        hireLikelihood: 0.78,
        confidenceBand: { lower: 0.68, upper: 0.85 },
        drivers: ['Strong remote readiness posture', 'EHR blocker still open'],
      },
      fhirSuitability: undefined,
    },
  ]
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Gauge, Loader2, Sparkles, TrendingUp } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')
const DEMO_CLINICIAN = 'wallet-demo-clinician'

interface MatchResponse {
  clinicianId: string
  matches: RecommendedMatch[]
  generatedAt: string
}

interface RecommendedMatch {
  jobId: string
  title: string
  organization: string
  specialty?: string
  matchScore: number
  adjustedScore: number
  multiSignal?: {
    finalScore?: number
    components?: Record<string, number>
    metadata?: {
      marketPressure?: string
      blockers?: string[]
    }
  }
  market?: {
    pressure: 'tight' | 'balanced' | 'surplus'
    equilibriumScore: number
    recommendedAction: string
    projectedFillTimeDays: number
  }
  skillGaps?: Array<{
    id: string
    title: string
    detail: string
    priority: 'high' | 'medium' | 'low'
  }>
  explanation?: {
    summary: string
    highlights: Array<{
      title: string
      detail: string
      sentiment: 'positive' | 'neutral' | 'warning'
    }>
    recommendedActions: Array<{ label: string; detail: string }>
  }
}

export default function RecommendedRolesPage() {
  const [clinicianId, setClinicianId] = useState(DEMO_CLINICIAN)
  const [matches, setMatches] = useState<RecommendedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(buildApiUrl(`/api/matching/jobs/${clinicianId}?limit=4`), {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(`Recommendation API failed (${response.status})`)
      }
      const payload = (await response.json()) as MatchResponse
      setMatches(payload.matches ?? [])
    } catch (err) {
      console.warn('Recommended roles API failed, falling back to mock payload', err)
      setMatches(buildMockMatches())
      setError('Live recommendations unavailable — showing cached intelligence.')
    } finally {
      setLoading(false)
    }
  }, [clinicianId])

  useEffect(() => {
    void fetchMatches()
  }, [fetchMatches])

  const summary = useMemo(() => {
    if (!matches.length) return null
    const average = matches.reduce((sum, match) => sum + match.adjustedScore, 0) / matches.length
    const tightMarkets = matches.filter((match) => match.market?.pressure === 'tight').length
    return {
      averageScore: (average * 100).toFixed(1),
      tightMarkets,
    }
  }, [matches])

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet</p>
          <h1 className="text-3xl font-bold">Recommended Roles</h1>
          <p className="text-muted-foreground max-w-2xl">
            Multi-signal match intelligence blending skills, readiness, trust, and market demand so you
            can action the highest leverage roles faster.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={clinicianId}
            onChange={(event) => setClinicianId(event.target.value)}
            placeholder="Clinician ID"
            className="w-48"
          />
          <Button onClick={fetchMatches} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Realtime recommendations unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Average fit</CardTitle>
            <CardDescription>Composite of multi-signal scores</CardDescription>
          </CardHeader>
          <CardContent>
            {summary ? (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{summary.averageScore}%</span>
                <span className="text-sm text-muted-foreground">Avg multi-signal score</span>
              </div>
            ) : (
              <Skeleton className="h-12 w-32" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Market pressure</CardTitle>
            <CardDescription>Regions flagged as tight</CardDescription>
          </CardHeader>
          <CardContent>
            {summary ? (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{summary.tightMarkets}</span>
                <span className="text-sm text-muted-foreground">Tight markets</span>
              </div>
            ) : (
              <Skeleton className="h-12 w-32" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
            <CardDescription>Roles surfaced for action</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-12 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{matches.length}</span>
                <span className="text-sm text-muted-foreground">Recommended roles</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        {loading ? (
          <LoadingList />
        ) : matches.length === 0 ? (
          <EmptyState />
        ) : (
          matches.map((match) => <RecommendationCard key={match.jobId} match={match} />)
        )}
      </section>
    </div>
  )
}

function RecommendationCard({ match }: { match: RecommendedMatch }) {
  const signalScore = match.multiSignal?.finalScore ?? match.adjustedScore / 100
  const marketPressure = match.market?.pressure ?? 'balanced'
  const color = marketPressure === 'tight' ? 'text-amber-600' : marketPressure === 'surplus' ? 'text-emerald-600' : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xl">{match.title}</CardTitle>
          <CardDescription>
            {match.organization} · {match.specialty ?? 'General'}
          </CardDescription>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Gauge className="h-3.5 w-3.5" />
          {((match.adjustedScore ?? 0) * 100).toFixed(1)}% fit
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Multi-signal blend</p>
          <div className="mt-2 space-y-2">
            <Progress value={(signalScore ?? 0) * 100} />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(match.multiSignal?.components ?? {})
                .slice(0, 4)
                .map(([label, value]) => (
                  <Badge key={label} variant="outline" className="justify-between gap-1 px-2">
                    <span>{label}</span>
                    <span className="font-semibold text-foreground">{Math.round(value * 100)}%</span>
                  </Badge>
                ))}
            </div>
          </div>
        </div>

        {match.market && (
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Market signal</span>
              <Badge variant="outline" className={color}>
                {match.market.pressure === 'tight'
                  ? 'Tight demand'
                  : match.market.pressure === 'surplus'
                    ? 'Surplus supply'
                    : 'Balanced'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{match.market.recommendedAction}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Projected fill: {match.market.projectedFillTimeDays} days
            </p>
          </div>
        )}

        {match.explanation && (
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">Highlights</p>
            <ul className="space-y-1">
              {match.explanation.highlights.slice(0, 2).map((highlight) => (
                <li key={highlight.title} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{highlight.title} · </span>
                  {highlight.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {match.skillGaps?.length ? (
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">Recommended actions</p>
            <div className="grid gap-2 md:grid-cols-2">
              {match.skillGaps.map((gap) => (
                <div key={gap.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{gap.title}</span>
                    <Badge variant={gap.priority === 'high' ? 'destructive' : gap.priority === 'medium' ? 'outline' : 'secondary'}>
                      {gap.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{gap.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LoadingList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`recommended-skeleton-${index}`} className="h-48 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      <TrendingUp className="h-8 w-8" />
      <p>No recommendations yet. Complete readiness steps to unlock matches.</p>
    </div>
  )
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function buildMockMatches(): RecommendedMatch[] {
  return [
    {
      jobId: 'mock-1',
      title: 'Interventional Cardiologist · Nights',
      organization: 'Mercy Heart Institute',
      specialty: 'Cardiology',
      matchScore: 92.5,
      adjustedScore: 0.92,
      multiSignal: {
        finalScore: 0.9,
        components: { skill: 0.95, readiness: 0.88, market: 0.87, ehr: 0.8 },
        metadata: { marketPressure: 'tight', blockers: [] },
      },
      market: {
        pressure: 'tight',
        equilibriumScore: 0.62,
        recommendedAction: 'Escalate sign-on to secure slot within 30 days.',
        projectedFillTimeDays: 32,
      },
      skillGaps: [
        {
          id: 'cme-tavr',
          title: 'CME — Structural refresher',
          detail: 'Upload structural heart CME to unlock 5% higher score.',
          priority: 'medium',
        },
      ],
      explanation: {
        summary: '91% suitability with competitive demand.',
        highlights: [
          {
            title: 'Skill alignment',
            detail: 'Primary specialty matches structural program with high procedure overlap.',
            sentiment: 'positive',
          },
          {
            title: 'Market pressure',
            detail: 'High demand outpaces supply in this region — act quickly.',
            sentiment: 'warning',
          },
        ],
        recommendedActions: [],
      },
    },
  ]
}

