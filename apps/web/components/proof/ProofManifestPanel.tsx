/**
 * ProofManifestPanel.tsx — W4-PR248A.
 *
 * Render-only server component that surfaces a ProofManifest in the
 * runtime. Accepts the raw manifest (unknown shape — caller may have
 * fetched it from the embed-sdk or the source-adapters output) and
 * derives a fail-closed view via deriveProofManifestView.
 *
 * Visual rules enforced here:
 *   - Coverage lanes with ambiguity-visible status carry an explicit
 *     "ambiguity-visible" indicator — never a green "Verified" badge.
 *   - The aggregate verdict label uses compound forms only ("Source-
 *     backed evidence", "Partial coverage", etc.) — never the bare
 *     word "Verified" per CLAUDE.md.
 *   - When the manifest is incomplete, an ambiguity banner is shown
 *     and the lanes section is hidden — we do not display partial
 *     coverage as if it were full coverage.
 *   - All limitations are listed; if there are none, the empty-state
 *     copy says "No limitations recorded in this manifest" rather
 *     than "Clean" or "All clear".
 */

import * as React from 'react';
import { deriveProofManifestView, type ProofManifestView } from '@/lib/proof/proofManifestView';

interface Props {
  /** Raw manifest from upstream — shape is narrowed at render time. */
  manifest: unknown;
  /** Optional override for the heading; defaults to "Proof manifest". */
  heading?: string;
}

function aggregateLabel(verdict: ProofManifestView['aggregateVerdict']): string {
  switch (verdict) {
    case 'verified-source-data':
      return 'Source-backed evidence';
    case 'partial':
      return 'Partial coverage';
    case 'no-coverage':
      return 'No coverage on this manifest';
    case 'unknown':
      return 'Manifest incomplete — ambiguity preserved';
  }
}

export function ProofManifestPanel({ manifest, heading = 'Proof manifest' }: Props): React.ReactElement {
  const view = deriveProofManifestView(manifest);

  return (
    <section
      className="rounded-md border border-zinc-200 bg-white p-5 text-zinc-900"
      data-testid="proof-manifest-panel"
      data-aggregate-verdict={view.aggregateVerdict}
      data-manifest-incomplete={String(view.manifestIncomplete)}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <span
          className="font-mono text-xs uppercase tracking-wider text-zinc-500"
          data-testid="proof-manifest-aggregate"
        >
          {aggregateLabel(view.aggregateVerdict)}
        </span>
      </header>

      {view.manifestIncomplete && (
        <p
          className="mb-4 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
          data-testid="proof-manifest-ambiguity-banner"
        >
          Manifest was returned incomplete. Required fields are missing; the surface is in
          ambiguity-visible mode and does not claim coverage.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500">Manifest ID</dt>
        <dd className="font-mono">{view.manifestId ?? '—'}</dd>

        <dt className="text-zinc-500">Schema</dt>
        <dd className="font-mono">{view.schema ?? '—'}</dd>

        <dt className="text-zinc-500">Generated at</dt>
        <dd className="font-mono">{view.generatedAt ?? '—'}</dd>

        <dt className="text-zinc-500">Subject NPI</dt>
        <dd className="font-mono">{view.subject.npi ?? '—'}</dd>

        <dt className="text-zinc-500">Readiness posture</dt>
        <dd>{view.readinessPosture ?? '—'}</dd>

        <dt className="text-zinc-500">Proof availability</dt>
        <dd>{view.proofAvailability ?? '—'}</dd>

        <dt className="text-zinc-500">Receipts</dt>
        <dd>{view.receiptCount}</dd>

        <dt className="text-zinc-500">Claims</dt>
        <dd>{view.claimCount}</dd>

        <dt className="text-zinc-500">Stale lanes</dt>
        <dd>{view.freshness.staleLanes}</dd>
      </dl>

      {!view.manifestIncomplete && view.coverage.length > 0 && (
        <section className="mt-5" data-testid="proof-manifest-coverage">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Coverage lanes</h3>
          <ul className="space-y-1.5 text-sm">
            {view.coverage.map((lane) => (
              <li
                key={`${lane.source}-${lane.laneType}`}
                className="flex items-center justify-between rounded-sm border border-zinc-100 px-3 py-1.5"
                data-testid="proof-manifest-lane"
                data-ambiguity-visible={String(lane.ambiguityVisible)}
              >
                <span className="font-mono text-xs uppercase tracking-wide">
                  {lane.source} · {lane.laneType}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">{lane.status}</span>
                  {lane.ambiguityVisible && (
                    <span
                      className="rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-900"
                      title="Ambiguity-visible — status is not OK/VERIFIED/FRESH"
                    >
                      Ambiguity-visible
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5" data-testid="proof-manifest-limitations">
        <h3 className="mb-2 text-sm font-semibold text-zinc-700">Limitations</h3>
        {view.limitations.length === 0 ? (
          <p className="text-sm text-zinc-500">No limitations recorded in this manifest.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {view.limitations.map((lim, idx) => (
              <li
                key={`${lim.kind}-${idx}`}
                className="rounded-sm border border-zinc-100 px-3 py-1.5"
                data-testid="proof-manifest-limitation"
              >
                <span className="font-mono text-xs uppercase">{lim.kind}</span>
                {lim.detail && <span className="ml-2 text-zinc-600">{lim.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
