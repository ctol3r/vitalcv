'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileWarning, Loader2 } from 'lucide-react';
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
  employerWorkflowStateLabel,
  employerWorkflowStateTone,
  relativeTimestamp,
  type EmployerWorkflowApplication,
  type EmployerWorkflowDashboardPayload,
  type EmployerWorkflowState,
} from '@/lib/employer-workflow';

const STATE_ORDER: EmployerWorkflowState[] = [
  'NEW',
  'UNDER_REVIEW',
  'WAITING_FOR_DOCUMENTS',
  'APPROVED',
  'REJECTED',
];

function providerLabel(application: EmployerWorkflowApplication): string {
  return application.provider?.fullName
    ?? (application.npi ? `NPI ${application.npi}` : 'Clinician');
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Clock3;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">{title}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
            <p className="mt-2 text-sm text-white/65">{detail}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <Icon className="h-5 w-5 text-emerald-200" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ application }: { application: EmployerWorkflowApplication }) {
  return (
    <Card className="border-white/10 bg-black/20 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{providerLabel(application)}</p>
            <p className="mt-1 text-sm text-white/65">
              {application.opportunity.title} · {application.opportunity.state}
            </p>
          </div>
          <Badge className={employerWorkflowStateTone(application.workflowState)} variant="outline">
            {employerWorkflowStateLabel(application.workflowState)}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-white/70">
          <div className="flex items-center justify-between gap-3">
            <span>Readiness</span>
            <span className="font-medium text-white">
              {application.readiness
                ? `${application.readiness.readinessLevel} · ${application.readiness.readinessScore}/100`
                : 'Unavailable'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Last movement</span>
            <span className="font-medium text-white">{relativeTimestamp(application.updatedAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Missing requests</span>
            <span className="font-medium text-white">
              {application.missingRequests.filter((request) => request.status === 'OPEN').length}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <Button asChild className="w-full" size="sm">
            <Link href={`/employer/applications/${encodeURIComponent(application.id)}`}>
              Review application
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployerWorkflowDashboard() {
  const [payload, setPayload] = React.useState<EmployerWorkflowDashboardPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/employer/applications/dashboard', {
          cache: 'no-store',
        });
        const nextPayload = await response.json().catch(() => ({})) as EmployerWorkflowDashboardPayload & { error?: string };

        if (!response.ok) {
          throw new Error(typeof nextPayload.error === 'string' ? nextPayload.error : 'Unable to load employer workflow.');
        }

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setPayload(null);
          setError(nextError instanceof Error ? nextError.message : 'Unable to load employer workflow.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#08101d] px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Employer workflow</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Applications, bottlenecks, and missing data in one surface.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            Review incoming applications, route document gaps, and move approved clinicians into credentialing without leaving the employer loop.
          </p>
        </header>

        {loading ? (
          <Card className="border-white/10 bg-white/[0.04]">
            <CardContent className="flex items-center justify-center gap-3 py-14 text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading employer workflow…
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="flex items-center gap-3 py-6 text-amber-100">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </CardContent>
          </Card>
        ) : null}

        {payload ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="New applications"
                value={String(payload.bottlenecks.newApplicationsCount)}
                detail="Fresh submissions that have not been touched."
                icon={Clock3}
              />
              <MetricCard
                title="Waiting for documents"
                value={String(payload.bottlenecks.waitingForDocumentsCount)}
                detail="Open document requests currently blocking motion."
                icon={FileWarning}
              />
              <MetricCard
                title="Review aging >48h"
                value={String(payload.bottlenecks.underReviewOver48HoursCount)}
                detail="Applications sitting in review longer than two days."
                icon={AlertTriangle}
              />
              <MetricCard
                title="Accepted as a head start"
                value={String(payload.bottlenecks.acceptedHeadStartCount)}
                detail="Cases moving through remaining hire-to-start requirements. Institution review remains."
                icon={CheckCircle2}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-5">
              {STATE_ORDER.map((state) => (
                <Card key={state} className="border-white/10 bg-white/[0.04] shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
                  <CardHeader>
                    <CardTitle className="text-white">{employerWorkflowStateLabel(state)}</CardTitle>
                    <CardDescription className="text-white/55">
                      {payload.byState[state]?.length ?? 0} application{payload.byState[state]?.length === 1 ? '' : 's'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(payload.byState[state] ?? []).length > 0 ? (
                      payload.byState[state].map((application) => (
                        <ApplicationCard key={application.id} application={application} />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                        No applications in this state.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-white/10 bg-white/[0.04] shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
                <CardHeader>
                  <CardTitle className="text-white">Missing data</CardTitle>
                  <CardDescription className="text-white/55">
                    Open document and field requests across active applications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payload.missingData.length > 0 ? (
                    payload.missingData.map((request) => (
                      <div key={request.requestId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{request.field}</p>
                            <p className="mt-1 text-sm text-white/65">{request.message}</p>
                          </div>
                          <Badge className="border-orange-500/25 bg-orange-500/10 text-orange-100" variant="outline">
                            {request.status}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-white/45">
                          Application {request.applicationId.slice(0, 8)} · Updated {relativeTimestamp(request.updatedAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                      No open missing-data requests.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.04] shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
                <CardHeader>
                  <CardTitle className="text-white">Current bottlenecks</CardTitle>
                  <CardDescription className="text-white/55">
                    What is slowing movement through the employer queue right now.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">Document chase</p>
                    <p className="mt-2 text-sm text-white/65">
                      {payload.bottlenecks.waitingForDocumentsCount} application{payload.bottlenecks.waitingForDocumentsCount === 1 ? '' : 's'} are waiting on clinician-supplied evidence.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">Aging review queue</p>
                    <p className="mt-2 text-sm text-white/65">
                      {payload.bottlenecks.underReviewOver48HoursCount} application{payload.bottlenecks.underReviewOver48HoursCount === 1 ? '' : 's'} have been sitting in review for more than 48 hours.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">Hire-to-start underway</p>
                    <p className="mt-2 text-sm text-white/65">
                      {payload.bottlenecks.acceptedHeadStartCount} application{payload.bottlenecks.acceptedHeadStartCount === 1 ? '' : 's'} {payload.bottlenecks.acceptedHeadStartCount === 1 ? 'has' : 'have'} an accepted head start and still require institution-owned work before a confirmed first day.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
