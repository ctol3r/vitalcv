/**
 * /trust/doctrine — Replay Contract Doctrine Surface
 *
 * Public, SSR, no auth.
 * Institutional cognition: can an operator read the replay contract in <60 seconds?
 */

import type { Metadata } from 'next';
import { getTrustRegisterSnapshot } from '@/lib/trust/register';
import { ReplayContractMap } from '@/components/replay-doctrine/ReplayContractMap';
import { LineageContinuityDiagram } from '@/components/replay-doctrine/LineageContinuityDiagram';
import { ChronologyContinuityRail } from '@/components/replay-doctrine/ChronologyContinuityRail';
import { ReplaySurvivabilityPanel } from '@/components/replay-doctrine/ReplaySurvivabilityPanel';
import { ReplayDeterminismVisualization } from '@/components/replay-doctrine/ReplayDeterminismVisualization';
import type { AnnotatedNode } from '@/components/replay-doctrine/ChronologyContinuityRail';
import type { LineageFlowProps } from '@/components/replay-doctrine/LineageContinuityDiagram';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Replay Contract Doctrine',
  description:
    'Machine-readable replay contract for VitalCV credential verification. 6 enforced invariants. Institutional cognition surface.',
};

// ─── Example data ─────────────────────────────────────────────────────────────

// A synthetic subject. 1457128509 is check-digit-INVALID and returns
// result_count 0 from NPPES, so it can never name a real registrant.
//
// Until 2026-08-16 this was a check-digit-VALID number belonging to a real,
// enumerated provider — whose name this public, no-auth page printed alongside
// status: 'verified' and tier: 'T3'. The same substitution was already made
// in the dev page-stack harness on 2026-08-10; this surface was missed, and
// it is the one strangers can read. Final digit (9) preserved: the sandbox
// connectors branch on it.
//
// Do not reintroduce a check-digit-valid NPI here. Only a subject in the
// consent register may be named on a public surface.
const EXAMPLE_NPI = '1457128509';
const EXAMPLE_SUBJECT = `NPI ${EXAMPLE_NPI}\nTest Provider`;

const EXAMPLE_CURRENT: LineageFlowProps = {
  object: EXAMPLE_SUBJECT,
  ownership: 'vcv-system',
  checkedAt: '2026-05-12\n10:21 UTC',
  channel: 'CMS NPPES\nRegistry',
  replay: 'run:ffff1234',
  runId: 'run:a1b2c3d4',
  tier: 'T3',
};

const EXAMPLE_PRIOR: LineageFlowProps = {
  object: EXAMPLE_SUBJECT,
  ownership: 'vcv-system',
  checkedAt: '2026-04-10\n09:00 UTC',
  channel: 'CMS NPPES\nRegistry',
  replay: null,
  runId: 'run:ffff1234',
  tier: 'T3',
};

const EXAMPLE_NODES: AnnotatedNode[] = [
  {
    nodeId: 'run:a1b2c3d4',
    ts: '2026-05-12 10:21 UTC',
    label: 'NPPES Identity',
    status: 'verified',
    tier: 'T3',
    priorNodeId: 'run:ffff1234',
    doctrineNote: 'dedupeKey — this run ID is final; idempotent replay guaranteed',
    contractClause: 'RC-1',
  },
  {
    nodeId: 'run:ffff1234',
    ts: '2026-04-10 09:00 UTC',
    label: 'NPPES Identity',
    status: 'verified',
    tier: 'T3',
    priorNodeId: null,
    doctrineNote: 'actor: system — genesis run; no prior chain',
    contractClause: 'RC-2',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DoctrinePage() {
  const snapshot = await getTrustRegisterSnapshot();

  // Derive survivability from snapshot
  const postgresConnected = !!process.env.DATABASE_URL;
  const signerActive = !!snapshot.signingKeyId;

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Dark masthead */}
      <div className="bg-gray-900 px-6 py-4 border-b border-gray-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-1">
            VitalCV / Trust / Doctrine
          </div>
          <h1 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
            Replay Contract Doctrine
          </h1>
          <div className="mt-1 text-[10px] font-mono text-gray-500">
            6 enforced invariants · {snapshot.doctrineVersion} · {snapshot.environment} ·{' '}
            <a href="/trust" className="underline text-gray-400 hover:text-gray-300">
              /trust
            </a>
            {' · '}
            <a href="/.well-known/trust-register" className="underline text-gray-400 hover:text-gray-300">
              /.well-known/trust-register
            </a>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">

        {/* 1. Replay Contract Map */}
        <section>
          <ReplayContractMap />
        </section>

        {/* 2. Lineage Continuity Diagram */}
        <section>
          <LineageContinuityDiagram
            current={EXAMPLE_CURRENT}
            prior={EXAMPLE_PRIOR}
            showDoctrineLabels
          />
        </section>

        {/* 3. Chronology Continuity Rail */}
        <section>
          <ChronologyContinuityRail nodes={EXAMPLE_NODES} showAnnotations />
        </section>

        {/* 4. Replay Survivability Panel */}
        <section>
          <ReplaySurvivabilityPanel
            dedupeKeyActive
            actorAttributionActive
            postgresConnected={postgresConnected}
            lastRestartSafe
            survivabilityScore={postgresConnected && signerActive ? 95 : postgresConnected ? 85 : 60}
            evidenceCount={1247}
          />
        </section>

        {/* 5. Replay Determinism Visualization */}
        <section>
          <ReplayDeterminismVisualization
            npi={EXAMPLE_NPI}
            checkedAt="1715529660000"
            derivedRunId="run:a1b2c3d4"
            algorithm="djb2-hash(npi:checkedAt) → hex → first 8 chars"
          />
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 pt-4">
          <div className="text-[9px] font-mono text-gray-300 space-y-0.5">
            <div>VITALCV REPLAY CONTRACT DOCTRINE · VERSION {snapshot.doctrineVersion}</div>
            <div>GENERATED: {new Date(snapshot.lastVerifiedAt).toISOString()}</div>
            <div>
              ISSUER: {snapshot.issuerDid} · KEY: {snapshot.signingKeyId ?? 'none'} · ALGO: {snapshot.keyAlgorithm}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
