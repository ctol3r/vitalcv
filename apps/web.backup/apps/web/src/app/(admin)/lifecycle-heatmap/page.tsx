'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Anchor, Loader2, RefreshCcw, ShieldCheck, Timer } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type LifecyclePhase = 'intake' | 'psv' | 'issued' | 'active' | 'expiring' | 'expired' | 'retired';

type LifecycleSeverity = 'stable' | 'warning' | 'critical';

interface LifecycleHeatmapCell {
  phase: LifecyclePhase;
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  avgTimeInPhase: number;
  riskScore: number;
  automationCoverage: number;
  severity: LifecycleSeverity;
}

interface LifecycleWatchStat {
  type: 'license_expiring' | 'license_expired' | 'cme_due' | 'cme_overdue' | 'board_recert_window' | 'board_recert_overdue';
  count: number;
  delta: number;
  topClinicians: string[];
}

interface LifecycleAnchorStats {
  pendingAnchors: number;
  anchorsToday: number;
  avgLagSeconds: number;
}

interface RenewalSuggestion {
  type: 'cmeCourse' | 'boardRecertReminder' | 'compactDeployment';
  title: string;
  impactScore: number;
  rationale: string;
  actions: string[];
  links?: Array<{ label: string; url: string }>;
}

interface LifecycleHeatmapResponse {
  generatedAt: string;
  windowDays: number;
  phases: LifecycleHeatmapCell[];
  watchSummary: LifecycleWatchStat[];
  suggestions: RenewalSuggestion[];
  anchorStats: LifecycleAnchorStats;
}

export default function LifecycleHeatmapPage() {
  const [windowDays, setWindowDays] = useState(45);
  const [data, setData] = useState<LifecycleHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/lifecycle/heatmap?windowDays=${windowDays}`);
      if (!response.ok) {
        throw new Error(`Failed to load lifecycle heatmap (status ${response.status})`);
      }
      const payload = (await response.json()) as LifecycleHeatmapResponse;
      setData(payload);
    } catch (err) {
      console.error('[lifecycle-heatmap] unable to load data', err);
      setError(err instanceof Error ? err.message : 'Unexpected error while loading lifecycle heatmap');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  const totals = useMemo(() => {
    if (!data?.phases.length) {
      return { active: 0, expiring: 0, expired: 0 };
    }
    return data.phases.reduce(
      (acc, cell) => {
        acc.active += cell.activeCount;
        acc.expiring += cell.expiringCount;
        acc.expired += cell.expiredCount;
        return acc;
      },
      { active: 0, expiring: 0, expired: 0 },
    );
  }, [data]);

  return (
    <div className="space-y-8 p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lifecycle heatmap</h1>
          <p className="text-muted-foreground">
            Credential lifecycle density, watcher detections, and auto-renewal nudges for the last {windowDays} days.
          </p>
          {data?.generatedAt && (
            <p className="text-xs text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()} · window {data.windowDays} days
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Window (days)
            <Input
              type="number"
              min={14}
              max={180}
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="w-28"
            />
          </label>
          <Button onClick={fetchHeatmap} variant="secondary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load lifecycle telemetry</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active credentials</CardTitle>
            <CardDescription>Currently live across all phases</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{formatNumber(totals.active)}</div>
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Expiring within window</CardTitle>
            <CardDescription>Includes CME + board recert triggers</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{formatNumber(totals.expiring)}</div>
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Expired / retired</CardTitle>
            <CardDescription>Awaiting auto-renew or archive</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{formatNumber(totals.expired)}</div>
            <Timer className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Anchoring backlog</CardTitle>
            <CardDescription>Pending lifecycle event hashes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span>Pending</span>
              <span className="font-semibold">{data?.anchorStats.pendingAnchors ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Anchored today</span>
              <span className="font-semibold">{data?.anchorStats.anchorsToday ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Avg lag</span>
              <span className="font-semibold">
                {data?.anchorStats.avgLagSeconds
                  ? `${Math.round(data.anchorStats.avgLagSeconds / 60)} min`
                  : '--'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase coverage heatmap</CardTitle>
          <CardDescription>Lifecycle density, automation, and risk across every phase</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading lifecycle heatmap...</p>}
          {!loading && (
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
              {data?.phases.map((cell) => (
                <div key={cell.phase} className={`rounded-lg border p-4 ${heatmapClasses(cell.severity)}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{formatPhaseLabel(cell.phase)}</p>
                    <Badge variant={severityBadge(cell.severity)}>{cell.severity}</Badge>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{cell.activeCount}</p>
                  <p className="text-xs text-muted-foreground">
                    Expiring {cell.expiringCount} · Expired {cell.expiredCount}
                  </p>
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Avg time in phase</span>
                      <span className="font-medium">{cell.avgTimeInPhase.toFixed(1)}d</span>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span>Risk pressure</span>
                        <span>{Math.round(cell.riskScore * 100)}%</span>
                      </div>
                      <Progress value={cell.riskScore * 100} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span>Automation coverage</span>
                        <span>{Math.round(cell.automationCoverage * 100)}%</span>
                      </div>
                      <Progress value={cell.automationCoverage * 100} className="bg-muted" />
                    </div>
                  </div>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground">No lifecycle records available.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Watcher detections</CardTitle>
            <CardDescription>Expiring licenses, CME windows, board recert reminders</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.watchSummary.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Δ vs last week</TableHead>
                    <TableHead>Top clinicians</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.watchSummary.map((stat) => (
                    <TableRow key={stat.type}>
                      <TableCell className="font-medium">{formatWatchType(stat.type)}</TableCell>
                      <TableCell>{stat.count}</TableCell>
                      <TableCell className={stat.delta >= 0 ? 'text-destructive' : 'text-emerald-600'}>
                        {stat.delta >= 0 ? '+' : ''}
                        {stat.delta}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {stat.topClinicians.length ? stat.topClinicians.join(', ') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No watcher anomalies detected for this window.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto-renewal nudges</CardTitle>
            <CardDescription>Suggestions from the lifecycle auto-renewal engine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.suggestions.length ? (
              data.suggestions.map((suggestion) => (
                <div key={suggestion.title} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={suggestionBadgeVariant(suggestion.type)}>
                      {formatSuggestionType(suggestion.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Impact {(suggestion.impactScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{suggestion.title}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.rationale}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {suggestion.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                  {suggestion.links && suggestion.links.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestion.links.map((link) => (
                        <Button key={link.url} variant="link" asChild size="sm" className="px-0 text-xs">
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {link.label}
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No active nudges. Lifecycle automation is handling renewals automatically.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anchor cadence</CardTitle>
          <CardDescription>Lifecycle events hashed to chain fast-mode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Anchor className="h-4 w-4" />
            <span>
              {data?.anchorStats.anchorsToday ?? 0} lifecycle events anchored today ·{' '}
              {data?.anchorStats.pendingAnchors ?? 0} pending queue
            </span>
          </div>
          <p>
            Average latency{' '}
            {data?.anchorStats.avgLagSeconds
              ? `${Math.round(data.anchorStats.avgLagSeconds)} seconds`
              : '—'}{' '}
            · Mode: lifecycleEventAnchored
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function heatmapClasses(severity: LifecycleSeverity) {
  if (severity === 'critical') {
    return 'border-destructive/40 bg-destructive/10';
  }
  if (severity === 'warning') {
    return 'border-amber-400/40 bg-amber-100/40 dark:bg-amber-900/10';
  }
  return 'border-border bg-card/50';
}

function severityBadge(severity: LifecycleSeverity) {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'secondary';
  return 'outline';
}

function formatPhaseLabel(phase: LifecyclePhase) {
  if (phase === 'psv') return 'PSV';
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function formatWatchType(type: LifecycleWatchStat['type']) {
  switch (type) {
    case 'license_expiring':
      return 'License expiring';
    case 'license_expired':
      return 'License expired';
    case 'cme_due':
      return 'CME due soon';
    case 'cme_overdue':
      return 'CME overdue';
    case 'board_recert_window':
      return 'Board recert window';
    case 'board_recert_overdue':
      return 'Board recert overdue';
    default:
      return type;
  }
}

function formatSuggestionType(type: RenewalSuggestion['type']) {
  switch (type) {
    case 'cmeCourse':
      return 'CME course';
    case 'boardRecertReminder':
      return 'Board recert';
    case 'compactDeployment':
      return 'Compact deployment';
    default:
      return type;
  }
}

function suggestionBadgeVariant(type: RenewalSuggestion['type']) {
  switch (type) {
    case 'cmeCourse':
      return 'secondary';
    case 'boardRecertReminder':
      return 'outline';
    case 'compactDeployment':
      return 'default';
    default:
      return 'outline';
  }
}

function formatNumber(value: number) {
  if (!value) return '0';
  return value.toLocaleString();
}


