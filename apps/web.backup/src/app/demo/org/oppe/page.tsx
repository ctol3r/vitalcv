'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCcw, Stethoscope } from 'lucide-react';

interface OppeCase {
  id: string;
  privilegeCode: string;
  status: 'OPEN' | 'REVIEWING' | 'COMPLETED' | 'FAILED';
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
}

interface ClinicianOppeRow {
  clinicianId: string;
  clinicianName: string;
  nextDueAt: string | null;
  cases: OppeCase[];
}

interface DashboardResponse {
  orgId: string;
  generatedAt: string;
  summary: {
    totalCases: number;
    openCases: number;
    completedCases: number;
    failedCases: number;
  };
  clinicians: ClinicianOppeRow[];
}

type StatusFilter = 'ALL' | 'OPEN' | 'COMPLETED' | 'FAILED';

export default function DemoOppeDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        const response = await fetch(`/api/org/demo-org-001/oppe/cases?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Fetch failed');
        const payload = (await response.json()) as DashboardResponse;
        if (!ignore) setData(payload);
      } catch (error) {
        console.error('Failed to load OPPE dashboard, falling back to demo data:', error);
        if (!ignore) setData(getMockOppeData());
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [statusFilter]);

  const filteredClinicians = useMemo(() => {
    if (!data) return [] as ClinicianOppeRow[];
    if (statusFilter === 'ALL') return data.clinicians;
    return data.clinicians
      .map((clinician) => ({
        ...clinician,
        cases: clinician.cases.filter((c) => c.status === statusFilter),
      }))
      .filter((clinician) => clinician.cases.length > 0);
  }, [data, statusFilter]);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo · Privileging</p>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-primary" aria-hidden="true" />
            OPPE Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor clinician performance, overdue cases, and privilege-specific metrics at a glance.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:w-72">
          <label className="text-sm font-medium" htmlFor="status-filter">
            Filter by status
          </label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {renderSummaryCards(data, loading)}

      <section className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Clinician cases</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading latest cases…' : `${filteredClinicians.length} clinician(s) shown`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('ALL')}
            className="gap-2">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Reset filters
          </Button>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {filteredClinicians.map((clinician) => (
            <AccordionItem value={clinician.clinicianId} key={clinician.clinicianId}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-col gap-1 text-left">
                  <span className="font-semibold">{clinician.clinicianName}</span>
                  <span className="text-sm text-muted-foreground">
                    Next due: {formatDate(clinician.nextDueAt) || 'Not scheduled'}
                  </span>
                  <span className="sr-only">Press to expand clinician OPPE case details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Privilege Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Metrics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinician.cases.map((oppeCase) => (
                      <TableRow key={oppeCase.id}>
                        <TableCell>{oppeCase.privilegeCode}</TableCell>
                        <TableCell>{renderStatusBadge(oppeCase.status)}</TableCell>
                        <TableCell>
                          <span className="block text-sm">{formatDate(oppeCase.periodStart)}</span>
                          <span className="block text-xs text-muted-foreground">to {formatDate(oppeCase.periodEnd)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {Object.entries(oppeCase.metrics || {}).map(([metric, value]) => (
                              <Badge key={metric} variant="secondary">
                                {metric}: {value}
                              </Badge>
                            ))}
                            {(!oppeCase.metrics || Object.keys(oppeCase.metrics).length === 0) && (
                              <span className="text-muted-foreground">No metrics yet</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

function renderSummaryCards(data: DashboardResponse | null, loading: boolean) {
  const summary = data?.summary ?? { totalCases: 0, openCases: 0, completedCases: 0, failedCases: 0 };
  const cards = [
    {
      label: 'Total Cases',
      value: summary.totalCases,
      description: 'Generated for current OPPE cycle',
      icon: ClipboardList,
    },
    {
      label: 'Open Cases',
      value: summary.openCases,
      description: 'Awaiting reviewer action',
      icon: AlertTriangle,
    },
    {
      label: 'Completed',
      value: summary.completedCases,
      description: 'Reviewed and archived',
      icon: CheckCircle2,
    },
    {
      label: 'Failed / Flags',
      value: summary.failedCases,
      description: 'Requires remediation',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-busy={loading}>
      {cards.map(({ label, value, description, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function renderStatusBadge(status: OppeCase['status']) {
  const config: Record<OppeCase['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }>
    = {
      OPEN: { label: 'Open', variant: 'secondary' },
      REVIEWING: { label: 'Reviewing', variant: 'default' },
      COMPLETED: { label: 'Completed', variant: 'default' },
      FAILED: { label: 'Failed', variant: 'destructive' },
    };
  const { label, variant } = config[status];
  return (
    <Badge variant={variant}>{label}</Badge>
  );
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMockOppeData(): DashboardResponse {
  return {
    orgId: 'demo-org-001',
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: 4,
      openCases: 2,
      completedCases: 1,
      failedCases: 1,
    },
    clinicians: [
      {
        clinicianId: 'did:example:alice',
        clinicianName: 'Dr. Alice Carter',
        nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cases: [
          {
            id: 'mock-1',
            privilegeCode: 'PROC-100',
            status: 'OPEN',
            periodStart: new Date('2025-01-01').toISOString(),
            periodEnd: new Date('2025-03-31').toISOString(),
            metrics: { cases: 12, complications: 0 },
          },
          {
            id: 'mock-2',
            privilegeCode: 'PROC-220',
            status: 'COMPLETED',
            periodStart: new Date('2024-10-01').toISOString(),
            periodEnd: new Date('2024-12-31').toISOString(),
            metrics: { cases: 15, issuesFlagged: 0 },
          },
        ],
      },
      {
        clinicianId: 'did:example:bob',
        clinicianName: 'Dr. Bob Singh',
        nextDueAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        cases: [
          {
            id: 'mock-3',
            privilegeCode: 'PROC-400',
            status: 'FAILED',
            periodStart: new Date('2024-10-01').toISOString(),
            periodEnd: new Date('2024-12-31').toISOString(),
            metrics: { complications: 2, issuesFlagged: 1 },
          },
          {
            id: 'mock-4',
            privilegeCode: 'PROC-401',
            status: 'OPEN',
            periodStart: new Date('2025-01-01').toISOString(),
            periodEnd: new Date('2025-03-31').toISOString(),
            metrics: { cases: 8 },
          },
        ],
      },
    ],
  };
}
