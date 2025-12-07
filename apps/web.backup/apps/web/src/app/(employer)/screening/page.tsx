'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { ShieldCheck, Clock3, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScreeningVerdict = 'pass' | 'review' | 'fail';

type EmployerScreeningRecord = {
  clinicianId: string;
  name: string;
  readinessScore: number;
  verdict: ScreeningVerdict;
  licenseStatus: string;
  boardStatus: string;
  yearsExperience: number | null;
  compactEligibility: string;
  updatedAt: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function EmployerScreeningPage() {
  const [records, setRecords] = useState<EmployerScreeningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadScreening();
  }, []);

  async function loadScreening() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployerScreening();
      setRecords(data);
    } catch (err) {
      console.warn('[employer][screening] fallback data loaded', err);
      setRecords(buildFallbackScreening());
      setError('Live screening API unreachable — showing demo candidates.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => summarize(records), [records]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <Badge variant="secondary">Employer · Screening</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Auto-screening queue</h1>
            <p className="text-muted-foreground">
              Review license, board, experience, and compact signals before pushing to your ATS.
            </p>
          </div>
          <Button
            className="ml-auto gap-2"
            variant="outline"
            onClick={() => loadScreening()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-amber-600">{error}</p>}
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
          label="Ready to push"
          value={summary.pass}
          detail="Auto-cleared in the last run."
        />
        <SummaryCard
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
          label="Needs review"
          value={summary.review}
          detail="At least one component requires human eyes."
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5 text-rose-500" />}
          label="Blocked"
          value={summary.fail}
          detail="Hard stops on license or board signals."
        />
        <Card>
          <CardHeader>
            <CardTitle>Avg. readiness</CardTitle>
            <CardDescription>Composite across visible candidates.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {(summary.averageReadiness * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Coverage score {(summary.coverage * 100).toFixed(0)}% · Last sync{' '}
              {records[0]?.updatedAt
                ? new Date(records[0].updatedAt).toLocaleString()
                : '—'}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Screening backlog</CardTitle>
          <CardDescription>
            Includes the latest {records.length} candidates waiting for ATS push.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Fetching screening results…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Board</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Compact</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.clinicianId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{record.name}</span>
                        <span className="text-xs text-muted-foreground">{record.clinicianId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={verdictVariant(record.verdict)}>
                        {verdictCopy(record.verdict)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(record.readinessScore * 100)} pts
                      </p>
                    </TableCell>
                    <TableCell>{record.licenseStatus}</TableCell>
                    <TableCell>{record.boardStatus}</TableCell>
                    <TableCell>
                      {record.yearsExperience !== null
                        ? `${record.yearsExperience.toFixed(1)} yrs`
                        : '—'}
                    </TableCell>
                    <TableCell>{record.compactEligibility}</TableCell>
                    <TableCell>{new Date(record.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard(props: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{props.label}</CardTitle>
        {props.icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{props.value}</div>
        <p className="text-xs text-muted-foreground">{props.detail}</p>
      </CardContent>
    </Card>
  );
}

function verdictVariant(verdict: ScreeningVerdict): 'secondary' | 'default' | 'destructive' {
  switch (verdict) {
    case 'pass':
      return 'default';
    case 'review':
      return 'secondary';
    case 'fail':
    default:
      return 'destructive';
  }
}

function verdictCopy(verdict: ScreeningVerdict): string {
  switch (verdict) {
    case 'pass':
      return 'Ready';
    case 'review':
      return 'Needs review';
    case 'fail':
    default:
      return 'Blocked';
  }
}

function summarize(records: EmployerScreeningRecord[]) {
  const totals = records.reduce(
    (acc, record) => {
      acc[record.verdict] += 1;
      acc.readiness += record.readinessScore;
      return acc;
    },
    { pass: 0, review: 0, fail: 0, readiness: 0 },
  );

  return {
    pass: totals.pass,
    review: totals.review,
    fail: totals.fail,
    averageReadiness:
      records.length === 0 ? 0 : totals.readiness / Math.max(1, records.length),
    coverage:
      records.length === 0
        ? 0
        : records.filter((record) => record.compactEligibility !== 'None').length /
          records.length,
  };
}

async function fetchEmployerScreening(): Promise<EmployerScreeningRecord[]> {
  if (!API_BASE) {
    throw new Error('API base URL not configured for employer screening UI');
  }
  const response = await fetch(`${API_BASE}/api/employer/screening?limit=50`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Employer screening endpoint returned ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.records)) {
    throw new Error('Malformed screening response');
  }
  return payload.records as EmployerScreeningRecord[];
}

function buildFallbackScreening(): EmployerScreeningRecord[] {
  const now = Date.now();
  return [
    {
      clinicianId: 'clinician-8891',
      name: 'Dr. Jordan Avery',
      readinessScore: 0.92,
      verdict: 'pass',
      licenseStatus: '3 active · verified 45d',
      boardStatus: 'ABPN · 2027',
      yearsExperience: 11.3,
      compactEligibility: 'IMLC (22 states)',
      updatedAt: new Date(now - 5 * 60_000).toISOString(),
    },
    {
      clinicianId: 'clinician-1544',
      name: 'PA Riley Chen',
      readinessScore: 0.74,
      verdict: 'review',
      licenseStatus: '2 active · verified 210d',
      boardStatus: 'NCCPA · 2025 (renew)',
      yearsExperience: 4.6,
      compactEligibility: 'None',
      updatedAt: new Date(now - 18 * 60_000).toISOString(),
    },
    {
      clinicianId: 'clinician-6620',
      name: 'NP Casey Morgan',
      readinessScore: 0.41,
      verdict: 'fail',
      licenseStatus: 'Expired license in TX',
      boardStatus: 'AANP (lapsed)',
      yearsExperience: 2.1,
      compactEligibility: 'Pending NLC',
      updatedAt: new Date(now - 42 * 60_000).toISOString(),
    },
  ];
}

