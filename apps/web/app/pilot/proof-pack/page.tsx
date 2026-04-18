/**
 * /pilot/proof-pack — Operator-facing proof-pack view
 *
 * Renders the current pilot proof pack with honest-partial framing:
 *   - counts + medians (null-safe; "—" when missing)
 *   - tier context (decision-grade / partial / draft submit counts)
 *   - blocker totals with open-wait flag
 *   - limitations list surfaced as a bullet set
 *   - download link for the deterministic JSON artifact
 *
 * This view is deliberately minimal. It reads from the GET variant of
 * /api/pilot/proof-pack (zero-application demonstration of the partial-
 * data response). A future wave wires real snapshots into the POST body.
 */

import type { Metadata } from 'next';
import { buildPilotProofPack, serializePilotProofPack } from '@/lib/proof/pilot-proof-pack';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pilot Proof Pack — VitalCV',
  description:
    'Deterministic proof-pack artifact for VitalCV pilot buyers. Counts, medians, tier context, and explicit limitations.',
};

function formatNullable(value: number | null, suffix: string): string {
  return value === null ? '—' : `${value}${suffix}`;
}

export default function PilotProofPackPage() {
  // Server-rendered from the same builder the API route consumes, so the
  // page view and the downloaded JSON are byte-identical for the same
  // input set. Real snapshots flow in via the /api/pilot/proof-pack POST
  // route; this server page demonstrates the zero-snapshot baseline.
  const { pack } = buildPilotProofPack({ applications: [] });
  const serialized = serializePilotProofPack(pack);

  return (
    <main className="min-h-screen bg-[var(--vt-bg)] text-[var(--vt-text-primary)] pb-24">
      <header className="border-b border-[var(--vt-border)] px-6 py-6 sm:px-8 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Pilot Proof Pack
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
          Buyer-legible pilot evidence
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
          This page renders the deterministic proof-pack artifact. Counts and medians are computed
          only from recorded events — nothing is imputed. When a metric is missing, it renders as
          &ldquo;—&rdquo; and the limitations list below names the gap explicitly.
        </p>
        <p className="mt-2 text-xs text-muted-foreground font-mono">
          Generated: {pack.generatedAt}
        </p>
      </header>

      <section className="px-6 py-6 sm:px-8 sm:py-8 space-y-8 max-w-4xl">
        {pack.partialDataNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
            data-slot="partial-data-notice"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600 mb-1">
              Partial data
            </p>
            <p className="text-sm text-foreground leading-relaxed">{pack.partialDataNotice}</p>
          </div>
        )}

        {/* Counts */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Counts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <CountTile label="Applications submitted" value={pack.counts.applicationsSubmitted} />
            <CountTile label="Reviews opened" value={pack.counts.reviewsOpened} />
            <CountTile label="Actions taken" value={pack.counts.actionsTaken} />
            <CountTile label="Advanced" value={pack.counts.advancedCount} />
            <CountTile label="Start-ready" value={pack.counts.startReadyCount} />
            <CountTile label="Started" value={pack.counts.startedCount} />
          </div>
        </div>

        {/* Medians */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Median time deltas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MedianTile
              label="Submit → first view"
              value={formatNullable(pack.medians.medianMinutesToFirstView, ' min')}
            />
            <MedianTile
              label="Submit → first action"
              value={formatNullable(pack.medians.medianMinutesToFirstAction, ' min')}
            />
            <MedianTile
              label="Submit → start-ready"
              value={formatNullable(pack.medians.medianDaysToStartReady, ' days')}
            />
            <MedianTile
              label="Submit → started"
              value={formatNullable(pack.medians.medianDaysToStarted, ' days')}
            />
          </div>
        </div>

        {/* Tier context */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Tier context at submit
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <CountTile
              label="Decision-grade"
              value={pack.tierContext.decisionGradeAtSubmit}
              tone="emerald"
            />
            <CountTile label="Partial" value={pack.tierContext.partialAtSubmit} tone="amber" />
            <CountTile label="Draft" value={pack.tierContext.draftAtSubmit} tone="neutral" />
          </div>
        </div>

        {/* Blockers */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Blockers
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CountTile label="Refresh requests" value={pack.blockers.totalRefreshRequests} />
            <CountTile
              label="Missing-info requests"
              value={pack.blockers.totalMissingInfoRequests}
            />
            <CountTile
              label="Open waits"
              value={pack.blockers.applicationsWithOpenWait}
              tone={pack.blockers.applicationsWithOpenWait > 0 ? 'amber' : 'neutral'}
            />
            <MedianTile
              label="Median refresh wait"
              value={formatNullable(pack.blockers.medianMinutesInRefreshWait, ' min')}
            />
          </div>
        </div>

        {/* Limitations */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Limitations ({pack.limitations.length})
          </h2>
          {pack.limitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No limitations recorded.</p>
          ) : (
            <ul className="space-y-2">
              {pack.limitations.map((limit, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-[var(--vt-border)] bg-card px-4 py-3 text-sm text-foreground leading-relaxed"
                >
                  <span className="text-amber-500 mr-2" aria-hidden>
                    ◦
                  </span>
                  {limit}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Download */}
        <div className="pt-4 border-t border-[var(--vt-border)]">
          <a
            href="/api/pilot/proof-pack?download=json"
            download
            className="inline-flex items-center gap-2 rounded-lg border border-foreground bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
          >
            Download proof pack (JSON)
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            Deterministic for identical input. Safe to diff across exports.
          </p>
        </div>

        {/* Raw JSON preview */}
        <details className="rounded-lg border border-[var(--vt-border)] bg-card px-4 py-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Raw serialized pack
          </summary>
          <pre className="mt-3 overflow-auto rounded-md bg-black/30 p-3 text-xs font-mono text-foreground/80 leading-relaxed">
            {serialized}
          </pre>
        </details>
      </section>
    </main>
  );
}

function CountTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'emerald' | 'amber';
}) {
  const tonedClass =
    tone === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : tone === 'amber'
        ? 'border-amber-500/25 bg-amber-500/5'
        : 'border-[var(--vt-border)] bg-card';
  return (
    <div className={`rounded-lg border px-4 py-3 ${tonedClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function MedianTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--vt-border)] bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
