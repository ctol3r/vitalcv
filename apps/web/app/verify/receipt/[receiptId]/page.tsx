/**
 * /verify/[receiptId] — Verifier-facing replay inspectability page.
 *
 * Server Component. Fetches ReplayInspection at render time.
 * Readable in under 30 seconds for a hospital reviewer.
 * Public, no auth required.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReplayInspection } from '@/lib/replay/getReplayInspection';
import type { ReplayInspection, DegradationOwnership, ContinuityGap } from '@/lib/replay/getReplayInspection';
import { TrustTierBadge } from '@/components/proof/TrustTierBadge';
import type { TrustTier } from '@/components/proof/TrustTierBadge';
import { IssuerContinuityPanel } from '@/components/verifier/IssuerContinuityPanel';
import { LineageHeader as CanonicalLineageHeader } from '@/components/trust/primitives';
import { composeLineage } from '@/lib/trust/replay-grammar';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Replay Inspection — VitalCV',
  description: 'Verifier-facing replay chain and degradation ownership for a VitalCV credential receipt.',
  robots: { index: false, follow: false },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReplayInspectionPage({ params }: PageProps) {
  const { receiptId } = await params;

  if (!receiptId || !/^(rcpt_|rec-)/.test(receiptId)) {
    notFound();
  }

  const inspection = await getReplayInspection(receiptId);
  if (!inspection) notFound();

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* CANONICAL LINEAGE · object → ownership → checked_at → channel → replay → run_id */}
      <div className="px-6 pt-5">
        <div className="max-w-6xl mx-auto">
          <CanonicalLineageHeader
            state={inspection.signingKeyId ? 'signed' : 'snapshot'}
            slots={composeLineage({
              object: {
                label: 'Object',
                value: `Receipt · ${inspection.receiptId.slice(0, 12)}`,
                subLabel: 'replay-inspection target',
              },
              ownership: {
                label: 'Ownership',
                value: 'Subject',
                subLabel: inspection.signingKeyId ? 'issuer-bound' : 'pending bind',
              },
              checkedAt: {
                label: 'checked_at',
                value: inspection.checkedAt,
                subLabel: 'UTC',
              },
              channel: {
                label: 'Channel',
                value: 'verify.vitalcv.health',
                subLabel: 'verifier zone',
              },
              replay: {
                label: 'Replay',
                value: inspection.signingKeyId ? 'anchored' : 'pending anchor',
                subLabel: `${inspection.runs.length} runs · ${inspection.gaps.length} gaps`,
              },
              runId: {
                label: 'run_id',
                value: inspection.runId,
                subLabel: 'verification run head',
              },
            })}
          />
        </div>
      </div>

      {/* LEGACY DENSE HEADER · route-specific replay-inspection summary */}
      <ReplayInspectionHeader inspection={inspection} />

      {/* DEGRADATION OWNERSHIP BAR */}
      <DegradationBar
        ownership={inspection.degradationOwnership}
        explanation={inspection.degradationExplanation}
      />

      {/* MAIN GRID: replay chain + issuer continuity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-gray-800">
        <div className="border-r border-gray-800 p-5">
          <ReplayChainSection inspection={inspection} />
        </div>
        <div className="p-5">
          <IssuerSection inspection={inspection} />
        </div>
      </div>

      {/* SOURCE PROVENANCE STRIP */}
      <div className="border-t border-gray-800 p-5 bg-gray-900">
        <ProvenanceStripSection inspection={inspection} />
      </div>
    </main>
  );
}

// ─── Lineage Key Humanizer ───────────────────────────────────────────────────

function humanizeLineageKey(key: string | null | undefined): string {
  if (!key) return '—';
  const [source] = key.split(':');
  const labels: Record<string, string> = {
    NPPES_API: 'Identity',
    OIG_LEIE: 'Exclusion check',
    PECOS_PUBLIC: 'Medicare enrollment',
    nppes_identity: 'Identity',
    oig_exclusions: 'Exclusion check',
    state_license: 'State license',
    employment_history: 'Employment',
    board_cert: 'Board certification',
    pecos_enrollment: 'Medicare enrollment',
  };
  return labels[source] ?? key;
}

// ─── Lineage Header ───────────────────────────────────────────────────────────

// Renamed from `LineageHeader` to free the canonical name for the primitive
// imported above (`CanonicalLineageHeader`). This function renders the
// route-specific dense replay-inspection summary header, not the binding
// six-cell reading-order strip.
function ReplayInspectionHeader({ inspection }: { inspection: ReplayInspection }) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            VitalCV · Replay Inspection
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HeaderField label="Receipt ID">
            <span className="font-mono text-xs text-white break-all">{inspection.receiptId}</span>
          </HeaderField>
          <HeaderField label="Run ID">
            <span className="font-mono text-xs text-white">{inspection.runId}</span>
          </HeaderField>
          <HeaderField label="Checked">
            <span className="font-mono text-xs text-white">{inspection.checkedAt}</span>
          </HeaderField>
          <HeaderField label="Issuer">
            <span className="font-mono text-xs text-blue-300">{inspection.issuerDid}</span>
          </HeaderField>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <HeaderField label="Lineage Key">
            <span className="font-mono text-[11px] text-gray-300">
              {humanizeLineageKey(inspection.lineageKey)}
              {inspection.lineageKey && humanizeLineageKey(inspection.lineageKey) !== inspection.lineageKey && (
                <span className="text-gray-600 ml-1">({inspection.lineageKey})</span>
              )}
            </span>
          </HeaderField>
          {inspection.signingKeyId && (
            <HeaderField label="Key">
              <span className="font-mono text-[11px] text-gray-300 break-all">
                {inspection.signingKeyId.slice(0, 28)}…
              </span>
            </HeaderField>
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// ─── Degradation Bar ──────────────────────────────────────────────────────────

const DEGRADATION_STYLES: Record<
  DegradationOwnership,
  { bg: string; border: string; text: string; icon: string; label: string }
> = {
  no_adverse_findings: {
    bg: 'bg-green-900/40',
    border: 'border-green-700',
    text: 'text-green-300',
    icon: '✓',
    label: 'No Adverse Findings',
  },
  issuer_outage: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-600 border-dashed',
    text: 'text-amber-300',
    icon: '⚠',
    label: 'Issuer Outage',
  },
  vitalcv_outage: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-600 border-dashed',
    text: 'text-amber-300',
    icon: '⚠',
    label: 'VitalCV Outage',
  },
  anonymous_preview: {
    bg: 'bg-gray-800/50',
    border: 'border-gray-600 border-dashed',
    text: 'text-gray-400',
    icon: '○',
    label: 'Anonymous Preview',
  },
  stale_data: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-600',
    text: 'text-amber-300',
    icon: '⏱',
    label: 'Stale Data',
  },
  unknown: {
    bg: 'bg-gray-800/50',
    border: 'border-gray-600',
    text: 'text-gray-400',
    icon: '—',
    label: 'Unknown State',
  },
};

function DegradationBar({
  ownership,
  explanation,
}: {
  ownership: DegradationOwnership;
  explanation: string;
}) {
  const style = DEGRADATION_STYLES[ownership];

  return (
    <div className={`border-b ${style.border} ${style.bg} px-6 py-3`}>
      <div className="max-w-6xl mx-auto flex items-start gap-3">
        <span className={`text-lg leading-none mt-0.5 ${style.text}`}>{style.icon}</span>
        <div>
          <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
          <span className="text-xs text-gray-400 ml-2">— {explanation}</span>
        </div>
        <span className="ml-auto text-[10px] font-mono text-gray-600 uppercase tracking-wider whitespace-nowrap">
          {ownership}
        </span>
      </div>
    </div>
  );
}

// ─── Replay Chain Section ─────────────────────────────────────────────────────

function ReplayChainSection({ inspection }: { inspection: ReplayInspection }) {
  return (
    <div>
      <SectionTitle>Replay Chain</SectionTitle>

      {/* Run entries */}
      <div className="space-y-2 mb-5">
        {inspection.runs.map((run) => (
          <div
            key={run.runId}
            className="border border-gray-700 rounded bg-gray-900/60 p-3"
          >
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="font-mono text-[11px] text-gray-300">{run.runId}</span>
              <TrustTierBadge tier={run.tier as TrustTier} />
            </div>
            <div className="text-[11px] text-gray-400 mb-1 font-mono">{run.checkedAt}</div>
            <div className="text-xs text-gray-300">{run.source}</div>
            <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{run.laneId}</div>
            {run.priorRunId && (
              <div className="text-[10px] text-blue-400 mt-1 font-mono">
                ↳ prior: {run.priorRunId}
              </div>
            )}
            <div className="mt-1.5">
              <StatusPill status={run.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Continuity gaps */}
      <div className="mb-5">
        <SectionSubTitle>Continuity Gaps</SectionSubTitle>
        {inspection.gaps.length === 0 ? (
          <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded px-3 py-2">
            ✓ No continuity gaps
          </div>
        ) : (
          <div className="space-y-2">
            {inspection.gaps.map((gap, i) => (
              <GapEntry key={i} gap={gap} />
            ))}
          </div>
        )}
      </div>

      {/* Survivability score */}
      <SurvivabilityDisplay score={inspection.survivabilityScore} rationale={inspection.survivabilityRationale} />
    </div>
  );
}

function GapEntry({ gap }: { gap: ContinuityGap }) {
  const colors = {
    info: 'border-blue-700 bg-blue-900/20 text-blue-300',
    warning: 'border-amber-600 bg-amber-900/20 text-amber-300',
    critical: 'border-red-600 bg-red-900/20 text-red-300',
  }[gap.severity];

  const icon = { info: 'ℹ', warning: '⚠', critical: '✗' }[gap.severity];

  return (
    <div className={`border rounded px-3 py-2 ${colors}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider opacity-70 mb-0.5">
            {gap.gapType.replace(/_/g, ' ')} · {gap.severity}
          </div>
          <div className="text-xs">{gap.description}</div>
          {gap.affectedRunId && (
            <div className="text-[10px] font-mono mt-0.5 opacity-60">run: {gap.affectedRunId}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SurvivabilityDisplay({ score, rationale }: { score: number; rationale: string }) {
  const color =
    score >= 80 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const barColor =
    score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="border border-gray-700 rounded p-3 bg-gray-900/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Survivability
        </span>
        <span className={`text-xl font-bold font-mono ${color}`}>{score}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
        <div
          className={`${barColor} h-1.5 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400">{rationale}</p>
    </div>
  );
}

// ─── Issuer Section ───────────────────────────────────────────────────────────

function IssuerSection({ inspection }: { inspection: ReplayInspection }) {
  return (
    <div>
      <SectionTitle>Issuer Continuity</SectionTitle>

      {/* Existing IssuerContinuityPanel — wrapped for dark bg */}
      <div className="bg-white rounded overflow-hidden mb-4">
        <IssuerContinuityPanel
          did={inspection.issuerDid}
          signingKeyId={inspection.signingKeyId}
        />
      </div>

      {/* Signer rotation history */}
      <SectionSubTitle>Signer History</SectionSubTitle>
      <div className="space-y-2">
        {inspection.signerHistory.map((entry) => (
          <div
            key={entry.kid}
            className="border border-gray-700 rounded bg-gray-900/60 p-3 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-gray-300 break-all">{entry.kid}</span>
              {entry.activeTo === null && (
                <span className="text-[10px] bg-green-900/50 text-green-400 border border-green-700 rounded px-1.5 py-0.5 ml-2 whitespace-nowrap">
                  Active
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              {entry.algorithm} · from: {entry.activeFrom}
              {entry.activeTo && ` · to: ${entry.activeTo}`}
            </div>
          </div>
        ))}
      </div>

      {/* Source continuity */}
      <div className="mt-4">
        <SectionSubTitle>Source Continuity</SectionSubTitle>
        <div className="border border-gray-700 rounded bg-gray-900/60 p-3 text-xs space-y-1.5">
          <SourceRow label="Source ID">{inspection.sourceContinuity.sourceId}</SourceRow>
          <SourceRow label="Display Name">{inspection.sourceContinuity.displayName}</SourceRow>
          <SourceRow label="Lifecycle">
            <LifecyclePill lifecycle={inspection.sourceContinuity.lifecycle} />
          </SourceRow>
          <SourceRow label="Last Checked">
            <span className="font-mono">{inspection.sourceContinuity.lastChecked ?? '—'}</span>
          </SourceRow>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-gray-500 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-300 flex-1">{children}</span>
    </div>
  );
}

function LifecyclePill({ lifecycle }: { lifecycle: 'active' | 'partial' | 'planned' }) {
  const styles = {
    active:  'bg-green-900/40 text-green-300 border-green-700',
    partial: 'bg-amber-900/40 text-amber-300 border-amber-600',
    planned: 'bg-gray-800 text-gray-400 border-gray-600',
  }[lifecycle];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${styles}`}>
      {lifecycle}
    </span>
  );
}

// ─── Provenance Strip ─────────────────────────────────────────────────────────

function ProvenanceStripSection({ inspection }: { inspection: ReplayInspection }) {
  return (
    <div className="max-w-6xl mx-auto">
      <SectionTitle>Source Provenance</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 pb-2 pr-4">Source</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 pb-2 pr-4">Checked At</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 pb-2 pr-4">Receipt ID</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 pb-2">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {inspection.runs.map((run) => (
              <tr key={run.runId} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-2 pr-4">
                  <div className="font-medium text-gray-200">{run.source}</div>
                  <div className="text-[10px] font-mono text-gray-500">{run.laneId}</div>
                </td>
                <td className="py-2 pr-4 font-mono text-gray-400">{run.checkedAt}</td>
                <td className="py-2 pr-4 font-mono text-gray-400">
                  {run.receiptId ? `${run.receiptId.slice(0, 12)}…` : '—'}
                </td>
                <td className="py-2">
                  <TrustTierBadge tier={run.tier as TrustTier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* JWKS link */}
      <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-600">
        <span>Issuer:</span>
        <span className="font-mono text-gray-500">{inspection.issuerDid}</span>
        <span>·</span>
        <a
          href={inspection.jwksUri}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-500 hover:text-blue-400"
        >
          {inspection.jwksUri}
        </a>
      </div>
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

const STATUS_PILL_STYLES: Record<string, string> = {
  verified:        'bg-green-900/50 text-green-300 border border-green-700',
  in_progress:     'bg-blue-900/50 text-blue-300 border border-blue-700',
  not_checked:     'bg-gray-800 text-gray-500 border border-gray-700',
  stale:           'bg-amber-900/40 text-amber-300 border border-amber-600',
  unavailable:     'bg-gray-800 text-gray-500 border border-gray-600',
  access_required: 'bg-amber-900/40 text-amber-300 border border-amber-600',
  review_required: 'bg-amber-900/50 text-amber-200 border border-amber-500',
  adverse:         'bg-red-900/50 text-red-300 border border-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  verified:        'Source-backed',
  in_progress:     'In Progress',
  not_checked:     'Not Checked',
  stale:           'Stale',
  unavailable:     'Unavailable',
  access_required: 'Access Required',
  review_required: 'Review Required',
  adverse:         'Adverse',
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL_STYLES[status] ?? 'bg-gray-800 text-gray-400 border border-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Shared layout primitives ─────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
      {children}
    </h2>
  );
}

function SectionSubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2 mt-4">
      {children}
    </h3>
  );
}
