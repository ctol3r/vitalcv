'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Link2,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

const FALLBACK_CLINICIAN_ID = 'clinician-demo-001';

type RevalidationTaskType = 'PECOS' | 'MEDICAID' | 'PAYER' | 'CREDENTIALING';
type RevalidationTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

type RevalidationTaskMetadata = {
  category?: 'PECOS' | 'STATE_LICENSE' | 'DEA' | 'BOARD' | 'MEDICAID' | 'PAYER' | 'CREDENTIALING';
  referenceId?: string;
  payerName?: string;
  state?: string;
  specialty?: string;
  evidenceUrl?: string;
  details?: Record<string, unknown>;
} | null;

type RevalidationTaskRecord = {
  id: string;
  clinicianId: string;
  type: RevalidationTaskType;
  dueDate: string;
  status: RevalidationTaskStatus;
  source: 'SYSTEM' | 'USER' | 'INTEGRATION' | 'IMPORT';
  notes?: string | null;
  metadata?: RevalidationTaskMetadata;
  completedAt: string | null;
  lastNotifiedAt: string | null;
  notificationCount: number;
  createdAt: string;
  updatedAt: string;
};

type EvidenceLink = {
  href: string;
  label: string;
  external?: boolean;
} | null;

const TYPE_COPY: Record<RevalidationTaskType, { label: string; description: string }> = {
  PECOS: {
    label: 'PECOS',
    description: 'CMS Medicare enrollment (CMS-855)',
  },
  MEDICAID: {
    label: 'Medicaid',
    description: 'State program revalidation',
  },
  PAYER: {
    label: 'Payer',
    description: 'Commercial payer credentialing / enrollment',
  },
  CREDENTIALING: {
    label: 'Credentialing',
    description: 'Licenses, board certs, DEA, or CAQH evidence',
  },
};

const STATUS_BADGE_STYLES: Record<RevalidationTaskStatus, string> = {
  OPEN: 'bg-sky-100 text-sky-900 border-sky-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-900 border-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  OVERDUE: 'bg-red-100 text-red-900 border-red-200',
};

const TYPE_ICONS: Record<RevalidationTaskType, typeof FileText> = {
  PECOS: FileText,
  MEDICAID: ShieldCheck,
  PAYER: Building2,
  CREDENTIALING: Stethoscope,
};

const CATEGORY_FALLBACK_LINKS: Partial<Record<NonNullable<RevalidationTaskMetadata>['category'], (clinicianId: string) => EvidenceLink>> = {
  PECOS: (clinicianId) => ({
    href: `/demo/org/clinicians/${clinicianId}/pecos`,
    label: 'Open PECOS enrollment summary',
  }),
  STATE_LICENSE: () => ({
    href: 'https://www.fsmb.org/licensure/verify-physician/',
    label: 'FSMB licensure verification',
    external: true,
  }),
  DEA: () => ({
    href: 'https://www.deadiversion.usdoj.gov/',
    label: 'DEA Diversion Control Division',
    external: true,
  }),
  BOARD: () => ({
    href: 'https://www.abms.org/verify-certification/',
    label: 'ABMS certification lookup',
    external: true,
  }),
  MEDICAID: () => ({
    href: 'https://www.medicaid.gov/',
    label: 'Medicaid program guidance',
    external: true,
  }),
  PAYER: () => ({
    href: '/demo/clinician/payers/requirements',
    label: 'View payer requirement checklist',
  }),
  CREDENTIALING: () => ({
    href: '/demo/clinician/fppe?panel=revalidation',
    label: 'Credentialing evidence workspace',
  }),
};

interface PageProps {
  searchParams?: {
    clinicianId?: string;
  };
}

export default function RevalidationTimelinePage({ searchParams }: PageProps) {
  const clinicianId = searchParams?.clinicianId ?? FALLBACK_CLINICIAN_ID;
  const [tasks, setTasks] = useState<RevalidationTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/revalidation/${clinicianId}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload.tasks)) {
        throw new Error('Malformed API response');
      }

      const normalized = payload.tasks as RevalidationTaskRecord[];
      normalized.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setTasks(normalized);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Revalidation timeline falling back to demo data', err);
      setError('Showing demo data until the revalidation API is connected.');
      const demoTimeline = buildMockTimeline(clinicianId);
      setTasks(demoTimeline);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks]);

  const overdueCount = useMemo(() => sortedTasks.filter((task) => task.status === 'OVERDUE').length, [sortedTasks]);
  const dueSoonCount = useMemo(
    () =>
      sortedTasks.filter(
        (task) => task.status !== 'COMPLETED' && daysUntil(task.dueDate) <= 30
      ).length,
    [sortedTasks]
  );

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revalidation Timeline</h1>
          <p className="text-muted-foreground">
            Upcoming PECOS, payer, Medicaid, license, and DEA tasks for clinician{' '}
            <span className="font-mono text-sm">{clinicianId}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading} aria-label="Refresh revalidation tasks">
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
          <Badge variant="outline" className="text-xs">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Awaiting data'}
          </Badge>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-400/70 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3" aria-live="polite">
        <Card>
          <CardHeader>
            <CardDescription>Open / In Progress</CardDescription>
            <CardTitle className="text-3xl">{sortedTasks.filter((task) => task.status !== 'COMPLETED').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Due within 30 days</CardDescription>
            <CardTitle className="text-3xl" aria-label={`${dueSoonCount} tasks due soon`}>
              {dueSoonCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-3xl text-red-600" aria-label={`${overdueCount} tasks overdue`}>
              {overdueCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
            Timeline
          </CardTitle>
          <CardDescription>Ordered by due date with evidence links for each task</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground" role="status">
              <Clock className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading revalidation tasks…
            </div>
          ) : sortedTasks.length === 0 ? (
            <p className="text-muted-foreground">No active revalidation tasks on the horizon.</p>
          ) : (
            <ol
              className="relative space-y-8 border-l border-border pl-6"
              role="list"
              aria-label="Upcoming revalidation tasks timeline"
            >
              {sortedTasks.map((task) => (
                <li key={task.id} className="group" aria-label={`${TYPE_COPY[task.type].label} task due ${formatDate(task.dueDate)}`}>
                  <span className="absolute -left-[13px] inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                    {formatDate(task.dueDate, { dayOnly: true })}
                  </span>
                  <div className="rounded-xl border bg-card p-4 shadow-sm focus-within:ring-2 focus-within:ring-primary">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Badge variant="outline" className={`capitalize ${STATUS_BADGE_STYLES[task.status]}`}>
                        {task.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                      {task.metadata?.category && (
                        <Badge variant="secondary" aria-label={`Category ${task.metadata.category}`}>
                          {task.metadata.category.replace('_', ' ')}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground" role="text">
                        Due {formatDate(task.dueDate)} ({describeRelativeDue(task.dueDate)})
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          {renderTypeIcon(task.type)}
                          {TYPE_COPY[task.type].label}
                        </div>
                        <p className="text-sm text-muted-foreground" aria-live="polite">
                          {task.notes || TYPE_COPY[task.type].description}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Created {formatDate(task.createdAt)}</p>
                        {task.lastNotifiedAt && <p>Last notified {formatDate(task.lastNotifiedAt)}</p>}
                      </div>
                    </div>

                    {task.metadata?.details && (
                      <dl className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        {Object.entries(task.metadata.details)
                          .slice(0, 4)
                          .map(([key, value]) => (
                            <div key={key} className="rounded-lg bg-muted/50 p-2">
                              <dt className="text-xs uppercase tracking-wide">{key}</dt>
                              <dd className="font-medium text-foreground">
                                {typeof value === 'string' ? value : JSON.stringify(value)}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    )}

                    <Separator className="my-4" />

                    <div className="flex flex-wrap items-center gap-3" aria-label="Evidence links">
                      {renderEvidenceLink(task, clinicianId)}
                      <span className="text-xs text-muted-foreground">
                        Task ID {task.id} · Source {task.source.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderTypeIcon(type: RevalidationTaskType) {
  const Icon = TYPE_ICONS[type];
  return <Icon className="h-5 w-5 text-primary" aria-hidden="true" />;
}

function formatDate(value: string, options: { dayOnly?: boolean } = {}) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return date.toLocaleDateString('en-US', {
    year: options.dayOnly ? undefined : 'numeric',
    month: options.dayOnly ? undefined : 'short',
    day: 'numeric',
  });
}

function daysUntil(value: string) {
  const now = Date.now();
  const due = new Date(value).getTime();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function describeRelativeDue(value: string) {
  const delta = daysUntil(value);
  if (delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  if (delta === 0) return 'due today';
  if (delta === 1) return 'due tomorrow';
  return `due in ${delta} days`;
}

function renderEvidenceLink(task: RevalidationTaskRecord, clinicianId: string) {
  const link = getEvidenceLink(task, clinicianId);

  if (!link) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
        Evidence pending
      </Button>
    );
  }

  const rel = link.external ? 'noreferrer' : undefined;
  const target = link.external ? '_blank' : undefined;

  return (
    <Button variant="link" size="sm" asChild>
      <a href={link.href} target={target} rel={rel} aria-label={link.label}>
        <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
        {link.label}
      </a>
    </Button>
  );
}

function getEvidenceLink(task: RevalidationTaskRecord, clinicianId: string): EvidenceLink {
  if (task.metadata?.evidenceUrl) {
    return {
      href: task.metadata.evidenceUrl,
      label: 'View uploaded evidence',
      external: task.metadata.evidenceUrl.startsWith('http'),
    };
  }

  const categoryLink = task.metadata?.category
    ? CATEGORY_FALLBACK_LINKS[task.metadata.category]?.(clinicianId)
    : null;

  return categoryLink ?? null;
}

function buildMockTimeline(clinicianId: string): RevalidationTaskRecord[] {
  const now = new Date();
  return [
    {
      id: 'mock-pecos-1',
      clinicianId,
      type: 'PECOS',
      dueDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'OPEN',
      source: 'SYSTEM',
      notes: 'CMS flagged this enrollment for the standard 5-year revalidation cycle.',
      metadata: {
        category: 'PECOS',
        referenceId: 'CMS855I-DEMO',
        payerName: 'Medicare',
        details: {
          cycle: 'STANDARD',
          enrollmentType: 'CMS855I',
        },
      },
      completedAt: null,
      lastNotifiedAt: null,
      notificationCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'mock-license-1',
      clinicianId,
      type: 'CREDENTIALING',
      dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'OVERDUE',
      source: 'SYSTEM',
      notes: 'California medical license expired — submit renewal evidence.',
      metadata: {
        category: 'STATE_LICENSE',
        referenceId: 'CA-A12345',
        state: 'CA',
        details: {
          licenseNumber: 'A12345',
          status: 'EXPIRED',
        },
      },
      completedAt: null,
      lastNotifiedAt: null,
      notificationCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'mock-dea-1',
      clinicianId,
      type: 'CREDENTIALING',
      dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'OPEN',
      source: 'SYSTEM',
      notes: 'DEA registration expiring — renew with DEA Form 224.',
      metadata: {
        category: 'DEA',
        referenceId: 'DEA-999',
        details: {
          registrationNumber: 'DEA-999',
        },
      },
      completedAt: null,
      lastNotifiedAt: null,
      notificationCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'mock-board-1',
      clinicianId,
      type: 'CREDENTIALING',
      dueDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'OPEN',
      source: 'SYSTEM',
      notes: 'ABIM board certification recertification window opens soon.',
      metadata: {
        category: 'BOARD',
        referenceId: 'ABIM-CARD',
        specialty: 'Cardiology',
        details: {
          board: 'ABIM',
          specialty: 'Cardiology',
        },
      },
      completedAt: null,
      lastNotifiedAt: null,
      notificationCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
}
