'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, ClipboardList, Clock } from 'lucide-react';

type StatusFilter = 'ALL' | 'OPEN' | 'IN_REVIEW' | 'OVERDUE';

interface FppeCaseSummary {
  orgId: string;
  generatedAt: string;
  summary: {
    totalCases: number;
    openCases: number;
    inReviewCases: number;
    completedCases: number;
    failedCases: number;
    overdueCases: number;
  };
  cases: FPPECase[];
}

interface FPPECase {
  id: string;
  clinicianId: string;
  clinicianName: string;
  privilegeCode: string;
  privilegeName?: string;
  status: 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'FAILED';
  startAt: string;
  dueAt: string;
  isOverdue: boolean;
  notes?: string | null;
  checklist: {
    items: Array<{
      key: string;
      label: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE';
      targetCount?: number;
      completedCount?: number;
      description?: string;
    }>;
  };
}

const statusConfig: Record<FPPECase['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  OPEN: { label: 'Open', variant: 'secondary' },
  IN_REVIEW: { label: 'In review', variant: 'outline' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

export default function DemoOrgFppeDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [data, setData] = useState<FppeCaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<FPPECase | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter === 'OVERDUE') {
          params.set('overdue', 'true');
        } else if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }
        const response = await fetch(`/api/org/demo-org-001/fppe/cases?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('FPPE dashboard request failed');
        }
        const payload = (await response.json()) as FppeCaseSummary;
        if (!ignore) {
          setData(payload);
        }
      } catch (error) {
        console.warn('[FPPE] Falling back to mock data:', error);
        if (!ignore) {
          setData(getMockFppeData());
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [statusFilter]);

  const filteredCases = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'ALL' || statusFilter === 'OVERDUE') {
      return data.cases;
    }
    return data.cases.filter((fppeCase) => fppeCase.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo · Privileging</p>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" aria-hidden="true" />
            FPPE Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track focused professional practice evaluations, overdue reviews, and reviewer progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton label="All" active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
          <FilterButton label="Open" active={statusFilter === 'OPEN'} onClick={() => setStatusFilter('OPEN')} />
          <FilterButton
            label="In Review"
            active={statusFilter === 'IN_REVIEW'}
            onClick={() => setStatusFilter('IN_REVIEW')}
          />
          <FilterButton
            label="Overdue"
            active={statusFilter === 'OVERDUE'}
            onClick={() => setStatusFilter('OVERDUE')}
          />
        </div>
      </header>

      {renderSummaryCards(data, loading)}

      <section className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Clinician FPPE cases</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading cases…' : `${filteredCases.length} case(s) shown`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('ALL')} className="gap-2">
            Reset filters
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Privilege</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((fppeCase) => (
                <TableRow
                  key={fppeCase.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setSelectedCase(fppeCase)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedCase(fppeCase);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{fppeCase.clinicianName}</span>
                      <span className="text-xs text-muted-foreground">{fppeCase.clinicianId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{fppeCase.privilegeName ?? fppeCase.privilegeCode}</span>
                      <span className="text-xs text-muted-foreground">{fppeCase.privilegeCode}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatDate(fppeCase.dueAt)}</span>
                      {fppeCase.isOverdue && (
                        <Badge variant="destructive" className="w-fit">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <Badge variant={statusConfig[fppeCase.status].variant}>
                      {statusConfig[fppeCase.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredCases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No FPPE cases match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCase?.privilegeName ?? selectedCase?.privilegeCode}</DialogTitle>
            <DialogDescription>
              {selectedCase
                ? `Case for ${selectedCase.clinicianName} due ${formatDate(selectedCase.dueAt)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant={statusConfig[selectedCase.status].variant}>
                  {statusConfig[selectedCase.status].label}
                </Badge>
                {selectedCase.isOverdue && <Badge variant="destructive">Overdue</Badge>}
                <Badge variant="outline">Due {formatDate(selectedCase.dueAt)}</Badge>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Checklist progress</h3>
                <div className="space-y-3">
                  {selectedCase.checklist.items.map((item) => (
                    <div key={item.key} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <Badge variant={item.status === 'COMPLETE' ? 'default' : 'secondary'}>
                          {item.status === 'COMPLETE'
                            ? 'Complete'
                            : item.status === 'IN_PROGRESS'
                            ? 'In progress'
                            : 'Pending'}
                        </Badge>
                      </div>
                      {typeof item.targetCount === 'number' && (
                        <p className="text-xs text-muted-foreground">
                          {item.completedCount ?? 0} / {item.targetCount} documented
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Link href={`/demo/clinician/fppe/${selectedCase.id}`} className="w-full md:w-auto">
                  <Button className="w-full">Open clinician view</Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderSummaryCards(data: FppeCaseSummary | null, loading: boolean) {
  const summary = data?.summary ?? {
    totalCases: 0,
    openCases: 0,
    inReviewCases: 0,
    completedCases: 0,
    failedCases: 0,
    overdueCases: 0,
  };

  const cards = [
    {
      label: 'Open cases',
      value: summary.openCases,
      description: 'Awaiting reviewer assignment',
      icon: ClipboardList,
    },
    {
      label: 'In review',
      value: summary.inReviewCases,
      description: 'Actively being evaluated',
      icon: Clock,
    },
    {
      label: 'Overdue',
      value: summary.overdueCases,
      description: 'Past due date',
      icon: AlertCircle,
    },
    {
      label: 'Completed',
      value: summary.completedCases,
      description: 'Signed off and archived',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, description, icon: Icon }) => (
        <Card key={label} aria-busy={loading}>
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

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? 'default' : 'outline'} size="sm" onClick={onClick} className="rounded-full">
      {label}
    </Button>
  );
}

function formatDate(date: string | Date) {
  const instance = typeof date === 'string' ? new Date(date) : date;
  return instance.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMockFppeData(): FppeCaseSummary {
  const cases: FPPECase[] = [
    {
      id: 'fppe-1',
      clinicianId: 'did:example:alice',
      clinicianName: 'Dr. Alice Carter',
      privilegeCode: 'CARD-CATH-ADULT',
      privilegeName: 'Adult Cardiac Cath',
      status: 'IN_REVIEW',
      startAt: new Date('2025-01-01').toISOString(),
      dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: false,
      checklist: {
        items: [
          { key: 'chartsReviewed', label: 'Charts reviewed', status: 'IN_PROGRESS', completedCount: 6, targetCount: 10 },
          { key: 'supervisedCases', label: 'Supervised cases', status: 'PENDING', completedCount: 1, targetCount: 5 },
          { key: 'outcomes', label: 'Outcome tracking', status: 'PENDING', completedCount: 0, targetCount: 3 },
        ],
      },
    },
    {
      id: 'fppe-2',
      clinicianId: 'did:example:bob',
      clinicianName: 'Dr. Bob Singh',
      privilegeCode: 'CARD-PCI',
      privilegeName: 'PCI with Stent',
      status: 'OPEN',
      startAt: new Date('2025-02-05').toISOString(),
      dueAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: false,
      checklist: {
        items: [
          { key: 'chartsReviewed', label: 'Charts reviewed', status: 'PENDING', completedCount: 0, targetCount: 12 },
          { key: 'supervisedCases', label: 'Supervised cases', status: 'PENDING', completedCount: 0, targetCount: 4 },
          { key: 'outcomes', label: 'Outcome tracking', status: 'PENDING', completedCount: 0, targetCount: 5 },
        ],
      },
    },
    {
      id: 'fppe-3',
      clinicianId: 'did:example:carol',
      clinicianName: 'Dr. Carol Nguyen',
      privilegeCode: 'PED-EMERG-SED',
      privilegeName: 'Pediatric Sedation',
      status: 'FAILED',
      startAt: new Date('2024-11-01').toISOString(),
      dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: true,
      checklist: {
        items: [
          { key: 'chartsReviewed', label: 'Charts reviewed', status: 'COMPLETE', completedCount: 8, targetCount: 8 },
          { key: 'supervisedCases', label: 'Supervised cases', status: 'IN_PROGRESS', completedCount: 3, targetCount: 6 },
          { key: 'outcomes', label: 'Outcome tracking', status: 'PENDING', completedCount: 1, targetCount: 4 },
        ],
      },
    },
  ];

  return {
    orgId: 'demo-org-001',
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: cases.length,
      openCases: cases.filter((c) => c.status === 'OPEN').length,
      inReviewCases: cases.filter((c) => c.status === 'IN_REVIEW').length,
      completedCases: cases.filter((c) => c.status === 'COMPLETED').length,
      failedCases: cases.filter((c) => c.status === 'FAILED').length,
      overdueCases: cases.filter((c) => c.isOverdue).length,
    },
    cases,
  };
}
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, ClipboardList, Clock } from 'lucide-react';

type StatusFilter = 'ALL' | 'OPEN' | 'IN_REVIEW' | 'OVERDUE';

interface FppeCaseSummary {
  orgId: string;
  generatedAt: string;
  summary: {
    totalCases: number;
    openCases: number;
    inReviewCases: number;
    completedCases: number;
    failedCases: number;
    overdueCases: number;
  };
  cases: FPPECase[];
}

interface FPPECase {
  id: string;
  clinicianId: string;
  clinicianName: string;
  privilegeCode: string;
  privilegeName?: string;
  status: 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'FAILED';
  startAt: string;
  dueAt: string;
  isOverdue: boolean;
  notes?: string | null;
  checklist: {
    items: Array<{
      key: string;
      label: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE';
      targetCount?: number;
      completedCount?: number;
      description?: string;
    }>;
  };
}

const statusConfig: Record<FPPECase['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  OPEN: { label: 'Open', variant: 'secondary' },
  IN_REVIEW: { label: 'In review', variant: 'outline' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

export default function DemoOrgFppeDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [data, setData] = useState<FppeCaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<FPPECase | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter === 'OVERDUE') {
          params.set('overdue', 'true');
        } else if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }
        const response = await fetch(`/api/org/demo-org-001/fppe/cases?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('FPPE dashboard request failed');
        }
        const payload = (await response.json()) as FppeCaseSummary;
        if (!ignore) {
          setData(payload);
        }
      } catch (error) {
        console.warn('[FPPE] Falling back to mock data:', error);
        if (!ignore) {
          setData(getMockFppeData());
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [statusFilter]);

  const filteredCases = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'ALL' || statusFilter === 'OVERDUE') {
      return data.cases;
    }
    return data.cases.filter((fppeCase) => fppeCase.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo · Privileging</p>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" aria-hidden="true" />
            FPPE Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track focused professional practice evaluations, overdue reviews, and reviewer progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton label="All" active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
          <FilterButton label="Open" active={statusFilter === 'OPEN'} onClick={() => setStatusFilter('OPEN')} />
          <FilterButton
            label="In Review"
            active={statusFilter === 'IN_REVIEW'}
            onClick={() => setStatusFilter('IN_REVIEW')}
          />
          <FilterButton
            label="Overdue"
          active={statusFilter === 'OVERDUE'}
          onClick={() => setStatusFilter('OVERDUE')}
          />
        </div>
      </header>

      {renderSummaryCards(data, loading)}

      <section className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Clinician FPPE cases</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading cases…' : `${filteredCases.length} case(s) shown`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('ALL')} className="gap-2">
            Reset filters
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Privilege</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((fppeCase) => (
                <TableRow
                  key={fppeCase.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
A                  onClick={() => setSelectedCase(fppeCase)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedCase(fppeCase);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{fppeCase.clinicianName}</span>
                      <span className="text-xs text-muted-foreground">{fppeCase.clinicianId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{fppeCase.privilegeName ?? fppeCase.privilegeCode}</span>
                      <span className="text-xs text-muted-foreground">{fppeCase.privilegeCode}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatDate(fppeCase.dueAt)}</span>
                      {fppeCase.isOverdue && (
                        <Badge variant="destructive" className="w-fit">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <Badge variant={statusConfig[fppeCase.status].variant}>
                      {statusConfig[fppeCase.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredCases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No FPPE cases match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCase?.privilegeName ?? selectedCase?.privilegeCode}</DialogTitle>
            <DialogDescription>
              {selectedCase
                ? `Case for ${selectedCase.clinicianName} due ${formatDate(selectedCase.dueAt)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant={statusConfig[selectedCase.status].variant}>
                  {statusConfig[selectedCase.status].label}
                </Badge>
                {selectedCase.isOverdue && <Badge variant="destructive">Overdue</Badge>}
                <Badge variant="outline">Due {formatDate(selectedCase.dueAt)}</Badge>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Checklist progress</h3>
                <div className="space-y-3">
                  {selectedCase.checklist.items.map((item) => (
                    <div key={item.key} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <Badge variant={item.status === 'COMPLETE' ? 'default' : 'secondary'}>
                          {item.status === 'COMPLETE' ? 'Complete' : item.status === 'IN_PROGRESS' ? 'In progress' : 'Pending'}
                        </Badge>
                      </div>
                      {typeof item.targetCount === 'number' && (
                        <p className="text-xs text-muted-foreground">
                          {item.completedCount ?? 0} / {item.targetCount} documented
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Link href={`/demo/clinician/fppe/${selectedCase.id}`} className="w-full md:w-auto">
                  <Button className="w-full">Open clinician view</Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderSummaryCards(data: FppeCaseSummary | null, loading: boolean) {
  const summary = data?.summary ?? {
    totalCases: 0,
    openCases: 0,
    inReviewCases: 0,
    completedCases: 0,
    failedCases: 0,
    overdueCases: 0,
  };

  const cards = [
    {
      label: 'Open cases',
      value: summary.openCases,
      description: 'Awaiting reviewer assignment',
      icon: ClipboardList,
    },
    {
      label: 'In review',
      value: summary.inReviewCases,
      description: 'Actively being evaluated',
      icon: Clock,
    },
    {
      label: 'Overdue',
      value: summary.overdueCases,
      description: 'Past due date',
      icon: AlertCircle,
    },
    {
      label: 'Completed',
      value: summary.completedCases,
      description: 'Signed off and archived',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, description, icon: Icon }) => (
        <Card key={label} aria-busy={loading}>
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

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? 'default' : 'outline'} size="sm" onClick={onClick} className="rounded-full">
      {label}
    </Button>
  );
}

function formatDate(date: string | Date) {
  const instance = typeof date === 'string' ? new Date(date) : date;
  return instance.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMockFppeData(): FppeCaseSummary {
  const cases: FPPECase[] = [
    {
      id: 'fppe-1',
      clinicianId: 'did:example:alice',
      clinicianName: 'Dr. Alice Carter',
      privilegeCode: 'CARD-CATH-ADULT',
      privilegeName: 'Adult Cardiac Cath',
      status: 'IN_REVIEW',
      startAt: new Date('2025-01-01').toISOString(),
      dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: false,
      checklist: {
        items: [
          { key: 'chartsReviewed', label: 'Charts reviewed', status: 'IN_PROGRESS', completedCount: 6, targetCount: 10 },
          { key: 'supervisedCases', label: 'Supervised cases', status: 'PENDING', completedCount: 1, targetCount: 5 },
          { key: 'outcomes', label: 'Outcome tracking', status: 'PENDING', completedCount: 0, targetCount: 3 },
        ],
      },
    },
    {
      id: 'fppe-2',
      clinicianId: 'did:example:bob',
      clinicianName: 'Dr. Bob Singh',
      privilegeCode: 'CARD-PCI',
      privilegeName: 'PCI with Stent',
      status: 'OPEN',
      startAt: new Date('2025-02-05').toISOString(),
      dueAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: false,
      checklist: {
        items: [
          { key: 'chartsReviewed', label: 'Charts reviewed', status: 'PENDING', completedCount: 0, targetCount: 12 },
          { key: 'supervisedCases', label: 'Supervised cases', status: 'PENDING', completedCount: 0, targetCount: 4 },
          { key: 'outcomes', label: 'Outcome tracking', status: 'PENDING', completedCount: 0, targetCount: 5 },
        ],
      },
    },
    {
      id: 'fppe-3',
      clinicianId: 'did:example:carol',
      clinicianName: 'Dr. Carol Nguyen',
      privilegeCode: 'PED-EMERG-SED',
      privilegeName: 'Pediatric Sedation',
      status: 'FAILED',
      startAt: new Date('2024-11-01').toISOString(),
      dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      isOverdue: true,
      checklist: {
        items: [
          { key: 'chartsReviewed', label: 'Charts reviewed', status: 'COMPLETE', completedCount: 8, targetCount: 8 },
          { key: 'supervisedCases', label: 'Supervised cases', status: 'IN_PROGRESS', completedCount: 3, targetCount: 6 },
          { key: 'outcomes', label: 'Outcome tracking', status: 'PENDING', completedCount: 1, targetCount: 4 },
        ],
      },
    },
  ];

  return {
    orgId: 'demo-org-001',
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: cases.length,
      openCases: cases.filter((c) => c.status === 'OPEN').length,
      inReviewCases: cases.filter((c) => c.status === 'IN_REVIEW').length,
      completedCases: cases.filter((c) => c.status === 'COMPLETED').length,
      failedCases: cases.filter((c) => c.status === 'FAILED').length,
      overdueCases: cases.filter((c) => c.isOverdue).length,
    },
    cases,
  };
}

