'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * AutopilotPanel — top-of-surface suggestion: "you are closest to X, to get there do Y".
 *
 * Rules:
 *   - Simple: one suggestion, one numbered list of steps
 *   - Actionable: every step maps to a real blocker the user can resolve
 *   - No clutter: hidden when no match or no steps
 */

interface TopMatchResult {
  employer: string;
  role: string;
  organizationSlug: string;
}

interface EnvelopeResponse<T> {
  result: T | null;
  blockers: string[];
  explanation: string;
  timestamp: string;
}

interface AutopilotPanelProps {
  /** Ordered list of next steps (typically from deriveBlockers) */
  steps: string[];
  /** Limit to N steps so the surface stays scannable */
  maxSteps?: number;
}

export function AutopilotPanel({ steps, maxSteps = 3 }: AutopilotPanelProps) {
  const [match, setMatch] = useState<TopMatchResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/passport/top-match', { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((envelope: EnvelopeResponse<TopMatchResult> | null) => {
        if (cancelled) return;
        setMatch(envelope?.result ?? null);
      })
      .catch(() => {
        // graceful: hide panel if match unavailable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!match) return null;

  const visibleSteps = steps.slice(0, maxSteps);

  return (
    <div
      data-slot="autopilot-panel"
      className="
        rounded-xl border border-[var(--vt-border)]
        bg-[var(--vt-surface)]
        p-[var(--vt-space-16)]
      "
      aria-label="Autopilot suggestion"
    >
      <p className="text-xs uppercase tracking-widest text-[var(--vt-text-muted)]">
        You are closest to:
      </p>
      <p className="mt-1 text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
        <Link
          href={`/employers/${match.organizationSlug}`}
          className="underline-offset-2 hover:underline"
        >
          {match.employer} — {match.role}
        </Link>
      </p>

      {visibleSteps.length > 0 && (
        <>
          <p className="mt-3 text-xs uppercase tracking-widest text-[var(--vt-text-muted)]">
            To get there:
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
    </div>
  );
}
