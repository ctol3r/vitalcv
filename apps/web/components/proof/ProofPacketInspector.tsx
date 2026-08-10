'use client';

/**
 * ProofPacketInspector (SHD-4.2) — one real, interactive proof moment.
 *
 * A visitor picks a representative claim and inspects the whole chain in one
 * place: claim → source → retrieval / receipt → state → limitation. It is built
 * from VitalCV's real evidence grammar (the passport source-coverage shape:
 * source, checkedAt, receipt, reason), and it is EXPLICITLY illustrative — it
 * never presents as a live clinician result. The employer boundary is stated:
 * employers begin review from attributed evidence; final credentialing stays
 * with the institution.
 *
 * Composes the canonical ProvenanceChip (state carries its own source + time).
 * Pure/SSR-safe first render (first claim selected); selection is client-side.
 */

import * as React from 'react';
import { ProvenanceChip, type ProvenanceState } from '@/design-system/components';

export interface ProofItem {
  id: string;
  /** The claim, in the reviewer's language. */
  claim: string;
  /** The evidence class, e.g. "Identity", "Exclusions". */
  kind: string;
  source: string;
  sourceUrl: string;
  state: ProvenanceState;
  checkedAt?: string;
  /** Receipt reference for the retrieval (illustrative). */
  receiptId: string;
  /** How the value was obtained. */
  retrieval: string;
  /** What this does — and does not — establish. */
  limitation: string;
}

/** Illustrative, grammar-accurate proof items. Not a live clinician result. */
export const PROOF_ITEMS: ReadonlyArray<ProofItem> = [
  {
    id: 'identity',
    claim: 'Identity resolves to a single NPI',
    kind: 'Identity',
    source: 'NPPES NPI Registry',
    sourceUrl: 'npiregistry.cms.hhs.gov',
    state: 'checked',
    checkedAt: '2026-07-14T09:12:00Z',
    receiptId: 'rcpt:nppes:8f2a…c41',
    retrieval: 'Queried the public NPPES registry by NPI; matched the record exactly.',
    limitation: 'Confirms the registry entry, not the underlying facts a clinician self-reported to NPPES.',
  },
  {
    id: 'exclusions',
    claim: 'No federal exclusion on record',
    kind: 'Exclusions',
    source: 'OIG / LEIE exclusions',
    sourceUrl: 'oig.hhs.gov/exclusions',
    state: 'checked',
    checkedAt: '2026-07-14T09:12:03Z',
    receiptId: 'rcpt:oig:7f3c…8d',
    retrieval: 'Swept the OIG LEIE list; no exclusion match returned.',
    limitation: 'A no-match result is not a good-standing guarantee — only that no listed exclusion was found on this date.',
  },
  {
    id: 'enrollment',
    claim: 'Medicare enrollment via PECOS',
    kind: 'Enrollment',
    source: 'CMS PECOS',
    sourceUrl: 'data.cms.gov',
    state: 'reviewRequired',
    checkedAt: '2026-07-14T09:12:05Z',
    receiptId: 'rcpt:pecos:c40a…19',
    retrieval: 'Checked CMS enrollment; status needs a human read before it advances.',
    limitation: 'Enrollment status is routed to review — it is not, by itself, an eligibility decision.',
  },
  {
    id: 'licensure',
    claim: 'State medical license',
    kind: 'Licensure',
    source: 'State Medical Board',
    sourceUrl: 'access-gated',
    state: 'gated',
    receiptId: '—',
    retrieval: 'Not retrieved. State boards are read only under an agreement VitalCV does not hold here.',
    limitation: 'Access-gated — shown as gated, never inferred as present or clear.',
  },
  {
    id: 'board-cert',
    claim: 'Board certification',
    kind: 'Certification',
    source: 'ABMS',
    sourceUrl: 'certificationmatters.org',
    state: 'stale',
    checkedAt: '2026-01-04T00:00:00Z',
    receiptId: 'rcpt:abms:4d2e…9a1',
    retrieval: 'Confirmed with ABMS, but the check has aged past its freshness window.',
    limitation: 'Was checked; now stale. A refresh is one request away — it is not treated as current.',
  },
];

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(88px,auto)_1fr] gap-3 py-2 border-t border-[var(--vt-border)] first:border-t-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)] pt-0.5">
        {label}
      </span>
      <span className="min-w-0 text-[13px] text-[var(--vt-text-secondary)]">{children}</span>
    </div>
  );
}

export function ProofPacketInspector({ className }: { className?: string }) {
  const [selectedId, setSelectedId] = React.useState(PROOF_ITEMS[0].id);
  const selected = PROOF_ITEMS.find((i) => i.id === selectedId) ?? PROOF_ITEMS[0];
  const selectedIndex = PROOF_ITEMS.findIndex((i) => i.id === selectedId);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = selectedIndex;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(PROOF_ITEMS.length - 1, selectedIndex + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(0, selectedIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = PROOF_ITEMS.length - 1;
    else return;
    e.preventDefault();
    setSelectedId(PROOF_ITEMS[next].id);
  };

  return (
    <div
      data-proof-packet-inspector=""
      className={['overflow-hidden rounded-[16px] border border-[var(--vt-border)] bg-[var(--vt-surface,transparent)]', className].filter(Boolean).join(' ')}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--vt-border)] px-4 py-2.5">
        <span className="text-[13px] font-semibold text-[var(--vt-text-primary)]">Proof packet · inspect a claim</span>
        <span
          data-proof-illustrative=""
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]"
        >
          Illustrative — not a live result
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(200px,0.9fr)_1.4fr]">
        {/* Claim list */}
        <ul
          role="tablist"
          aria-label="Proof packet claims"
          aria-orientation="vertical"
          className="m-0 list-none border-b border-[var(--vt-border)] p-0 sm:border-b-0 sm:border-r"
          onKeyDown={onKeyDown}
        >
          {PROOF_ITEMS.map((item) => {
            const active = item.id === selectedId;
            return (
              <li key={item.id} role="presentation" className="border-t border-[var(--vt-border)] first:border-t-0">
                <button
                  type="button"
                  role="tab"
                  id={`proof-tab-${item.id}`}
                  aria-selected={active}
                  aria-controls="proof-detail"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelectedId(item.id)}
                  data-proof-claim={item.id}
                  className={[
                    'flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors',
                    active ? 'bg-[var(--vt-surface-subtle,transparent)]' : 'hover:bg-[var(--vt-surface-subtle,transparent)]',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">{item.kind}</span>
                    <span className={['block text-[13px]', active ? 'font-semibold text-[var(--vt-text-primary)]' : 'text-[var(--vt-text-secondary)]'].join(' ')}>
                      {item.claim}
                    </span>
                  </span>
                  <span aria-hidden="true" className="font-mono text-[12px] text-[var(--vt-text-muted)]">{active ? '›' : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Detail: claim → source → retrieval/receipt → state → limitation */}
        <div
          role="tabpanel"
          id="proof-detail"
          aria-labelledby={`proof-tab-${selected.id}`}
          className="p-4"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--vt-text-primary)]">{selected.claim}</h3>
            {/* This inspector is EXPLICITLY illustrative (see the file header),
                so its chips attribute as examples — never as results about a
                real provider. */}
            <ProvenanceChip
              state={selected.state}
              attribution={{ legend: true, source: selected.source, asOf: selected.checkedAt }}
            />
          </div>
          <DetailRow label="Source">
            {selected.source} <span className="font-mono text-[11px] text-[var(--vt-text-muted)]">· {selected.sourceUrl}</span>
          </DetailRow>
          <DetailRow label="Retrieval">{selected.retrieval}</DetailRow>
          <DetailRow label="Receipt">
            <span className="font-mono text-[11.5px] tabular-nums text-[var(--vt-text-secondary)]">{selected.receiptId}</span>
          </DetailRow>
          <DetailRow label="Limitation">
            <span className="text-[var(--vt-text-primary)]">{selected.limitation}</span>
          </DetailRow>
        </div>
      </div>

      <p className="border-t border-[var(--vt-border)] px-4 py-2.5 text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
        Employers begin review from this attributed evidence — not from intake. Final credentialing, privileging, and
        hiring authority remain with the institution.
      </p>
    </div>
  );
}

export default ProofPacketInspector;
