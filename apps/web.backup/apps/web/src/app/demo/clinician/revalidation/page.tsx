'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ApiRevalidationTask {
  id: string;
  type: 'PECOS' | 'MEDICAID' | 'PAYER' | 'CREDENTIALING';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  source: string;
  dueDate: string;
  notes?: string | null;
  metadata?: {
    category?: string;
    payerName?: string;
    evidenceUrl?: string;
    state?: string;
    specialty?: string;
  };
}

interface ApiResponse {
  clinicianId: string;
  count: number;
  tasks: ApiRevalidationTask[];
}

const STATUS_STYLES: Record<ApiRevalidationTask['status'], { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
};

const TYPE_DESCRIPTIONS: Record<ApiRevalidationTask['type'], string> = {
  PECOS: 'Medicare / PECOS revalidation',
  MEDICAID: 'State Medicaid enrollment',
  PAYER: 'Commercial payer enrollment',
  CREDENTIALING: 'Credentialing artifacts (license, DEA, boards)',
};

const DEMO_CLINICIAN_ID = 'demo-clinician-001';

export default function DemoRevalidationTimeline() {
  const [tasks, setTasks] = useState<ApiRevalidationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      try {
        setLoading(true);
        const response = await fetch(`/api/revalidation/${DEMO_CLINICIAN_ID}`);

        if (!response.ok) {
          throw new Error('Failed to load revalidation tasks');
        }

        const data: ApiResponse = await response.json();
        if (!cancelled) {
          setTasks(data.tasks);
          setError(null);
        }
      } catch (err) {
        console.warn('[DemoRevalidation] falling back to mock data', err);
        if (!cancelled) {
          setTasks(buildMockTasks());
          setError('Using demo data (API unavailable)');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    return tasks.reduce<Record<ApiRevalidationTask['type'], ApiRevalidationTask[]>>(
      (acc, task) => {
        acc[task.type] = acc[task.type] ? [...acc[task.type], task] : [task];
        return acc;
      },
      { PECOS: [], MEDICAID: [], PAYER: [], CREDENTIALING: [] }
    );
  }, [tasks]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Revalidation Control Tower
          </p>
          <h1 className="text-3xl font-bold">Upcoming Clinician Revalidations</h1>
          <p className="text-slate-600">
            Track PECOS, payer, and credentialing renewals in a single SR-friendly timeline. Tap
            any task to review evidence links and remediation steps.
          </p>
          {error && (
            <p role="status" className="text-sm text-amber-700">
              {error}
            </p>
          )}
        </header>

        <section className="grid gap-4 md:grid-cols-4" aria-label="Task summary cards">
          {Object.entries(grouped).map(([type, typeTasks]) => (
            <Card
              key={type}
              role="region"
              aria-labelledby={`summary-${type}`}
              className="bg-white shadow-sm"
            >
              <CardHeader>
                <CardDescription id={`summary-${type}`} className="text-xs uppercase">
                  {TYPE_DESCRIPTIONS[type as ApiRevalidationTask['type']]}
                </CardDescription>
                <CardTitle className="text-3xl">{typeTasks.length}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <Card className="bg-white shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" aria-hidden />
              Revalidation timeline
            </CardTitle>
            <CardDescription>
              Sorted by due date. Screen reader tips: use arrow keys to move through events; each
              entry announces status, due date, and recommended action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500" role="status" aria-live="polite">
                Loading tasks…
              </p>
            ) : (
              <ol className="relative border-l border-slate-200 pl-6" role="list">
                {tasks.map((task, index) => (
                  <li key={task.id} className="mb-8 last:mb-0">
                    <TimelineEvent task={task} position={index + 1} total={tasks.length} />
                  </li>
                ))}
                {tasks.length === 0 && (
                  <p className="text-sm text-slate-500">No open tasks 🎉</p>
                )}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function TimelineEvent({ task, position, total }: { task: ApiRevalidationTask; position: number; total: number }) {
  const status = STATUS_STYLES[task.status];
  const Icon = task.status === 'OVERDUE' ? AlertTriangle : task.status === 'COMPLETED' ? CheckCircle2 : Clock;
  const daysLeft = task.dueDate ? daysUntil(task.dueDate) : null;

  return (
    <article
      className="rounded-lg bg-slate-50/60 p-4 shadow-sm ring-1 ring-slate-100"
      aria-posinset={position}
      aria-setsize={total}
      aria-label={`${task.type} task due ${formatDate(task.dueDate)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white p-2 text-slate-500 shadow" aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {task.metadata?.category || task.type}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">{TYPE_DESCRIPTIONS[task.type]}</h3>
          </div>
        </div>
        <Badge className={status.color}>{status.label}</Badge>
      </div>
      <dl className="mt-3 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Due date</dt>
          <dd className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
            <span>
              {formatDate(task.dueDate)}
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="sr-only">, {daysLeft} days remaining</span>
              )}
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Context</dt>
          <dd>
            {task.metadata?.payerName ||
              task.metadata?.state ||
              task.metadata?.specialty ||
              task.notes ||
              'Review required'}
          </dd>
        </div>
      </dl>
      {task.notes && (
        <p className="mt-3 text-sm text-slate-600">
          <FileText className="mr-2 inline h-4 w-4 text-slate-400" aria-hidden />
          {task.notes}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {task.metadata?.evidenceUrl ? (
          <Button
            variant="outline"
            className="gap-2"
            asChild
          >
            <a href={task.metadata.evidenceUrl} target="_blank" rel="noreferrer">
              View evidence
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        ) : (
          <Button variant="outline" className="gap-2" disabled>
            Evidence pending
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <Button variant="default" className="gap-2">
          Open task workspace
          <ArrowIndicator status={task.status} />
        </Button>
      </div>
    </article>
  );
}

function ArrowIndicator({ status }: { status: ApiRevalidationTask['status'] }) {
  if (status === 'COMPLETED') {
    return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  }
  if (status === 'OVERDUE') {
    return <AlertTriangle className="h-4 w-4" aria-hidden />;
  }
  return <Clock className="h-4 w-4" aria-hidden />;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'TBD';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateString: string | null | undefined) {
  if (!dateString) return null;
  const due = new Date(dateString).getTime();
  const diff = due - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function buildMockTasks(): ApiRevalidationTask[] {
  const now = new Date();
  return [
    {
      id: 'mock-pecos',
      type: 'PECOS',
      status: 'OPEN',
      source: 'SYSTEM',
      dueDate: addDays(now, 70).toISOString(),
      notes: 'CMS reminder: submit 855R supporting docs.',
      metadata: { category: 'PECOS', payerName: 'Medicare' },
    },
    {
      id: 'mock-license',
      type: 'CREDENTIALING',
      status: 'OVERDUE',
      source: 'SYSTEM',
      dueDate: addDays(now, -5).toISOString(),
      notes: 'California medical license expired — upload new board letter.',
      metadata: { category: 'STATE_LICENSE', state: 'CA', evidenceUrl: '#' },
    },
    {
      id: 'mock-dea',
      type: 'CREDENTIALING',
      status: 'OPEN',
      source: 'SYSTEM',
      dueDate: addDays(now, 20).toISOString(),
      notes: 'DEA registration expiring in <30 days; renew via DEA Diversion portal.',
      metadata: { category: 'DEA', evidenceUrl: '#' },
    },
  ];
}

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

