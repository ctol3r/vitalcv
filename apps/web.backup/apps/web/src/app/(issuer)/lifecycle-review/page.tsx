'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Clock4,
  FileWarning,
  Filter,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type ReviewSeverity = 'info' | 'warning' | 'critical';
type ReviewIssueType = 'license' | 'cme' | 'board' | 'anomaly';

interface LifecycleReviewItem {
  id: string;
  clinicianId: string;
  clinicianName: string;
  facility?: string;
  credentialId: string;
  credentialType: string;
  issueType: ReviewIssueType;
  severity: ReviewSeverity;
  summary: string;
  windowEnd: string;
  ageHours: number;
  watcherType?: string;
  anomalies?: string[];
  recommendedActions: string[];
  links?: Array<{ label: string; url: string }>;
}

interface LifecycleReviewResponse {
  queue: LifecycleReviewItem[];
  metrics: {
    open: number;
    expiringSoon: number;
    anomalies: number;
    autoclosed24h: number;
  };
}

const severityCopy: Record<
  ReviewSeverity,
  { label: string; variant: 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }
> = {
  info: {
    label: 'info',
    variant: 'outline',
    icon: <Activity className="h-3.5 w-3.5 text-muted-foreground" />,
  },
  warning: {
    label: 'warning',
    variant: 'secondary',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  },
  critical: {
    label: 'critical',
    variant: 'destructive',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
};

const issueLabel: Record<
  ReviewIssueType,
  { label: string; description: string; icon: React.ReactNode; badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  license: {
    label: 'License renewal',
    description: 'State license expiring or expired',
    icon: <ClipboardCheck className="h-3.5 w-3.5 text-sky-600" />,
    badgeVariant: 'default',
  },
  cme: {
    label: 'CME hours',
    description: 'CME attestation required',
    icon: <FileWarning className="h-3.5 w-3.5 text-indigo-600" />,
    badgeVariant: 'secondary',
  },
  board: {
    label: 'Board recert',
    description: 'Board window closing',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    badgeVariant: 'outline',
  },
  anomaly: {
    label: 'Lifecycle anomaly',
    description: 'Detector flagged inconsistent data',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    badgeVariant: 'destructive',
  },
};

export default function LifecycleReviewQueue() {
  const [data, setData] = useState<LifecycleReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<ReviewIssueType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<ReviewSeverity | 'all'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issuer/lifecycle/review');
      const payload = (await response.json()) as LifecycleReviewResponse;
      if (!response.ok) {
        throw new Error(payload ? (payload as any).error : 'Unable to load lifecycle queue');
      }
      setData(payload);
    } catch (err) {
      console.error('[lifecycle-review] load failed', err);
      setError(err instanceof Error ? err.message : 'Unable to load lifecycle review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const filteredQueue = useMemo(() => {
    if (!data?.queue) return [];
    return data.queue.filter((item) => {
      const matchesIssue = issueFilter === 'all' || item.issueType === issueFilter;
      const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
      return matchesIssue && matchesSeverity;
    });
  }, [data, issueFilter, severityFilter]);

  const handleResolve = async (itemId: string) => {
    setResolvingId(itemId);
    try {
      const response = await fetch(`/api/issuer/lifecycle/review/${itemId}/resolve`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to resolve review');
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              metrics: {
                ...prev.metrics,
                open: Math.max(prev.metrics.open - 1, 0),
              },
              queue: prev.queue.filter((entry) => entry.id !== itemId),
            }
          : prev,
      );
      toast({
        title: 'Lifecycle review cleared',
        description: `Marked review ${itemId} as resolved.`,
      });
    } catch (err) {
      toast({
        title: 'Unable to resolve',
        description: err instanceof Error ? err.message : 'Please retry in a few seconds.',
        variant: 'destructive',
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="container mx-auto space-y-8 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Issuer · Lifecycle controls</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Lifecycle review queue</h1>
            <p className="text-muted-foreground max-w-3xl">
              Investigate credentials flagged by lifecycle watchers, anomaly detectors, and auto-renewal workflows before
              final issuance.
            </p>
          </div>
          <Button variant="secondary" onClick={fetchQueue} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing
              </>
            ) : (
              <>
                <Filter className="mr-2 h-4 w-4" />
                Refresh queue
              </>
            )}
          </Button>
        </div>
      </header>

      {data && (
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard title="Open reviews" description="Awaiting issuer decision" value={data.metrics.open} icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} />
          <SummaryCard title="Expiring soon" description="<45d remaining" value={data.metrics.expiringSoon} icon={<Clock4 className="h-5 w-5 text-sky-500" />} />
          <SummaryCard title="Anomalies" description="Detector escalations" value={data.metrics.anomalies} icon={<ShieldAlert className="h-5 w-5 text-red-500" />} />
          <SummaryCard title="Auto-closed (24h)" description="Resolved via automation" value={data.metrics.autoclosed24h} icon={<Archive className="h-5 w-5 text-emerald-500" />} />
        </section>
      )}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load queue</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="space-y-4" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Issue</span>
          <div className="flex flex-wrap gap-2">
            {(['all', 'license', 'cme', 'board', 'anomaly'] as const).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={issueFilter === type ? 'default' : 'outline'}
                onClick={() => setIssueFilter(type === 'all' ? 'all' : (type as ReviewIssueType))}
              >
                {type === 'all' ? 'All' : issueLabel[type as ReviewIssueType].label}
              </Button>
            ))}
          </div>
          <span className="ml-4 text-sm font-medium text-muted-foreground">Severity</span>
          <div className="flex flex-wrap gap-2">
            {(['all', 'info', 'warning', 'critical'] as const).map((level) => (
              <Button
                key={level}
                size="sm"
                variant={severityFilter === level ? 'default' : 'outline'}
                onClick={() => setSeverityFilter(level === 'all' ? 'all' : (level as ReviewSeverity))}
              >
                {level === 'all' ? 'All' : level}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => <LoadingCard key={`loading-${idx}`} />)
        ) : filteredQueue.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No lifecycle reviews pending</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Automation cleared every lifecycle issue for now. New escalations will appear instantly.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          filteredQueue.map((item) => (
            <Card key={item.id}>
              <CardHeader className="gap-4 md:flex md:items-center md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <span>{item.clinicianName}</span>
                    {item.facility && <Badge variant="secondary">{item.facility}</Badge>}
                    <Badge variant={issueLabel[item.issueType].badgeVariant}>{issueLabel[item.issueType].label}</Badge>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Credential {item.credentialType}</span>
                    <span>Window ends {new Date(item.windowEnd).toLocaleDateString()}</span>
                    <span>Age {Math.round(item.ageHours)}h</span>
                  </CardDescription>
                </div>
                <Badge variant={severityCopy[item.severity].variant} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                  {severityCopy[item.severity].icon}
                  {severityCopy[item.severity].label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{item.summary}</p>

                {item.anomalies?.length && (
                  <div className="rounded-md border border-dashed border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    <p className="font-semibold">Detector findings</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {item.anomalies.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended actions</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {item.recommendedActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={resolvingId === item.id}
                    onClick={() => handleResolve(item.id)}
                  >
                    {resolvingId === item.id ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Marking…
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="mr-2 h-3.5 w-3.5" />
                        Mark resolved
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/claims/${item.clinicianId}/evidence`} prefetch={false}>
                      View evidence
                    </Link>
                  </Button>
                  {item.links?.map((link) => (
                    <Button key={link.url} size="sm" variant="ghost" asChild>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  description,
  value,
  icon,
}: {
  title: string;
  description: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value ?? 0}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}


