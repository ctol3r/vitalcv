/**
 * /status — VitalCV Public Operational Status
 *
 * Public SSR page. No auth required.
 * Shows live trust status board, source lane telemetry,
 * chronology integrity, and links to all .well-known endpoints.
 */

import type { Metadata } from 'next';
import { LiveTrustStatusBoard } from '@/components/ops/LiveTrustStatusBoard';
import { SourceLaneTelemetry } from '@/components/ops/SourceLaneTelemetry';
import { ChronologyIntegrityTelemetry } from '@/components/ops/ChronologyIntegrityTelemetry';

export const metadata: Metadata = {
  title: 'Operational Status · VitalCV',
  description:
    'Live operational status for VitalCV trust infrastructure. Independently verifiable.',
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
          <a
            href="/"
            className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
          >
            ← vitalcv.com
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Live status board */}
        <LiveTrustStatusBoard />

        {/* Source lane telemetry */}
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
          Source of truth: <a href="/api/status" className="underline hover:text-gray-500">/api/status</a>
        </p>
      </main>
    </div>
  );
}
