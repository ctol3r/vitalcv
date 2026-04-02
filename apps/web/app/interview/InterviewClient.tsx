'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PassportData } from '@/lib/trust/passport-contract';
import { useRoleContext } from '@/components/auth/RoleContext';
import {
  buildPassportProofSections,
  summarizePassportProofSections,
} from '@/components/trust/passportProofSections';
import { TimeToStartEstimateSummary } from '@/components/trust/TimeToStartEstimateSummary';
import { Accordion } from '@/components/ui/accordion';
import {
  CLERK_PROVIDER_ENABLED,
  CLERK_SIGN_IN_URL,
} from '@/lib/auth/clerkConfig';
import { resolvePassportTruthSet } from '@/lib/trust/passport-review-truth';
import {
  normalizeLivePathShareResponse,
  resolveLivePathAuthState,
  resolveLivePathErrorMessage,
  resolveLivePathReadinessStatus,
} from '@/lib/live-path/contracts';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import { VStatusPill } from '@/components/vds/primitives';
import {
  buildEmployerReviewHref,
  buildPassportEntityHref,
  resolvePublicWedgeSurfaceStateFromAccordionStatus,
  resolvePublicWedgeSurfaceStateFromTruth,
} from '@/lib/trust/public-wedge-parity';
import { resolveAuthorityAccordionStatus } from '@/lib/trust/passport-truth';
import { buildPassportPilotTimeToStartEstimate } from '@/lib/trust/time-to-start-estimate';

interface Props {
  entityId: string;
  passport: PassportData | null;
  contextId?: string;
}

type ShareState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; eventId: string; timestamp: string; status: string }
  | { phase: 'error'; message: string };

const SHARE_UNAVAILABLE_MESSAGE = 'Share is unavailable for this passport right now.';

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not checked';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not checked';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(value?: string | null): string {
  if (!value) return 'Not checked';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not checked';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildCheckedTags(passport: PassportData): string[] {
  const tags: string[] = [];
  const truth = resolvePassportTruthSet(passport);

  if (resolvePublicWedgeSurfaceStateFromTruth(truth.identity) === 'checked') {
    tags.push('Identity checked');
  }
  if (resolvePublicWedgeSurfaceStateFromTruth(truth.authority) === 'checked') {
    tags.push('Licensure checked');
  }
  if (passport.authority.credentials.some((credential) => (
    credential.domain === 'BOARD_CERTIFICATION'
    && resolvePublicWedgeSurfaceStateFromAccordionStatus(
      resolveAuthorityAccordionStatus(credential),
    ) === 'checked'
  ))) {
    tags.push('Board certification checked');
  }
  if (passport.authority.credentials.some((credential) => (
    credential.domain === 'DEA_REGISTRATION'
    && resolvePublicWedgeSurfaceStateFromAccordionStatus(
      resolveAuthorityAccordionStatus(credential),
    ) === 'checked'
  ))) {
    tags.push('DEA checked');
  }
  if (resolvePublicWedgeSurfaceStateFromTruth(truth.safety) === 'checked') {
    tags.push('Sanctions checked');
  }
  if (resolvePublicWedgeSurfaceStateFromTruth(truth.eligibility) === 'checked') {
    tags.push('Enrollment checked');
  }

  return dedupe(tags);
}

function buildMissingTags(passport: PassportData): string[] {
  return dedupe([
    ...passport.readiness.blockers.map((blocker) => blocker.replace(/_/g, ' ')),
    ...passport.authority.summary.missing.map((domain) => domain.replace(/_/g, ' ').toLowerCase()),
    ...passport.trustPosture.reviewRequiredItems,
    ...passport.trustPosture.gatedItems,
    ...passport.trustPosture.staleItems,
    ...passport.trustPosture.missingItems,
  ]).slice(0, 6);
}

function readinessProceedNote(passport: PassportData): string {
  switch (passport.readiness.status) {
    case 'READY':
      return 'This passport is strong enough for employer review and next-step hiring conversations right now.';
    case 'BLOCKED':
      return 'Use this passport for review context only. Employment decisions still need the blocking items resolved first.';
    case 'PARTIAL':
    default:
      return 'Identity and completed checks can travel with the passport, but missing domains stay visible until they are resolved.';
  }
}

export default function InterviewClient({ entityId, passport, contextId }: Props) {
  const [shareState, setShareState] = useState<ShareState>({ phase: 'idle' });
  const { isLoaded, isSignedIn } = useRoleContext();
  const authState = resolveLivePathAuthState({ isLoaded, isSignedIn });
  const mountedRef = useRef(true);
  const shareInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      shareInFlightRef.current = false;
    };
  }, []);

  if (!passport) {
    return (
      <div className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-white/40 text-sm">
            Could not load passport data for this provider.
          </p>
          <p className="text-white/25 text-xs">
            The data may still be ingesting. Try again in a moment.
          </p>
          <Link
            href="/passport"
            className="block w-full rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm py-3.5 text-center transition-colors"
          >
            Back to passport lookup
          </Link>
        </div>
      </div>
    );
  }

  const displayName = passport.identity.displayName ?? `NPI ${passport.identity.npi ?? passport.npi ?? entityId}`;
  const specialty = passport.identity.specialty ?? 'Healthcare Provider';
  const readinessStatus = resolveLivePathReadinessStatus(passport.readiness.status);
  const proofItems = buildPassportProofSections(passport);
  const proofSummary = summarizePassportProofSections(proofItems);
  const checkedTags = buildCheckedTags(passport);
  const missingTags = buildMissingTags(passport);
  const timeToStartEstimate = buildPassportPilotTimeToStartEstimate(passport);
  const hasShareContext = Boolean(contextId);
  const canShare = hasShareContext && isLoaded && isSignedIn;
  // Employer review is available for all readiness states — BLOCKED passports still
  // need to be reviewable so employers can see blockers and route-to-review decisions.
  const canOpenEmployerReview = Boolean(passport.entityId);
  const proofHref = passport.identity.npi
    ? `/api/trust-proof/${encodeURIComponent(passport.identity.npi)}?format=pdf`
    : null;
  const reviewHref = buildEmployerReviewHref(passport.entityId, {
    contextId,
    from: displayName,
  });

  async function handleShare() {
    if (!contextId || !canShare || shareInFlightRef.current) {
      return;
    }

    shareInFlightRef.current = true;
    const startedAt = performance.now();
    trackUxEvent({
      event_name: 'share_click',
      component_id: 'interview_share_packet',
      metadata: {
        auth_state: authState,
        interaction_result: 'started',
        source_mode: 'live',
      },
    });

    if (mountedRef.current) {
      setShareState({ phase: 'loading' });
    }

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          organizationContextId: contextId,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        shareEventId?: string;
        eventId?: string;
        status?: string;
        timestamp?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sign in to share this passport.');
        }
        if (response.status === 404) {
          throw new Error('The employer review context is no longer available.');
        }
        throw new Error(payload.error ?? SHARE_UNAVAILABLE_MESSAGE);
      }

      if (!mountedRef.current) return;

      setShareState({
        phase: 'success',
        ...normalizeLivePathShareResponse(payload),
      });
      trackUxEvent({
        event_name: 'share_success',
        component_id: 'interview_share_packet',
        duration_ms: performance.now() - startedAt,
        metadata: {
          auth_state: authState,
          interaction_result: 'success',
          source_mode: 'live',
        },
      });
    } catch (error) {
      const message = resolveLivePathErrorMessage(error, SHARE_UNAVAILABLE_MESSAGE);
      if (!mountedRef.current) return;

      setShareState({ phase: 'error', message });
      trackUxEvent({
        event_name: 'share_error',
        component_id: 'interview_share_packet',
        duration_ms: performance.now() - startedAt,
        metadata: {
          auth_state: authState,
          error_message: message,
          interaction_result: 'error',
          source_mode: 'live',
        },
      });
    } finally {
      shareInFlightRef.current = false;
    }
  }

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-10 sm:pt-16 pb-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/25">
            Passport view
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Portable readiness for the next employer conversation.
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/42 sm:mx-0">
            This view stays tied to the current passport truth object. Missing sources, stale checks, and blocked domains remain visible.
          </p>
        </div>

        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-white">{displayName}</p>
                <p className="mt-1 text-sm text-white/45">{specialty}</p>
              </div>
              <VStatusPill status={readinessStatus} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-left sm:min-w-[18rem]">
              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Readiness</p>
                <p className="mt-1 text-lg font-semibold text-white">{passport.readiness.score}/100</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Trust band</p>
                <p className="mt-1 text-lg font-semibold text-white">{passport.readiness.level}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Last checked</p>
                <p className="mt-1 text-sm font-medium text-white">{formatShortDate(passport.lastCheckedAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Proof coverage</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} sections attached
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
            <TimeToStartEstimateSummary estimate={timeToStartEstimate} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Checked now</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {checkedTags.length > 0 ? checkedTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62"
                    >
                      {tag}
                    </span>
                  )) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/38">
                      No decision-grade checks attached yet
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Missing or review</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingTags.length > 0 ? missingTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/48"
                    >
                      {tag}
                    </span>
                  )) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">
                      No visible blockers on this passport
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">What can proceed</p>
              <p className="mt-2 text-sm leading-relaxed text-white/64">
                {readinessProceedNote(passport)}
              </p>
              <p className="mt-4 text-[11px] leading-relaxed text-white/34">
                Freshness: {proofSummary.warningCount > 0 ? 'review needed on at least one proof section' : 'no stale or review-required proof sections visible'}.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={buildPassportEntityHref(passport.entityId)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/62 transition hover:border-white/20 hover:text-white"
                >
                  Open full passport
                </Link>
                {proofHref && (
                  <Link
                    href={proofHref}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/62 transition hover:border-white/20 hover:text-white"
                  >
                    Download proof PDF
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/25">Proof depth</p>
              <p className="mt-1 text-sm text-white/42">
                Expand a section to inspect source, freshness, and attached evidence posture.
              </p>
            </div>
            {proofHref && (
              <Link
                href={proofHref}
                className="hidden rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/48 transition hover:border-white/20 hover:text-white/70 sm:inline-flex"
              >
                Export passport proof
              </Link>
            )}
          </div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-5 py-2">
            <Accordion
              items={proofItems}
              defaultOpen={proofItems.find((item) => item.status !== 'checked')?.id ?? proofItems[0]?.id}
              telemetryComponentId="interview_proof_packet"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/25">
                Share with employer
              </p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/42">
                Share stays live only when this passport was opened with a real employer review context. No public link or success state is fabricated here.
              </p>
            </div>
            {hasShareContext && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/42">
                Review context attached
              </span>
            )}
          </div>

          {shareState.phase === 'success' ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-sm font-medium text-white/78">Share recorded</p>
              <p className="mt-1 text-xs leading-relaxed text-white/42">
                VitalCV returned a real share event for this employer review context.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Share event</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-white/54">{shareState.eventId}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Recorded</p>
                  <p className="mt-1 text-[11px] text-white/54">
                    {formatDateTime(shareState.timestamp)} · {shareState.status}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={reviewHref}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--vt-success)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Open employer review
                </Link>
                <Link
                  href={buildPassportEntityHref(passport.entityId)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/56 transition hover:border-white/20 hover:text-white"
                >
                  Return to passport
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {!hasShareContext && (
                <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                  <p className="text-sm font-medium text-white/70">Preview only</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/38">
                    A real employer review context is required before this passport can be shared. Continue from your passport flow or from an employer request that carries a valid context.
                  </p>
                </div>
              )}

              {hasShareContext && !CLERK_PROVIDER_ENABLED && (
                <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                  <p className="text-sm font-medium text-white/70">Authentication unavailable</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/38">
                    This preview environment is not mounting Clerk, so the share action is intentionally blocked here.
                  </p>
                </div>
              )}

              {hasShareContext && CLERK_PROVIDER_ENABLED && isLoaded && !isSignedIn && (
                <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                  <p className="text-sm font-medium text-white/70">Sign in required</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/38">
                    Sharing writes a real employer review event, so VitalCV requires an authenticated session before it will proceed.
                  </p>
                </div>
              )}

              {shareState.phase === 'error' && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/8 px-4 py-4">
                  <p className="text-sm font-medium text-rose-100">Share blocked</p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-100/70">{shareState.message}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {canShare ? (
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={shareState.phase === 'loading'}
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--vt-success)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {shareState.phase === 'loading' ? 'Sharing with employer…' : 'Share with employer'}
                  </button>
                ) : CLERK_PROVIDER_ENABLED && hasShareContext ? (
                  <Link
                    href={CLERK_SIGN_IN_URL}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-5 text-sm font-medium text-white/62 transition hover:border-white/20 hover:text-white"
                  >
                    Sign in to share
                  </Link>
                ) : null}

                {canOpenEmployerReview && (
                  <Link
                    href={reviewHref}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-5 text-sm font-medium text-white/62 transition hover:border-white/20 hover:text-white"
                  >
                    View employer review
                  </Link>
                )}

                <Link
                  href={buildPassportEntityHref(passport.entityId)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-5 text-sm font-medium text-white/56 transition hover:border-white/20 hover:text-white"
                >
                  Return to passport
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
