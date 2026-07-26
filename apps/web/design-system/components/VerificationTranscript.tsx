import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  parseVerificationSteps,
  type ParsedTranscript,
  type TranscriptStep,
} from '@/lib/audit/verificationTranscript';

/**
 * VerificationTranscript (W5) — verification you can watch, and break.
 *
 * Renders the real Merkle-inclusion proof (the backend `verificationSteps`)
 * as a stepwise mono trace. When the leaf does not belong to the signed root
 * it names the exact break and fails closed — never a generic
 * "verification failed". Pure / SSR-safe; reduced-motion-safe (no animation).
 */

export interface VerificationTranscriptProps {
  /** Raw backend `verificationSteps` (string[]) or a pre-parsed transcript. */
  steps: ReadonlyArray<string> | ParsedTranscript;
  /** The signed checkpoint root, shown in the verdict line. */
  root?: string;
  className?: string;
}

const MARKER: Record<TranscriptStep['status'], { glyph: string; color: string }> = {
  ok: { glyph: '✓', color: 'var(--vt-state-verified)' },
  fail: { glyph: '✗', color: 'var(--vt-severity-critical)' },
  info: { glyph: '→', color: 'var(--vt-text-muted)' },
};

const RESULT_META: Record<
  ParsedTranscript['result'],
  { label: string; meaning: string; color: string }
> = {
  verified: {
    label: 'Inclusion verified',
    meaning: 'The leaf is proven to belong to the signed checkpoint. This is not a completed credentialing decision.',
    color: 'var(--vt-state-verified)',
  },
  failed: {
    label: 'Fails closed — integrity failure located',
    meaning: 'The recomputed root does not match the signed checkpoint: the leaf does not belong to this root. Rejected.',
    color: 'var(--vt-severity-critical)',
  },
  pending: {
    label: 'Proof incomplete',
    meaning: 'The trace has no root comparison yet. No verdict is claimed.',
    color: 'var(--vt-state-unknown)',
  },
};

function isParsed(v: VerificationTranscriptProps['steps']): v is ParsedTranscript {
  return !Array.isArray(v);
}

export function VerificationTranscript({ steps, root, className }: VerificationTranscriptProps) {
  const parsed = isParsed(steps) ? steps : parseVerificationSteps(steps);
  const result = RESULT_META[parsed.result];
  const failClosed = parsed.result === 'failed';

  return (
    <div
      data-transcript-result={parsed.result}
      className={cn('overflow-hidden rounded-[14px] border bg-[var(--vt-surface,transparent)]', className)}
      style={{
        borderColor: failClosed
          ? `color-mix(in oklab, ${result.color} 45%, transparent)`
          : 'var(--vt-border)',
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--vt-border)] px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
          Audit proof · Merkle inclusion
        </span>
      </div>

      {/* The trace */}
      <div className="overflow-x-auto px-4 py-3">
        <ol className="m-0 list-none p-0 font-mono text-[12px] leading-[1.9] tabular-nums">
          {parsed.steps.map((step, i) => {
            const m = MARKER[step.status];
            return (
              <li key={i} data-transcript-step={step.status} className="flex items-baseline gap-2.5 whitespace-nowrap">
                <span aria-hidden="true" style={{ color: m.color }}>{m.glyph}</span>
                <span className="sr-only">{step.status === 'fail' ? 'failure:' : step.status === 'ok' ? 'ok:' : ''}</span>
                <span
                  className={step.status === 'fail' ? 'font-semibold' : ''}
                  style={{ color: step.status === 'fail' ? m.color : 'var(--vt-text-secondary)' }}
                >
                  {step.text}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Verdict — located, never generic */}
      <div
        className="flex flex-col gap-0.5 border-t px-4 py-3"
        style={{
          borderColor: 'var(--vt-border)',
          background: `color-mix(in oklab, ${result.color} ${failClosed ? 12 : 8}%, transparent)`,
        }}
      >
        <span className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold" style={{ color: result.color }}>
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: result.color }} />
          {result.label}
        </span>
        <span className="text-[12px] leading-snug text-[var(--vt-text-secondary)]">
          {result.meaning}
          {root && parsed.result === 'verified' && (
            <span className="ml-1 font-mono text-[11px] text-[var(--vt-text-muted)]">root {root}</span>
          )}
        </span>
      </div>
    </div>
  );
}
