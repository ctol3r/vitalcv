'use client';

/**
 * ReviewClient.tsx — Employer decision surface
 *
 * THE DECISION SURFACE. One screen. Can you hire this person?
 *
 * Layout (spec-exact):
 *   Header         — VitalCV + "Employer review"
 *   DecisionCard   — Name, specialty, READY/PARTIAL/BLOCKED, start estimate, confidence
 *   ReadinessBreak — Identity / Authority / Standing / Enrollment rows
 *   ProofPanel     — accordion: each credential with source + timestamp + status
 *   ActionPanel    — Accept / Request missing / Save
 *   ShareContext   — if accessed via share link, shows who shared + when
 *
 * UX rules:
 *   - Decision first, proof collapsible
 *   - < 10 seconds to decide
 *   - No tabs, no sidebars, no clutter
 *   - Status via opacity only (doctrine)
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRoleContext } from '@/components/auth/RoleContext';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import {
  buildPassportProofSections,
} from '@/components/trust/passportProofSections';
import { EvidenceDisclosureCard } from '@/components/trust/EvidenceDisclosureCard';
import { PassportSourceCoveragePanel } from '@/components/trust/PassportSourceCoveragePanel';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { TrustLabel, type TrustStatus } from '@/components/ui/trust-label';
import type { PassportData } from '@/lib/trust/passport-contract';
import { EmployerAdvisoryPanel } from '@/components/advisory/AdvisoryPanel';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import {
  CLERK_PROVIDER_ENABLED,
  CLERK_SIGN_IN_URL,
} from '@/lib/auth/clerkConfig';
import {
  formatAsOfDate,
  formatAsOfQuarter,
  formatProofDate,
  joinNoteParts,
  type PassportFreshnessEntry,
} from '@/lib/trust/proof-language';
import {
  resolveLivePathAuthState,
  resolveLivePathErrorMessage,
  resolveLivePathReadinessStatus,
} from '@/lib/live-path/contracts';
import {
  employerReviewLoadingLabel,
  formatEmployerReviewPersistedDetail,
  formatEmployerReviewPersistedLabel,
  type EmployerReviewActionIntent,
  type EmployerReviewActionResponse,
  type EmployerReviewActionState,
  type EmployerReviewStatusResponse,
} from '@/lib/employer-review-actions';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import {
  buildPassportReviewTruthModel,
  resolvePassportTruthSet,
  type PassportTruthListItem,
} from '@/lib/trust/passport-review-truth';
import {
  buildPassportEntityHref,
  resolvePublicWedgeSurfaceStateFromAccordionStatus,
  resolvePublicWedgeSurfaceStateFromTruth,
} from '@/lib/trust/public-wedge-parity';
import {
  resolveAuthorityAccordionStatus,
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
  resolveAuthorityStatusLead,
  resolveAuthorityTitle,
} from '@/lib/trust/passport-truth';
import type { CanonicalTruthSet } from '../../../../packages/trust-state';

function latestCredentialObservationDate(
  credentials: PassportData['authority']['credentials'],
): string | null {
  const values = credentials
    .map((credential) => credential.observedAt ?? credential.verifiedAt ?? null)
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) return null;

  return values.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function buildTruthStatusLabelRow(input: {
  truth: CanonicalTruthSet[keyof CanonicalTruthSet];
  label: string;
  confirmedExplanation: string;
  confirmedNote?: string;
  missingExplanation: string;
}): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  const status = resolvePublicWedgeSurfaceStateFromTruth(input.truth);

  switch (status) {
    case 'checked':
      return {
        status,
        label: input.label,
        note: input.confirmedNote,
        explanation: input.confirmedExplanation,
      };
    case 'review_required':
      return {
        status,
        label: input.label,
        note: joinNoteParts(['Review required', 'requires verification']),
        explanation: input.truth.coverage.reason || input.missingExplanation,
      };
    case 'access_required':
      return {
        status,
        label: input.label,
        note: joinNoteParts(['Access required', 'requires verification']),
        explanation: input.truth.coverage.reason || input.missingExplanation,
      };
    case 'unavailable':
      return {
        status,
        label: input.label,
        note: joinNoteParts(['Unavailable', 'requires verification']),
        explanation: input.truth.coverage.reason || input.missingExplanation,
      };
    case 'preview_only':
      return {
        status,
        label: input.label,
        note: joinNoteParts(['Preview only', 'context only']),
        explanation: input.truth.coverage.reason || input.missingExplanation,
      };
    case 'stale':
      return {
        status,
        label: input.label,
        note: joinNoteParts(['Stale', 'requires verification']),
        explanation: input.truth.coverage.reason || input.missingExplanation,
      };
    case 'pending':
    default:
      return {
        status: 'pending',
        label: input.label,
        note: joinNoteParts(['Pending', 'requires verification']),
        explanation: input.truth.coverage.reason || input.missingExplanation,
      };
  }
}

function buildSafetyRow(passport: PassportData): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  const { standing } = passport;
  const truth = resolvePassportTruthSet(passport);
  // MS16-E: note contract — checkedAt · dataFreshness · confidenceLabel (· action-flag)
  const checkedNote = formatAsOfDate(standing.exclusionCheckedAt);
  const confidence  = standing.exclusionConfidenceLabel ?? null;

  switch (standing.exclusionStatus) {
    case 'POSSIBLE_MATCH':
      return {
        status: 'review_required',
        label: 'Exclusion check',
        note: joinNoteParts(['Review required', checkedNote, confidence, 'requires verification']),
        explanation: 'A potential OIG match needs manual adjudication before the employer can rely on this safety layer.',
      };
    case 'EXCLUDED':
      return {
        status: 'blocked',
        label: 'Exclusion check',
        note: joinNoteParts(['Blocked', checkedNote, confidence, 'requires verification']),
        explanation: 'An exclusion record is attached to this provider. Employment should not proceed until it is resolved.',
      };
    case 'CLEAR':
    case 'UNKNOWN':
    case 'UNCHECKED':
    default:
      return buildTruthStatusLabelRow({
        truth: truth.safety,
        label: 'Exclusion check',
        confirmedNote: joinNoteParts(['Clear', checkedNote, confidence]),
        confirmedExplanation: 'No exclusion entry was found in the current OIG LEIE check.',
        missingExplanation: 'No current OIG exclusion check is attached to this review.',
      });
  }
}

function buildAuthorityRow(credential: PassportData['authority']['credentials'][0]): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation?: string;
} {
  const status = resolvePublicWedgeSurfaceStateFromAccordionStatus(
    resolveAuthorityAccordionStatus(credential),
  );

  // MS16-E: note carries dataFreshness + confidenceLabel (row contract)
  const note = joinNoteParts([
    resolveAuthorityStatusLead(credential),
    formatAsOfDate(credential.observedAt ?? credential.verifiedAt),
    credential.dataFreshnessLabel ?? null,
    credential.claimConfidenceLabel ?? null,
    status !== 'checked' ? 'requires verification' : null,
  ]);

  return {
    status,
    label: resolveAuthorityTitle(credential),
    note,
    explanation: resolveAuthorityNote(credential) ?? undefined,
  };
}

function buildEligibilityRow(passport: PassportData, status: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' | 'OPTED_OUT'): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  const { standing } = passport;
  const truth = resolvePassportTruthSet(passport);
  const quarterNote  = formatAsOfQuarter(standing.enrollmentObservedAt, standing.enrollmentDataVersion);
  // MS16-E: note contract — dataFreshness · confidenceLabel · checkedAt (· action-flag)
  const freshness    = standing.enrollmentFreshnessLabel ?? standing.enrollmentDataFreshness ?? null;
  const confidence   = standing.enrollmentConfidenceLabel ?? null;

  switch (status) {
    case 'NOT_FOUND':
      return {
        status: 'review_required',
        label: 'Medicare enrollment',
        // MS16-A explicit label: "Not found in CMS enrollment data — may indicate not enrolled or data lag"
        note: joinNoteParts(['Review required', freshness, confidence, quarterNote, 'estimated quarterly publication lag possible', 'requires verification']),
        explanation:
          standing.enrollmentNote
          ?? 'Not finding a record may indicate non-enrollment or a quarterly CMS publication lag. Verify at pecos.cms.hhs.gov before relying on this layer.',
      };
    case 'ENROLLED':
    case 'UNKNOWN':
    case 'UNCHECKED':
    default:
      return buildTruthStatusLabelRow({
        truth: truth.eligibility,
        label: 'Medicare enrollment',
        confirmedNote: joinNoteParts(['Enrolled', freshness, confidence, quarterNote]),
        confirmedExplanation:
          standing.enrollmentNote ?? 'CMS PECOS confirms an enrolled provider record in the current quarterly release.',
        missingExplanation: 'No CMS PECOS lookup has been performed yet. Enrollment eligibility is unknown.',
      });
  }
}

// ── Main review component ──────────────────────────────────────────────────────

interface Props {
  passport:   PassportData;
  contextId?: string;
  sharedBy?:  string;
}

// ── M2: Freshness helpers ──────────────────────────────────────────────────

function FreshnessPanel({ entries }: { entries: PassportFreshnessEntry[] }) {
  const hasWarning = entries.some(e => e.stale || e.unchecked);
  if (!hasWarning) return null;

  return (
    <Card className="gap-3 rounded-2xl border-[var(--vt-badge-warning-border)] bg-[var(--vt-surface-2)] px-4 py-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vt-badge-warning-text)]">
          Source freshness
        </p>
        <TrustStatusBadge status="stale" label="Refresh recommended" size="sm" />
      </div>
      {entries.map(e => (
        <div key={e.layer} className="flex items-start justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 shrink-0 text-[10px] text-[var(--vt-text-3)]">
              {e.stale ? '⚠' : e.unchecked ? '○' : '✔'}
            </span>
            <span className={`text-xs ${e.stale || e.unchecked ? 'text-[var(--vt-text-1)]' : 'text-[var(--vt-text-2)]'}`}>
              {e.layer}
            </span>
          </div>
          <span className="shrink-0 text-right text-[10px] text-[var(--vt-text-3)]">
            {e.stale
              ? `stale — ${e.checkedAt ? new Date(e.checkedAt).toLocaleDateString() : 'date unknown'}`
              : e.unchecked
                ? e.stateLabel ?? 'Unavailable'
                : e.checkedAt
                  ? new Date(e.checkedAt).toLocaleDateString()
                  : 'unknown'}
          </span>
        </div>
      ))}
    </Card>
  );
}

function ReviewTruthBucket({
  title,
  items,
  icon,
  accentClassName,
  emptyLabel,
}: {
  title: string;
  items: PassportTruthListItem[];
  icon: string;
  accentClassName: string;
  emptyLabel?: string;
}) {
  if (items.length === 0 && !emptyLabel) return null;

  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] uppercase tracking-[0.15em] ${accentClassName}`}>
        {title}
      </p>
      {items.length > 0 ? (
        items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-xs">
            <span className={`w-3 shrink-0 text-center ${accentClassName}`} aria-hidden>
              {icon}
            </span>
            <div>
              <p className="text-white/62">{item.label}</p>
              {item.detail && (
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/28">
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="w-3 shrink-0 text-center text-white/20" aria-hidden>
            {icon}
          </span>
          <span>{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── M2: Action state type ──────────────────────────────────────────────────

type ActionState =
  | { phase: 'idle' }
  | { phase: 'loading'; intent: EmployerReviewActionIntent }
  | { phase: 'done'; state: EmployerReviewActionState }
  | { phase: 'error'; intent: EmployerReviewActionIntent; message: string }
  | { phase: 'downloading' };

type EmployerActionEndpoint = 'accept' | 'request-refresh' | 'route-to-review';

// ── M2: API call helpers ───────────────────────────────────────────────────

const API = '';

async function postAction(
  entityId: string,
  endpoint: 'accept' | 'request-refresh' | 'route-to-review',
  body?: Record<string, unknown>,
): Promise<EmployerReviewActionResponse> {
  const res = await fetch(`${API}/api/employer-review/${entityId}/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    throw new Error(err.error_description ?? `Action failed (${res.status})`);
  }
  return res.json() as Promise<EmployerReviewActionResponse>;
}

async function getPersistedActionState(entityId: string): Promise<EmployerReviewActionState | null> {
  const res = await fetch(`${API}/api/employer-review/${entityId}/status`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    throw new Error(err.error_description ?? `Status lookup failed (${res.status})`);
  }

  const payload = await res.json() as EmployerReviewStatusResponse;
  return payload.state ?? null;
}

export default function ReviewClient({ passport, contextId, sharedBy }: Props) {
  const [actionState, setActionState] = useState<ActionState>({ phase: 'idle' });
  const [persistedActionState, setPersistedActionState] = useState<EmployerReviewActionState | null>(null);
  const { isLoaded, isSignedIn, isEmployer } = useRoleContext();
  const mountedRef = useRef(true);
  const actionInFlightRef = useRef(false);
  const reviewOpenedTrackedRef = useRef(false);

  const { identity, readiness, standing, authority } = passport;
  const truth = resolvePassportTruthSet(passport);
  const readinessStatus = resolveLivePathReadinessStatus(readiness.status);
  const pecosEnrollmentStatus: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' | 'OPTED_OUT' =
    standing.pecosEnrollmentStatus ?? (
      standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
      standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
    );
  const latestAuthorityObservationAt = latestCredentialObservationDate(authority.credentials);

  const missingDomains    = authority.summary.missing;
  const blocked = Array.from(new Set([
    ...readiness.blockers,
    ...missingDomains.map((domain) => domain.replace(/_/g, ' ').toLowerCase()),
  ]));
  const reviewTruth = buildPassportReviewTruthModel(passport);
  const proofItems = buildPassportProofSections(passport);
  const proofSummary = reviewTruth.proofSummary;
  const identityStatus = resolvePublicWedgeSurfaceStateFromTruth(truth.identity);
  const safetyRow = buildSafetyRow(passport);
  const eligibilityRow = buildEligibilityRow(passport, pecosEnrollmentStatus);
  const lastSyncedAt =
    passport.lastCheckedAt
    ?? standing.exclusionCheckedAt
    ?? latestAuthorityObservationAt
    ?? standing.enrollmentObservedAt
    ?? null;
  const previewOnlyMessage =
    !CLERK_PROVIDER_ENABLED
      ? 'Preview only. Authentication is unavailable in this environment, so employer actions are intentionally disabled.'
      : !isLoaded
        ? 'Checking employer session before enabling actions.'
        : !isSignedIn
          ? 'Preview only. Sign in with an employer workspace to persist decisions.'
          : !isEmployer
            ? 'Preview only. Switch into an employer workspace to persist decisions.'
            : null;
  const canPersistActions = previewOnlyMessage === null;
  const authState = resolveLivePathAuthState({ isLoaded, isSignedIn, isEmployer });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      actionInFlightRef.current = false;
    };
  }, []);

  const freshnessEntries = reviewTruth.freshness.entries;
  const freshnessState = reviewTruth.freshness.label;

  useEffect(() => {
    if (reviewOpenedTrackedRef.current || (CLERK_PROVIDER_ENABLED && !isLoaded)) return;

    trackUxEvent({
      event_name: 'review_opened',
      component_id: 'employer_review_surface',
      metadata: {
        auth_state: authState,
        blockers_count: blocked.length,
        interaction_result: canPersistActions ? 'ready' : 'preview_only',
        shared_context: Boolean(sharedBy || contextId),
        source_mode: 'live',
      },
    });

    reviewOpenedTrackedRef.current = true;
  }, [authState, blocked.length, canPersistActions, contextId, isLoaded, sharedBy]);

  useEffect(() => {
    if (!canPersistActions) {
      if (mountedRef.current) {
        setPersistedActionState(null);
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const state = await getPersistedActionState(passport.entityId);
        if (!cancelled && mountedRef.current) {
          setPersistedActionState(state);
        }
      } catch {
        if (!cancelled && mountedRef.current) {
          setPersistedActionState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canPersistActions, passport.entityId]);

  function trackEmployerActionClicked(action: EmployerReviewActionIntent) {
    trackUxEvent({
      event_name: UX_EVENTS.EMPLOYER_ACTION_CLICKED,
      component_id: 'employer_review_actions',
      metadata: {
        action,
        auth_state: authState,
        interaction_result: canPersistActions ? 'started' : 'blocked',
        source_mode: 'live',
      },
    });
  }

  function trackEmployerActionResult(
    action: EmployerReviewActionIntent,
    result: 'success' | 'error',
    startedAt: number,
    errorMessage?: string,
  ) {
    trackUxEvent({
      event_name: 'employer_action_result',
      component_id: 'employer_review_actions',
      duration_ms: performance.now() - startedAt,
      metadata: {
        action,
        auth_state: authState,
        blockers_count: blocked.length,
        error_message: errorMessage ?? null,
        interaction_result: result,
        source_mode: 'live',
      },
    });
  }

  async function runEmployerAction(config: {
    intent: EmployerReviewActionIntent;
    endpoint: EmployerActionEndpoint;
    body: Record<string, unknown>;
  }) {
    if (!canPersistActions || actionInFlightRef.current) return;

    actionInFlightRef.current = true;
    const startedAt = performance.now();
    trackEmployerActionClicked(config.intent);
    if (mountedRef.current) {
      setActionState({ phase: 'loading', intent: config.intent });
    }

    try {
      const result = await postAction(passport.entityId, config.endpoint, config.body);
      if (!mountedRef.current) return;

      setPersistedActionState(result.state);
      setActionState({
        phase: 'done',
        state: result.state,
      });
      trackEmployerActionResult(config.intent, 'success', startedAt);
    } catch (error) {
      const message = resolveLivePathErrorMessage(error, 'Action failed');
      if (!mountedRef.current) return;

      setActionState({ phase: 'error', intent: config.intent, message });
      trackEmployerActionResult(config.intent, 'error', startedAt, message);
    } finally {
      actionInFlightRef.current = false;
    }
  }

  async function handleAccept() {
    await runEmployerAction({
      intent: 'accept',
      endpoint: 'accept',
      body: {},
    });
  }

  async function handleRequestRefresh() {
    await runEmployerAction({
      intent: 'refresh',
      endpoint: 'request-refresh',
      body: {
        staleSources: freshnessEntries
          .filter((entry) => entry.stale || entry.unchecked)
          .map((entry) => entry.source),
        missingDomains: authority.summary.missing,
      },
    });
  }

  async function handleRouteToReview() {
    await runEmployerAction({
      intent: 'review',
      endpoint: 'route-to-review',
      body: {
        reason: blocked.length > 0
          ? `Employer routed to review. Blockers: ${blocked.slice(0, 3).join(', ')}`
          : 'Employer routed for manual review.',
        priority: blocked.length > 0 ? 'HIGH' : 'NORMAL',
      },
    });
  }

  async function handleDownloadPacket() {
    if (!canPersistActions || actionInFlightRef.current) return;
    if (mountedRef.current) {
      setActionState({ phase: 'downloading' });
    }
    try {
      const res = await fetch(`${API}/api/employer-review/${passport.entityId}/packet`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const npi  = passport.identity.npi ?? passport.entityId;
      a.download = `vitalcv-passport-${npi}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* download failure is non-fatal */ }
    if (mountedRef.current) {
      setActionState({ phase: 'idle' });
    }
  }

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-10 sm:pt-16 pb-28">
      <div className="w-full max-w-3xl space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-white/25 text-xs tracking-widest uppercase">VitalCV</span>
          <span className="text-white/25 text-xs">Employer review</span>
        </div>

        {/* ── Share context (if accessed via share link) ───────────────────── */}
        {(sharedBy || contextId) && (
          <Card className="gap-2 rounded-xl border-white/8 bg-white/[0.03] px-4 py-3 shadow-none">
            {sharedBy && (
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Shared by</span>
                <span className="text-white/55">{sharedBy}</span>
              </div>
            )}
            <div className={`flex justify-between text-xs ${sharedBy ? 'mt-1' : ''}`}>
              <span className="text-white/35">Purpose</span>
              <span className="text-white/55">Employment review</span>
            </div>
            {contextId && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-white/35">Review context</span>
                <span className="text-white/45 font-mono">{contextId.slice(0, 8)}…</span>
              </div>
            )}
          </Card>
        )}

        {/* ── Decision card — Exact Layout ──────────────────────────────── */}
        <SectionReveal delay={0}>
          <Card className="mb-6 gap-6 rounded-2xl border-white/8 bg-white/3 px-5 py-5 shadow-none">
          {/* Identity */}
          <div>
            <h1 className="text-white text-xl font-semibold leading-tight">
              {identity.displayName}
            </h1>
            {identity.specialty && (
              <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
            )}
            <div className="mt-3">
              <TrustStatusBadge status={readinessStatus} size="sm" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Readiness</p>
              <p className="mt-1 text-lg font-semibold text-white">{readiness.score}/100</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Trust band</p>
              <p className="mt-1 text-lg font-semibold text-white">{readiness.level}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Freshness</p>
              <p className="mt-1 text-sm font-medium text-white">{freshnessState}</p>
              <p className="mt-1 text-[11px] text-white/30">{formatProofDate(lastSyncedAt) ?? 'Not checked'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Proof completeness</p>
              <p className="mt-1 text-sm font-medium text-white">
                {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} attached
              </p>
              <p className="mt-1 text-[11px] text-white/30">
                {proofSummary.warningCount > 0 ? `${proofSummary.warningCount} review warning${proofSummary.warningCount === 1 ? '' : 's'}` : 'No review warnings'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Decision snapshot</p>
                <p className="mt-1 text-sm leading-relaxed text-white/56">
                  {blocked.length > 0
                    ? `Proceed only as a head start. ${blocked.length} blocker${blocked.length === 1 ? '' : 's'} still need review or refresh.`
                    : 'No visible blockers are attached to this review right now.'}
                </p>
              </div>
              <p className="text-xs text-white/34">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? '0 days' : `~${readiness.estimatedStartDays} days`}
              </p>
            </div>
          </div>

          {/* MS16-F: Employer 6-question flow — strict order */}
          <div className="pt-2 mt-4 space-y-6">
            {/* Q1: Who is this? */}
            <div className="space-y-2">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Identity</h2>
              <TrustLabel
                status={identityStatus}
                label={identityStatus === 'checked' ? 'Identity checked' : 'Identity'}
                source="CMS NPPES"
                note={
                  identityStatus === 'checked'
                    ? formatAsOfDate(truth.identity.coverage.checkedAt ?? passport.lastCheckedAt) ?? undefined
                    : joinNoteParts([
                        truth.identity.coverage.reason,
                        'requires verification',
                      ])
                }
                explanation={
                  identityStatus === 'checked'
                    ? 'Identity checked against the national provider registry.'
                    : truth.identity.coverage.reason || 'Identity must resolve to CMS NPPES before the rest of the trust stack can be relied on.'
                }
              />
            </div>

            <div className="border-t border-white/10 pt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold">Trust stack</h2>
                <span className="text-white/18 text-[11px] uppercase tracking-[0.18em]">Safety · Authority · Eligibility</span>
              </div>

              {/* Q2: Safe? */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Safety</h3>
                <TrustLabel
                  status={safetyRow.status}
                  label={safetyRow.label}
                  source="OIG LEIE"
                  timestamp={standing.exclusionCheckedAt ? `checked ${formatProofDate(standing.exclusionCheckedAt)}` : undefined}
                  note={safetyRow.note}
                  explanation={safetyRow.explanation}
                />
              </div>

              {/* Q3: Licensed? */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Authority</h3>
                {(() => {
                  const licCreds = authority.credentials.filter((credential) => credential.domain === 'LICENSURE');
                  const certCreds = authority.credentials.filter((credential) => credential.domain === 'BOARD_CERTIFICATION');
                  const hasAny = licCreds.length > 0 || certCreds.length > 0;

                  return (
                    <div className="space-y-2">
                      {licCreds.map((credential) => {
                        const row = buildAuthorityRow(credential);
                        return (
                          <TrustLabel
                            key={credential.id}
                            status={row.status}
                            label={row.label}
                            source={resolveAuthorityMethodLabel(credential)}
                            timestamp={credential.observedAt || credential.verifiedAt ? `checked ${formatProofDate(credential.observedAt ?? credential.verifiedAt)}` : undefined}
                            note={row.note}
                            explanation={row.explanation}
                          />
                        );
                      })}

                      {certCreds.map((credential) => (
                        <TrustLabel
                          key={credential.id}
                          status="checked"
                          label={`Board certified${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`}
                          source={credential.issuerName ?? credential.sourceId ?? 'ABMS'}
                          timestamp={credential.observedAt || credential.verifiedAt ? `checked ${formatProofDate(credential.observedAt ?? credential.verifiedAt)}` : undefined}
                          note={formatAsOfDate(credential.observedAt ?? credential.verifiedAt) ?? undefined}
                          explanation="Board certification is on file from the issuing authority."
                        />
                      ))}

                      {!hasAny && (
                        <TrustLabel
                          status="access_required"
                          label="Authority"
                          source="CA State Board / FSMB"
                          note="Access required · requires verification"
                          explanation="No source-backed authority record is attached yet. Only the CA physician licensure launch lane can become decision-grade in this release."
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Q4: Eligible? — MS16-B: 4-state canonical rendering */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Eligibility</h3>
                <TrustLabel
                  status={eligibilityRow.status}
                  label={eligibilityRow.label}
                  source={standing.enrollmentSourceLabel ?? 'CMS PECOS'}
                  timestamp={standing.enrollmentObservedAt ? `checked ${formatProofDate(standing.enrollmentObservedAt)}` : undefined}
                  note={eligibilityRow.note}
                  explanation={eligibilityRow.explanation}
                />
              </div>
            </div>

            {/* Q5: What blocks start? + Q6: What do I do? */}
            <div className="border-t border-white/10 pt-4 space-y-1 text-sm">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Readiness</h2>
              <p className="text-white/90 font-medium pb-1">{readiness.score}% ready</p>

              {/* Q5: Blockers */}
              {blocked.length > 0 && (
                <div className="space-y-1 pb-1">
                  {blocked.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-white/20 text-xs w-3 shrink-0 mt-0.5" aria-hidden>·</span>
                      <span className="text-white/50 text-xs">{b.charAt(0).toUpperCase() + b.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-white/50 pt-1">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? '0 days' : `~${readiness.estimatedStartDays} days`}
              </p>

              {/* Q6: What do I do? — sourced from readiness.nextActions[] */}
              {reviewTruth.buckets.nextActions.length > 0 && (
                <div className="pt-3 mt-1 border-t border-white/8 space-y-2">
                  <p className="text-white/25 text-[10px] uppercase tracking-widest">Next actions</p>
                  {reviewTruth.buckets.nextActions.slice(0, 4).map((action) => (
                    <div key={action.id} className="flex items-start gap-2">
                      <span className="text-white/15 text-xs w-3 shrink-0 mt-0.5">·</span>
                      <div>
                        <p className="text-white/55 text-xs font-medium">{action.label}</p>
                        <p className="text-white/30 text-xs mt-0.5 leading-relaxed">{action.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </Card>
        </SectionReveal>

        {/* ── Advisory Panel — gated, clearly labeled, below readiness ── */}
        <EmployerAdvisoryPanel passport={passport} />

        {/* ── M2: Freshness panel — above proof so stale warnings are visible before expanding ── */}
        <FreshnessPanel entries={freshnessEntries} />

        {/* ── Proof panel — collapsible ────────────────────────────────────── */}
        {proofItems.length > 0 && (
          <EvidenceDisclosureCard
            eyebrow="Proof"
            title="Source-backed evidence"
            description="Expand each section to see the trust-core proof, contextual notes, and decision-grade gaps attached to this review."
            action={(
              <Button
                onClick={handleDownloadPacket}
                disabled={!canPersistActions || actionState.phase === 'downloading'}
                variant="outline"
                title={
                  !canPersistActions
                    ? (previewOnlyMessage ?? 'Sign in with an employer workspace to export')
                    : undefined
                }
                className="h-9 rounded-xl border-white/10 px-4 py-2 text-[11px] font-medium text-white/45 hover:border-white/20 hover:text-white/70"
              >
                {actionState.phase === 'downloading' ? 'Exporting…' : 'Export passport proof'}
              </Button>
            )}
            className="rounded-2xl border-white/8 bg-white/[0.03]"
            contentClassName="px-5 py-1"
          >
            <Accordion
              items={proofItems}
              telemetryComponentId="employer_review_proof"
            />
          </EvidenceDisclosureCard>
        )}

        <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] px-4 py-4 shadow-none">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Last synced</p>
              <p className="mt-1 text-sm text-white/62">{formatProofDate(lastSyncedAt) ?? 'Not checked'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Freshness</p>
              <p className="mt-1 text-sm text-white/62">{freshnessState}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Proof completeness</p>
              <p className="mt-1 text-sm text-white/62">
                {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} sections attached
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Review warnings</p>
              <p className="mt-1 text-sm text-white/62">
                {blocked.length > 0 ? `${blocked.length} blocker${blocked.length === 1 ? '' : 's'}` : 'No blockers'}
              </p>
            </div>
          </div>
          {persistedActionState ? (
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">
                {formatEmployerReviewPersistedLabel(persistedActionState)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/36">
                {formatEmployerReviewPersistedDetail(persistedActionState)}
              </p>
            </div>
          ) : previewOnlyMessage ? (
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Preview only</p>
              <p className="mt-1 text-xs leading-relaxed text-white/48">
                {previewOnlyMessage}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-white/36">
              Employer actions below are real. VitalCV waits for the backend audit event before it renders success.
            </p>
          )}
        </Card>

        <PassportSourceCoveragePanel checks={reviewTruth.sourceCoverageChecks} />

        {/* ── Decision basis — what you're acting on (no assumptions) ──────── */}
        {(actionState.phase === 'idle' || actionState.phase === 'downloading') && (
          <SectionReveal delay={0.05}>
            <Card className="gap-3 rounded-2xl border-white/8 bg-white/3 px-5 py-4 shadow-none">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Passport truth in this review
            </p>

            <div className="rounded-lg border border-white/6 bg-white/2 px-3 py-2.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white/20 text-[10px] uppercase tracking-widest">
                    Trust posture
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-white/60">
                    {reviewTruth.posture.bandLabel}
                    <span className="ml-1 text-xs font-mono text-white/25">
                      {reviewTruth.posture.level}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-white/30">
                    {reviewTruth.posture.reliableLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/20 text-[10px] uppercase tracking-widest">Score</p>
                  <p className="text-lg font-semibold tabular-nums text-white/70">
                    {reviewTruth.posture.score}
                    <span className="text-xs text-white/25">/100</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-white/20">
                {reviewTruth.posture.disclaimer}
              </p>
            </div>

            <ReviewTruthBucket
              title="Source-backed now"
              items={reviewTruth.buckets.sourceBackedNow}
              icon="✓"
              accentClassName="text-emerald-400/60"
              emptyLabel="No source-backed Passport proof is attached yet."
            />

            {reviewTruth.buckets.contextualOnly.length > 0 && (
              <div className="border-t border-white/6 pt-2">
                <ReviewTruthBucket
                  title="Contextual only"
                  items={reviewTruth.buckets.contextualOnly}
                  icon="·"
                  accentClassName="text-sky-300/45"
                />
              </div>
            )}

            {reviewTruth.buckets.stale.length > 0 && (
              <div className="border-t border-white/6 pt-2">
                <ReviewTruthBucket
                  title="Stale"
                  items={reviewTruth.buckets.stale}
                  icon="⚠"
                  accentClassName="text-amber-400/60"
                />
              </div>
            )}

            {reviewTruth.buckets.needsReview.length > 0 && (
              <div className="border-t border-white/6 pt-2">
                <ReviewTruthBucket
                  title="Needs review"
                  items={reviewTruth.buckets.needsReview}
                  icon="!"
                  accentClassName="text-rose-400/60"
                />
              </div>
            )}

            <div className="border-t border-white/6 pt-2">
              <ReviewTruthBucket
                title="Missing or access required"
                items={reviewTruth.buckets.missingOrAccessRequired}
                icon="–"
                accentClassName="text-white/28"
                emptyLabel="No missing Passport proof sections are flagged right now."
              />
            </div>

            <div className="border-t border-white/6 pt-2">
              <ReviewTruthBucket
                title="Next action"
                items={reviewTruth.buckets.nextActions}
                icon="→"
                accentClassName="text-white/46"
                emptyLabel="No follow-up action is attached right now."
              />
            </div>

            {/* Active blockers callout */}
            {blocked.length > 0 && (
              <div className="pt-2 border-t border-white/6 flex items-start gap-2 bg-amber-500/6 rounded-xl px-3 py-2">
                <span className="text-amber-400/70 text-xs mt-0.5">⚠</span>
                <div>
                  <p className="text-amber-300/80 text-xs font-medium">
                    {blocked.length} active blocker{blocked.length === 1 ? '' : 's'} — you&apos;re accepting with known gaps
                  </p>
                  <p className="text-amber-400/50 text-[10px] mt-0.5">
                    "Accept as head start" records your decision and these blockers in the audit trail.
                  </p>
                </div>
              </div>
            )}
            </Card>
          </SectionReveal>
        )}

        {/* ── M2: Action panel — all actions write audit events ────────────── */}
        {actionState.phase === 'idle' || actionState.phase === 'downloading' ? (
          <SectionReveal delay={0.1}>
            <Card className="gap-4 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-5 shadow-none">
            {/* Primary — Accept as head start */}
            <Button
              onClick={handleAccept}
              disabled={!canPersistActions || actionState.phase === 'downloading'}
              variant="success"
              className="h-14 w-full rounded-xl text-sm font-medium"
            >
              {blocked.length > 0 ? `Accept as head start (${blocked.length} blocker${blocked.length === 1 ? '' : 's'} noted)` : 'Accept as head start'}
            </Button>

            {/* Secondary row */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleRequestRefresh}
                disabled={!canPersistActions || actionState.phase === 'downloading'}
                variant="outline"
                title={freshnessEntries.filter(e => e.stale || e.unchecked).length > 0
                  ? `${freshnessEntries.filter(e => e.stale || e.unchecked).length} stale source${freshnessEntries.filter(e => e.stale || e.unchecked).length === 1 ? '' : 's'} will be included`
                  : 'Request the clinician refresh their data'}
                className="min-h-[48px] rounded-xl border-white/10 bg-white/4 py-3.5 text-xs text-white/55 hover:border-white/20 hover:bg-white/8 hover:text-white/80"
              >
                {freshnessEntries.filter(e => e.stale || e.unchecked).length > 0
                  ? `Request refresh (${freshnessEntries.filter(e => e.stale || e.unchecked).length} stale)`
                  : 'Request refresh'}
              </Button>
              <Button
                onClick={handleRouteToReview}
                disabled={!canPersistActions || actionState.phase === 'downloading'}
                variant="outline"
                title="Route to your credentialing committee for manual review"
                className="min-h-[48px] rounded-xl border-white/10 bg-white/4 py-3.5 text-xs text-white/55 hover:border-white/20 hover:bg-white/8 hover:text-white/80"
              >
                Route to review
              </Button>
            </div>

            {!canPersistActions && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {CLERK_PROVIDER_ENABLED && isLoaded && !isSignedIn ? (
                  <Link
                    href={CLERK_SIGN_IN_URL}
                    className="text-xs text-white/38 transition-colors hover:text-white/58"
                  >
                    Sign in with employer workspace
                  </Link>
                ) : (
                  <Link
                    href={buildPassportEntityHref(passport.entityId)}
                    className="text-xs text-white/38 transition-colors hover:text-white/58"
                  >
                    Open full passport
                  </Link>
                )}
              </div>
            )}
            </Card>
          </SectionReveal>

        ) : actionState.phase === 'loading' ? (
          /* Loading state */
          <SectionReveal delay={0.1}>
            <TrustStateCard
              title={employerReviewLoadingLabel(actionState.intent)}
              description="Writing the persisted audit record..."
              centered
            />
          </SectionReveal>

        ) : actionState.phase === 'done' ? (
          /* Success — show audit event ID for verifiability */
          <SectionReveal delay={0.1}>
            <TrustStateCard
              title={actionState.state.summary.title}
              description={actionState.state.summary.description}
              tone="success"
              className="rounded-xl"
              actions={(
                <Button
                  onClick={() => setActionState({ phase: 'idle' })}
                  variant="ghost"
                  className="min-h-[44px] w-full text-xs text-white/25 hover:bg-transparent hover:text-white/40"
                >
                  Back
                </Button>
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--vt-success)] text-sm">✔</span>
                <p className="text-white/75 text-sm font-medium">Audit trail recorded</p>
              </div>
              {/* Audit event + trust snapshot at time of decision */}
              <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 mt-1 space-y-1.5">
                <p className="text-white/20 text-[10px] uppercase tracking-widest">Audit record</p>
                <p className="text-white/45 text-[10px] font-mono break-all">{actionState.state.auditEventId}</p>
                <p className="text-white/20 text-[10px]">{new Date(actionState.state.timestamp).toLocaleString()}</p>
                {(() => {
                  const snap = actionState.state.trustSnapshot;
                  if (!snap) return null;
                  return (
                    <div className="mt-2 pt-2 border-t border-white/6 space-y-1">
                      <p className="text-white/20 text-[10px] uppercase tracking-widest">Trust state recorded at decision</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span className="text-white/25 text-[10px]">Readiness</span>
                        <span className="text-white/50 text-[10px]">{snap.readinessStatus} · {snap.readinessScore}%</span>
                        <span className="text-white/25 text-[10px]">Trust band</span>
                        <span className="text-white/50 text-[10px]">{snap.trustBand} · {snap.trustBandLabel}</span>
                        <span className="text-white/25 text-[10px]">Blockers noted</span>
                        <span className="text-white/50 text-[10px]">{snap.blockerCount}</span>
                        <span className="text-white/25 text-[10px]">Exclusion</span>
                        <span className="text-white/50 text-[10px]">{snap.exclusionStatus}</span>
                      </div>
                      <p className="text-white/15 text-[10px] font-mono break-all mt-1">
                        receipt: {snap.snapshotHash?.slice(0, 16)}…
                      </p>
                    </div>
                  );
                })()}
              </div>
            </TrustStateCard>
          </SectionReveal>

        ) : /* error */ (
          <SectionReveal delay={0.1}>
            <TrustStateCard
              title="Action failed"
              description={actionState.message}
              tone="critical"
              actions={(
                <Button
                  onClick={() => setActionState({ phase: 'idle' })}
                  variant="ghost"
                  className="min-h-[44px] w-full text-xs text-white/25 hover:bg-transparent hover:text-white/40"
                >
                  Try again
                </Button>
              )}
            />
          </SectionReveal>
        )}

      </div>
    </main>
  );
}
