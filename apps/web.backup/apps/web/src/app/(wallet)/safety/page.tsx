'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Award, RefreshCcw, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Trend = 'up' | 'down' | 'flat';
type SafetyAnomalySeverity = 'low' | 'medium' | 'high';

interface SafetyAnomaly {
  type: string;
  severity: SafetyAnomalySeverity;
  summary: string;
  detectedAt: string;
}

interface PrivilegeCorrelationRow {
  signalId: string;
  type: string;
  severity: string;
  reportedAt: string;
  privilegeCodes: string[];
  privilegeSignal?: {
    id: string;
    signalType: string;
    severity: string;
    detectedAt: string;
    overlap: number;
  };
}

interface SafetyProfileResponse {
  clinicianId: string;
  clinicianHash: string;
  generatedAt: string;
  signalStats: {
    total: number;
    commendations: number;
    nearMisses: number;
    adverseEvents: number;
    highSeverity: number;
  };
  riskImpact: {
    privilegingScore: number;
    matchingScore: number;
    narrative: string[];
  };
  privilegeCorrelation: PrivilegeCorrelationRow[];
  commendation: {
    eligible: boolean;
    badge: string | null;
    positiveSignals: number;
    lastPositiveAt: string | null;
  };
  anomalies: SafetyAnomaly[];
  auditExport: {
    clinicianHash: string;
    window: { start: string; end: string; days: number };
  };
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.API_BASE_URL ??
  '';

export default function WalletSafetyPage() {
  const [profile, setProfile] = useState<SafetyProfileResponse | null>(null);
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setState('loading');
    try {
      const snapshot = await fetchSafetyProfile();
      setProfile(snapshot);
      setState('idle');
    } catch (error) {
      console.warn('[wallet][safety]', error);
      setProfile(buildFallbackProfile());
      setState('error');
    }
  }

  const indicators = useMemo(() => deriveIndicators(profile), [profile]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Wallet · Safety</Badge>
          {profile?.commendation.eligible && (
            <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Exemplary clinician
            </Badge>
          )}
          {state === 'error' && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Degraded
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={state === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', state === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clinician safety profile</h1>
          <p className="text-sm text-muted-foreground">
            Aggregated indicators across safety signals, privilege telemetry, and credential timelines.
          </p>
        </div>
      </header>

      {profile ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {indicators.map((indicator) => (
              <Card key={indicator.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{indicator.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">{indicator.value}</span>
                    {indicator.delta && (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          indicator.trend === 'up' && 'text-emerald-600',
                          indicator.trend === 'down' && 'text-amber-600',
                          indicator.trend === 'flat' && 'text-muted-foreground',
                        )}
                      >
                        {indicator.delta}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{indicator.caption}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Privilege + match impact</CardTitle>
                <CardDescription>Risk weighting derived from latest safety signals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <ImpactBadge
                    label="Privileging"
                    value={profile.riskImpact.privilegingScore}
                  />
                  <ImpactBadge label="Match recommendations" value={profile.riskImpact.matchingScore} />
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {profile.riskImpact.narrative.map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit-safe reference</CardTitle>
                <CardDescription>Identifiers hashed prior to regulator export.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Clinician hash</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">
                    {shorten(profile.auditExport.clinicianHash)}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Window</span>
                  <span className="font-medium">
                    {new Date(profile.auditExport.window.start).toLocaleDateString()} →{' '}
                    {new Date(profile.auditExport.window.end).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {profile.auditExport.window.days}-day hashed extracts only; no PHI stored or rendered.
                </p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Safety ⇄ credential correlation</CardTitle>
              <CardDescription>Cross-links between signals and privilege timelines.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signal</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Privilege overlap</TableHead>
                    <TableHead>Related event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.privilegeCorrelation.map((row) => (
                    <TableRow key={row.signalId}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="capitalize">{row.type.replace('-', ' ')}</span>
                          <span className={cn('text-xs font-semibold', severityClass(row.severity))}>
                            {row.severity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(row.reportedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.privilegeCodes.length ? row.privilegeCodes.join(', ') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.privilegeSignal ? (
                          <>
                            <div className="font-medium">{row.privilegeSignal.signalType}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.privilegeSignal.overlap * 100}% overlap ·{' '}
                              {new Date(row.privilegeSignal.detectedAt).toLocaleDateString()}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No privilege event detected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!profile.privilegeCorrelation.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No safety signals recorded for this window.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anomaly radar</CardTitle>
              <CardDescription>Departmental spikes and role-specific issues.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.anomalies.length ? (
                <ul className="space-y-3">
                  {profile.anomalies.map((anomaly) => (
                    <li
                      key={`${anomaly.type}-${anomaly.detectedAt}`}
                      className="flex items-start justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{anomaly.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          Detected {new Date(anomaly.detectedAt).toLocaleString()}
                        </p>
                      </div>
                      <SeverityPill severity={anomaly.severity} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  No anomalies detected.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <Shield className="h-5 w-5" />
          Safety indicators will load once signals are ingested.
        </div>
      )}
    </div>
  );
}

function ImpactBadge({ label, value }: { label: string; value: number }) {
  const variant =
    value === 0 ? 'neutral' : value > 0 ? 'positive' : value < -0.2 ? 'negative' : 'warning';
  const copy: Record<
    'positive' | 'negative' | 'warning' | 'neutral',
    { label: string; className: string }
  > = {
    positive: {
      label: 'positive',
      className: 'text-emerald-600',
    },
    negative: {
      label: 'negative',
      className: 'text-rose-600',
    },
    warning: {
      label: 'watch',
      className: 'text-amber-600',
    },
    neutral: {
      label: 'neutral',
      className: 'text-muted-foreground',
    },
  };
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{(value * 100).toFixed(0)} bp</span>
        <span className={cn('text-xs font-medium', copy[variant].className)}>
          {copy[variant].label}
        </span>
      </div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: SafetyAnomalySeverity }) {
  const copy: Record<SafetyAnomalySeverity, { label: string; className: string }> = {
    low: { label: 'Low', className: 'text-emerald-600' },
    medium: { label: 'Medium', className: 'text-amber-600' },
    high: { label: 'High', className: 'text-rose-600' },
  };
  return <span className={cn('text-xs font-semibold', copy[severity].className)}>{copy[severity].label}</span>;
}

function deriveIndicators(profile: SafetyProfileResponse | null) {
  if (!profile) {
    return [];
  }
  const { signalStats } = profile;
  return [
    {
      label: 'Signals this window',
      value: signalStats.total,
      caption: `${signalStats.highSeverity} high severity`,
      delta: undefined,
      trend: 'flat' as Trend,
    },
    {
      label: 'Commendations',
      value: signalStats.commendations,
      caption: 'Positive peer or system commendations',
      delta: profile.commendation.positiveSignals ? `+${profile.commendation.positiveSignals}` : undefined,
      trend: profile.commendation.eligible ? 'up' : 'flat',
    },
    {
      label: 'Privileging impact',
      value: `${(profile.riskImpact.privilegingScore * 100).toFixed(0)} bp`,
      caption: 'Scaled risk weight',
      delta: undefined,
      trend: profile.riskImpact.privilegingScore >= 0 ? 'up' : 'down',
    },
    {
      label: 'Matching impact',
      value: `${(profile.riskImpact.matchingScore * 100).toFixed(0)} bp`,
      caption: 'Recommendation modifier',
      delta: undefined,
      trend: profile.riskImpact.matchingScore >= 0 ? 'up' : 'down',
    },
  ];
}

async function fetchSafetyProfile(): Promise<SafetyProfileResponse> {
  const base =
    API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL missing');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/safety/profile/self`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Safety profile API failed with ${response.status}`);
  }
  return (await response.json()) as SafetyProfileResponse;
}

function buildFallbackProfile(): SafetyProfileResponse {
  const now = new Date();
  return {
    clinicianId: 'self',
    clinicianHash: 'cln_demo_hash',
    generatedAt: now.toISOString(),
    signalStats: {
      total: 6,
      commendations: 2,
      nearMisses: 3,
      adverseEvents: 1,
      highSeverity: 2,
    },
    riskImpact: {
      privilegingScore: -0.18,
      matchingScore: 0.12,
      narrative: [
        'Privileging impact: -18bp · Matching impact: +12bp',
        'Top drivers: adverse-event (high), commendation (moderate)',
      ],
    },
    privilegeCorrelation: [
      {
        signalId: 'sig_demo_1',
        type: 'adverse-event',
        severity: 'high',
        reportedAt: now.toISOString(),
        privilegeCodes: ['CARDIO_L1', 'CARDIO_L2'],
        privilegeSignal: {
          id: 'psig_demo_1',
          signalType: 'QUALITY_RISK',
          severity: 'HIGH',
          detectedAt: now.toISOString(),
          overlap: 0.8,
        },
      },
      {
        signalId: 'sig_demo_2',
        type: 'commendation',
        severity: 'moderate',
        reportedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        privilegeCodes: ['CARDIO_L3'],
      },
    ],
    commendation: {
      eligible: true,
      badge: 'exemplaryClinician',
      positiveSignals: 3,
      lastPositiveAt: now.toISOString(),
    },
    anomalies: [
      {
        type: 'department_spike',
        severity: 'medium',
        summary: 'Cath lab recorded 3 safety signals this week',
        detectedAt: now.toISOString(),
      },
    ],
    auditExport: {
      clinicianHash: 'hash_demo_1234',
      window: {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        end: now.toISOString(),
        days: 30,
      },
    },
  };
}

function severityClass(severity: string) {
  switch (severity.toLowerCase()) {
    case 'high':
      return 'text-rose-600';
    case 'moderate':
      return 'text-amber-600';
    default:
      return 'text-muted-foreground';
  }
}

function shorten(value: string, length = 10) {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
}

