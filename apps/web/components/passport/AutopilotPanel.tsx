'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * AutopilotPanel — hero wayfinding surface on the passport.
 *
 * Direction, not suggestion: the copy tells the clinician where they're
 * going and what to do to get there. Never renders "no results": when
 * the marketplace has nothing to match we fall back to a directional
 * placeholder so the top-of-surface always carries a clear next move.
 *
 * Mode wiring:
 *   - primary  → "You are closest to: {Employer — Role}"
 *   - fallback → "Closest available opportunity: {Employer — Role}" (or
 *                 a generic placeholder if the registry is empty)
 */

type TopMatchMode = 'primary' | 'fallback';

interface TopMatchOpportunity {
  // Canonical opportunity identity — lets the Autopilot handoff route
  // the user to /opportunities/{id} without losing role/org context.
  opportunityId: string;
  employer: string;
  role: string;
  organizationSlug: string;
}

interface TopMatchResult {
  mode: TopMatchMode;
  opportunity: TopMatchOpportunity | null;
}

interface EnvelopeResponse<T> {
  result: T | null;
  blockers: string[];
  explanation: string;
  timestamp: string;
}

interface AutopilotPanelProps {
  /** Ordered imperative steps (typically from deriveAutopilotSteps) */
  steps: string[];
  /** Limit to N steps so the surface stays scannable */
  maxSteps?: number;
  /** Estimated days to start-ready — rendered under the opportunity */
  estimatedDays?: number | null;
  /** Specialty hint — lets the server promote a match from fallback → primary */
  specialty?: string | null;
  /** Human-readable outcome label — e.g. "Likely accepted". Never a score. */
  outcomeLabel?: string | null;
  /**
   * The specific directive the user is actively resolving, e.g. "Fix PECOS".
   * When present, the panel surfaces a prominent in-progress line so the
   * click feels connected to real work. Nullable for the idle state.
   */
  inProgressStep?: string | null;
  /**
   * Pinned opportunity — when the user arrives from an explicit
   * opportunity (Explore card CTA, autopilot handoff), the panel locks
   * to that exact role instead of calling /api/passport/top-match for a
   * specialty-based guess. Preserves canonical org + role identity
   * across the handoff.
   */
  pinnedOpportunity?: TopMatchOpportunity | null;
  /**
   * NPI for the subject. When present, the panel fetches NBA confidence
   * signals (cohort sample size + typical time-to-start) from Omega and
   * surfaces them as an empirical footer. Drives the "Based on N similar
   * cases" + "Most clinicians complete this in N days" lines that make
   * the autopilot read as inevitable rather than advisory.
   */
  npi?: string | null;
}

interface AutopilotConfidence {
  sampleSize: number | null;
  avgDaysToStart: number | null;
}

interface OmegaEnvelopeShape {
  nextBestAction?: {
    expectedOutcome?: {
      sampleSize?: number | null;
      avgTimeToStartDays?: number | null;
    } | null;
  } | null;
}

const PRIMARY_HEADLINE = 'You are closest to:';
const FALLBACK_HEADLINE = 'Closest available opportunity:';
const FALLBACK_PLACEHOLDER = 'Explore the marketplace';

function formatStartLabel(estimatedDays: number | null | undefined): string | null {
  if (estimatedDays === null || estimatedDays === undefined) return null;
  if (estimatedDays <= 0) return 'Start now';
  return `Start in ~${estimatedDays} day${estimatedDays === 1 ? '' : 's'}`;
}

function formatBlockersLabel(steps: string[]): string | null {
  const count = steps.length;
  if (count <= 0) return 'No blockers';
  return `${count} blocker${count === 1 ? '' : 's'}`;
}

export function AutopilotPanel({
  steps,
  maxSteps = 3,
  estimatedDays,
  specialty,
  outcomeLabel,
  inProgressStep,
  npi,
  pinnedOpportunity,
}: AutopilotPanelProps) {
  // When a pinned opportunity is provided, the match is fixed to that
  // role — no specialty-based guessing, no fallback. The handoff from
  // Explore or from a share link carries a specific canonical row and
  // the panel must respect it.
  const initialMatch: TopMatchResult | null = pinnedOpportunity
    ? { mode: 'primary', opportunity: pinnedOpportunity }
    : null;
  const [match, setMatch] = useState<TopMatchResult | null>(initialMatch);
  const [confidence, setConfidence] = useState<AutopilotConfidence>({
    sampleSize: null,
    avgDaysToStart: null,
  });

  useEffect(() => {
    // If a pinned opportunity was provided, never fetch — doing so would
    // race and potentially overwrite the canonical role context with a
    // specialty-based guess.
    if (pinnedOpportunity) {
      setMatch({ mode: 'primary', opportunity: pinnedOpportunity });
      return;
    }

    let cancelled = false;
    const url = specialty
      ? `/api/passport/top-match?specialty=${encodeURIComponent(specialty)}`
      : '/api/passport/top-match';

    // cache: 'no-store' is load-bearing — the UI-consistency contract
    // says cached data must look identical to live data. Easiest path to
    // that guarantee is to make every fetch live, so there is no cached
    // branch that could drift from the server's current state.
    fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((envelope: EnvelopeResponse<TopMatchResult> | null) => {
        if (cancelled) return;
        // Degrade to a shaped fallback rather than hiding the panel — the
        // rule is "never show no results".
        setMatch(envelope?.result ?? { mode: 'fallback', opportunity: null });
      })
      .catch(() => {
        if (cancelled) return;
        setMatch({ mode: 'fallback', opportunity: null });
      });
    return () => {
      cancelled = true;
    };
  }, [specialty, pinnedOpportunity]);

  // Confidence signals: empirical cohort stats that make the autopilot
  // read as inevitable. Fires once per npi change so the panel isn't
  // hammering Omega on every parent re-render. Failures degrade silently
  // — missing cohort data just hides the footer rather than the panel.
  useEffect(() => {
    if (!npi) {
      setConfidence({ sampleSize: null, avgDaysToStart: null });
      return;
    }
    let cancelled = false;
    fetch('/api/omega', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ npi, actorType: 'clinician' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: OmegaEnvelopeShape | null) => {
        if (cancelled) return;
        const eo = payload?.nextBestAction?.expectedOutcome;
        setConfidence({
          sampleSize:
            typeof eo?.sampleSize === 'number' && eo.sampleSize > 0 ? eo.sampleSize : null,
          avgDaysToStart:
            typeof eo?.avgTimeToStartDays === 'number' && eo.avgTimeToStartDays > 0
              ? Math.round(eo.avgTimeToStartDays)
              : null,
        });
      })
      .catch(() => {
        if (!cancelled) setConfidence({ sampleSize: null, avgDaysToStart: null });
      });
    return () => {
      cancelled = true;
    };
  }, [npi]);

  if (!match) return null;

  const headline = match.mode === 'primary' ? PRIMARY_HEADLINE : FALLBACK_HEADLINE;
  const visibleSteps = steps.slice(0, maxSteps);

  // Human-readable signal lines. Order intentional: outcome frames the
  // verdict; days + blockers explain the cost of reaching it.
  const signalLines: string[] = [];
  if (outcomeLabel) signalLines.push(outcomeLabel);
  const startLabel = formatStartLabel(estimatedDays ?? null);
  if (startLabel) signalLines.push(startLabel);
  const blockersLabel = formatBlockersLabel(steps);
  if (blockersLabel) signalLines.push(blockersLabel);

  return (
    <div
      data-slot="autopilot-panel"
      data-mode={match.mode}
      className="
        rounded-xl border border-[var(--vt-border)]
        bg-[var(--vt-surface)]
        p-[var(--vt-space-16)]
      "
      aria-label="Career Autopilot"
    >
      <p className="text-xs uppercase tracking-widest text-[var(--vt-text-muted)]">
        {headline}
      </p>

      {match.opportunity ? (
        <p className="mt-1 text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          <Link
            // Canonical handoff: route to the specific opportunity, not
            // the employer's listing index. Preserves role + org identity
            // so the user lands on exactly the opportunity Autopilot
            // recommended, with its readiness context intact.
            href={`/opportunities/${match.opportunity.opportunityId}`}
            className="underline-offset-2 hover:underline"
          >
            {match.opportunity.employer} — {match.opportunity.role}
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          <Link
            href="/explore"
            className="underline-offset-2 hover:underline"
          >
            {FALLBACK_PLACEHOLDER}
          </Link>
        </p>
      )}

      {signalLines.length > 0 && (
        <ul
          data-slot="autopilot-signals"
          className="mt-2 space-y-0.5 text-sm text-[var(--vt-text-secondary)]"
        >
          {signalLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {inProgressStep && (
        <p
          data-slot="autopilot-in-progress"
          className="mt-3 text-sm font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]"
          aria-live="polite"
        >
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--vt-text-primary)] align-middle" aria-hidden />
          {inProgressStep}
        </p>
      )}

      {visibleSteps.length > 0 && (
        <>
          <p className="mt-3 text-xs uppercase tracking-widest text-[var(--vt-text-muted)]">
            Next step:
          </p>
          <ol className="mt-1 space-y-0.5">
            {visibleSteps.map((step, i) => (
              <li key={step} className="text-sm text-[var(--vt-text-secondary)]">
                <span className="tabular-nums text-[var(--vt-text-muted)]">{i + 1}.</span> {step}
              </li>
            ))}
          </ol>
        </>
      )}

      {(confidence.sampleSize || confidence.avgDaysToStart) && (
        <div
          data-slot="autopilot-confidence"
          className="mt-3 border-t border-[var(--vt-border)] pt-2 space-y-0.5 text-xs text-[var(--vt-text-muted)]"
        >
          {confidence.sampleSize && (
            <p>Based on {confidence.sampleSize} similar cases</p>
          )}
          {confidence.avgDaysToStart && (
            <p>Most clinicians complete this in {confidence.avgDaysToStart} days</p>
          )}
        </div>
      )}
    </div>
  );
}
