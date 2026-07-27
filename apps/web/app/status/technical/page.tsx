/**
 * /status/technical — the operator/technical status console (moved from /status).
 *
 * Public SSR page, no auth. Foundation status flags, source lane telemetry,
 * chronology integrity, and the .well-known endpoint index. The customer-facing
 * status summary lives at /status; this page keeps the literal honesty flags
 * (`redactionLive: false` etc.) pinned by status-page-compliance-evidence.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveTrustStatusBoard } from '@/components/ops/LiveTrustStatusBoard';
import { SourceLaneTelemetry } from '@/components/ops/SourceLaneTelemetry';
import { ChronologyIntegrityTelemetry } from '@/components/ops/ChronologyIntegrityTelemetry';
import { ConnectorMatrix } from '@/components/status/ConnectorMatrix';
import { buildAdapterMatrix } from '@/lib/authority/adapterMatrix';
import { buildDataClassificationFoundation } from '@/lib/security/dataClassificationFoundation';
import { buildRetentionFoundation } from '@/lib/security/retentionFoundation';

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Technical Status · VitalCV',
  description:
    'Status surfaces are foundation previews. No uptime guarantee is implied. Live operational status for VitalCV trust infrastructure.',
};

const WELL_KNOWN_ENDPOINTS = [
  {
    path: '/.well-known/jwks.json',
    description: 'Public signing keys (ES256)',
    auth: 'None',
  },
  {
    path: '/.well-known/did.json',
    description: 'W3C DID document',
    auth: 'None',
  },
  {
    path: '/.well-known/trust.json',
    description: 'Trust manifest',
    auth: 'None',
  },
  {
    path: '/.well-known/trust-register',
    description: 'Machine-readable doctrine register',
    auth: 'None',
  },
  {
    path: '/.well-known/openid-configuration',
    description: 'OID4VCI discovery alias',
    auth: 'None',
  },
  {
    path: '/trust/graph',
    description: 'Verifier-readable trust graph',
    auth: 'None',
  },
  {
    path: '/trust/schema',
    description: 'Trust schema reference',
    auth: 'None',
  },
  {
    path: '/trust/doctrine',
    description: 'Replay contract doctrine',
    auth: 'None',
  },
  {
    path: '/api/receipts/verify',
    description: 'Verify a receipt JWT',
    auth: 'None',
  },
  {
    path: '/api/replay/[runId]',
    description: 'Replay inspection payload',
    auth: 'None',
  },
  {
    path: '/api/receipt/[lineageKey]',
    description: 'Receipt continuity payload',
    auth: 'None',
  },
  {
    path: '/api/status',
    description: 'This endpoint — operational truth payload',
    auth: 'None',
  },
];

export default function StatusPage() {
  // Compliance evidence shape — read from the foundation modules so /status
  // and /api/compliance/evidence agree on every count + Live flag. The page
  // renders the literal flag strings (`redactionLive: false` etc.) so the
  // status-page-compliance-evidence regression test catches any silent
  // regressions in the underlying foundation modules.
  const dataClassification = buildDataClassificationFoundation();
  const retention = buildRetentionFoundation();
  const authority = buildAdapterMatrix();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-5">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">
              VitalCV · Operational Status
            </h1>
            <p className="mt-1 text-[10px] text-gray-500">
              External observability surface — independently verifiable
            </p>
          </div>
          <Link
            href="/"
            className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
          >
            ← vitalcv.com
          </Link>
        </div>
      </header>

      {/* Technical-reference notice (audit 5.2): this is telemetry for
          operators and integrators, not the customer status summary. */}
      <div className="border-b border-gray-800 bg-black/40 px-6 py-3">
        <p className="mx-auto max-w-4xl text-[11px] leading-relaxed text-gray-400">
          This is VitalCV&rsquo;s technical status console — foundation flags, lane telemetry, and verification
          endpoints. For the plain-language status summary, see{' '}
          <Link href="/status" className="text-gray-300 underline underline-offset-2 hover:text-white">
            /status
          </Link>
          .
        </p>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Foundation status preview — disclaimer + compliance evidence shape */}
        <section
          aria-labelledby="foundation-status-heading"
          className="border border-gray-800 bg-gray-950"
        >
          <div className="border-b border-gray-800 px-4 py-2">
            <h2 id="foundation-status-heading" className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Foundation status preview
            </h2>
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed text-gray-300">
            <p>
              <strong>{'We publish the source of every field. We do not claim HIPAA, SOC 2, or NCQA certification.'}</strong>
            </p>
            <p className="mt-2">
              <strong>{'Status surfaces are foundation previews. No uptime guarantee is implied.'}</strong>{' '}
              Incident notices and public changelogs are planned surfaces. Neither is wired today.
            </p>
          </div>
        </section>

        {/*
          Two tables on this page describe sources, on two different axes, and
          a reader who does not know that will read them as contradicting each
          other. The connector matrix answers "what can an anonymous visitor
          get"; the source-lane telemetry further down answers "is the lane
          wired and returning data", and is derived from the same registry
          /api/status serves. OIG can legitimately be a monthly snapshot in one
          and `active / operational` in the other. Each is labelled.
        */}
        <p className="text-[10px] leading-relaxed text-gray-500">
          <strong className="text-gray-400">Access boundary.</strong>{' '}
          The matrix below describes what an <em>anonymous</em> visitor can obtain from each
          connector. Whether a lane is wired and returning data at all is a different question,
          answered by <span className="font-mono">source lane operational telemetry</span> further
          down this page and by{' '}
          <Link href="/api/status" className="underline hover:text-gray-300">/api/status</Link>.
          A lane can be fully operational here and still require something of the caller.
        </p>
        <ConnectorMatrix />

        <section
          aria-labelledby="compliance-evidence-heading"
          className="border border-gray-800 bg-gray-950"
        >
          <div className="border-b border-gray-800 px-4 py-2">
            <h2 id="compliance-evidence-heading" className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Compliance evidence (foundation shape)
            </h2>
          </div>
          <div className="space-y-3 px-4 py-3 text-xs leading-relaxed text-gray-300">
            <p className="text-gray-400">
              This report is a foundation shape for vendor risk assessments. It reflects planned controls, not enforced production policies.
            </p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-gray-500">Data classification</dt>
                <dd className="mt-1 font-mono text-[11px]">redactionLive: {String(dataClassification.redactionLive)}</dd>
                <dd className="font-mono text-[11px] text-gray-500">{dataClassification.rules.length} redaction rules</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-gray-500">Retention</dt>
                <dd className="mt-1 font-mono text-[11px]">retentionEnforced: {String(retention.retentionEnforced)}</dd>
                <dd className="font-mono text-[11px] text-gray-500">{retention.policies.length} entity policies</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-gray-500">Authority adapters</dt>
                <dd className="mt-1 font-mono text-[11px]">allAdaptersLive: {String(authority.allAdaptersLive)}</dd>
                <dd className="font-mono text-[11px] text-gray-500">{authority.adapters.length} adapters</dd>
              </div>
            </dl>
            <p className="text-[10px] text-gray-500">
              Machine-readable shape:{' '}
              <Link href="/api/compliance/evidence" className="underline hover:text-gray-300">/api/compliance/evidence</Link>
            </p>
          </div>
        </section>

        {/* Live status board */}
        <LiveTrustStatusBoard />

        {/* Source lane telemetry — derived from SOURCE_LANE_OPS, the same
            registry /api/status serves. See the axis note above the connector
            matrix for why the two tables can differ without contradicting. */}
        <p className="text-[10px] leading-relaxed text-gray-500">
          <strong className="text-gray-400">Lane capability.</strong>{' '}
          Derived from the same source registry{' '}
          <Link href="/api/status" className="underline hover:text-gray-300">/api/status</Link>{' '}
          publishes, so the two always agree. This is whether a lane is wired and returning data —
          not what an anonymous visitor can retrieve, which is the connector matrix above.
        </p>
        <SourceLaneTelemetry />

        {/* Chronology integrity */}
        <ChronologyIntegrityTelemetry />

        {/* Well-known endpoint index */}
        <div className="border border-gray-700 bg-gray-950">
          <div className="border-b border-gray-700 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              PUBLIC VERIFICATION ENDPOINTS
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-[9px] uppercase tracking-widest text-gray-600">
                <th className="px-4 py-1.5 text-left font-normal">Endpoint</th>
                <th className="px-4 py-1.5 text-left font-normal">Description</th>
                <th className="px-4 py-1.5 text-left font-normal">Auth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {WELL_KNOWN_ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="hover:bg-gray-900/40">
                  <td className="px-4 py-1.5">
                    <a
                      href={ep.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-blue-500 hover:text-blue-300 underline underline-offset-2"
                    >
                      {ep.path}
                    </a>
                  </td>
                  <td className="px-4 py-1.5 text-[10px] text-gray-400">{ep.description}</td>
                  <td className="px-4 py-1.5 text-[10px] text-gray-600">{ep.auth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <p className="text-[9px] text-gray-700 text-center">
          All endpoints are public. No authentication required for verification.
          Source of truth: <Link href="/api/status" className="underline hover:text-gray-500">/api/status</Link>
        </p>
      </main>
    </div>
  );
}
