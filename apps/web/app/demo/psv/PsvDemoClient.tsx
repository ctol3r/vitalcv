'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PSVSource, PSVStatus, type PSVCheckResult, type PSVReport } from '@domain-common/psvContracts'

type SourceBadge = 'LIVE' | 'NOT_CONFIGURED' | 'RESTRICTED'

const SOURCE_LABELS: Record<PSVSource, string> = {
  [PSVSource.OIG_LEIE]: 'OIG LEIE',
  [PSVSource.SAM_EXCLUSIONS]: 'SAM Exclusions',
  [PSVSource.CMS_PPEF]: 'CMS PPEF',
  [PSVSource.STATE_BOARD]: 'State Board',
  [PSVSource.DEA]: 'DEA',
  [PSVSource.NPDB]: 'NPDB',
}

const BADGE_TONES: Record<SourceBadge, string> = {
  LIVE: 'border-emerald-200/70 bg-emerald-500/10 text-emerald-700',
  NOT_CONFIGURED: 'border-amber-200/70 bg-amber-500/10 text-amber-700',
  RESTRICTED: 'border-slate-200/70 bg-slate-500/10 text-slate-700',
}

const STATUS_TONES: Record<PSVStatus, string> = {
  PASS: 'text-emerald-600',
  FAIL: 'text-red-600',
  FLAG: 'text-amber-600',
  UNKNOWN: 'text-muted-foreground',
  ERROR: 'text-red-600',
}

const DECISION_TONES: Record<string, string> = {
  CLEAR: 'border-emerald-200/70 bg-emerald-500/10 text-emerald-700',
  REVIEW: 'border-amber-200/70 bg-amber-500/10 text-amber-700',
  BLOCK: 'border-red-200/70 bg-red-500/10 text-red-700',
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

const getBadge = (check: PSVCheckResult): SourceBadge => {
  const badge = check.evidence.metadata?.badge
  if (badge === 'LIVE' || badge === 'NOT_CONFIGURED' || badge === 'RESTRICTED') {
    return badge
  }

  if (check.source === PSVSource.OIG_LEIE || check.source === PSVSource.CMS_PPEF) {
    return 'LIVE'
  }
  if (check.source === PSVSource.SAM_EXCLUSIONS) {
    return 'NOT_CONFIGURED'
  }
  return 'RESTRICTED'
}

export default function PsvDemoClient() {
  const [npi, setNpi] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<PSVReport | null>(null)
  const descriptionId = 'psv-npi-description'
  const errorId = 'psv-npi-error'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!npi.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/psv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: npi.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'PSV run failed.')
      }

      const data = (await response.json()) as PSVReport
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PSV run failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Run PSV</CardTitle>
          <CardDescription id={descriptionId}>
            Enter a 10-digit NPI to generate a PSV report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="npi">NPI Number</Label>
              <Input
                id="npi"
                name="npi"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234567890"
                value={npi}
                onChange={(event) => setNpi(event.target.value.replace(/\D/g, '').slice(0, 10))}
                className="mt-2 text-lg font-mono tracking-widest"
                aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
                aria-invalid={error ? 'true' : undefined}
                disabled={loading}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription id={errorId}>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={loading || npi.length !== 10}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Running PSV...
                </>
              ) : (
                'Run PSV'
              )}
            </Button>
          </form>
          <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
            Restricted sources stay in REVIEW until integrations are configured.
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">PSV Decision</CardTitle>
              <CardDescription>Policy evaluation based on source checks.</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em]',
                report ? DECISION_TONES[report.decision] : 'border-border/70 text-muted-foreground',
              )}
            >
              {report ? report.decision : 'Awaiting'}
            </Badge>
          </CardHeader>
          <CardContent>
            {report ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Subject</span>
                  <span className="font-mono text-foreground">{report.subjectId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Decided</span>
                  <span>{formatDate(report.decidedAt)}</span>
                </div>
                <div className="pt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Reasons
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  {report.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Run PSV to see decision logic and evidence reasons.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {(report?.checks ?? []).map((check) => {
            const badge = getBadge(check)
            const reason = check.evidence.notes ?? 'No reason available.'

            return (
              <Card key={check.source} className="border-border/70 bg-card/70 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{SOURCE_LABELS[check.source]}</CardTitle>
                  <Badge variant="outline" className={cn('rounded-full', BADGE_TONES[badge])}>
                    {badge.replace('_', ' ')}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn('font-semibold', STATUS_TONES[check.status])}>
                      {check.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Checked</span>
                    <span>{formatDate(check.evidence.checkedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span>{formatDate(check.evidence.expiresAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Evidence Ref</span>
                    <code className="mt-1 block truncate text-xs text-foreground/80">
                      {check.evidence.evidenceRef}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reason</span>
                    <p className="mt-1 text-sm text-foreground">{reason}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {!report && (
          <Card className="border-dashed border-border/70 bg-card/40">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Run PSV to populate source checks and evidence details.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
