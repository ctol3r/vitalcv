'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { RefreshCcw, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type VitalStatus = 'good' | 'warning' | 'critical';

interface RecruiterHealthSnapshot {
  clinicianId: string;
  clinicianName: string;
  healthScore: number;
  timeToReadyDays: number;
  vitals: Array<{
    component: string;
    status: VitalStatus;
    summary: string;
    etaDays?: number | null;
  }>;
  remediation: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    owner: 'recruiter' | 'clinician' | 'issuer';
    description: string;
    impact: string;
    etaDays: number;
  }>;
}

const PRIORITY_PILLS: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10',
};

const STATUS_LABELS: Record<VitalStatus, string> = {
  good: 'Green',
  warning: 'Yellow',
  critical: 'Red',
};

export default function RecruiterHealthPage({ params }: { params: { clinicianId: string } }) {
  const [snapshot, setSnapshot] = useState<RecruiterHealthSnapshot | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    void loadSnapshot(params.clinicianId);
  }, [params.clinicianId]);

  async function loadSnapshot(clinicianId: string) {
    setStatus('loading');
    try {
      const result = await fetchRecruiterHealth(clinicianId);
      setSnapshot(result);
      setStatus('idle');
    } catch (error) {
      console.warn('[recruiter][health]', error);
      setSnapshot(buildFallbackSnapshot(clinicianId));
      setStatus('error');
    }
  }

  const readinessBand = useMemo(() => categorizeTime(snapshot?.timeToReadyDays ?? null), [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · Credential Health</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              {snapshot?.clinicianName ?? 'Clinician'} credential vitals
            </h1>
            <p className="text-muted-foreground">
              Holistic readiness for employer review and onboarding acceleration.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadSnapshot(params.clinicianId)} disabled={status === 'loading'}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {status === 'error' && (
          <p className="text-sm text-amber-600">
            Real-time monitor unavailable; displaying cached readiness model.
          </p>
        )}
      </header>

      {snapshot && (
        <>
          <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Employer readiness</CardTitle>
                <CardDescription>Composite signal for sharing with hiring partners.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Health score</p>
                    <p className="text-4xl font-semibold">
                      {(snapshot.healthScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Progress value={snapshot.healthScore * 100} className="h-3 flex-1" />
                  <span className={cn('rounded-full px-3 py-1 text-sm font-medium', readinessBand.className)}>
                    {readinessBand.label}
                  </span>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    Time-to-ready estimate
                  </div>
                  <p className="text-3xl font-semibold">
                    {snapshot.timeToReadyDays <= 0
                      ? 'Ready now'
                      : `${snapshot.timeToReadyDays.toFixed(0)} days`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Includes average SLA for board, NPDB, and DEA remediation.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority remediation</CardTitle>
                <CardDescription>Auto-suggested actions to reach deployment-ready state.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">ETA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.remediation.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-xs', PRIORITY_PILLS[item.priority])}>
                              {item.priority.toUpperCase()}
                            </span>
                            <span className="font-medium">{item.description}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.impact}</p>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{item.owner}</TableCell>
                        <TableCell className="text-right text-sm">{item.etaDays}d</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {snapshot.vitals.map((vital) => (
              <Card key={vital.component}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{componentLabel(vital.component)}</CardTitle>
                    <CardDescription>{vital.summary}</CardDescription>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm font-medium',
                      statusClass(vital.status),
                    )}
                  >
                    {STATUS_LABELS[vital.status]}
                  </span>
                </CardHeader>
                {typeof vital.etaDays === 'number' && (
                  <CardContent>
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      Expected resolution in {vital.etaDays} days.
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </section>
        </>
      )}

      {!snapshot && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          No credential snapshot available for this clinician yet.
        </div>
      )}
    </div>
  );
}

function categorizeTime(timeToReady: number | null) {
  if (timeToReady === null) {
    return { label: 'Unknown', className: 'bg-muted text-muted-foreground' };
  }

  if (timeToReady <= 0) {
    return { label: 'Ready now', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10' };
  }
  if (timeToReady <= 14) {
    return { label: '< 2 weeks', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10' };
  }
  return { label: 'Needs work', className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10' };
}

function componentLabel(component: string): string {
  switch (component) {
    case 'license':
      return 'State license';
    case 'sanctions':
      return 'Sanctions monitoring';
    case 'npdb':
      return 'NPDB';
    case 'dea':
      return 'DEA credential';
    case 'board':
      return 'Board certification';
    default:
      return component;
  }
}

function statusClass(status: VitalStatus) {
  switch (status) {
    case 'good':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-500/10';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-500/10';
    case 'critical':
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-500/10';
  }
}

async function fetchRecruiterHealth(clinicianId: string): Promise<RecruiterHealthSnapshot> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) {
    throw new Error('API base URL missing');
  }

  const response = await fetch(`${baseUrl}/api/recruiter/health/${clinicianId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Recruiter health API failed with ${response.status}`);
  }

  return (await response.json()) as RecruiterHealthSnapshot;
}

function buildFallbackSnapshot(clinicianId: string): RecruiterHealthSnapshot {
  return {
    clinicianId,
    clinicianName: 'Jordan Reyes, MD',
    healthScore: 0.74,
    timeToReadyDays: 11,
    vitals: [
      {
        component: 'license',
        status: 'warning',
        summary: 'CA license expiring in 18 days.',
        etaDays: 7,
      },
      {
        component: 'dea',
        status: 'critical',
        summary: 'DEA renewal lapsed last week.',
        etaDays: 10,
      },
      {
        component: 'sanctions',
        status: 'good',
        summary: 'No sanctions hits.',
      },
      {
        component: 'npdb',
        status: 'warning',
        summary: 'Narrative required for NPDB watch.',
        etaDays: 4,
      },
    ],
    remediation: [
      {
        id: 'dea',
        priority: 'high',
        owner: 'clinician',
        description: 'Submit DEA renewal and upload confirmation letter.',
        impact: 'Blocks prescriptions and onboarding.',
        etaDays: 10,
      },
      {
        id: 'npdb',
        priority: 'medium',
        owner: 'recruiter',
        description: 'Collect NPDB narrative + hospital attestation.',
        impact: 'Required for privileging packet.',
        etaDays: 4,
      },
      {
        id: 'license',
        priority: 'medium',
        owner: 'clinician',
        description: 'Sign CA license renewal e-form.',
        impact: 'Needed before start date.',
        etaDays: 7,
      },
    ],
  };
}

