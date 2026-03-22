'use client';

import { StartClinicianAction } from '@/components/employer/StartClinicianAction';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import { useActions } from '@/hooks/useActions';
import { useFindings } from '@/hooks/useFindings';
import { useStorylines } from '@/hooks/useStorylines';
import type {
  IntelligenceAction,
  IntelligenceFinding,
  IntelligenceRecommendationPreview,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

type AppStatus = 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';

interface LiveApplication {
  id: string;
  opportunityId: string;
  clerkUserId: string;
  npi: string | null;
  coverNote: string | null;
  status: AppStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  provider: {
    npi: string | null;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
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
  latestRecommendation: IntelligenceRecommendationPreview | null;
  timeline: Array<{
    stage: 'applied' | 'verified' | 'reviewed' | 'escalated' | 'accepted';
    occurredAt: string | null;
    description: string;
  }>;
  systemBehavesAutonomously: boolean;
  opportunity?: {
    id: string;
    organizationId: string;
    organizationName: string | null;
    title: string;
    specialty: string;
    state: string;
    hiringType: string;
    payRange: string | null;
    status: string;
  };
}

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING: { label: 'Pending Review', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  REVIEWED: { label: 'Reviewed', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400' },
  ACCEPTED: { label: 'Accepted', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  DECLINED: { label: 'Declined', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-white/25', bg: 'bg-white/4 border-white/8', dot: 'bg-white/25' },
};

function StatusPill({ status }: { status: AppStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timelineStageLabel(stage: LiveApplication['timeline'][number]['stage']) {
  switch (stage) {
    case 'applied':
      return 'Applied';
    case 'verified':
      return 'Verified';
    case 'reviewed':
      return 'Reviewed';
    case 'escalated':
      return 'Escalated';
    case 'accepted':
      return 'Accepted';
    default:
      return stage;
  }
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/3">
        <FileText className="h-6 w-6 text-white/20" />
      </div>
      <p className="mb-1 font-medium text-white/40">No applications yet</p>
      <p className="max-w-xs text-sm text-white/20">
        When clinicians apply to your live opportunities, they&apos;ll appear here for review.
      </p>
      <Link
        href="/verifier/opportunities"
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-5 py-2.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white/80"
      >
        Post an opportunity <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function IntelligenceList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string }>;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/30">{title}</p>
      {items.length > 0 ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-1 text-xs text-white/35">{item.meta}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/30">{empty}</p>
      )}
    </div>
  );
}

function ApplicationDetail({
  app,
  reviewing,
  mutating,
  actionError,
  findings,
  storylines,
  actions,
  onReview,
  onReviewProvider,
  onVerifyCredential,
  onEscalate,
}: {
  app: LiveApplication;
  reviewing: boolean;
  mutating: boolean;
  actionError: string | null;
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  actions: IntelligenceAction[];
  onReview: (status: 'ACCEPTED' | 'DECLINED', note?: string) => void;
  onReviewProvider: (note?: string) => void;
  onVerifyCredential: () => void;
  onEscalate: () => void;
}) {
  const [note, setNote] = useState('');
  const providerLabel = app.provider?.fullName ?? (app.provider?.npi ? `NPI ${app.provider.npi}` : 'Candidate');

  useEffect(() => {
    setNote(app.reviewNote ?? '');
  }, [app.id, app.reviewNote]);

  return (
    <motion.div
      key={app.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col"
    >
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
              <User className="h-3.5 w-3.5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Active Applicant</span>
            {app.readiness?.readinessLevel === 'L3' && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{providerLabel}</h2>
          <p className="mt-2 text-sm text-white/50 font-medium flex items-center gap-2">
            <span>{app.opportunity?.title ?? 'Unknown role'}</span>
            <span className="text-white/20">•</span>
            <span>{app.opportunity?.state ?? 'Unknown state'}</span>
            <span className="text-white/20">•</span>
            <span>{app.opportunity?.specialty ?? 'Unknown specialty'}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={app.status} />
          <div className="text-[10px] font-medium uppercase tracking-widest text-white/30">
            Applied {relativeTime(app.createdAt)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="col-span-1 rounded-2xl border border-emerald-500/20 bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.15),_transparent_60%)] p-5 shadow-[0_4px_24px_rgba(16,185,129,0.08)]">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">System Readiness</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold tracking-tighter text-white">
              {app.readiness ? app.readiness.readinessScore : 'N/A'}
            </p>
            {app.readiness && <p className="text-sm font-semibold text-emerald-400/80">/ 100</p>}
          </div>
          <p className="mt-2 text-sm font-medium text-emerald-100/70">
            {app.readiness
              ? `${app.readiness.readinessLevel} · ${app.readiness.readinessStatus}`
              : 'Readiness is not yet available for this clinician.'}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-white/8 bg-white/2 p-5 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Verification Breakdown</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Trust Signals</p>
              {app.readiness?.trustSignals?.length ? (
                <div className="space-y-2">
                  {app.readiness.trustSignals.slice(0, 3).map((signal) => (
                    <div key={signal} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70 mt-0.5 shrink-0" />
                      <p className="text-xs font-medium text-white/70 leading-relaxed">{signal}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/30 font-medium">No signals yet.</p>
              )}
            </div>
            
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Key Credentials</p>
              {app.readiness?.keyCredentials?.length ? (
                <div className="flex flex-wrap gap-2">
                  {app.readiness.keyCredentials.slice(0, 4).map((credential) => (
                    <span
                      key={credential}
                      className="rounded-md border border-white/10 bg-white/5 shadow-sm px-2.5 py-1 text-xs font-medium text-white/80"
                    >
                      {credential}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/30 font-medium">No credential summary available.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {app.latestRecommendation ? (
        <div className="mt-4 rounded-2xl border border-sky-500/20 bg-[radial-gradient(ellipse_at_top_left,_rgba(14,165,233,0.08),_transparent_70%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20">
                  <CheckCircle2 className="h-3 w-3 text-sky-400" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/90">Decision Engine Recommendation</p>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-xl font-bold text-white tracking-tight">
                  {app.latestRecommendation.label}
                </p>
                <p className="text-sm font-semibold text-sky-400/80">
                  {Math.round(app.latestRecommendation.confidence * 100)}% Confidence
                </p>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">
                {app.latestRecommendation.explanation}
              </p>
            </div>
            {app.systemBehavesAutonomously ? (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous Mode
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/5 pt-5">
            <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/70">
              Queue: <span className="text-white ml-1">{app.latestRecommendation.workflowEffects.queueDestination.replace(/_/g, ' ')}</span>
            </span>
            {app.latestRecommendation.workflowEffects.employerNotification ? (
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/70">
                Employer Notify
              </span>
            ) : null}
            {app.latestRecommendation.workflowEffects.clinicianRequest ? (
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/70">
                Clinician Request
              </span>
            ) : null}
            {app.latestRecommendation.workflowEffects.webhookQueued ? (
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/70">
                Webhook Queued
              </span>
            ) : null}
          </div>

          {app.latestRecommendation.workflowEffects.missingCredentials.length > 0 ? (
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <p className="text-xs font-semibold text-amber-500 mb-1">Missing Required Credentials</p>
              <p className="text-sm text-amber-200/80">
                {app.latestRecommendation.workflowEffects.missingCredentials.join(', ')}
              </p>
            </div>
          ) : null}

          {app.latestRecommendation.previewDecision ? (
            <div className="mt-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0" />
              <p className="text-[11px] font-semibold tracking-wide text-emerald-400/80">
                Acceptance Preview: {app.latestRecommendation.previewDecision.label} ({Math.round(app.latestRecommendation.previewDecision.confidence * 100)}% Confidence)
              </p>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0" />
            </div>
          ) : null}
        </div>
      ) : null}

      {app.timeline.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Provider timeline</p>
            <p className="text-xs text-white/25">{app.timeline.length} stages</p>
          </div>
          <div className="space-y-3">
            {app.timeline.map((event, index) => (
              <div key={`${event.stage}-${event.occurredAt ?? index}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  {index < app.timeline.length - 1 ? <span className="mt-2 h-full w-px bg-white/10" /> : null}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium text-white">{timelineStageLabel(event.stage)}</p>
                  <p className="mt-1 text-xs text-white/35">
                    {event.occurredAt ? relativeTime(event.occurredAt) : 'Pending'}
                  </p>
                  <p className="mt-1 text-sm text-white/55">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {app.coverNote ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/3 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">Cover note</p>
          <p className="text-sm leading-relaxed text-white/60">{app.coverNote}</p>
        </div>
      ) : null}

      <div className="mb-4 mt-4 flex items-center gap-4 text-xs text-white/25">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Applied {relativeTime(app.createdAt)}
        </span>
        {app.reviewedAt ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Reviewed {relativeTime(app.reviewedAt)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <IntelligenceList
          title="Findings"
          items={findings.slice(0, 2).map((finding) => ({
            id: finding.id,
            title: finding.title,
            meta: `${finding.severity} · ${finding.status}`,
          }))}
          empty="No active findings linked to this clinician."
        />
        <IntelligenceList
          title="Storylines"
          items={storylines.slice(0, 2).map((storyline) => ({
            id: storyline.id,
            title: storyline.title,
            meta: `${storyline.severity} · ${storyline.status}`,
          }))}
          empty="No active storylines linked to this clinician."
        />
        <IntelligenceList
          title="Actions"
          items={actions.slice(0, 2).map((action) => ({
            id: action.id,
            title: action.title,
            meta: `${action.priority} · ${action.status}`,
          }))}
          empty="No active action recommendations queued."
        />
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-white/8 bg-white/3 p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Employer Actions</p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional contextual note for the audit log…"
            rows={2}
            className="glue-input resize-none w-full text-sm bg-black/20"
          />
        </div>

        {actionError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            <p>{actionError}</p>
            <div className="mt-3">
              <SupportActionButton
                label="Contact support"
                title="Verifier application action failed"
                messagePrefill={actionError}
                className="inline-flex items-center justify-center rounded-xl border border-red-300/20 bg-red-500/5 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/10"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onReviewProvider(note)}
            disabled={reviewing || mutating || app.status === 'DECLINED'}
            className="rounded-xl border border-blue-500/30 bg-[linear-gradient(180deg,rgba(59,130,246,0.1),rgba(59,130,246,0.05))] px-5 py-3 text-sm font-bold text-blue-300 transition hover:bg-[rgba(59,130,246,0.15)] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            {mutating ? 'Processing…' : 'Review Provider'}
          </button>
          <button
            type="button"
            onClick={onVerifyCredential}
            disabled={reviewing || mutating}
            className="rounded-xl border border-emerald-500/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05))] px-5 py-3 text-sm font-bold text-emerald-300 transition hover:bg-[rgba(16,185,129,0.15)] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            Verify Credential
          </button>
          <button
            type="button"
            onClick={onEscalate}
            disabled={reviewing || mutating}
            className="rounded-xl border border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.1),rgba(245,158,11,0.05))] px-5 py-3 text-sm font-bold text-amber-300 transition hover:bg-[rgba(245,158,11,0.15)] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            Escalate To Team
          </button>
        </div>

        {app.status !== 'DECLINED' && app.status !== 'WITHDRAWN' ? (
          <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4 mt-2">
            <button
              type="button"
              onClick={() => onReview('ACCEPTED', note)}
              disabled={reviewing || mutating}
              className="group relative flex min-w-[160px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(180deg,#10b981,#059669)] px-6 py-3.5 text-sm font-bold tracking-wide text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-shimmer" />
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              Accept and Hire
            </button>
            <button
              type="button"
              onClick={() => onReview('DECLINED', note)}
              disabled={reviewing || mutating}
              className="flex min-w-[140px] items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-3.5 text-sm font-bold tracking-wide text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Reject Queue
            </button>
          </div>
        ) : null}
      </div>


      {app.status === 'ACCEPTED' && (app.provider?.npi ?? app.npi) ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-semibold text-emerald-300">
            Application accepted. Continue with the hiring and billing-backed start flow.
          </p>
          <div className="mt-4">
            <StartClinicianAction
              npi={app.provider?.npi ?? app.npi ?? ''}
              name={providerLabel}
              role={app.opportunity?.title ?? 'Clinician'}
              cleared
              employerId={app.employer.organizationId}
            />
          </div>
        </div>
      ) : app.status === 'ACCEPTED' ? (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          This application was accepted, but the clinician NPI is missing. Complete clinician onboarding before starting the hire/start flow.
        </div>
      ) : null}
    </motion.div>
  );
}

export default function VerifierInbox() {
  const [applications, setApplications] = useState<LiveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'ALL'>('ALL');

  useEffect(() => {
    fetch('/api/employer/applications', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then((data: LiveApplication[]) => {
        setApplications(data);
        if (data.length > 0) {
          setActiveId(data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (statusFilter !== 'ALL' && application.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystacks = [
        application.npi,
        application.provider?.fullName,
        application.opportunity?.title,
        application.opportunity?.specialty,
        application.employer?.name,
      ].filter((value): value is string => Boolean(value));

      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [applications, query, statusFilter]);

  const active = useMemo(
    () => filtered.find((application) => application.id === activeId) ?? filtered[0] ?? null,
    [activeId, filtered],
  );
  const activeProviderNpi = active?.provider?.npi ?? active?.npi ?? null;

  const actionsResource = useActions({
    entity: activeProviderNpi,
    limit: 3,
    paused: !activeProviderNpi,
  });
  const findingsResource = useFindings({
    provider: activeProviderNpi,
    limit: 3,
    paused: !activeProviderNpi,
  });
  const storylinesResource = useStorylines({
    provider: activeProviderNpi,
    limit: 3,
    paused: !activeProviderNpi,
  });

  const primaryAction = actionsResource.data?.actions[0] ?? null;
  const primaryFinding = findingsResource.data?.findings[0] ?? null;
  const primaryStoryline = storylinesResource.data?.storylines[0] ?? null;

  useEffect(() => {
    if (!active) {
      return;
    }

    void trackPilotEvent({
      eventType: 'application_detail_viewed',
      entity: {
        kind: 'application',
        id: active.id,
        label: active.opportunity?.title ?? active.id,
        objectType: 'application',
      },
      details: {
        opportunityId: active.opportunityId,
        status: active.status,
      },
      dedupeKey: `application-detail:${active.id}`,
    });
  }, [active]);

  async function refreshIntelligence() {
    await Promise.all([
      actionsResource.refresh(),
      findingsResource.refresh(),
      storylinesResource.refresh(),
    ]);
  }

  async function updateActionStatus(actionId: string, status: 'in_progress' | 'completed' | 'skipped', note: string) {
    const response = await fetch(`/api/actions/${encodeURIComponent(actionId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });

    if (!response.ok) {
      throw new Error('Action update failed.');
    }
  }

  async function updateFindingStatus(findingId: string, status: 'acknowledged' | 'resolved', note: string) {
    const response = await fetch(`/api/findings/${encodeURIComponent(findingId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });

    if (!response.ok) {
      throw new Error('Finding update failed.');
    }
  }

  async function postStorylineFeedback(storylineId: string, action: 'acknowledge' | 'escalate' | 'archive', note: string) {
    const response = await fetch(`/api/storylines/${encodeURIComponent(storylineId)}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });

    if (!response.ok) {
      throw new Error('Storyline update failed.');
    }
  }

  async function runApplicationSideEffects(status: 'REVIEWED' | 'ACCEPTED' | 'DECLINED') {
    if (status === 'REVIEWED') {
      if (primaryAction) {
        await updateActionStatus(primaryAction.id, 'in_progress', 'Employer reviewing provider.');
      }
      if (primaryStoryline) {
        await postStorylineFeedback(primaryStoryline.id, 'acknowledge', 'Employer reviewed provider.');
      }
      return;
    }

    if (status === 'ACCEPTED') {
      if (primaryAction) {
        await updateActionStatus(primaryAction.id, 'completed', 'Employer accepted the application.');
      }
      if (primaryFinding) {
        await updateFindingStatus(primaryFinding.id, 'resolved', 'Credential review completed during acceptance.');
      }
      if (primaryStoryline) {
        await postStorylineFeedback(primaryStoryline.id, 'acknowledge', 'Employer accepted the application.');
      }
      return;
    }

    if (primaryAction) {
      await updateActionStatus(primaryAction.id, 'skipped', 'Employer declined the application.');
    }
    if (primaryFinding) {
      await updateFindingStatus(primaryFinding.id, 'acknowledged', 'Employer reviewed finding during decline.');
    }
    if (primaryStoryline) {
      await postStorylineFeedback(primaryStoryline.id, 'archive', 'Employer declined the application.');
    }
  }

  async function handleReview(status: 'ACCEPTED' | 'DECLINED', note?: string) {
    if (!active) {
      return;
    }

    setReviewing(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/applications/${active.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNote: note }),
      });

      if (!response.ok) {
        throw new Error('Application update failed.');
      }

      const updated = await response.json() as LiveApplication;
      setApplications((current) => current.map((application) => (
        application.id === updated.id ? updated : application
      )));

      await runApplicationSideEffects(status);
      await refreshIntelligence();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the application.');
    } finally {
      setReviewing(false);
    }
  }

  async function handleReviewProvider(note?: string) {
    if (!active) {
      return;
    }

    setMutating(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/applications/${active.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REVIEWED',
          reviewNote: note?.trim() || 'Employer reviewed provider details.',
        }),
      });

      if (!response.ok) {
        throw new Error('Review update failed.');
      }

      const updated = await response.json() as LiveApplication;
      setApplications((current) => current.map((application) => (
        application.id === updated.id ? updated : application
      )));

      await runApplicationSideEffects('REVIEWED');
      await refreshIntelligence();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to mark the provider as reviewed.');
    } finally {
      setMutating(false);
    }
  }

  async function handleVerifyCredential() {
    setMutating(true);
    setActionError(null);

    try {
      if (!primaryFinding) {
        throw new Error('No linked finding is available to verify.');
      }

      await updateFindingStatus(primaryFinding.id, 'resolved', 'Employer verified credential.');
      if (primaryAction) {
        await updateActionStatus(primaryAction.id, 'completed', 'Credential verification completed.');
      }
      await refreshIntelligence();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to verify the credential.');
    } finally {
      setMutating(false);
    }
  }

  async function handleEscalate() {
    setMutating(true);
    setActionError(null);

    try {
      if (!primaryStoryline) {
        throw new Error('No linked storyline is available to escalate.');
      }

      await postStorylineFeedback(primaryStoryline.id, 'escalate', 'Employer escalated candidate review.');
      if (primaryAction) {
        await updateActionStatus(primaryAction.id, 'in_progress', 'Employer escalated candidate review.');
      }
      await refreshIntelligence();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to escalate the candidate.');
    } finally {
      setMutating(false);
    }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: applications.length };
    applications.forEach((application) => {
      result[application.status] = (result[application.status] || 0) + 1;
    });
    return result;
  }, [applications]);

  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">Employer</p>
            <h1 className="heading-lg text-white">Incoming Applications</h1>
            <p className="mt-1 text-white/40">
              Review providers, verify credentials, escalate concerns, and move accepted clinicians into hire/start.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/verifier/opportunities"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white/80"
            >
              Post opportunity
            </Link>
            <Link
              href="/verifier/home"
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Employer dashboard
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(['ALL', 'PENDING', 'REVIEWED', 'ACCEPTED', 'DECLINED'] as const).map((status) => {
            const cfg = status !== 'ALL' ? STATUS_CONFIG[status] : null;
            const isActive = statusFilter === status;
            const count = counts[status] || 0;

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? status === 'ALL'
                      ? 'border-white/20 bg-white/8 text-white'
                      : `${cfg?.bg} ${cfg?.color}`
                    : 'border-white/8 text-white/30 hover:text-white/50'
                }`}
              >
                {status === 'ALL' ? 'All' : STATUS_CONFIG[status].label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-white/20" />
          </div>
        ) : applications.length === 0 ? (
          <EmptyInbox />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/2">
              <div className="border-b border-white/6 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search candidate, role, specialty…"
                    className="glue-input py-2.5 pl-9 pr-4 text-sm"
                  />
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-white/25">
                    No applications match your filters.
                  </div>
                ) : (
                  filtered.map((application) => {
                    const cfg = STATUS_CONFIG[application.status];
                    const isActive = application.id === activeId;
                    const providerLabel = application.provider?.fullName
                      ?? (application.provider?.npi ? `NPI ${application.provider.npi}` : 'Candidate');

                    return (
                      <button
                        key={application.id}
                        onClick={() => setActiveId(application.id)}
                        className={`w-full border-b border-white/4 p-4 text-left transition-all ${
                          isActive ? 'bg-white/6' : 'hover:bg-white/3'
                        }`}
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-white">{providerLabel}</span>
                          <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                        </div>
                        <p className="mb-1 text-xs text-white/40">
                          {application.readiness
                            ? `${application.readiness.readinessLevel} · ${application.readiness.readinessScore}/100`
                            : 'Readiness unavailable'}
                        </p>
                        <p className="truncate text-xs text-white/40">
                          {application.opportunity?.title || 'Unknown role'} · {application.opportunity?.specialty}
                        </p>
                        {application.latestRecommendation ? (
                          <p className="mt-1 truncate text-[11px] text-sky-200/80">
                            {application.latestRecommendation.label} · {Math.round(application.latestRecommendation.confidence * 100)}%
                          </p>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                          <div className="flex items-center gap-2">
                            {application.systemBehavesAutonomously ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                                Auto
                              </span>
                            ) : null}
                            <span className="text-[10px] text-white/20">{relativeTime(application.createdAt)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="min-h-[400px] rounded-2xl border border-white/8 bg-white/2 p-6">
              <AnimatePresence mode="wait">
                {active ? (
                  <ApplicationDetail
                    key={active.id}
                    app={active}
                    reviewing={reviewing}
                    mutating={mutating}
                    actionError={actionError}
                    findings={findingsResource.data?.findings ?? []}
                    storylines={storylinesResource.data?.storylines ?? []}
                    actions={actionsResource.data?.actions ?? []}
                    onReview={handleReview}
                    onReviewProvider={handleReviewProvider}
                    onVerifyCredential={handleVerifyCredential}
                    onEscalate={handleEscalate}
                  />
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex h-full flex-col items-center justify-center py-16 text-center"
                  >
                    <User className="mb-3 h-8 w-8 text-white/10" />
                    <p className="text-sm text-white/25">Select an application to review</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {(actionsResource.error || findingsResource.error || storylinesResource.error) ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Supporting intelligence is partially unavailable. Application review still works.</p>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
