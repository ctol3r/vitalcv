'use client';

/**
 * FunnelLoadingSequence — deterministic loading UI for NPI verification.
 *
 * Shows 4 named steps that map to real API check phases:
 *   1. "Verifying NPI identity..."        → NPPES
 *   2. "Checking exclusion status..."      → OIG / LEIE
 *   3. "Confirming enrollment..."          → CMS PECOS
 *   4. "Building readiness snapshot..."    → Readiness score computation
 *
 * Each step transitions based on actual stream state, not timers,
 * so the loading sequence progresses at the real speed of the checks.
 */

import { useEffect, useState } from 'react';
import type { IngestStreamState } from '@/hooks/useIngestStream';

interface LoadingStep {
  id: string;
  label: string;
  source: string;
}

const LOADING_STEPS: LoadingStep[] = [
  { id: 'nppes',      label: 'Verifying NPI identity',      source: 'CMS NPPES' },
  { id: 'oig',        label: 'Checking exclusion status',   source: 'OIG / LEIE' },
  { id: 'pecos',      label: 'Confirming enrollment',       source: 'CMS PECOS' },
  { id: 'readiness',  label: 'Building readiness snapshot',  source: 'VitalCV Engine' },
];

type StepState = 'waiting' | 'active' | 'done';

function resolveStepState(
  stepId: string,
  streamState: IngestStreamState,
): StepState {
  switch (stepId) {
    case 'nppes':
      if (streamState.sources.nppes === 'done' || streamState.sources.nppes === 'error') return 'done';
      if (streamState.sources.nppes === 'checking' || streamState.phase === 'starting' || streamState.phase === 'nppes') return 'active';
      return streamState.runId ? 'active' : 'waiting';

    case 'oig':
      if (streamState.sources.oig === 'done' || streamState.sources.oig === 'error') return 'done';
      if (streamState.sources.oig === 'checking' || streamState.phase === 'sanctions') return 'active';
      if (streamState.sources.nppes === 'done' || streamState.sources.nppes === 'error') return 'active';
      return 'waiting';

    case 'pecos':
      if (streamState.sources.pecos === 'done' || streamState.sources.pecos === 'error') return 'done';
      if (streamState.sources.pecos === 'checking' || streamState.phase === 'enrollment') return 'active';
      if ((streamState.sources.oig === 'done' || streamState.sources.oig === 'error')) return 'active';
      return 'waiting';

    case 'readiness':
      if (typeof streamState.readiness.score === 'number') return 'done';
      if (streamState.sources.pecos === 'done' || streamState.sources.pecos === 'error') return 'active';
      return 'waiting';

    default:
      return 'waiting';
  }
}

interface FunnelLoadingSequenceProps {
  streamState: IngestStreamState;
  visible: boolean;
}

export function FunnelLoadingSequence({ streamState, visible }: FunnelLoadingSequenceProps) {
  const [minimumStepIndex, setMinimumStepIndex] = useState(0);

  // Guarantee each step is visible for at least 1.5s before advancing
  useEffect(() => {
    if (!visible) {
      setMinimumStepIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setMinimumStepIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 2000);

    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="mt-6 space-y-3"
      role="status"
      aria-label="Checking your NPI across federal sources"
    >
      {LOADING_STEPS.map((step, index) => {
        const realState = resolveStepState(step.id, streamState);
        // Use the real state, but ensure steps don't jump ahead of minimum pacing
        const displayState: StepState =
          index > minimumStepIndex ? 'waiting' :
          realState === 'done' ? 'done' :
          index === minimumStepIndex || realState === 'active' ? 'active' :
          realState;

        return (
          <div
            key={step.id}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
              displayState === 'done'
                ? 'border-[var(--vt-status-resolved)]/20 bg-[var(--vt-status-resolved)]/[0.04]'
                : displayState === 'active'
                  ? 'border-[var(--vt-accent)]/25 bg-[var(--vt-accent)]/[0.04]'
                  : 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] opacity-50'
            }`}
            style={{
              animation: index <= minimumStepIndex
                ? `vcv-loading-step-enter 300ms ease-out ${index * 120}ms both`
                : undefined,
            }}
          >
            {/* Step indicator */}
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              {displayState === 'done' ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--vt-status-resolved)] text-white"
                  style={{ animation: 'vcv-loading-check 350ms ease-out both' }}
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              ) : displayState === 'active' ? (
                <span
                  className="inline-block h-4 w-4 rounded-full border-2 border-[var(--vt-accent)] border-t-transparent animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-[var(--vt-text-muted)]/30"
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Step label */}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium transition-colors duration-200 ${
                displayState === 'done'
                  ? 'text-[var(--vt-status-resolved)]'
                  : displayState === 'active'
                    ? 'text-[var(--vt-text-primary)]'
                    : 'text-[var(--vt-text-muted)]'
              }`}>
                {step.label}{displayState === 'active' ? '...' : ''}
              </p>
              <p className={`text-[11px] transition-colors duration-200 ${
                displayState === 'done'
                  ? 'text-[var(--vt-status-resolved)]/70'
                  : 'text-[var(--vt-text-muted)]'
              }`}>
                {step.source}
              </p>
            </div>

            {/* Status text */}
            {displayState === 'done' && (
              <span className="shrink-0 text-[11px] font-medium text-[var(--vt-status-resolved)]">
                Complete
              </span>
            )}
          </div>
        );
      })}

      <p className="sr-only" aria-live="polite">
        {LOADING_STEPS.filter((_, i) =>
          resolveStepState(LOADING_STEPS[i].id, streamState) === 'done',
        ).length} of {LOADING_STEPS.length} checks complete
      </p>
    </div>
  );
}
