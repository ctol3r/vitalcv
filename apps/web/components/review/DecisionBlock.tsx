/**
 * DecisionBlock
 * ─────────────
 * Decision-grade output for employer review. Renders instantly with a single
 * verdict, plain-language explanation, what's still needed, and what this
 * means operationally for the employer's team.
 *
 * Design rules (enforced by this component):
 *   - One verdict. No score. No "X/100". No "Withheld".
 *   - No empty states ("No warnings", "No blockers attached", etc.).
 *   - No source-freshness warnings at the top of the review flow.
 *
 * Shape of the four credentialing checks VitalCV attaches to every packet:
 *   - identity     → CMS NPPES lookup
 *   - safety       → OIG / LEIE sanctions baseline
 *   - authority    → State licensing board
 *   - eligibility  → CMS PECOS enrollment
 */
import React from 'react';

import { Button } from '@/components/ui/button';
import type { PassportData } from '@/lib/trust/passport-contract';

export type DecisionStatus = 'READY' | 'CONDITIONAL_READY' | 'NOT_READY';

type DecisionDimension = 'identity' | 'safety' | 'authority' | 'eligibility';

interface DimensionState {
  dimension: DecisionDimension;
  proven: boolean;
  label: string;          // employer-facing label e.g. "NPPES lookup"
  pendingReason: string;  // used in "What's still needed"
  skipCopy: string;       // used in "What this means for your team"
}

// ── Dimension labels ────────────────────────────────────────────────────────

const DIMENSION_COPY: Record<
  DecisionDimension,
  { label: string; pendingReason: string; skipCopy: string }
> = {
  identity: {
    label: 'NPPES lookup',
    pendingReason: 'Identity not confirmed against NPPES',
    skipCopy: 'Skip NPPES lookup',
  },
  safety: {
    label: 'OIG baseline check',
    pendingReason: 'Sanctions verification pending',
    skipCopy: 'Skip OIG baseline check',
  },
  authority: {
    label: 'State board license',
    pendingReason: 'Active license not source-verified',
    skipCopy: 'Skip state board lookup',
  },
  eligibility: {
    label: 'CMS PECOS enrollment',
    pendingReason: 'Enrollment not confirmed',
    skipCopy: 'Skip CMS PECOS check',
  },
};

// ── Dimension facts pulled from the passport ───────────────────────────────

function readDimensions(passport: PassportData): DimensionState[] {
  const proven = new Set<DecisionDimension>();

  if (passport.decisionPosture) {
    for (const item of passport.decisionPosture.proven) {
      proven.add(item.dimension as DecisionDimension);
    }
  } else {
    // Fallback derivation when the backend hasn't attached a decisionPosture.
    if (passport.identity?.displayName) {
      proven.add('identity');
    }
    if (passport.standing.exclusionStatus === 'CLEAR') {
      proven.add('safety');
    }
    if (
      passport.authority.credentials.some(
        (c) => c.domain === 'LICENSURE' && c.status === 'ACTIVE',
      )
    ) {
      proven.add('authority');
    }
    if (passport.standing.pecosEnrollmentStatus === 'ENROLLED') {
      proven.add('eligibility');
    }
  }

  return (Object.keys(DIMENSION_COPY) as DecisionDimension[]).map((dimension) => ({
    dimension,
    proven: proven.has(dimension),
    ...DIMENSION_COPY[dimension],
  }));
}

// ── Status resolution ──────────────────────────────────────────────────────
//
// TODO(learning-mode): Implement the business rule that decides when a
// clinician is READY vs CONDITIONAL_READY vs NOT_READY.
//
// Context:
//   `dimensions` has one entry per credentialing check with a `.proven`
//   boolean. Identity and Authority (license) are the two hard gates — an
//   unknown name or no active license is never acceptable. Safety (OIG) and
//   Eligibility (PECOS) are "review-able" gaps — the employer can still
//   conditionally accept a clinician while those checks are being completed.
//
// Trade-offs to consider:
//   1. Strict: require ALL 4 dimensions for READY; any missing identity OR
//      authority → NOT_READY; otherwise CONDITIONAL_READY.
//      → Safest for the employer, but slows down most real packets.
//
//   2. Hard-gate: identity + authority must be proven to qualify at all;
//      safety + eligibility can be missing and still show CONDITIONAL_READY.
//      → Matches the user's copy ("Sanctions verification pending,
//        Enrollment not confirmed" → still CONDITIONAL_READY).
//
//   3. Majority: CONDITIONAL_READY if ≥ 2 of 4 dimensions proven.
//      → Easier to reach a "green" verdict but weaker guarantee.
//
// Your judgment call: pick the rule that matches VitalCV's trust stance
// for the YC MVP. The shape of the return value is fixed — you only need
// to write the `if` branches.
function resolveDecisionStatus(dimensions: DimensionState[]): DecisionStatus {
  // TODO: replace this stub with the real rule.
  const provenCount = dimensions.filter((d) => d.proven).length;
  const identityProven = dimensions.find((d) => d.dimension === 'identity')?.proven ?? false;
  const authorityProven = dimensions.find((d) => d.dimension === 'authority')?.proven ?? false;

  if (provenCount === dimensions.length) return 'READY';
  if (identityProven && authorityProven) return 'CONDITIONAL_READY';
  return 'NOT_READY';
}

// ── Presentation helpers ───────────────────────────────────────────────────

const STATUS_COPY: Record<
  DecisionStatus,
  { label: string; headline: string; badgeClass: string; borderClass: string }
> = {
  READY: {
    label: 'READY',
    headline:
      'This clinician can proceed to credentialing. All source-backed checks attached.',
    badgeClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30 bg-emerald-500/[0.06]',
  },
  CONDITIONAL_READY: {
    label: 'CONDITIONAL READY',
    headline:
      'This clinician can proceed to credentialing review. No disqualifying issues found.',
    badgeClass: 'text-amber-400',
    borderClass: 'border-amber-500/30 bg-amber-500/[0.05]',
  },
  NOT_READY: {
    label: 'NOT READY',
    headline:
      'This clinician cannot proceed yet. Core identity or licensure is unverified.',
    badgeClass: 'text-rose-400',
    borderClass: 'border-rose-500/25 bg-rose-500/[0.05]',
  },
};

// ── Component ──────────────────────────────────────────────────────────────

interface DecisionBlockProps {
  passport: PassportData;
  canPersistActions: boolean;
  previewOnlyMessage: string | null;
  onAccept: () => void;
  onRequestRefresh: () => void;
  onRouteToReview: () => void;
}

export function DecisionBlock({
  passport,
  canPersistActions,
  previewOnlyMessage,
  onAccept,
  onRequestRefresh,
  onRouteToReview,
}: DecisionBlockProps) {
  const dimensions = readDimensions(passport);
  const status = resolveDecisionStatus(dimensions);
  const statusCopy = STATUS_COPY[status];

  const stillNeeded = dimensions.filter((d) => !d.proven);
  const skipList = dimensions.filter((d) => d.proven);

  const isBlocked = status === 'NOT_READY';

  return (
    <section
      aria-label="Decision"
      className={`rounded-2xl border px-6 py-6 ${statusCopy.borderClass}`}
    >
      {/* Verdict */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            Decision
          </p>
          <p
            className={`mt-1 font-mono text-3xl font-bold tracking-tight ${statusCopy.badgeClass}`}
          >
            {statusCopy.label}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/80">
            {statusCopy.headline}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
            Clinician
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {passport.identity.displayName}
          </p>
          {passport.identity.specialty && (
            <p className="mt-0.5 text-xs text-muted-foreground/60">
              {passport.identity.specialty}
            </p>
          )}
        </div>
      </div>

      {/* What's still needed — only rendered when there is something real to show */}
      {stillNeeded.length > 0 && (
        <div className="mt-6 rounded-xl border border-white/8 bg-black/20 px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
            What&apos;s still needed
          </p>
          <ul className="mt-2 space-y-1.5">
            {stillNeeded.map((d) => (
              <li
                key={d.dimension}
                className="flex items-start gap-2 text-sm text-foreground/85"
              >
                <span className="mt-0.5 text-xs text-amber-400/80">•</span>
                <span>{d.pendingReason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What this means for your team — only rendered when we can save work */}
      {skipList.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
            What this means for your team
          </p>
          <ul className="mt-2 space-y-1.5">
            {skipList.map((d) => (
              <li
                key={d.dimension}
                className="flex items-start gap-2 text-sm text-foreground/85"
              >
                <span className="mt-0.5 text-xs text-emerald-400/80">✓</span>
                <span>{d.skipCopy}</span>
              </li>
            ))}
            {stillNeeded.length > 0 && (
              <li className="flex items-start gap-2 text-sm text-foreground/85">
                <span className="mt-0.5 text-xs text-emerald-400/80">✓</span>
                <span>Focus only on remaining gaps</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 space-y-2">
        <Button
          onClick={onAccept}
          disabled={!canPersistActions || isBlocked}
          variant="success"
          className="h-14 w-full rounded-none text-xs font-bold uppercase tracking-widest"
        >
          {isBlocked
            ? 'Acceptance blocked — resolve blockers first'
            : status === 'READY'
              ? 'Accept for credentialing'
              : `Accept as head start — ${stillNeeded.length} gap${stillNeeded.length === 1 ? '' : 's'} noted`}
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
            className="h-11 rounded-none border-red-500/40 bg-transparent text-[10px] font-bold uppercase tracking-widest text-red-500/70 hover:border-red-500 hover:bg-red-500 hover:text-white"
          >
            Route to review
          </Button>
        </div>
        {previewOnlyMessage && (
          <p className="pt-1 text-center font-mono text-[10px] text-muted-foreground/40">
            {previewOnlyMessage}
          </p>
        )}
      </div>
    </section>
  );
}
