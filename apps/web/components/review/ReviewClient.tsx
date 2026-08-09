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
import { useTrackEvent } from '@/lib/learning/useTrackEvent';
import Link from 'next/link';
import { useRoleContext } from '@/components/auth/RoleContext';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import {
  buildPassportProofSections,
} from '@/components/trust/passportProofSections';
import { EvidenceDisclosureCard } from '@/components/trust/EvidenceDisclosureCard';
import { PassportSourceCoveragePanel } from '@/components/trust/PassportSourceCoveragePanel';
import { TimeToStartEstimateSummary } from '@/components/trust/TimeToStartEstimateSummary';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { TrustContainerPanel } from '@/components/trust/TrustContainerPanel';
import { DivergenceSummaryCard } from '@/components/trust/DivergenceSummaryCard';
import { TrustLabel, type TrustStatus } from '@/components/ui/trust-label';
import type { PassportData } from '@/lib/trust/passport-contract';
import { readinessLevelLabel } from '@/lib/trust/status-language';
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
import { isAcceptBlockedDecisionPosture } from '@/lib/employer-review-state';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import {
  buildPassportReviewTruthModel,
  resolvePassportTruthSet,
  type PassportTruthListItem,
} from '@/lib/trust/passport-review-truth';
import {
  resolvePublicWedgeSurfaceStateFromAccordionStatus,
  resolvePublicWedgeSurfaceStateFromTruth,
} from '@/lib/trust/public-wedge-parity';
import { resolveEmployerPacketExportGate } from '@/lib/export/export-gating';
import {
  buildEmployerProofPacketDownloadUrl,
  employerProofPacketFilename,
} from '@/lib/export/employer-proof-packet';
import {
  resolveAuthorityAccordionStatus,
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
  resolveAuthorityStatusLead,
  resolveAuthorityTitle,
} from '@/lib/trust/passport-truth';
import { buildPassportPilotTimeToStartEstimate } from '@/lib/trust/time-to-start-estimate';
import type { CanonicalTruthSet } from '@vitalcv/trust-state';

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
          standing.enrollmentNote ?? 'CMS PECOS (Simulated) returns an enrolled status for preview. Do not rely on this for decisions.',
        missingExplanation: 'No CMS PECOS lookup has been performed yet. Enrollment eligibility is unknown.',
      });
  }
}

// ── BinaryDecisionCard ────────────────────────────────────────────────────────

type DecisionPostureStatus = PassportData['readiness']['status'];

function resolveDecisionCardPosture(passport: PassportData): {
  status: DecisionPostureStatus;
  headline: string;
  nextAction: string;
  freshnessLabel: string;
} {
  if (passport.decisionPosture) {
    return {
      status: passport.decisionPosture.status,
      headline: passport.decisionPosture.headline,
      nextAction: passport.decisionPosture.nextAction,
      freshnessLabel: passport.decisionPosture.freshness.label,
    };
  }

  const status = passport.readiness.status;

  return {
    status,
    headline:
      status === 'DECISION_GRADE'
        ? 'All attached decision-grade sources support employer review.'
        : status === 'BLOCKED'
          ? 'Blocking gaps remain attached to this review.'
          : 'Some decision-grade sources are still missing, gated, or pending.',
    nextAction:
      passport.readiness.nextActions[0]?.detail
      ?? (
        status === 'DECISION_GRADE'
          ? 'Accept as head start.'
          : status === 'BLOCKED'
            ? 'Route to review or request refresh before start.'
            : 'Request refresh for the missing decision-grade checks.'
      ),
    freshnessLabel: passport.trustPosture.freshness.label,
  };
}

function decisionPostureDisplayLabel(status: DecisionPostureStatus): string {
  switch (status) {
    case 'DECISION_GRADE':
      return 'Decision-ready evidence';
    case 'BLOCKED':
      return 'Blocked';
    case 'PARTIAL':
      return 'Partial readiness';
    case 'CHECKING':
    default:
      return 'Checking sources';
  }
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
  const decisionPosture = resolveDecisionCardPosture(passport);

  // Active license check
  const hasActiveLicense = authorityCredentials.some(
    (c) => c.domain === 'LICENSURE' && c.status === 'ACTIVE',
  );

  const DECISION_COLORS: Record<DecisionPostureStatus, string> = {
    DECISION_GRADE: 'border-emerald-500/30 bg-emerald-500/[0.06]',
    CHECKING:       'border-sky-500/30 bg-sky-500/[0.05]',
    PARTIAL:        'border-amber-500/30 bg-amber-500/[0.05]',
    BLOCKED:        'border-rose-500/25 bg-rose-500/[0.05]',
  };
  const DECISION_TEXT: Record<DecisionPostureStatus, string> = {
    DECISION_GRADE: 'text-emerald-400',
    CHECKING:       'text-sky-400',
    PARTIAL:        'text-amber-400',
    BLOCKED:        'text-rose-400',
  };

  // Enrollment status
  const enrollmentStatus =
    standing.pecosEnrollmentStatus ?? (
      standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
      standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
    );
  const enrollmentOk = enrollmentStatus === 'ENROLLED';

  // 4 canonical bullets — key facts for <10s employer decision
  const bullets: { label: string; source: string; ok: boolean; reason?: string }[] = [
    {
      label: 'Identity checked',
      source: 'NPPES',
      ok: passport.decisionPosture
        ? passport.decisionPosture.proven.some((item) => item.dimension === 'identity')
        : identityStatus === 'checked',
      reason:
        passport.decisionPosture?.missing.find((item) => item.dimension === 'identity')?.reason
        ?? (identityStatus !== 'checked' ? 'NPPES identity check incomplete' : undefined),
    },
    {
      label: 'Safety checked',
      source: 'OIG/LEIE',
      ok: passport.decisionPosture
        ? passport.decisionPosture.proven.some((item) => item.dimension === 'safety')
        : standing.exclusionStatus === 'CLEAR',
      reason:
        passport.decisionPosture?.missing.find((item) => item.dimension === 'safety')?.reason
        ?? (standing.exclusionStatus !== 'CLEAR' ? `OIG status: ${standing.exclusionStatus ?? 'UNKNOWN'}` : undefined),
    },
    {
      label: 'License source-backed',
      source: 'State Board',
      ok: passport.decisionPosture
        ? passport.decisionPosture.proven.some((item) => item.dimension === 'authority')
        : hasActiveLicense,
      reason:
        passport.decisionPosture?.missing.find((item) => item.dimension === 'authority')?.reason
        ?? (!hasActiveLicense ? 'No active license found in source data' : undefined),
    },
    {
      label: 'Enrollment checked',
      source: 'CMS PECOS',
      ok: passport.decisionPosture
        ? passport.decisionPosture.proven.some((item) => item.dimension === 'eligibility')
        : enrollmentOk,
      reason:
        passport.decisionPosture?.missing.find((item) => item.dimension === 'eligibility')?.reason
        ?? (!enrollmentOk
          ? enrollmentStatus === 'NOT_FOUND' ? 'Not found in CMS enrollment data' : 'Enrollment not yet checked'
          : undefined),
    },
  ];

  return (
    <div className={"border border-[var(--vt-border)] px-6 py-6 " + DECISION_COLORS[decisionPosture.status]}>
      {/* Name + decision readiness */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Clinician Under Review</p>
          <h1 className="text-foreground text-3xl font-bold uppercase tracking-tight leading-none">{identity.displayName}</h1>
          {identity.specialty && <p className="text-muted-foreground text-sm mt-2 font-mono">{identity.specialty}</p>}
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground/70">
            {decisionPosture.headline}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Decision Posture</p>
          <p className={"text-xl font-bold " + DECISION_TEXT[decisionPosture.status]}>{decisionPostureDisplayLabel(decisionPosture.status)}</p>
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
      <div className="mt-6 space-y-2">
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Next best action</p>
              <p data-testid="decision-next-action" className="mt-1 text-sm leading-relaxed text-foreground">
                {decisionPosture.nextAction}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">Freshness</p>
              <p className="mt-1 text-xs text-foreground/70">{decisionPosture.freshnessLabel}</p>
            </div>
          </div>
          {blocked.length > 0 && (
            // External-pilot P0: reviewer must see the full blocker set when the
            // decision is BLOCKED (so the cause of the disabled Accept is never
            // hidden behind the "…"). In non-blocked states we keep the compact
            // 3-item summary to preserve the at-a-glance density contract.
            isAcceptBlockedDecisionPosture(decisionPosture.status) ? (
              <ul
                data-testid="blocker-list"
                aria-label={`${blocked.length} active blocker${blocked.length === 1 ? '' : 's'} preventing acceptance`}
                className="mt-3 space-y-1 text-xs text-muted-foreground"
              >
                {blocked.map((b) => (
                  <li key={b} data-testid="blocker-item" className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 text-rose-400/80">•</span>
                    <span className="text-foreground/80">{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="blocker-summary" className="mt-3 text-xs text-muted-foreground">
                {blocked.length} active blocker{blocked.length !== 1 ? 's' : ''}: {blocked.slice(0, 3).join(', ')}{blocked.length > 3 ? '…' : ''}
              </p>
            )
          )}
        </div>
        <Button
          data-testid="employer-accept-button"
          data-blocked={isAcceptBlockedDecisionPosture(decisionPosture.status) ? 'true' : 'false'}
          onClick={onAccept}
          disabled={!canPersistActions || isAcceptBlockedDecisionPosture(decisionPosture.status)}
          variant="success"
          className="h-14 w-full rounded-none text-xs font-bold uppercase tracking-widest"
        >
          {isAcceptBlockedDecisionPosture(decisionPosture.status)
            ? 'Acceptance blocked — resolve blockers first'
            : `Accept as head start${blocked.length > 0 ? ` — ${blocked.length} gap${blocked.length !== 1 ? 's' : ''} noted` : ''}`}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onRequestRefresh}
            disabled={!canPersistActions}
            variant="outline"
            className="h-11 rounded-none border-border bg-transparent text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:bg-foreground hover:text-background"
          >
            Request refresh
          </Button>
          <Button
            onClick={onRouteToReview}
            disabled={!canPersistActions}
            variant="outline"
            className="h-11 rounded-none border-red-500/40 bg-transparent text-[10px] font-bold uppercase tracking-widest text-red-500/70 hover:bg-red-500 hover:text-white hover:border-red-500"
          >
            Route to review
          </Button>
        </div>
        {previewOnlyMessage && (
          // External-pilot P0: previously the preview-only state rendered as
          // faint fine-print, so external reviewers hit a dead end trying to
          // act. Lift it to a card with an explicit sign-in CTA so the path
          // from "I can see this review" → "I can persist a decision" is one
          // click instead of requiring product context.
          <div
            data-testid="employer-action-preview-only"
            className="mt-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-3 py-3 space-y-2"
          >
            <p className="text-[11px] leading-relaxed text-amber-200/80">{previewOnlyMessage}</p>
            <Button
              asChild
              size="sm"
              variant="outline"
              data-testid="employer-action-preview-signin"
              className="h-9 w-full rounded-full border-amber-400/40 bg-transparent text-[10px] font-bold uppercase tracking-widest text-amber-200 hover:bg-amber-400 hover:text-background"
            >
              <a href={CLERK_SIGN_IN_URL}>Sign in to persist decisions</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main review component ──────────────────────────────────────────────────────

interface ReviewClientLoadedProps {
  passport:   PassportData;
  contextId?: string;
  bundleId?:  string;
  sharedBy?:  string;
  acceptanceHistory?: EmployerAcceptanceHistoryResponse;
  receiptJwts?: string[];
}

interface ReviewClientLoadingProps {
  loading: true;
  entityId?: string;
}

type Props = ReviewClientLoadedProps | ReviewClientLoadingProps;

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

type EmployerActionEndpoint = 'accept' | 'request-refresh' | 'route-to-review';

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
                  {entry.isAnonymized ? 'Anonymized for portability' : 'Recorded organization'}
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

// ── Cryptographic receipt available panel ────────────────────────────────

function extractKidFromJwt(jwt: string): string | null {
  try {
    const raw = jwt.split('.')[0] ?? '';
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return typeof decoded.kid === 'string' ? decoded.kid : null;
  } catch {
    return null;
  }
}

function CryptoReceiptAvailablePanel({ receiptJwts }: { receiptJwts: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (receiptJwts.length === 0) return null;

  const firstJwt = receiptJwts[0]!;
  const kid = extractKidFromJwt(firstJwt);
  const truncatedJwt = firstJwt.length > 100 ? `${firstJwt.slice(0, 100)}…` : firstJwt;

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-400 text-sm" aria-label="Cryptographic Receipt">🔐</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80">
              Cryptographic Receipt Available
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/50">
              This evidence is cryptographically signed by VitalCV as the orchestration agent.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-7 px-2 text-[10px] text-indigo-400/70 hover:text-indigo-300 hover:bg-indigo-500/10"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide' : 'View proof'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2.5 border-t border-white/8 pt-3">
          {kid && (
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground/60 shrink-0">Key ID (kid)</span>
              <span className="font-mono text-foreground/80 truncate">{kid}</span>
            </div>
          )}
          <div className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-2">
            <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/40 break-all">
              {receiptJwts.length === 1 ? truncatedJwt : `${truncatedJwt} (+${receiptJwts.length - 1} more)`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-muted-foreground/50">Verify public keys independently</span>
            <Link
              href="/.well-known/jwks.json"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400/70 hover:text-indigo-300 underline underline-offset-2 shrink-0"
            >
              /.well-known/jwks.json ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewClientLoadingShell({ entityId }: { entityId?: string }) {
  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-10 sm:pt-16 pb-28">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--vt-border)] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground flex items-center justify-center text-background text-xs font-bold">V</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">VitalCV</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 border border-foreground/20 px-3 py-1">Employer Review</span>
        </div>

        <Card className="rounded-2xl border border-border bg-card px-5 py-5 shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-44 rounded-full" />
              <Skeleton className="h-4 w-28 rounded-full" />
            </div>
            <div className="space-y-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Decision readiness</p>
              <TrustStatusBadge status="pending" label="Pending" size="sm" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {['Identity', 'Safety', 'License', 'Enrollment'].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-0.5 text-sm shrink-0 text-muted-foreground/40">·</span>
                <div className="w-full space-y-1.5">
                  <p className="text-sm font-medium text-foreground/80">{item}</p>
                  <Skeleton className="h-3 w-56 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button disabled variant="success" className="h-12 rounded-xl text-sm font-semibold sm:col-span-3">
              Proceed (head start)
            </Button>
            <Button disabled variant="outline" className="h-11 rounded-xl border-border bg-white/[0.03] text-xs text-foreground/70">
              Request updated data
            </Button>
            <Button disabled variant="outline" className="h-11 rounded-xl border-border bg-white/[0.03] text-xs text-foreground/70">
              Route to review
            </Button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Loading source-backed decision data{entityId ? ` for ${entityId.slice(0, 8)}…` : ''}. Only real proof will fill this surface.
          </p>
        </Card>
      </div>
    </main>
  );
}

function ReviewClientLoaded({
  passport,
  contextId,
  bundleId,
  sharedBy,
  acceptanceHistory,
  receiptJwts,
}: ReviewClientLoadedProps) {
  const [actionState, setActionState] = useState<ActionState>({ phase: 'idle' });
  const [persistedActionState, setPersistedActionState] = useState<EmployerReviewActionState | null>(null);
  const [confirmStartState, setConfirmStartState] = useState<
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'done'; attestationId: string; startedAt: string }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' });
  const [confirmStartFields, setConfirmStartFields] = useState({ startedAt: '', role: '', facility: '' });
  const [acceptanceHistoryState, setAcceptanceHistoryState] = useState<EmployerAcceptanceHistoryResponse>(
    () => acceptanceHistory ?? buildEmptyAcceptanceHistory(),
  );
  const { isLoaded, isSignedIn, isEmployer } = useRoleContext();
  const mountedRef = useRef(true);
  const actionInFlightRef = useRef(false);
  const trackEvent = useTrackEvent();
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
  const blocked = Array.from(new Set(readiness.blockers));
  const reviewTruth = buildPassportReviewTruthModel(passport);
  const proofItems = buildPassportProofSections(passport);
  const proofSummary = reviewTruth.proofSummary;
  const showReadinessScore = proofSummary.decisionGradeCount > 0;
  const identityStatus = resolvePublicWedgeSurfaceStateFromTruth(truth.identity);
  const safetyRow = buildSafetyRow(passport);
  const eligibilityRow = buildEligibilityRow(passport, pecosEnrollmentStatus);
  const timeToStartEstimate = buildPassportPilotTimeToStartEstimate(passport);
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
  const exportGate = resolveEmployerPacketExportGate(passport);
  const canExportPacket = canPersistActions && exportGate.allowed;
  const authState = resolveLivePathAuthState({ isLoaded, isSignedIn, isEmployer });
  // Wave-1 P0: confirm-start must be reachable *both* after an in-session accept
  // and when the reviewer returns to a previously-accepted review (persisted state).
  // Nesting confirm-start inside `actionState.phase === 'done'` only (old behavior)
  // hid it whenever the page remounted — returning reviewers could never record start.
  const hasAcceptedAction =
    (actionState.phase === 'done' && actionState.state.action === 'accept')
    || persistedActionState?.action === 'accept';

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

    trackEvent('EMPLOYER_VIEWED', { providerId: passport.entityId });
    reviewOpenedTrackedRef.current = true;
  }, [authState, blocked.length, bundleId, canPersistActions, contextId, isLoaded, sharedBy, trackEvent, passport.entityId]);

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
    if (isAcceptBlockedDecisionPosture(passport.decisionPosture?.status ?? passport.readiness.status)) {
      return;
    }

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

  async function handleConfirmStart(e: React.FormEvent) {
    e.preventDefault();
    const acceptanceId = persistedActionState?.persistence?.acceptanceId ?? null;
    const startedAt = confirmStartFields.startedAt.trim();
    const role      = confirmStartFields.role.trim();
    const facility  = confirmStartFields.facility.trim();
    if (!startedAt || !role || !facility) {
      setConfirmStartState({
        phase: 'error',
        message: 'Start date, role, and facility are required before the audit record can close.',
      });
      return;
    }
    setConfirmStartState({ phase: 'loading' });
    try {
      const res = await fetch(`${API}/api/employer-review/${passport.entityId}/confirm-start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startedAt,
          role,
          facility,
          ...(acceptanceId ? { acceptanceId } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; error_description?: string };
        throw new Error(err.error_description ?? err.error ?? `Confirm start failed (${res.status})`);
      }
      const data = await res.json() as { attestationId: string; startedAt: string };
      setConfirmStartState({ phase: 'done', attestationId: data.attestationId, startedAt: data.startedAt });
    } catch (err) {
      setConfirmStartState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to record start date.' });
    }
  }

  async function handleDownloadPacket() {
    if (!canPersistActions || !exportGate.allowed || actionInFlightRef.current) {
      trackUxEvent({
        event_name: 'export_gate_blocked',
        component_id: 'employer_review_export_gate',
        metadata: {
          auth_state: authState,
          interaction_result: 'blocked',
          source_mode: 'live',
          export_gate_status: exportGate.status,
          export_gate_score: exportGate.survivabilityScore,
          export_gate_blockers: exportGate.blockers.map((blocker) => blocker.code),
          replay_attribution: exportGate.replayAttribution.lineageKey,
        },
      });
      if (canPersistActions && mountedRef.current) {
        setActionState({
          phase: 'error',
          intent: 'review',
          message: exportGate.summary,
        });
      }
      return;
    }
    if (mountedRef.current) {
      setActionState({ phase: 'downloading' });
    }
    const startedAt = performance.now();
    trackUxEvent({
      event_name: 'export_gate_started',
      component_id: 'employer_review_export_gate',
      metadata: {
        auth_state: authState,
        interaction_result: 'started',
        source_mode: 'live',
        export_gate_score: exportGate.survivabilityScore,
        replay_attribution: exportGate.replayAttribution.lineageKey,
      },
    });
    try {
      const npi = passport.identity.npi ?? passport.npi;
      if (!npi) {
        throw new Error('This review does not have a valid NPI for export.');
      }

      const res = await fetch(buildEmployerProofPacketDownloadUrl(npi));
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error_description?: string; error?: string };
        throw new Error(
          payload.error_description
          ?? payload.error
          ?? `Export failed (${res.status})`,
        );
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = employerProofPacketFilename(npi);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      trackUxEvent({
        event_name: 'export_gate_result',
        component_id: 'employer_review_export_gate',
        duration_ms: performance.now() - startedAt,
        metadata: {
          auth_state: authState,
          interaction_result: 'success',
          source_mode: 'live',
          export_gate_score: exportGate.survivabilityScore,
          replay_attribution: exportGate.replayAttribution.lineageKey,
        },
      });
    } catch (error) {
      trackUxEvent({
        event_name: 'export_gate_result',
        component_id: 'employer_review_export_gate',
        duration_ms: performance.now() - startedAt,
        metadata: {
          auth_state: authState,
          interaction_result: 'error',
          source_mode: 'live',
          export_gate_score: exportGate.survivabilityScore,
          replay_attribution: exportGate.replayAttribution.lineageKey,
          error_message: error instanceof Error ? error.message : 'Export failed.',
        },
      });
      if (mountedRef.current) {
        setActionState({
          phase: 'error',
          intent: 'review',
          message: error instanceof Error ? error.message : 'Export failed.',
        });
      }
      return;
    }
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

        {/* ── Cryptographic receipt available panel ───────────────────────── */}
        {receiptJwts && receiptJwts.length > 0 && (
          <CryptoReceiptAvailablePanel receiptJwts={receiptJwts} />
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
              <span className="text-muted-foreground">Audit-boundary record</span>
              <span className="text-foreground">Actions tied to this context</span>
            </div>
          </Card>
        )}
        {!sharedBy && !contextId && !bundleId && (
          <Card className="gap-2 rounded-xl border-amber-500/15 bg-amber-500/5 px-4 py-3 shadow-none">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Review context</span>
              <span className="text-amber-300/70">None — direct view</span>
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/40">
              Actions here are not tied to a confirmed employer context.{' '}
              <Link
                href="/review/request"
                className="text-foreground underline underline-offset-2 transition-colors hover:text-foreground/60"
              >
                Request a review context
              </Link>{' '}
              for auditable decisions.
            </p>
          </Card>
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
              description="Your request has been recorded. Clinicians will be notified through the operations channel."
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
                <p className="text-foreground/70 text-sm font-medium">Audit-boundary entry captured</p>
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

        {/* ══════════════════════════════════════════════════════════════════
            CONFIRM-START — hoisted to top level so it's reachable whenever the
            review has been accepted (in-session OR previously persisted).
            Prior behavior nested this inside the just-accepted TrustStateCard,
            which meant returning reviewers could never record a start date.
        ══════════════════════════════════════════════════════════════════ */}
        {canPersistActions && hasAcceptedAction && confirmStartState.phase !== 'done' && (
          <SectionReveal delay={0.05}>
            <Card
              data-testid="confirm-start-panel"
              className="gap-3 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-5 shadow-none"
            >
              <div>
                <p className="text-muted-foreground/60 text-[10px] font-semibold uppercase tracking-widest">Record start date</p>
                <p className="mt-1 text-sm text-foreground">Attach an attested start date so the audit-boundary record closes the loop on this acceptance.</p>
              </div>
              {confirmStartState.phase === 'error' && (
                <p data-testid="confirm-start-error" className="text-destructive text-xs">{confirmStartState.message}</p>
              )}
              <form onSubmit={(e) => { void handleConfirmStart(e); }} className="space-y-2">
                <div className="space-y-1">
                  <label className="text-muted-foreground/50 text-[10px] uppercase tracking-widest" htmlFor="confirm-start-date">Start date</label>
                  <input
                    id="confirm-start-date"
                    data-testid="confirm-start-date"
                    type="date"
                    required
                    value={confirmStartFields.startedAt}
                    onChange={(e) => setConfirmStartFields((f) => ({ ...f, startedAt: e.target.value }))}
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-muted-foreground/50 text-[10px] uppercase tracking-widest" htmlFor="confirm-start-role">Role</label>
                    <input
                      id="confirm-start-role"
                      data-testid="confirm-start-role"
                      type="text"
                      required
                      placeholder="e.g. Attending Cardiologist"
                      value={confirmStartFields.role}
                      onChange={(e) => setConfirmStartFields((f) => ({ ...f, role: e.target.value }))}
                      className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground/50 text-[10px] uppercase tracking-widest" htmlFor="confirm-start-facility">Facility</label>
                    <input
                      id="confirm-start-facility"
                      data-testid="confirm-start-facility"
                      type="text"
                      required
                      placeholder="e.g. Main Campus"
                      value={confirmStartFields.facility}
                      onChange={(e) => setConfirmStartFields((f) => ({ ...f, facility: e.target.value }))}
                      className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  data-testid="confirm-start-submit"
                  size="sm"
                  disabled={
                    confirmStartState.phase === 'loading'
                    || !confirmStartFields.startedAt.trim()
                    || !confirmStartFields.role.trim()
                    || !confirmStartFields.facility.trim()
                  }
                  className="w-full text-xs min-h-[36px]"
                >
                  {confirmStartState.phase === 'loading' ? 'Recording…' : 'Record Start'}
                </Button>
              </form>
            </Card>
          </SectionReveal>
        )}

        {confirmStartState.phase === 'done' && (
          <SectionReveal delay={0.05}>
            <Card
              data-testid="confirm-start-success"
              className="gap-2 rounded-2xl border-[var(--vt-success)]/25 bg-[var(--vt-success)]/5 px-5 py-4 shadow-none"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--vt-success)] text-xs">✔</span>
                <p className="text-[var(--vt-success)] text-xs font-medium">Start attested</p>
              </div>
              <p className="text-muted-foreground/60 text-[10px] font-mono break-all">{confirmStartState.attestationId}</p>
              <p className="text-muted-foreground/50 text-[10px]">{new Date(confirmStartState.startedAt).toLocaleDateString()}</p>
            </Card>
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
              <p className="mt-1 text-lg font-semibold text-foreground">
                {showReadinessScore ? `${readiness.score}/100` : 'Withheld'}
              </p>
              {!showReadinessScore ? (
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  Score appears after source-backed claims attach.
                </p>
              ) : null}
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
                    ? `Use only as a head start. ${blocked.length} blocker${blocked.length === 1 ? '' : 's'} still need review or refresh.`
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
                  const hasAny = licCreds.length > 0;

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

                      {!hasAny && (
                        <TrustLabel
                          status="access_required"
                          label="Authority"
                          source="Configured state board lane"
                          note="Access required · requires verification"
                          explanation="No source-backed authority record is attached yet. Authority remains incomplete until a connected state board lane succeeds."
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
              <p className="text-foreground font-medium pb-1">
                {showReadinessScore ? `${readiness.score}% ready` : 'Readiness score withheld until source-backed claims attach'}
              </p>

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

              <div className="pt-3">
                <TimeToStartEstimateSummary estimate={timeToStartEstimate} />
              </div>

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

        {/* ── Packet explanation — what this review contains ──────────── */}
        <Card className="gap-3 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-4 shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            About this review
          </p>
          <div className="space-y-2 text-xs leading-relaxed text-white/45">
            <p>
              This verification data contains a source-backed readiness snapshot for{' '}
              <span className="text-white/65">{identity.displayName}</span>.
              It is generated by VitalCV from primary and secondary sources — not self-reported by the clinician.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Included layers</p>
                <p>Identity (CMS NPPES)</p>
                <p>Safety (OIG LEIE exclusion check)</p>
                <p>Authority (state licensure, board certification)</p>
                <p>Eligibility (CMS PECOS enrollment)</p>
              </div>
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Trust statuses</p>
                <p><span className="text-white/55">Checked</span> — current source coverage is attached now</p>
                <p><span className="text-white/55">Pending</span> — the source has not completed yet</p>
                <p><span className="text-white/55">Stale</span> — attached evidence is older than the freshness window</p>
                <p><span className="text-white/55">Access required / Review required</span> — institutional access or manual follow-up is still needed</p>
                <p><span className="text-white/55">Unavailable / Preview only</span> — no decision-grade source result is attached yet</p>
              </div>
            </div>
            <div className="pt-2 border-t border-white/6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <p className="text-white/30">
                Generated by VitalCV{lastSyncedAt ? ` · last synced ${formatProofDate(lastSyncedAt)}` : ''}
              </p>
              <p className="text-white/20 text-[10px]">
                Audit-grade document — employer actions are recorded with trust state at time of decision
              </p>
            </div>
          </div>
        </Card>

        {/* ── Advisory Panel — gated, clearly labeled, below readiness ── */}
        <EmployerAdvisoryPanel passport={passport} />

        {/* ── M2: Freshness panel — above proof so stale warnings are visible before expanding ── */}
        <FreshnessPanel entries={freshnessEntries} />

        {passport.divergence?.activeCount ? (
          <DivergenceSummaryCard divergence={passport.divergence} mode="review" />
        ) : null}

        {/* ── Proof panel — collapsible ────────────────────────────────────── */}
        {proofItems.length > 0 && (
          <EvidenceDisclosureCard
            eyebrow="Proof"
            title="Source-backed evidence"
            description="Expand each section to see the trust-core proof, contextual notes, and decision-grade gaps attached to this review."
            action={(
              <Button
                onClick={handleDownloadPacket}
                disabled={!canExportPacket || actionState.phase === 'downloading'}
                variant="outline"
                title={
                  !canPersistActions
                    ? (previewOnlyMessage ?? 'Sign in with an employer workspace to export')
                    : !exportGate.allowed
                      ? exportGate.summary
                    : undefined
                }
                className="h-9 rounded-xl border-border px-4 py-2 text-[11px] font-medium text-foreground hover:border-border hover:text-foreground/70"
              >
                {actionState.phase === 'downloading' ? 'Exporting…' : 'Download Credentials'}
              </Button>
            )}
            className="rounded-2xl border-white/8 bg-white/[0.03]"
            contentClassName="px-5 py-1"
          >
            <Accordion
              items={proofItems}
              telemetryComponentId="employer_review_proof"
            />
            <TrustContainerPanel
              entry={passport.trustContainer ?? null}
              className="mt-4"
            />
            <div
              role={exportGate.allowed ? 'status' : 'alert'}
              className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                exportGate.allowed
                  ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-100/80'
                  : 'border-amber-400/20 bg-amber-400/5 text-amber-100/85'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                Export gate
              </p>
              <p className="mt-1">
                {exportGate.allowed
                  ? 'Ready to export with decision-grade launch-spine evidence.'
                  : exportGate.summary}
              </p>
              <p className="mt-1 opacity-70">
                Runtime gating stability {exportGate.survivabilityScore}% · evidence chain{' '}
                <span className="break-all">{exportGate.replayAttribution.lineageKey}</span>
              </p>
            </div>
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
              Source truth in this review
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
              title="Source-backed in this review"
              items={reviewTruth.buckets.sourceBackedNow}
              icon="✓"
              accentClassName="text-emerald-400/60"
              emptyLabel="No source-backed proof is attached yet."
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
                emptyLabel="No missing proof sections are flagged right now."
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
                    "Proceed with Credentialing Head Start" records your decision and these blockers as audit-boundary metadata. Primary source verification (PSV) is still pending.
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

export default function ReviewClient(props: Props) {
  if ('loading' in props && props.loading) {
    return <ReviewClientLoadingShell entityId={props.entityId} />;
  }

  if (!('passport' in props)) {
    return <ReviewClientLoadingShell />;
  }

  return <ReviewClientLoaded {...props} />;
}
