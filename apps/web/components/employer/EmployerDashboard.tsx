'use client';

import { useRoleContext } from '@/components/auth/RoleContext';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import type {
  IntelligenceAction,
  IntelligenceFinding,
  IntelligenceProvider,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Layers3,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { FEATURES } from '@/lib/features';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  buildEmployerApplicationProofMoments,
  buildEmployerProofSummary,
  buildEmployerValueSignalsSummary,
} from '@/lib/proof/proof-model';
import type { EmployerValueSignals } from '@/lib/proof/types';

type AppStatus = 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';

interface EmployerApplication {
  id: string;
  opportunityId: string;
  npi: string | null;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  provider: {
    npi: string | null;
    fullName: string | null;
    specialty: string | null;
    stateOfPractice: string | null;
  } | null;
  employer: {
    organizationId: string;
    name: string | null;
  };
  readiness: {
    readinessScore: number;
    readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
    readinessStatus: string;
    gapSummary: string[];
    keyCredentials: string[];
    trustSignals: string[];
  } | null;
  opportunity: {
    id: string;
    title: string;
    specialty: string;
    state: string;
    payRange: string | null;
  };
}

const APPLICATION_STATUS_LABEL: Record<AppStatus, string> = {
  PENDING: 'Pending review',
  REVIEWED: 'Reviewed',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};

const APPLICATION_STATUS_TONE: Record<AppStatus, string> = {
  PENDING: 'text-amber-200 border-amber-500/25 bg-amber-500/10',
  REVIEWED: 'text-sky-200 border-sky-500/25 bg-sky-500/10',
  ACCEPTED: 'text-emerald-200 border-emerald-500/25 bg-emerald-500/10',
  DECLINED: 'text-rose-200 border-rose-500/25 bg-rose-500/10',
  WITHDRAWN: 'text-foreground/70 border-border bg-muted',
};

function relativeTime(iso: string | null): string {
  if (!iso) {
    return 'Unavailable';
  }

  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) {
    return 'Just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function providerLabel(application: EmployerApplication): string {
  return application.provider?.fullName
    ?? (application.provider?.npi ? `NPI ${application.provider.npi}` : 'Clinician pending profile');
}

function SectionShell({
  title,
  actionHref,
  actionLabel,
  children,
  helper,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/8 bg-white/[0.04] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {helper ? <p className="mt-1 text-sm text-foreground">{helper}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/60 transition hover:border-border hover:text-foreground"
          >
            {actionLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
  detail,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  tone: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function ResourceState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading live data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
        {error}
      </div>
    );
  }

  if (!children) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return children;
}

function ApplicationRow({
  application,
  signalSummary,
}: {
  application: EmployerApplication;
  signalSummary?: EmployerValueSignals['candidateSummaries'][number] | null;
}) {
  const readiness = application.readiness;
  const proofMoments = signalSummary
    ? [signalSummary.summary, ...signalSummary.preparedContext].slice(0, 4)
    : buildEmployerApplicationProofMoments(application);

  return (
    <div className="rounded-2xl border border-white/8 bg-muted p-5 transition-all hover:bg-muted hover:border-border group cursor-pointer block">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-foreground group-hover:text-amber-400 transition-colors">
              {providerLabel(application)}
            </p>
            {readiness?.readinessLevel === 'L3' && (
              <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Issuer-confirmed
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground/70 font-medium">
            {application.opportunity?.title ?? 'Unknown role'}
            {' · '}
            {application.opportunity?.state ?? 'Unknown state'}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${APPLICATION_STATUS_TONE[application.status]} shadow-sm`}>
          {APPLICATION_STATUS_LABEL[application.status]}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Live Readiness</p>
            {readiness ? (
              <p className="font-mono text-emerald-400 font-semibold text-sm">
                {readiness.readinessLevel} <span className="text-muted-foreground/40 px-1 truncate">|</span> {readiness.readinessScore}/100
              </p>
            ) : (
              <p className="text-muted-foreground/60 font-medium text-sm">Unavailable</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Key Credentials</p>
            <p className="text-foreground/80 font-medium text-sm truncate">
              {readiness?.keyCredentials?.slice(0, 2).join(', ') || 'Processing...'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Trust Signals</p>
            <p className="text-foreground/80 font-medium text-sm truncate">
              {readiness?.trustSignals?.slice(0, 2).join(', ') || 'Pending'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <div className="text-xs font-medium text-muted-foreground text-right">
            Applied {relativeTime(application.createdAt)}
          </div>
          <Link href={`/employer/review/${application.id}`} className="rounded-xl border border-border bg-muted px-4 py-2 text-xs font-bold text-foreground transition-all group-hover:bg-emerald-500 group-hover:text-foreground group-hover:border-emerald-500">
            Review & Verify
          </Link>
        </div>
      </div>

      {proofMoments.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-black/20 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prepared by VitalCV</p>
          <div className="mt-3 space-y-2">
            {proofMoments.map((moment) => (
              <p key={moment} className="text-sm leading-6 text-foreground/70">
                {moment}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProviderRow({ provider }: { provider: IntelligenceProvider }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{provider.name}</p>
          <p className="mt-1 text-sm text-foreground">{provider.specialties.slice(0, 2).join(' · ') || `NPI ${provider.npi}`}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">{provider.trustScore}</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">Trust</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground">
        <span className="rounded-full border border-border bg-muted px-2.5 py-1">
          {provider.credentialHealth.toLowerCase()}
        </span>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1">
          {provider.activeCredentials} active credentials
        </span>
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: IntelligenceFinding }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{finding.title}</p>
          <p className="mt-1 text-sm text-foreground">{finding.providerLabel ?? finding.providerNpi ?? 'Unknown provider'}</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
          {finding.severity}
        </span>
      </div>
      <p className="mt-3 text-sm text-foreground">{finding.summary}</p>
    </div>
  );
}

function StorylineRow({ storyline }: { storyline: IntelligenceStoryline }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{storyline.title}</p>
          <p className="mt-1 text-sm text-foreground">{storyline.providerNpi ?? 'Cross-provider storyline'}</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
          {storyline.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-foreground">{storyline.summary}</p>
    </div>
  );
}

function ActionRow({ action }: { action: IntelligenceAction }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{action.title}</p>
          <p className="mt-1 text-sm text-foreground">{action.targetLabel ?? action.providerNpi ?? 'Organization queue'}</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
          {action.priority}
        </span>
      </div>
      <p className="mt-3 text-sm text-foreground">{action.explanation}</p>
    </div>
  );
}

export function EmployerDashboard() {
  const { isLoaded: roleLoaded, isEmployer, isSignedIn } = useRoleContext();
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [valueSignals, setValueSignals] = useState<EmployerValueSignals | null>(null);
  const [valueSignalsLoading, setValueSignalsLoading] = useState(true);
  const [valueSignalsError, setValueSignalsError] = useState<string | null>(null);

  const providers = useProviders({ limit: 6 });
  const findings = useFindings({ limit: 6 });
  const storylines = useStorylines({ limit: 6 });
  const actions = useActions({ limit: 6 });

  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      setApplicationsLoading(true);
      setApplicationsError(null);

      try {
        const response = await fetch('/api/employer/applications', {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as EmployerApplication[] & { error?: string };

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Connection to live feed interrupted. Retrying securely.');
        }

        if (!cancelled) {
          setApplications(Array.isArray(payload) ? payload : []);
        }
      } catch (error) {
        if (!cancelled) {
          setApplicationsError(error instanceof Error ? error.message : 'Connection to live feed interrupted. Retrying securely.');
          setApplications([]);
        }
      } finally {
        if (!cancelled) {
          setApplicationsLoading(false);
        }
      }
    }

    void loadApplications();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadValueSignals() {
      setValueSignalsLoading(true);
      setValueSignalsError(null);

      try {
        const response = await fetch('/api/employer/value-signals', {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as EmployerValueSignals & { error?: string };

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Employer value signals are temporarily unavailable.');
        }

        if (!cancelled) {
          setValueSignals(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setValueSignalsError(error instanceof Error ? error.message : 'Employer value signals are temporarily unavailable.');
          setValueSignals(null);
        }
      } finally {
        if (!cancelled) {
          setValueSignalsLoading(false);
        }
      }
    }

    void loadValueSignals();
    return () => {
      cancelled = true;
    };
  }, []);

  const providerRows = providers.data?.providers ?? [];
  const findingRows = findings.data?.findings ?? [];
  const storylineRows = storylines.data?.storylines ?? [];
  const actionRows = actions.data?.actions ?? [];
  const recentApplications = applications.slice(0, 5);
  const proofSummary = useMemo(() => (
    valueSignals
      ? buildEmployerValueSignalsSummary(valueSignals)
      : buildEmployerProofSummary({
          applications,
          findingCount: findingRows.length,
          storylineCount: storylineRows.length,
          actionCount: actionRows.length,
        })
  ), [actionRows.length, applications, findingRows.length, storylineRows.length, valueSignals]);
  const candidateSignalSummaries = useMemo(() => (
    new Map((valueSignals?.candidateSummaries ?? []).map((entry) => [entry.applicationId, entry]))
  ), [valueSignals?.candidateSummaries]);

  const acceptedCount = applications.filter((application) => application.status === 'ACCEPTED').length;
  const pendingCount = applications.filter((application) => application.status === 'PENDING' || application.status === 'REVIEWED').length;
  const providerCount = useMemo(() => {
    const providerNpis = applications
      .map((application) => application.provider?.npi ?? application.npi)
      .filter((value): value is string => Boolean(value));
    return new Set(providerNpis).size;
  }, [applications]);

  const readinessAverage = useMemo(() => {
    const scores = applications
      .map((application) => application.readiness?.readinessScore ?? null)
      .filter((score): score is number => typeof score === 'number');
    if (scores.length === 0) {
      return null;
    }
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [applications]);

  if (roleLoaded && isSignedIn && !isEmployer) {
    return (
      <main className="min-h-screen bg-[#08101d] px-6 py-12 text-foreground">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Employer workspace required</h1>
                <p className="mt-2 text-sm leading-6 text-amber-50/85">
                  This dashboard is for employer and verifier actions. Switch into your employer workspace to review providers, findings, and incoming applications.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {/* /workspace/switch never shipped (only an _archive page).
                      The live switcher is the persona widget mounted on the
                      holder surfaces. */}
                  <Link href="/holder" className="glue-btn glue-btn-primary">
                    Open workspace switcher
                  </Link>
                  <Link href="/holder/home" className="glue-btn border border-border bg-muted text-foreground hover:bg-muted">
                    Return to clinician dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08101d] px-6 py-12 text-foreground">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Employer Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">Apply, verify, hire, and pay in one loop.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground">
                Incoming applications include readiness, verified credentials, and trust signals as of [date/quarter] so your team can confidently move clinicians to start.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* /verifier/* was archived; the live employer tree is /employer/*. */}
              <Link href="/employer/review-queue" className="glue-btn glue-btn-primary">
                Open applications queue
              </Link>
              <Link href="/employer/post" className="glue-btn border border-border bg-muted text-foreground hover:bg-muted">
                Post opportunity
              </Link>
              {FEATURES.MATCHA_V2 ? (
                <Link href="/employer/candidates" className="glue-btn border border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15">
                  Browse credential-ready clinicians
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Briefcase}
            label="Incoming applications"
            value={applicationsLoading ? '…' : String(applications.length)}
            tone="bg-emerald-500/15 text-emerald-200"
            detail={`${pendingCount} pending or reviewed in queue`}
          />
          <MetricCard
            icon={Users}
            label="Providers in motion"
            value={applicationsLoading ? '…' : String(providerCount || providerRows.length)}
            tone="bg-sky-500/15 text-sky-200"
            detail={providerRows.length > 0 ? `${providerRows.length} tracked in intelligence` : 'Identified from your application pipeline'}
          />
          <MetricCard
            icon={ShieldCheck}
            label="Average readiness"
            value={readinessAverage === null ? 'N/A' : `${readinessAverage}`}
            tone="bg-violet-500/15 text-violet-200"
            detail={readinessAverage === null ? 'Waiting for clinician trust states' : `${proofSummary.readinessVisibleCount} candidates already show readiness in queue`}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Accepted to hire/start"
            value={applicationsLoading ? '…' : String(acceptedCount)}
            tone="bg-amber-500/15 text-amber-200"
            detail={`${proofSummary.actionQueueCount} actions generated and ${proofSummary.issuesIdentifiedBeforeReviewCount} issues caught early`}
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-white/8 bg-white/[0.04] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Employer value signals</h2>
                <p className="mt-1 text-sm text-foreground">
                  Queue facts tied to readiness visibility, issues caught before review, and prepared context.
                </p>
              </div>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold text-foreground/60">
                {valueSignalsLoading ? 'Loading…' : 'Real signals only'}
              </span>
            </div>

            {valueSignalsError ? (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {valueSignalsError}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Readiness visible</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{valueSignalsLoading ? '…' : proofSummary.readinessVisibleCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prepared context</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{valueSignalsLoading ? '…' : proofSummary.preparedReviewCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Issues caught early</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{valueSignalsLoading ? '…' : proofSummary.issuesIdentifiedBeforeReviewCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Review actions</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{valueSignalsLoading ? '…' : proofSummary.reviewActionCount}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Applications moving</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{valueSignalsLoading ? '…' : proofSummary.applicationsMovingCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live findings</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{findings.loading ? '…' : findingRows.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Action queue</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{valueSignalsLoading ? '…' : proofSummary.actionQueueCount}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Link
                href="/api/employer/value-signals"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/60 transition hover:border-border hover:text-foreground"
              >
                Export JSON
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/[0.04] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">What Changed Because Of VitalCV</h2>
                <p className="mt-1 text-sm text-foreground">
                  Candidate, review, and queue movement summarized from live employer state.
                </p>
              </div>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold text-foreground/60">
                {proofSummary.applicationsMovingCount} moving
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {proofSummary.recentChanges.length > 0 ? proofSummary.recentChanges.slice(0, 4).map((change) => (
                <Link
                  key={change.id}
                  href={change.href}
                  className="block rounded-2xl border border-border bg-black/20 px-4 py-3 transition hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{change.title}</p>
                      <p className="mt-1 text-sm leading-6 text-foreground/60">{change.summary}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{relativeTime(change.occurredAt)}</p>
                  </div>
                </Link>
              )) : (
                <p className="text-sm text-foreground">
                  Recent employer-side value signals will appear here as clinicians and reviewers move the queue.
                </p>
              )}
            </div>
          </section>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionShell
            title="Incoming Applications"
            helper="Live submissions from clinicians who applied with their VitalCV profile."
            actionHref="/employer/review-queue"
            actionLabel="Review queue"
          >
            <ResourceState
              loading={applicationsLoading}
              error={applicationsError}
              empty="No clinician applications have arrived yet."
            >
              {recentApplications.length > 0 ? (
                <div className="space-y-3">
                  {recentApplications.map((application) => (
                    <ApplicationRow
                      key={application.id}
                      application={application}
                      signalSummary={candidateSignalSummaries.get(application.id) ?? null}
                    />
                  ))}
                </div>
              ) : null}
            </ResourceState>
          </SectionShell>

          <SectionShell
            title="Providers"
            helper="Clinicians connected to your workspace and live intelligence view."
            actionHref="/employer/candidates"
            actionLabel="Open providers"
          >
            <ResourceState
              loading={providers.loading}
              error={providers.error}
              empty="No providers are available in the employer workspace yet."
            >
              {providerRows.length > 0 ? (
                <div className="space-y-3">
                  {providerRows.slice(0, 4).map((provider) => (
                    <ProviderRow key={provider.id} provider={provider} />
                  ))}
                </div>
              ) : null}
            </ResourceState>
          </SectionShell>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <SectionShell
            title="Findings"
            helper="Signals that should influence review, verification, or escalation."
            /* The intelligence-era /findings surface was archived; the panel
               keeps its data but a CTA must not link into a 404. */
          >
            <ResourceState
              loading={findings.loading}
              error={findings.error}
              empty="No employer findings are active right now."
            >
              {findingRows.length > 0 ? (
                <div className="space-y-3">
                  {findingRows.slice(0, 4).map((finding) => (
                    <FindingRow key={finding.id} finding={finding} />
                  ))}
                </div>
              ) : null}
            </ResourceState>
          </SectionShell>

          <SectionShell
            title="Storylines"
            helper="Narratives that track provider risk, verification progress, and hiring state."
            /* /storylines was archived with the intelligence tree. */
          >
            <ResourceState
              loading={storylines.loading}
              error={storylines.error}
              empty="No employer storylines are active right now."
            >
              {storylineRows.length > 0 ? (
                <div className="space-y-3">
                  {storylineRows.slice(0, 4).map((storyline) => (
                    <StorylineRow key={storyline.id} storyline={storyline} />
                  ))}
                </div>
              ) : null}
            </ResourceState>
          </SectionShell>

          <SectionShell
            title="Actions Queue"
            helper="Real actions your team can take to move providers through the hiring loop."
            /* /actions was archived with the intelligence tree. */
          >
            <ResourceState
              loading={actions.loading}
              error={actions.error}
              empty="No queued actions are waiting right now."
            >
              {actionRows.length > 0 ? (
                <div className="space-y-3">
                  {actionRows.slice(0, 4).map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                </div>
              ) : null}
            </ResourceState>
          </SectionShell>
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-emerald-200">
              <Clock3 className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Hiring timing</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground">
              Accepted clinicians can move straight into the separate hire/start flow from the inbox, using the billing-backed employer start endpoints already in the system.
            </p>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-sky-200">
              <Layers3 className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Intelligence sync</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground">
              Reduce hiring cycles by making confident decisions on Registered with CMS NPPES signals instantly. Reviewing or verifying a clinician from the inbox automatically updates storylines and findings.
            </p>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-amber-200">
              <Building2 className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Employer readiness</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground">
              Each incoming application now carries provider identity, readiness, credentials, and trust signals so employers see value immediately instead of landing on demo-only views.
            </p>
          </div>
        </section>

        {(providers.recovering || findings.recovering || storylines.recovering || actions.recovering || valueSignalsLoading) ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Refreshing live employer intelligence…
          </div>
        ) : null}


      </div>
    </main>
  );
}
