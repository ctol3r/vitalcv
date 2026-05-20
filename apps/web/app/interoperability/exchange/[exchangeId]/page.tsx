/**
 * /interoperability/exchange/[exchangeId] -- Verification Exchange
 * Workspace (rehearsal infrastructure).
 *
 * Single dense institutional surface that demonstrates the SHAPE of
 * an evidence handoff between two institutions. Reuses the canonical
 * trust primitives (LineageHeader via ProvenanceChronology), the
 * institutional language module, and the degradation grammar.
 *
 * Critical posture (binding):
 *  - This is a REHEARSAL. Nothing on the page constitutes production
 *    credential issuance, wallet auth, OpenID flow, or federation.
 *  - The receiving institution OWNS the cross-check. The page shows
 *    affordances; it does not perform trust transfers.
 *  - Continuity states reuse the canonical DegradationState taxonomy.
 *  - No "automatic acceptance", "instant verification", or "fully
 *    verified" language.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDemoExchange } from '@/lib/interoperability/demoExchanges';
import {
  describeExchangeReadiness,
  visualForExchangeReadiness,
} from '@/lib/interoperability/exchangeReadiness';
import { summarizeReplayBundle } from '@/lib/interoperability/replayBundleEnvelope';
import { describeDegradation } from '@/lib/trust/degradation';
import { ProvenanceChronology } from '@/components/trust/navigation';
import { IndependentCrossCheckPanel } from '@/components/interoperability/IndependentCrossCheckPanel';
import { TrustExchangeTimeline } from '@/components/interoperability/TrustExchangeTimeline';
import { EvidenceReusePanel } from '@/components/interoperability/EvidenceReusePanel';
import { ExportVerificationExchangeButton } from '@/components/interoperability/ExportVerificationExchangeButton';

export const metadata: Metadata = {
  title: 'Verification exchange · VitalCV interoperability rehearsal',
  description:
    'Rehearsal infrastructure: institutional trust-evidence handoff with replay bundle, independent cross-check lane, and operational timeline.',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ exchangeId: string }>;
}

export default async function VerificationExchangePage({ params }: PageProps) {
  const { exchangeId } = await params;
  const exchange = getDemoExchange(exchangeId);
  if (!exchange) notFound();

  const readiness = describeExchangeReadiness(exchange.readiness);
  const summary = summarizeReplayBundle(exchange.envelope);
  const envelope = exchange.envelope;
  const continuityCopy = describeDegradation(envelope.continuityStatus);
  const visualToken = visualForExchangeReadiness(exchange.readiness);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900 bg-slate-950 px-5 py-3 font-mono text-xs uppercase tracking-wider text-slate-100">
        Verification exchange · rehearsal · {exchange.exchangeId}
      </header>

      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
        {/* Institutional masthead */}
        <section
          data-slot="exchange-masthead"
          className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-900 bg-white p-5 sm:grid-cols-12"
        >
          <div className="sm:col-span-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Originating institution
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {envelope.originatingInstitution.displayName}
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
              role · {envelope.originatingInstitution.role}
            </div>
            {envelope.originatingInstitution.discoveryUrl ? (
              <div className="mt-1 font-mono text-[11px] text-slate-600 break-all">
                {envelope.originatingInstitution.discoveryUrl}
              </div>
            ) : null}
          </div>
          <div className="hidden items-center justify-center sm:col-span-2 sm:flex">
            <span aria-hidden="true" className="text-slate-500">
              →
            </span>
          </div>
          <div className="sm:col-span-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Receiving institution
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {envelope.receivingInstitution.displayName}
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
              role · {envelope.receivingInstitution.role}
            </div>
          </div>
          <div className="border-t border-slate-200 pt-3 sm:col-span-12">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Envelope" value={envelope.envelopeId} />
              <Stat label="Replay head" value={envelope.replayId} />
              <Stat label="Evidence refs" value={String(summary.evidenceCount)} />
              <Stat
                label="Cross-check"
                value={envelope.crossCheckEligibility.replace(/_/g, ' ')}
              />
            </div>
          </div>
        </section>

        {/* Readiness chip + actions */}
        <section
          data-slot="exchange-readiness"
          data-readiness={readiness.state}
          data-readiness-visual={visualToken}
          className={`rounded-2xl border bg-white p-4 ${
            visualToken === 'hard_interruption'
              ? 'border-2 border-rose-900'
              : visualToken === 'dashed'
                ? 'border-dashed border-slate-700'
                : visualToken === 'manual_lane'
                  ? 'border-slate-900'
                  : 'border-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Exchange readiness
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {readiness.headline}
              </div>
              <p className="mt-1 max-w-[62ch] text-sm text-slate-700">
                {readiness.detail}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                owned by · {readiness.ownedBy.replace(/_/g, ' ')}
                {readiness.terminal ? ' · terminal' : ''}
              </p>
            </div>
            <ExportVerificationExchangeButton />
          </div>
        </section>

        {/* Canonical reading-order strip from provenance navigation */}
        <ProvenanceChronology
          state={envelope.continuityStatus === 'revoked' ? 'preview' : 'snapshot'}
          chronology={{
            object: {
              value: `Replay bundle · ${envelope.envelopeId}`,
              subLabel: `subject · NPI ${envelope.scope.subjectNpi}`,
            },
            ownership: {
              value: 'Delegated',
              subLabel: `originating · ${envelope.originatingInstitution.displayName}`,
            },
            checkedAt: {
              value: envelope.checkedAt,
              subLabel: 'UTC',
            },
            channel: {
              value: 'interoperability · rehearsal',
              subLabel: `lanes · ${envelope.scope.laneIds.length}`,
            },
            replay: {
              value: continuityCopy.headline,
              subLabel: continuityCopy.detail,
            },
            runId: {
              value: envelope.replayId,
              subLabel: 'verification run head',
            },
          }}
        />

        {/* Evidence references list */}
        <section
          data-slot="evidence-references"
          className="overflow-hidden rounded-2xl border border-slate-900 bg-white"
        >
          <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
              Evidence references · {summary.evidenceCount} item(s)
            </h3>
          </header>
          <ul className="divide-y divide-slate-200">
            {envelope.evidenceReferences.map((ref) => (
              <li
                key={`${ref.kind}-${ref.id}`}
                data-slot="evidence-reference"
                data-kind={ref.kind}
                className="grid grid-cols-1 gap-2 px-4 py-2 sm:grid-cols-12"
              >
                <div className="sm:col-span-2">
                  <span className="inline-flex items-center border border-slate-900 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-50">
                    {ref.kind}
                  </span>
                </div>
                <div className="sm:col-span-6 font-mono text-xs text-slate-900 break-all">
                  {ref.id}
                </div>
                <div className="sm:col-span-4 text-xs text-slate-700">
                  {ref.label}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Operator notes */}
        <section
          data-slot="operator-notes"
          className="rounded-2xl border border-slate-900 bg-white p-4"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Operator notes · human-reviewed lane
          </div>
          <p className="mt-2 text-sm text-slate-800">{envelope.operatorNotes}</p>
        </section>

        {/* Trust exchange timeline */}
        <TrustExchangeTimeline entries={exchange.timeline} />

        {/* Independent cross-check lane */}
        <IndependentCrossCheckPanel lanes={exchange.crossCheckLanes} />

        {/* Evidence reuse panel */}
        <EvidenceReusePanel rows={exchange.evidenceReuse} />

        {/* Footer disclosure -- explicit posture (zinc-500 footnote tone) */}
        <footer className="border-t border-dashed border-slate-400 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Rehearsal infrastructure · institution-owned cross-check ·
          no production credential issuance · no federation guarantee
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xs text-slate-900 break-all">
        {value}
      </div>
    </div>
  );
}
