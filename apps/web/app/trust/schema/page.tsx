import type { Metadata } from 'next';
import { CanonicalChronologyView } from '@/components/chronology/CanonicalChronologyView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust Graph Schema — VitalCV',
  description:
    'Schema reference for VitalCV trust graph, replay continuity, receipt continuity, and the canonical six-slot chronology order.',
};

const CURRENT_FLOW = {
  object: 'Trust Graph',
  ownership: 'vcv-system',
  checkedAt: 'Current runtime',
  channel: 'Trust / Verifier / Replay',
  replay: 'run:canonical',
  runId: 'run:canonical',
  tier: 'T3' as const,
};

const FIELDS = [
  {
    name: 'TrustRegisterSnapshot',
    shape: 'issuerDid, jwksUri, didDocUri, signingKeyId, keyAlgorithm, doctrineVersion, environment, proofTiers, replaySurvivable, sources, verifierEndpoints',
  },
  {
    name: 'ReplayInspection',
    shape: 'receiptId, lineageKey, runId, checkedAt, issuerDid, signingKeyId, jwksUri, runs, gaps, signerHistory, survivabilityScore, degradationOwnership, sourceContinuity',
  },
  {
    name: 'PublicReceiptResponse',
    shape: 'receipt_id, lane, source, checked_at, signed_payload, key_fingerprint, issuer_did, jwks_uri',
  },
  {
    name: 'Trust manifest',
    shape: 'version, issuer, jwks_uri, did_document_uri, trust_graph_uri, trust_schema_uri, trust_doctrine_uri, status_uri, verify_uri, credential_types, proof_tiers, environment',
  },
];

export default function TrustSchemaPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200 px-6 py-5">
        <div className="mx-auto max-w-5xl space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            VitalCV / Trust / Schema
          </div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-900">
            Trust Graph Schema Reference
          </h1>
          <p className="max-w-3xl text-xs text-gray-500">
            Canonical field shapes and reading order for trust, replay, verifier, and receipt surfaces.
            No alternate schema is introduced here.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        <section className="border border-gray-200 bg-gray-50 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 mb-3">
            Canonical Reading Order
          </div>
          <CanonicalChronologyView {...CURRENT_FLOW} variant="masthead" />
        </section>

        <section className="border border-gray-200 p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 mb-3">
            Required Record Shapes
          </h2>
          <div className="divide-y divide-gray-100 border border-gray-200">
            {FIELDS.map((field) => (
              <div key={field.name} className="grid gap-2 px-3 py-3 md:grid-cols-[180px_1fr]">
                <div className="font-mono text-xs font-semibold text-gray-900">{field.name}</div>
                <div className="font-mono text-xs leading-5 text-gray-600 break-all">{field.shape}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="border border-gray-200 p-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 mb-3">
              Required Semantics
            </h2>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>OBJECT identifies the artifact under inspection.</li>
              <li>OWNERSHIP identifies actor, system, or unbound state.</li>
              <li>CHECKED_AT is the deterministic capture time.</li>
              <li>CHANNEL names the source or path that produced the artifact.</li>
              <li>REPLAY links prior continuity when available.</li>
              <li>RUN_ID is the deterministic chronology anchor.</li>
            </ul>
          </div>

          <div className="border border-gray-200 p-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 mb-3">
              Public Surfaces
            </h2>
            <ul className="space-y-2 text-xs text-gray-600">
              <li><a className="text-blue-700 underline underline-offset-2" href="/trust">/trust</a></li>
              <li><a className="text-blue-700 underline underline-offset-2" href="/trust/graph">/trust/graph</a></li>
              <li><a className="text-blue-700 underline underline-offset-2" href="/trust/doctrine">/trust/doctrine</a></li>
              <li><a className="text-blue-700 underline underline-offset-2" href="/.well-known/trust.json">/.well-known/trust.json</a></li>
              <li><a className="text-blue-700 underline underline-offset-2" href="/.well-known/openid-configuration">/.well-known/openid-configuration</a></li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
