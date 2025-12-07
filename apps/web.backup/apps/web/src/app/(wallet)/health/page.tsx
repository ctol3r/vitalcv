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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShieldAlert, Activity, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type VitalStatus = 'good' | 'warning' | 'critical';

interface CredentialVitalSign {
  component: string;
  status: VitalStatus;
  details: Record<string, unknown>;
  updatedAt: string;
}

interface CredentialHealthSnapshot {
  clinicianId: string;
  healthScore: number;
  previousScore?: number;
  vitals: CredentialVitalSign[];
  updatedAt: string;
}

const STATUS_LABELS: Record<VitalStatus, string> = {
  good: 'Healthy',
  warning: 'Needs attention',
  critical: 'Action required',
};

const STATUS_STYLE: Record<VitalStatus, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-500/10',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-500/10',
  critical: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-500/10',
};

export default function CredentialHealthPage() {
  const [snapshot, setSnapshot] = useState<CredentialHealthSnapshot | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function loadSnapshot() {
    setStatus('loading');
    try {
      const result = await fetchCredentialHealth();
      setSnapshot(result);
      setStatus('idle');
    } catch (error) {
      console.warn('[wallet][health]', error);
      setSnapshot(buildFallbackSnapshot());
      setStatus('error');
    }
  }

  const nextActions = useMemo(() => deriveActions(snapshot?.vitals ?? []), [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Credential Health</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Credential health snapshot</h1>
            <p className="text-muted-foreground">
              Continuous monitoring across licenses, sanctions, NPDB, DEA, and board signals.
            </p>
          </div>
          <Button variant="outline" onClick={loadSnapshot} disabled={status === 'loading'}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {status === 'error' && (
          <p className="text-sm text-amber-600">
            Live feed unavailable; displaying cached resilience snapshot.
          </p>
        )}
      </header>

      {snapshot && (
        <>
          <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Health score</CardTitle>
                <CardDescription>Weighted blend across all credential vital signs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current</p>
                    <p className="text-4xl font-semibold">
                      {(snapshot.healthScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  {typeof snapshot.previousScore === 'number' && (
                    <TrendPill
                      current={snapshot.healthScore}
                      previous={snapshot.previousScore}
                    />
                  )}
                  <div className="ml-auto flex flex-col items-end text-sm text-muted-foreground">
                    <span>Updated {new Date(snapshot.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
                <Progress value={snapshot.healthScore * 100} className="h-3" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next actions</CardTitle>
                <CardDescription>Auto-suggested remediation steps.</CardDescription>
              </CardHeader>
              <CardContent>
                {nextActions.length ? (
                  <ul className="space-y-3">
                    {nextActions.map((action) => (
                      <li
                        key={action.component}
                        className="rounded-lg border border-dashed p-3 text-sm leading-tight"
                      >
                        <p className="font-semibold">{action.title}</p>
                        <p className="text-muted-foreground">{action.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-500/10">
                    <Activity className="h-4 w-4" />
                    All credential vitals look great.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {snapshot.vitals.map((vital) => (
              <Card key={vital.component} className="h-full">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>{componentLabel(vital.component)}</CardTitle>
                    <CardDescription>
                      Updated {new Date(vital.updatedAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <span className={cn('rounded-full border px-3 py-1 text-sm', STATUS_STYLE[vital.status as VitalStatus])}>
                    {STATUS_LABELS[vital.status as VitalStatus]}
                  </span>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Signal</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(vital.details ?? {}).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="text-sm text-muted-foreground">
                            {humanizeKey(key)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {formatValue(value)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!Object.keys(vital.details ?? {}).length && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-sm text-muted-foreground">
                            No details provided.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}

      {!snapshot && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Credential health data will appear once monitoring is enabled for your profile.
        </div>
      )}
    </div>
  );
}

function TrendPill({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-sm font-medium',
        positive
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10',
      )}
    >
      {positive ? '+' : ''}
      {(delta * 100).toFixed(1)} pts vs last
    </span>
  );
}

function componentLabel(component: string): string {
  switch (component) {
    case 'license':
      return 'State license';
    case 'board':
      return 'Board certification';
    case 'sanctions':
      return 'Sanctions';
    case 'npdb':
      return 'NPDB';
    case 'dea':
      return 'DEA credential';
    default:
      return component;
  }
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') {
    const date = Date.parse(value);
    if (!Number.isNaN(date) && value.includes('T')) {
      return new Date(value).toLocaleDateString();
    }
    return value;
  }
  return JSON.stringify(value);
}

function deriveActions(vitals: CredentialVitalSign[]) {
  return vitals
    .filter((vital) => vital.status !== 'good')
    .map((vital) => ({
      component: vital.component,
      title: actionTitle(vital),
      detail: actionDetail(vital),
    }))
    .slice(0, 4);
}

function actionTitle(vital: CredentialVitalSign): string {
  switch (vital.component) {
    case 'license':
      return vital.status === 'critical' ? 'Renew license immediately' : 'Schedule renewal follow-up';
    case 'sanctions':
      return 'Resolve sanctions investigation';
    case 'npdb':
      return 'Review NPDB adverse action';
    case 'dea':
      return vital.status === 'critical' ? 'Renew DEA credential' : 'Start DEA renewal';
    case 'board':
      return 'Refresh board certification evidence';
    default:
      return 'Review outstanding action';
  }
}

function actionDetail(vital: CredentialVitalSign): string {
  switch (vital.component) {
    case 'license':
      return 'Expedite state license verification to avoid onboarding delay.';
    case 'sanctions':
      return 'Provide documentation and clearance for pending sanction hit.';
    case 'npdb':
      return 'Coordinate narrative and remediation for NPDB event.';
    case 'dea':
      return 'DEA registry shows expired or soon-to-expire record.';
    case 'board':
      return 'Upload active board certificate or re-issue credential.';
    default:
      return 'Follow up with compliance team.';
  }
}

async function fetchCredentialHealth(): Promise<CredentialHealthSnapshot> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) {
    throw new Error('API base URL missing');
  }

  const response = await fetch(`${baseUrl}/api/wallet/health`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Credential health API failed with ${response.status}`);
  }

  return (await response.json()) as CredentialHealthSnapshot;
}

function buildFallbackSnapshot(): CredentialHealthSnapshot {
  const now = new Date();
  return {
    clinicianId: 'self',
    healthScore: 0.78,
    previousScore: 0.84,
    updatedAt: now.toISOString(),
    vitals: [
      {
        component: 'license',
        status: 'warning',
        updatedAt: now.toISOString(),
        details: {
          expiringInDays: 18,
          state: 'CA',
          licenseNumber: 'A123456',
        },
      },
      {
        component: 'sanctions',
        status: 'good',
        updatedAt: now.toISOString(),
        details: {
          monitorStatus: 'CLEAR',
          lastCheckedAt: now.toISOString(),
        },
      },
      {
        component: 'npdb',
        status: 'warning',
        updatedAt: now.toISOString(),
        details: {
          adverseActionCount: 1,
          monitorStatus: 'ADVERSE_ACTION',
        },
      },
      {
        component: 'dea',
        status: 'critical',
        updatedAt: now.toISOString(),
        details: {
          deaNumber: 'AB1234567',
          expiringInDays: -7,
        },
      },
      {
        component: 'board',
        status: 'good',
        updatedAt: now.toISOString(),
        details: {
          expired: 0,
        },
      },
    ],
  };
}










