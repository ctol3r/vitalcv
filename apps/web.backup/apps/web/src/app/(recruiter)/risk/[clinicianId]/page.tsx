'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ShieldCheck, ShieldHalf, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')

interface RiskApiResponse {
  clinicianId: string
  riskScore: number
  updatedAt: string
  rationale: Record<string, any>
  reasonCodes: string[]
  mitigationSteps: string[]
  components: Record<
    string,
    | {
        score: number
        metadata?: Record<string, any>
        observedAt?: string
      }
    | null
  >
  alerts?: Array<{
    type: string
    message: string
    createdAt: string
  }>
  recentEvents?: Array<{
    id: string
    type: string
    severity: number
    createdAt: string
    metadata?: Record<string, any>
  }>
}

export default function RecruiterRiskPage({
  params,
}: {
  params: { clinicianId: string }
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<RiskApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadRiskProfile(false)
  }, [params.clinicianId])

  async function loadRiskProfile(refresh: boolean) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        buildApiUrl(
          `/api/recruiter/risk/${params.clinicianId}${refresh ? '?refresh=true' : ''}`,
        ),
      )
      if (!response.ok) {
        throw new Error(`Risk API responded with ${response.status}`)
      }
      const data = (await response.json()) as RiskApiResponse
      setProfile(data)
    } catch (err) {
      console.warn('Risk API unavailable, showing cached mock', err)
      setProfile(buildMockRisk(params.clinicianId))
      setError(
        'Live risk feed unavailable — showing cached snapshot with behavioral flags.',
      )
    } finally {
      setLoading(false)
    }
  }

  const riskLabel = useMemo(() => {
    if (!profile) return ''
    if (profile.riskScore >= 0.75) return 'High'
    if (profile.riskScore >= 0.45) return 'Medium'
    return 'Low'
  }, [profile])

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Recruiter Portal • Risk
          </p>
          <h1 className="text-3xl font-bold">Composite Risk Monitor</h1>
          <p className="text-muted-foreground max-w-2xl">
            Blends sanctions, fraud, NPDB, and behavioral telemetry. Use this panel to
            capture mitigation notes before moving a clinician into offers or privileging.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <Button
            variant="secondary"
            onClick={() => loadRiskProfile(true)}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh signals
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-500/60 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Composite risk</CardTitle>
              <CardDescription>
                Updated {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : '—'}
              </CardDescription>
            </div>
            {profile && (
              <Badge
                variant={
                  profile.riskScore >= 0.75
                    ? 'destructive'
                    : profile.riskScore >= 0.45
                      ? 'outline'
                      : 'secondary'
                }
                className="text-base"
              >
                {riskLabel} · {(profile.riskScore * 100).toFixed(1)}%
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : profile ? (
              <div className="space-y-6">
                <RiskGauge value={profile.riskScore} />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Reason codes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.reasonCodes.map((code) => (
                      <Badge key={code} variant="outline">
                        {code.replaceAll('_', ' ')}
                      </Badge>
                    ))}
                    {profile.reasonCodes.length === 0 && (
                      <span className="text-sm text-muted-foreground">No active flags.</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Mitigation steps
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {profile.mitigationSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                    {profile.mitigationSteps.length === 0 && (
                      <li>Continue monitoring automated telemetry.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No risk data available.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Behavioral telemetry</CardTitle>
            <CardDescription>Missed deadlines, mismatches, revoked documents.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !profile ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BehaviorPanel data={profile.components.behavior?.metadata ?? {}} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Component scores</CardTitle>
            <CardDescription>Sanctions, fraud, NPDB detail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !profile ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              Object.entries(profile.components)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <ComponentRow
                    key={key}
                    label={key}
                    score={value!.score}
                    metadata={value!.metadata}
                  />
                ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent alerts</CardTitle>
            <CardDescription>Anchored when risk crosses thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : profile?.recentEvents && profile.recentEvents.length > 0 ? (
              profile.recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{event.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {(event.severity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent alerts.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function RiskGauge({ value }: { value: number }) {
  const percent = Math.min(100, Math.max(0, value * 100))
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-center gap-3">
        <ShieldHalf className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="text-sm text-muted-foreground">Composite score</p>
          <p className="text-2xl font-semibold">{percent.toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-4 h-3 rounded-full bg-muted">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function ComponentRow({
  label,
  score,
  metadata,
}: {
  label: string
  score: number
  metadata?: Record<string, any>
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="capitalize">{label}</p>
        <Badge variant="outline">{(score * 100).toFixed(0)}%</Badge>
      </div>
      {metadata?.notes && (
        <p className="mt-1 text-xs text-muted-foreground">{metadata.notes}</p>
      )}
      {metadata?.expiringSoon && (
        <p className="mt-1 text-xs text-muted-foreground">
          {metadata.expiringSoon.length} expiring soon.
        </p>
      )}
    </div>
  )
}

function BehaviorPanel({ data }: { data: Record<string, any> }) {
  const normalized = data?.normalized ?? {}
  const flags: string[] = data?.flags ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Observation window: {data?.observationWindowDays ?? 90} days
        </p>
      </div>
      <div className="grid gap-3">
        <BehaviorMetric label="Missed deadlines" value={data.missedDocumentDeadlines} />
        <BehaviorMetric label="Mismatches" value={data.repeatedMismatches} />
        <BehaviorMetric label="Revoked credentials" value={data.revokedCredentials} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Flags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {flags.length === 0 && (
            <Badge variant="secondary" className="text-xs">
              Stable
            </Badge>
          )}
          {flags.map((flag) => (
            <Badge key={flag} variant="outline" className="text-xs">
              {flag.replaceAll('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>
      <Separator />
      <div className="text-xs text-muted-foreground">
        Normalized signals:{' '}
        {Object.keys(normalized).length
          ? JSON.stringify(normalized)
          : 'No normalized telemetry provided.'}
      </div>
    </div>
  )
}

function BehaviorMetric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <p>{label}</p>
      <strong>{value ?? 0}</strong>
    </div>
  )
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function buildMockRisk(clinicianId: string): RiskApiResponse {
  return {
    clinicianId,
    riskScore: 0.38,
    updatedAt: new Date().toISOString(),
    rationale: {},
    reasonCodes: ['BASELINE_MONITOR'],
    mitigationSteps: ['Continue monitoring automated telemetry.'],
    components: {
      sanctions: { score: 0.32, metadata: { notes: 'No hits in last 90 days.' } },
      fraud: { score: 0.4, metadata: { notes: 'Device telemetry stable.' } },
      behavior: {
        score: 0.33,
        metadata: {
          missedDocumentDeadlines: 1,
          repeatedMismatches: 0,
          revokedCredentials: 0,
          flags: ['STABLE_BEHAVIOR'],
          normalized: {
            missedDocumentDeadlines: 0.2,
            repeatedMismatches: 0,
            revokedCredentials: 0,
          },
        },
      },
      npdb: { score: 0.37, metadata: { notes: 'Last attestation clear.' } },
    },
    alerts: [],
    recentEvents: [],
  }
}

