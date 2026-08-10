'use client';

/**
 * Source-check narration — the shared "watched it work" primitive.
 *
 * Consolidates the two near-identical implementations that used to live in
 * `home/LiveNpiResult` and `onboarding/OnboardingReadiness`: the process
 * sequence, the reduced-motion handling, and the resolving-view rows.
 *
 * Honesty: the resolving phase is *process*, not results — a source that is
 * still being read renders as `pending` (the canonical ProvenanceChip), never
 * a `checked` claim. Real per-source results are shown by each caller's
 * resolved view once the data lands.
 *
 * Motion doctrine (W0): no looping/`animate-spin`. Rows REVEAL as the sequence
 * advances (a one-shot settle), and under `prefers-reduced-motion` the sequence
 * is shown fully settled at once — never a spinner.
 */

import * as React from 'react';
import { ProvenanceChip } from '@/design-system/components';

export interface TrustState {
  identityVerified?: boolean;
  exclusionStatus?: string; // CLEAR | EXCLUDED | UNCHECKED
  pecosStatus?: string; // ENROLLED | NOT_FOUND | UNKNOWN
  licensureStatus?: string; // unknown | ...
  blockers?: string[];
  nextActions?: string[];
}

/** The process steps, in order. Labels are process-honest (what we are doing),
 *  never result claims. */
export const CHECK_SEQUENCE = [
  'Recognizing your identity',
  'Checking federal exclusion data (OIG)',
  'Checking Medicare enrollment (PECOS)',
  'Preparing your readiness snapshot',
] as const;

export type SequencePhase = 'resolving' | 'resolved' | 'error';

/**
 * Drives the reveal sequence and phase transition. The caller owns the fetch
 * and calls `finish(ok)` when the data lands; the hook enforces a minimum
 * on-screen duration (so the reveal never beats the data) and honors
 * `prefers-reduced-motion` by settling instantly with no animation.
 */
export function useSourceCheckSequence(opts: {
  stepCount: number;
  minDurationMs?: number;
  stepIntervalMs?: number;
}) {
  const { stepCount, minDurationMs = 1850, stepIntervalMs = 610 } = opts;
  const [step, setStep] = React.useState(0);
  const [phase, setPhase] = React.useState<SequencePhase>('resolving');
  const reduceRef = React.useRef(false);
  const startedRef = React.useRef(0);
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    reduceRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    startedRef.current = Date.now();
    if (reduceRef.current) {
      setStep(stepCount);
      return;
    }
    const t = window.setInterval(
      () => setStep((s) => Math.min(s + 1, stepCount)),
      stepIntervalMs,
    );
    return () => window.clearInterval(t);
  }, [stepCount, stepIntervalMs]);

  const finish = React.useCallback(
    (ok: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const elapsed = Date.now() - (startedRef.current || Date.now());
      const wait = reduceRef.current ? 0 : Math.max(0, minDurationMs - elapsed);
      window.setTimeout(() => {
        setStep(stepCount);
        setPhase(ok ? 'resolved' : 'error');
      }, wait);
    },
    [minDurationMs, stepCount],
  );

  return { step, phase, finish };
}

/** Right-side per-row status: read (process complete) / running / queued. */
function RowStatus({ position }: { position: 'read' | 'running' | 'queued' }) {
  if (position === 'running') {
    // Honest: the check is in progress, shown as the canonical pending chip.
    // Attribution is `declared` because no source has answered yet — naming
    // one here would imply a read that has not returned. The declaration is
    // announced to assistive tech and paints nothing, so the row is unchanged.
    return (
      <ProvenanceChip state="pending" attribution={{ declared: 'check in progress' }} size="sm" />
    );
  }
  if (position === 'read') {
    return (
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rounded-full bg-[var(--vt-text-muted,#6b7280)]"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-[7px] w-[7px] rounded-full border border-[var(--vt-border)]"
    />
  );
}

export interface SourceCheckNarrationProps {
  /** How many steps have been read so far (0..steps.length). */
  step: number;
  steps?: ReadonlyArray<string>;
  /** Rendered after the list (e.g. a skeleton preview). */
  trailing?: React.ReactNode;
  className?: string;
  /** Compact spacing for tight surfaces. */
  compact?: boolean;
}

/**
 * The resolving-view content: the "Reading primary sources" eyebrow and the
 * process rows. Callers wrap this in their own container (with `aria-live`).
 */
export function SourceCheckNarration({
  step,
  steps = CHECK_SEQUENCE,
  trailing,
  className,
  compact = false,
}: SourceCheckNarrationProps) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
        Reading primary sources
      </p>
      <ul className={compact ? 'mt-3 space-y-2.5' : 'mt-4 space-y-3'}>
        {steps.map((label, i) => {
          const position: 'read' | 'running' | 'queued' =
            i < step ? 'read' : i === step ? 'running' : 'queued';
          return (
            <li
              key={label}
              data-check-row={position}
              className="flex items-center justify-between gap-3 text-[13px] transition-opacity duration-[var(--mz-dur,320ms)] ease-[var(--mz-ease,ease)]"
              style={{ opacity: position === 'queued' ? 0.55 : 1 }}
            >
              <span
                className={
                  position === 'read'
                    ? 'text-[var(--vt-text-primary)]'
                    : 'text-[var(--vt-text-secondary)]'
                }
              >
                {label}
              </span>
              <RowStatus position={position} />
            </li>
          );
        })}
      </ul>
      {trailing}
    </div>
  );
}
