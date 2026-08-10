import * as React from 'react';
import { cn } from '@/lib/utils';
import { ProvenanceChip } from './ProvenanceChip';

/**
 * VerdictSplit (W4) — the public verify verdict, split into the two questions a
 * credential actually has to answer, never collapsed into one green banner:
 *
 *   Integrity        — does the math hold? (signature, digest set, inclusion)
 *   Issuer legitimacy — is the signer real? (registry + revocation)
 *
 * A signature-valid credential from an unrecognized issuer is its own MIXED
 * state, distinct from a fully-verifiable one and from a rejection. Revocation
 * is always a visible step (reusing the canonical ProvenanceChip `revoked`
 * register), and a revoked credential renders a full stop — it can never read
 * as merely "unavailable". Pure / SSR-safe. Never renders the bare word
 * "Verified" as a status.
 */

export type VerdictStatus = 'pass' | 'mixed' | 'fail' | 'pending';

export interface VerdictItem {
  /** Named check, e.g. "Signature valid · ES256". */
  label: string;
  status: VerdictStatus;
  /** Optional plain detail. */
  detail?: string;
  /** Optional mono provenance line (source · timestamp / key / root). */
  provenance?: string;
}

export type RevocationState = 'none-found' | 'revoked' | 'unknown';

export interface VerdictSplitProps {
  integrity: ReadonlyArray<VerdictItem>;
  issuer: ReadonlyArray<VerdictItem>;
  /** Revocation is surfaced as its own visible step; `revoked` fails closed. */
  revocation?: {
    state: RevocationState;
    source?: string;
    checkedAt?: string;
  };
  className?: string;
}

const ITEM_META: Record<
  VerdictStatus,
  { glyph: string; color: string; sr: string }
> = {
  pass: { glyph: '✓', color: 'var(--vt-state-source-confirmed)', sr: 'pass' },
  mixed: { glyph: '◐', color: 'var(--vt-state-pending)', sr: 'mixed' },
  fail: { glyph: '✗', color: 'var(--vt-severity-critical)', sr: 'fail' },
  pending: { glyph: '○', color: 'var(--vt-state-unknown)', sr: 'pending' },
};

/** Derive the honest overall verdict from the two halves + revocation. */
export function deriveOverallVerdict(
  integrity: ReadonlyArray<VerdictItem>,
  issuer: ReadonlyArray<VerdictItem>,
  revocation?: VerdictSplitProps['revocation'],
): { status: VerdictStatus | 'revoked'; label: string; meaning: string } {
  const all = [...integrity, ...issuer];
  if (revocation?.state === 'revoked') {
    return {
      status: 'revoked',
      label: 'Revoked — fails closed',
      meaning: 'This credential was withdrawn at the source. It cannot be relied on; its custody history stays visible.',
    };
  }
  if (all.some((i) => i.status === 'fail')) {
    return {
      status: 'fail',
      label: 'Fails closed',
      meaning: 'A required check did not pass. This credential is rejected.',
    };
  }
  if (all.some((i) => i.status === 'pending')) {
    return {
      status: 'pending',
      label: 'Checks pending',
      meaning: 'Some checks have not resolved yet. No verdict is claimed.',
    };
  }
  const integrityOk = integrity.every((i) => i.status === 'pass');
  const issuerMixed = issuer.some((i) => i.status === 'mixed');
  if (integrityOk && issuerMixed) {
    return {
      status: 'mixed',
      label: 'Mixed — signature valid, issuer unrecognized',
      meaning: 'The math holds, but the signer is not a recognized issuer. Treat with care.',
    };
  }
  if (all.some((i) => i.status === 'mixed')) {
    return {
      status: 'mixed',
      label: 'Mixed result',
      meaning: 'Some checks passed and some need attention. Read both halves below.',
    };
  }
  return {
    status: 'pass',
    label: 'Verifiable',
    meaning: 'Integrity holds and the issuer is recognized. This is not a completed credentialing decision.',
  };
}

function VerdictLine({ item }: { item: VerdictItem }) {
  const m = ITEM_META[item.status];
  return (
    <li className="flex items-baseline gap-2.5 py-1.5 text-[13px]">
      <span aria-hidden="true" className="font-mono text-[13px] leading-none" style={{ color: m.color }}>
        {m.glyph}
      </span>
      <span className="sr-only">{m.sr}:</span>
      <span className="min-w-0 flex-1">
        <span className="text-[var(--vt-text-primary)]">{item.label}</span>
        {item.detail && <span className="text-[var(--vt-text-secondary)]"> · {item.detail}</span>}
        {item.provenance && (
          <span className="mt-0.5 block font-mono text-[10.5px] tabular-nums text-[var(--vt-text-muted)]">
            {item.provenance}
          </span>
        )}
      </span>
    </li>
  );
}

function VerdictHalf({ title, items }: { title: string; items: ReadonlyArray<VerdictItem> }) {
  return (
    <div className="min-w-0 p-4">
      <h4 className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
        {title}
      </h4>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <VerdictLine key={item.label} item={item} />
        ))}
      </ul>
    </div>
  );
}

const OVERALL_COLOR: Record<string, string> = {
  pass: 'var(--vt-state-source-confirmed)',
  mixed: 'var(--vt-state-pending)',
  pending: 'var(--vt-state-unknown)',
  fail: 'var(--vt-severity-critical)',
  revoked: 'var(--vt-severity-critical)',
};

export function VerdictSplit({ integrity, issuer, revocation, className }: VerdictSplitProps) {
  const overall = deriveOverallVerdict(integrity, issuer, revocation);
  const color = OVERALL_COLOR[overall.status];
  const failClosed = overall.status === 'fail' || overall.status === 'revoked';

  return (
    <div
      data-verdict={overall.status}
      className={cn(
        'overflow-hidden rounded-[14px] border bg-[var(--vt-surface,transparent)]',
        className,
      )}
      style={{
        borderColor: failClosed
          ? `color-mix(in oklab, ${color} 45%, transparent)`
          : 'var(--vt-border)',
      }}
    >
      {/* Overall verdict header */}
      <div
        className="flex flex-col gap-1 px-4 py-3"
        style={{ background: `color-mix(in oklab, ${color} ${failClosed ? 12 : 8}%, transparent)` }}
      >
        <span
          className="inline-flex w-fit items-center gap-2 font-semibold"
          style={{ color }}
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
          {overall.label}
        </span>
        <span className="text-[12.5px] leading-snug text-[var(--vt-text-secondary)]">{overall.meaning}</span>
      </div>

      {/* Two halves */}
      <div className="grid grid-cols-1 border-t border-[var(--vt-border)] sm:grid-cols-2">
        <div className="border-b border-[var(--vt-border)] sm:border-b-0 sm:border-r">
          <VerdictHalf title="Integrity" items={integrity} />
        </div>
        <div>
          <VerdictHalf title="Issuer legitimacy" items={issuer} />
          {revocation && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--vt-border)] px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                Revocation
              </span>
              <ProvenanceChip
                state={
                  revocation.state === 'revoked'
                    ? 'revoked'
                    : revocation.state === 'none-found'
                      ? 'checked'
                      : 'unavailable'
                }
                label={
                  revocation.state === 'revoked'
                    ? 'Revoked'
                    : revocation.state === 'none-found'
                      ? 'None found'
                      : 'Not checked'
                }
                attribution={
                  // Both `source` and `checkedAt` are optional upstream. When a
                  // source is named, `asOf: null` still renders the words
                  // rather than vanishing. When none is named, nothing read the
                  // status list — which is `declared`, not a source with a
                  // missing timestamp. The 'Not checked' label already says so.
                  revocation.source
                    ? {
                        source: revocation.source,
                        asOf: revocation.checkedAt ?? null,
                        detail:
                          revocation.state === 'none-found'
                            ? 'checked against status list'
                            : undefined,
                      }
                    : { declared: 'no revocation source recorded' }
                }
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
