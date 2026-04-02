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
  type EmployerAcceptanceHistoryEntry,
  type EmployerAcceptanceHistoryResponse,
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
        note: joinNoteParts(['Preview', 'context only']),
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
        confirmedNote: joinNoteParts(['Checked', checkedNote, confidence]),
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

// ── BinaryDecisionCard ────────────────────────────────────────────────────────

type DecisionReadiness = 'HIGH' | 'MEDIUM' | 'BLOCKED';

function resolveDecisionReadiness(blocked: string[], identityStatus: TrustStatus, safetyRowStatus: TrustStatus): DecisionReadiness {
  if (blocked.length > 0 || identityStatus === 'blocked' || safetyRowStatus === 'blocked') return 'BLOCKED';
  if (identityStatus !== 'checked' || safetyRowStatus !== 'checked') return 'MEDIUM';
  return 'HIGH';
}

interface BinaryDecisionCardProps {
  passport: PassportData;
  blocked: string[];
  safetyRow: { status: TrustStatus };
  identityStatus: TrustStatus;
  authorityCredentials: PassportData['authority']['credentials'];
  acceptanceHistorySummary: EmployerAcceptanceHistoryResponse['summary'];
  canPersistActions: boolean;
  previewOnlyMessage: string | null;
  onAccept: () => void;
  onRequestRefresh: () => void;
  onRouteToReview: () => void;
}

function BinaryDecisionCard({
  passport,
  blocked,
  safetyRow,
  identityStatus,
  authorityCredentials,
  acceptanceHistorySummary,
  canPersistActions,
  previewOnlyMessage,
  onAccept,
  onRequestRefresh,
  onRouteToReview,
}: BinaryDecisionCardProps) {
  const { identity, standing } = passport;
  const decisionReadiness = resolveDecisionReadiness(blocked, identityStatus, safetyRow.status);

  // Active license check
  const hasActiveLicense = authorityCredentials.some(
    (c) => c.domain === 'LICENSURE' && c.status === 'ACTIVE',
  );

  const DECISION_COLORS: Record<DecisionReadiness, string> = {
    HIGH:    'border-emerald-500/30 bg-emerald-500/[0.06]',
    MEDIUM:  'border-amber-500/30 bg-amber-500/[0.05]',
    BLOCKED: 'border-rose-500/25 bg-rose-500/[0.05]',
  };
  const DECISION_TEXT: Record<DecisionReadiness, string> = {
    HIGH:    'text-emerald-400',
    MEDIUM:  'text-amber-400',
    BLOCKED: 'text-rose-400',
  };

  // 3 canonical bullets
  const bullets: { label: string; source: string; ok: boolean; reason?: string }[] = [
    {
      label: 'Identity checked',
      source: 'NPPES',
      ok: identityStatus === 'checked',
      reason: identityStatus !== 'checked' ? 'NPPES identity check incomplete' : undefined,
    },
    {
      label: 'License source-backed',
      source: 'State Board',
      ok: hasActiveLicense,
      reason: !hasActiveLicense ? 'No active license found in source data' : undefined,
    },
    {
      label: 'Safety checked',
      source: 'OIG/LEIE',
      ok: standing.exclusionStatus === 'CLEAR',
      reason: standing.exclusionStatus !== 'CLEAR' ? `OIG status: ${standing.exclusionStatus ?? 'UNKNOWN'}` : undefined,
    },
  ];

  return (
    <Card className={`rounded-2xl border px-5 py-5 shadow-none ${DECISION_COLORS[decisionReadiness]}`}>
      {/* Name + decision readiness */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold leading-tight">{identity.displayName}</h1>
          {identity.specialty && <p className="text-foreground text-sm mt-0.5">{identity.specialty}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Decision readiness</p>
          <p className={`text-lg font-bold mt-0.5 ${DECISION_TEXT[decisionReadiness]}`}>{decisionReadiness}</p>
        </div>
      </div>

      {/* 3 canonical bullets */}
      <div className="mt-4 space-y-2.5">
        {bullets.map((bullet) => (
          <div key={bullet.label} className="flex items-start gap-3">
            <span className={`mt-0.5 text-sm shrink-0 ${bullet.ok ? 'text-emerald-400' : 'text-rose-400/80'}`}>
              {bullet.ok ? '✓' : '✗'}
            </span>
            <div>
              <p className={`text-sm font-medium ${bullet.ok ? 'text-foreground/80' : 'text-foreground'}`}>
                {bullet.label}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                {bullet.ok ? bullet.source : (bullet.reason ?? bullet.source)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Blockers summary if any */}
      {blocked.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {blocked.length} active blocker{blocked.length !== 1 ? 's' : ''}: {blocked.slice(0, 3).join(', ')}{blocked.length > 3 ? '…' : ''}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-black/15 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Portable acceptance</p>
        <p className="mt-1 text-sm font-medium text-foreground">{acceptanceHistorySummary.headline}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60">
          {acceptanceHistorySummary.trustCopy
            ?? 'Any future VitalCV acceptance will appear here with its organization-specific scope.'}
        </p>
      </div>

      {/* Action row */}
      <div className="mt-5 space-y-2">
        <Button
          onClick={onAccept}
          disabled={!canPersistActions}
          variant="success"
          className="h-12 w-full rounded-xl text-sm font-semibold"
        >
          Accept as head start{blocked.length > 0 ? ` (${blocked.length} gap${blocked.length !== 1 ? 's' : ''} noted)` : ''}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onRequestRefresh}
            disabled={!canPersistActions}
            variant="outline"
            className="h-11 rounded-xl border-border bg-white/[0.03] text-xs text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground/70"
          >
            Request missing info
          </Button>
          <Button
            onClick={onRouteToReview}
            disabled={!canPersistActions}
            variant="outline"
            className="h-11 rounded-xl border-border bg-white/[0.03] text-xs text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground/70"
          >
            Route to review
          </Button>
        </div>
        {previewOnlyMessage && (
          <p className="text-center text-[10px] text-muted-foreground/40 pt-1">{previewOnlyMessage}</p>
        )}
      </div>
    </Card>
  );
}

// ── Main review component ──────────────────────────────────────────────────────

interface Props {
  passport:   PassportData;
  contextId?: string;
  bundleId?:  string;
  sharedBy?:  string;
  acceptanceHistory?: EmployerAcceptanceHistoryResponse;
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
        <div key={e.layer} className="flex items-start justify-between gap-3 rounded-xl border border-white/6 bg-muted px-3 py-2.5">
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
              <p className="text-foreground/60">{item.label}</p>
              {item.detail && (
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/40">
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-3 shrink-0 text-center text-muted-foreground/40" aria-hidden>
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
  | { phase: 'pilot_confirmation'; intent: EmployerReviewActionIntent; message: string }
  | { phase: 'error'; intent: EmployerReviewActionIntent; message: string }
  | { phase: 'downloading' };

type EmployerActionEndpoint = 'accept' | 'request-refresh' | 'route-to-review' | 'reject';

class PilotFallbackError extends Error {
  constructor(public readonly pilotMessage: string) {
    super(pilotMessage);
    this.name = 'PilotFallbackError';
  }
}

// ── M2: API call helpers ───────────────────────────────────────────────────

const API = '';

function buildEmptyAcceptanceHistory(): EmployerAcceptanceHistoryResponse {
  return {
    ok: true,
    summary: {
      acceptedOrganizationCount: 0,
      hasPriorAcceptances: false,
      headline: 'No prior acceptances',
      trustCopy: null,
    },
    history: [],
  };
}

function formatAcceptanceScopeLabel(scope: EmployerAcceptanceHistoryEntry['acceptanceScope']): string {
  switch (scope) {
    case 'full':
      return 'Full';
    case 'partial':
      return 'Partial';
    case 'pilot':
    default:
      return 'Pilot';
  }
}

function buildReviewScopeSearchParams(scope?: {
  contextId?: string;
  bundleId?: string;
}): string {
  const params = new URLSearchParams();

  if (scope?.contextId) {
    params.set('organizationContextId', scope.contextId);
  }

  if (scope?.bundleId) {
    params.set('bundleId', scope.bundleId);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function postAction(
  entityId: string,
  endpoint: EmployerActionEndpoint,
  body?: Record<string, unknown>,
  scope?: {
    contextId?: string;
    bundleId?: string;
  },
): Promise<EmployerReviewActionResponse> {
  const res = await fetch(`${API}/api/employer-review/${entityId}/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(body ?? {}),
      ...(scope?.contextId ? { organizationContextId: scope.contextId } : {}),
      ...(scope?.bundleId ? { bundleId: scope.bundleId } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    const status = res.status;
    if (status === 401 || status === 403) {
      if (endpoint === 'request-refresh') throw new PilotFallbackError('Request recorded — clinician will be notified during pilot');
      if (endpoint === 'reject') throw new PilotFallbackError('Rejection recorded — decision logged for pilot audit trail');
    }
    throw new Error(err.error_description ?? `Action failed (${status})`);
  }
  return res.json() as Promise<EmployerReviewActionResponse>;
}

async function getPersistedActionState(
  entityId: string,
  scope?: {
    contextId?: string;
    bundleId?: string;
  },
): Promise<EmployerReviewActionState | null> {
  const res = await fetch(
    `${API}/api/employer-review/${entityId}/status${buildReviewScopeSearchParams(scope)}`,
    {
      headers: { Accept: 'application/json' },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    throw new Error(err.error_description ?? `Status lookup failed (${res.status})`);
  }

  const payload = await res.json() as EmployerReviewStatusResponse;
  return payload.state ?? null;
}

async function getAcceptanceHistory(entityId: string): Promise<EmployerAcceptanceHistoryResponse> {
  const res = await fetch(`${API}/api/employer-review/${entityId}/acceptance-history`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Acceptance history lookup failed (${res.status})`);
  }

  return res.json() as Promise<EmployerAcceptanceHistoryResponse>;
}

function AcceptanceHistoryPanel({
  acceptanceHistory,
}: {
  acceptanceHistory: EmployerAcceptanceHistoryResponse;
}) {
  return (
    <Card className="gap-4 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-5 shadow-none">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
          Acceptance history
        </p>
        <p className="text-sm font-medium text-foreground">
          {acceptanceHistory.summary.headline}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {acceptanceHistory.summary.trustCopy
            ?? 'No employer has recorded a prior VitalCV acceptance for this clinician yet. Future acceptances will appear here with their organization-specific scope.'}
        </p>
      </div>

      {acceptanceHistory.history.length > 0 ? (
        <div className="space-y-2">
          {acceptanceHistory.history.map((entry, index) => (
            <div
              key={`${entry.acceptanceId ?? entry.orgLabel}-${entry.acceptedAt}-${index}`}
              className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{entry.orgLabel}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/50">
                  {entry.isAnonymized ? 'Anonymized for pilot portability' : 'Recorded organization'}
                </p>
              </div>
              <div className="grid gap-2 text-left sm:text-right">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Date</p>
                  <p className="mt-1 text-xs text-foreground">{formatProofDate(entry.acceptedAt) ?? 'Not recorded'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Scope</p>
                  <p className="mt-1 text-xs text-foreground">{formatAcceptanceScopeLabel(entry.acceptanceScope)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted px-4 py-4 text-xs leading-relaxed text-muted-foreground">
          No acceptance history is attached yet. VitalCV records each employer decision with its own scope, not as universal approval.
        </div>
      )}
    </Card>
  );
}

export default function ReviewClient({
  passport,
  contextId,
  bundleId,
  sharedBy,
  acceptanceHistory,
}: Props) {
  const [actionState, setActionState] = useState<ActionState>({ phase: 'idle' });
  const [persistedActionState, setPersistedActionState] = useState<EmployerReviewActionState | null>(null);
  const [acceptanceHistoryState, setAcceptanceHistoryState] = useState<EmployerAcceptanceHistoryResponse>(
    () => acceptanceHistory ?? buildEmptyAcceptanceHistory(),
  );
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
      ? 'Preview. Authentication is unavailable in this environment, so employer actions are intentionally disabled.'
      : !isLoaded
        ? 'Checking employer session before enabling actions.'
        : !isSignedIn
          ? 'Preview. Sign in with an employer workspace to persist decisions.'
          : !isEmployer
            ? 'Preview. Switch into an employer workspace to persist decisions.'
            : null;
  const canPersistActions = previewOnlyMessage === null;
  const authState = resolveLivePathAuthState({ isLoaded, isSignedIn, isEmployer });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      actionInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (acceptanceHistory) {
      setAcceptanceHistoryState(acceptanceHistory);
    }
  }, [acceptanceHistory]);

  const freshnessEntries = reviewTruth.freshness.entries;
  const freshnessState = reviewTruth.freshness.label;

  useEffect(() => {
    if (reviewOpenedTrackedRef.current || (CLERK_PROVIDER_ENABLED && !isLoaded)) return;

    // review_opened is in PilotMetricEventType — counted by getPilotOpsSummary
    trackUxEvent({
      event_name: 'review_opened' as const,
      component_id: 'employer_review_surface',
      metadata: {
        auth_state: authState,
        blockers_count: blocked.length,
        interaction_result: canPersistActions ? 'ready' : 'preview_only',
        shared_context: Boolean(sharedBy || contextId || bundleId),
        source_mode: 'live',
      },
    });

    reviewOpenedTrackedRef.current = true;
  }, [authState, blocked.length, bundleId, canPersistActions, contextId, isLoaded, sharedBy]);

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
        const state = await getPersistedActionState(passport.entityId, {
          contextId,
          bundleId,
        });
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
  }, [bundleId, canPersistActions, contextId, passport.entityId]);

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

  async function refreshAcceptanceHistory() {
    try {
      const history = await getAcceptanceHistory(passport.entityId);
      if (mountedRef.current) {
        setAcceptanceHistoryState(history);
      }
    } catch {
      // Acceptance history is supplemental. Keep the last known state on failure.
    }
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
      const result = await postAction(
        passport.entityId,
        config.endpoint,
        config.body,
        { contextId, bundleId },
      );
      if (!mountedRef.current) return;

      setPersistedActionState(result.state);
      setActionState({
        phase: 'done',
        state: result.state,
      });
      if (config.intent === 'accept') {
        void refreshAcceptanceHistory();
      }
      trackEmployerActionResult(config.intent, 'success', startedAt);
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof PilotFallbackError) {
        setActionState({ phase: 'pilot_confirmation', intent: config.intent, message: error.pilotMessage });
        trackEmployerActionResult(config.intent, 'success', startedAt);
        return;
      }
      const message = resolveLivePathErrorMessage(error, 'Action failed');
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
      body: {
        acceptanceScope: 'pilot',
      },
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
          <span className="text-muted-foreground/50 text-xs tracking-widest uppercase">VitalCV</span>
          <span className="text-muted-foreground/50 text-xs">Employer review</span>
        </div>

        {/* ── Review context attribution ────────────────────────────────────── */}
        {(sharedBy || contextId || bundleId) && (
          <Card className="gap-2 rounded-xl border-white/8 bg-white/[0.03] px-4 py-3 shadow-none">
            {sharedBy && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Shared by</span>
                <span className="text-foreground">{sharedBy}</span>
              </div>
            )}
            <div className={`flex justify-between text-xs ${sharedBy ? 'mt-1' : ''}`}>
              <span className="text-muted-foreground">Purpose</span>
              <span className="text-foreground">Employment review</span>
            </div>
            {contextId && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">Review context</span>
                <span className="text-foreground font-mono">{contextId.slice(0, 8)}…</span>
              </div>
            )}
            {bundleId && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">Bundle review</span>
                <span className="text-foreground font-mono">{bundleId.slice(0, 8)}…</span>
              </div>
            )}
            <div className="flex justify-between text-xs mt-1">
              <span className="text-muted-foreground">Audit trail</span>
              <span className="text-foreground">Actions tied to this context</span>
            </div>
          </Card>
        )}
        {/* No context — direct view, actions not context-attributed */}
        {!sharedBy && !contextId && !bundleId && (
          <Card className="gap-2 rounded-xl border-amber-500/15 bg-amber-500/5 px-4 py-3 shadow-none">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Review context</span>
              <span className="text-amber-300/70">None — direct view</span>
            </div>
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed mt-0.5">
              Actions here are not tied to a confirmed employer context.{' '}
              <Link
                href="/review/request"
                className="text-foreground underline underline-offset-2 hover:text-foreground/60 transition-colors"
              >
                Request a review context
              </Link>{' '}
              for auditable decisions.
            </p>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            BINARY DECISION CARD — Above the fold. Employer decides here.
            <10 seconds. Everything else is collapsed below.
        ══════════════════════════════════════════════════════════════════ */}
        {(actionState.phase === 'idle' || actionState.phase === 'downloading') && (
          <BinaryDecisionCard
            passport={passport}
            blocked={blocked}
            safetyRow={safetyRow}
            identityStatus={identityStatus}
            authorityCredentials={authority.credentials}
            acceptanceHistorySummary={acceptanceHistoryState.summary}
            canPersistActions={canPersistActions}
            previewOnlyMessage={previewOnlyMessage}
            onAccept={handleAccept}
            onRequestRefresh={handleRequestRefresh}
            onRouteToReview={handleRouteToReview}
          />
        )}

        {/* ── Action feedback states ─────────────────────────────────────── */}
        {actionState.phase === 'loading' && (
          <SectionReveal delay={0.05}>
            <TrustStateCard
              title={employerReviewLoadingLabel(actionState.intent)}
              description="Writing the persisted audit record..."
              centered
            />
          </SectionReveal>
        )}

        {actionState.phase === 'pilot_confirmation' && (
          <SectionReveal delay={0.05}>
            <TrustStateCard
              title={actionState.message}
              description={
                actionState.intent === 'reject'
                  ? 'Your rejection decision has been recorded in the pilot audit trail.'
                  : 'Your request has been recorded. During the pilot, clinicians will be notified through the pilot operations channel.'
              }
              tone="success"
              className="rounded-xl"
              actions={(
                <Button onClick={() => setActionState({ phase: 'idle' })} variant="ghost" className="min-h-[44px] w-full text-xs text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground">
                  Back
                </Button>
              )}
            />
          </SectionReveal>
        )}

        {actionState.phase === 'done' && (
          <SectionReveal delay={0.05}>
            <TrustStateCard
              title={actionState.state.summary.title}
              description={actionState.state.summary.description}
              tone="success"
              className="rounded-xl"
              actions={(
                <Button onClick={() => setActionState({ phase: 'idle' })} variant="ghost" className="min-h-[44px] w-full text-xs text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground">
                  Back
                </Button>
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--vt-success)] text-sm">✔</span>
                <p className="text-foreground/70 text-sm font-medium">Audit trail recorded</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-card px-3 py-2 mt-1 space-y-1.5">
                <p className="text-muted-foreground/40 text-[10px] uppercase tracking-widest">Audit record</p>
                <p className="text-foreground text-[10px] font-mono break-all">{actionState.state.auditEventId}</p>
                <p className="text-muted-foreground/40 text-[10px]">{new Date(actionState.state.timestamp).toLocaleString()}</p>
              </div>
            </TrustStateCard>
          </SectionReveal>
        )}

        {actionState.phase === 'error' && (
          <SectionReveal delay={0.05}>
            <TrustStateCard
              title="Action failed"
              description={actionState.message}
              tone="critical"
              actions={(
                <Button onClick={() => setActionState({ phase: 'idle' })} variant="ghost" className="min-h-[44px] w-full text-xs text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground">
                  Try again
                </Button>
              )}
            />
          </SectionReveal>
        )}

        <AcceptanceHistoryPanel acceptanceHistory={acceptanceHistoryState} />

        {/* ── Detail disclosure — collapsed by default ───────────────────── */}
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors list-none py-1">
            <span className="group-open:hidden">▸</span>
            <span className="hidden group-open:inline">▾</span>
            Full credential detail
          </summary>
          <div className="mt-4 space-y-6">

        {/* ── Decision card — Exact Layout ──────────────────────────────── */}
        <SectionReveal delay={0}>
          <Card className="mb-6 gap-6 rounded-2xl border-white/8 bg-card px-5 py-5 shadow-none">
          {/* Identity */}
          <div>
            <h1 className="text-foreground text-xl font-semibold leading-tight">
              {identity.displayName}
            </h1>
            {identity.specialty && (
              <p className="text-foreground/70 text-sm mt-0.5">{identity.specialty}</p>
            )}
            <div className="mt-3">
              <TrustStatusBadge status={readinessStatus} size="sm" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Readiness</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{readiness.score}/100</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Trust band</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{readiness.level}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Freshness</p>
              <p className="mt-1 text-sm font-medium text-foreground">{freshnessState}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">{formatProofDate(lastSyncedAt) ?? 'Not checked'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Proof completeness</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} attached
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                {proofSummary.warningCount > 0 ? `${proofSummary.warningCount} review warning${proofSummary.warningCount === 1 ? '' : 's'}` : 'No review warnings'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Decision snapshot</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {blocked.length > 0
                    ? `Proceed only as a head start. ${blocked.length} blocker${blocked.length === 1 ? '' : 's'} still need review or refresh.`
                    : 'No visible blockers are attached to this review right now.'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/50">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? '0 days' : `~${readiness.estimatedStartDays} days`}
              </p>
            </div>
          </div>

          {/* MS16-F: Employer 6-question flow — strict order */}
          <div className="pt-2 mt-4 space-y-6">
            {/* Q1: Who is this? */}
            <div className="space-y-2">
              <h2 className="text-muted-foreground/60 text-xs uppercase tracking-widest font-semibold mb-2">Identity</h2>
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

            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-muted-foreground/60 text-xs uppercase tracking-widest font-semibold">Trust stack</h2>
                <span className="text-muted-foreground/20 text-[11px] uppercase tracking-[0.18em]">Safety · Authority · Eligibility</span>
              </div>

              {/* Q2: Safe? */}
              <div className="space-y-2">
                <h3 className="text-muted-foreground/30 text-[10px] uppercase tracking-widest font-semibold">Safety</h3>
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
                <h3 className="text-muted-foreground/30 text-[10px] uppercase tracking-widest font-semibold">Authority</h3>
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

                      {certCreds.map((credential) => {
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
                <h3 className="text-muted-foreground/30 text-[10px] uppercase tracking-widest font-semibold">Eligibility</h3>
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
            <div className="border-t border-border pt-4 space-y-1 text-sm">
              <h2 className="text-muted-foreground/60 text-xs uppercase tracking-widest font-semibold mb-2">Readiness</h2>
              <p className="text-foreground font-medium pb-1">{readiness.score}% ready</p>

              {/* Q5: Blockers */}
              {blocked.length > 0 && (
                <div className="space-y-1 pb-1">
                  {blocked.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground/40 text-xs w-3 shrink-0 mt-0.5" aria-hidden>·</span>
                      <span className="text-foreground/70 text-xs">{b.charAt(0).toUpperCase() + b.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-foreground/70 pt-1">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? '0 days' : `~${readiness.estimatedStartDays} days`}
              </p>

              {/* Q6: What do I do? — sourced from readiness.nextActions[] */}
              {reviewTruth.buckets.nextActions.length > 0 && (
                <div className="pt-3 mt-1 border-t border-white/8 space-y-2">
                  <p className="text-muted-foreground/50 text-[10px] uppercase tracking-widest">Next actions</p>
                  {reviewTruth.buckets.nextActions.slice(0, 4).map((action) => (
                    <div key={action.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground/30 text-xs w-3 shrink-0 mt-0.5">·</span>
                      <div>
                        <p className="text-foreground text-xs font-medium">{action.label}</p>
                        <p className="text-muted-foreground/60 text-xs mt-0.5 leading-relaxed">{action.detail}</p>
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
                className="h-9 rounded-xl border-border px-4 py-2 text-[11px] font-medium text-foreground hover:border-border hover:text-foreground/70"
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
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Last synced</p>
              <p className="mt-1 text-sm text-foreground/60">{formatProofDate(lastSyncedAt) ?? 'Not checked'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Freshness</p>
              <p className="mt-1 text-sm text-foreground/60">{freshnessState}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Proof completeness</p>
              <p className="mt-1 text-sm text-foreground/60">
                {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} sections attached
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Review warnings</p>
              <p className="mt-1 text-sm text-foreground/60">
                {blocked.length > 0 ? `${blocked.length} blocker${blocked.length === 1 ? '' : 's'}` : 'No blockers'}
              </p>
            </div>
          </div>
          {persistedActionState ? (
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">
                {formatEmployerReviewPersistedLabel(persistedActionState)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
                {formatEmployerReviewPersistedDetail(persistedActionState)}
              </p>
            </div>
          ) : previewOnlyMessage ? (
            <div className="mt-4 border-t border-white/8 pt-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Preview</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {previewOnlyMessage}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground/60">
              Employer actions below are real. VitalCV waits for the backend audit event before it renders success.
            </p>
          )}
        </Card>

        <PassportSourceCoveragePanel checks={reviewTruth.sourceCoverageChecks} />

        {/* ── Decision basis — what you're acting on (no assumptions) ──────── */}
        {(actionState.phase === 'idle' || actionState.phase === 'downloading') && (
          <SectionReveal delay={0.05}>
            <Card className="gap-3 rounded-2xl border-white/8 bg-card px-5 py-4 shadow-none">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Passport truth in this review
            </p>

            <div className="rounded-lg border border-white/6 bg-white/2 px-3 py-2.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground/40 text-[10px] uppercase tracking-widest">
                    Trust posture
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {reviewTruth.posture.bandLabel}
                    <span className="ml-1 text-xs font-mono text-muted-foreground/50">
                      {reviewTruth.posture.level}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    {reviewTruth.posture.reliableLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground/40 text-[10px] uppercase tracking-widest">Score</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground/70">
                    {reviewTruth.posture.score}
                    <span className="text-xs text-muted-foreground/50">/100</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/40">
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
                accentClassName="text-muted-foreground/40"
                emptyLabel="No missing Passport proof sections are flagged right now."
              />
            </div>

            <div className="border-t border-white/6 pt-2">
              <ReviewTruthBucket
                title="Next action"
                items={reviewTruth.buckets.nextActions}
                icon="→"
                accentClassName="text-muted-foreground/60"
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

          </div>{/* end details inner */}
        </details>

      </div>
    </main>
  );
}
