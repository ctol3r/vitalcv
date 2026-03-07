import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'API Reference | VitalCV Docs',
  description: 'Complete REST API reference for the VitalCV Trust Protocol.',
};

const BASE_URL = 'https://api.vitalcv.com/v1';

interface Endpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  desc: string;
  id: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  response?: string;
}

const SECTIONS: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: 'Verification',
    endpoints: [
      {
        id: 'verify',
        method: 'POST',
        path: '/verify',
        desc: 'Verify a clinician credential bundle. Returns trust band (L0–L3), verification receipt, and HAIP compliance status.',
        params: [
          { name: 'npi', type: 'string', required: true, desc: 'National Provider Identifier (10-digit)' },
          { name: 'credential_types', type: 'string[]', required: false, desc: 'Filter by type: license, board_cert, npi_attest' },
          { name: 'selective_claims', type: 'string[]', required: false, desc: 'Claim fields to reveal (selective disclosure)' },
        ],
        response: '{ trustBand, receipt, credentials[], revocationStatus, issuerScore }',
      },
      {
        id: 'verify-npi',
        method: 'GET',
        path: '/verify/:npi',
        desc: 'Quick NPI lookup — returns current trust state without full credential bundle.',
        response: '{ npi, trustBand, lastVerified, sourceCount }',
      },
    ],
  },
  {
    title: 'Credentials',
    endpoints: [
      {
        id: 'issue',
        method: 'POST',
        path: '/credentials/issue',
        desc: 'Issue a signed SD-JWT VC credential for a clinician. Requires issuer API key with ISSUE scope.',
        params: [
          { name: 'subject_npi', type: 'string', required: true, desc: 'Clinician NPI' },
          { name: 'type', type: 'string', required: true, desc: 'Credential type: license | board_cert | npi_attest' },
          { name: 'claims', type: 'object', required: true, desc: 'Credential claim payload' },
          { name: 'expiry_days', type: 'number', required: false, desc: 'Credential TTL in days (default: 365)' },
        ],
        response: '{ credentialId, sdJwt, did, issuedAt, expiresAt }',
      },
      {
        id: 'selective-disclosure',
        method: 'POST',
        path: '/credentials/present/selective',
        desc: 'Generate a selective disclosure presentation — reveal only specified claims.',
        params: [
          { name: 'credential_id', type: 'string', required: true, desc: 'Credential to present' },
          { name: 'reveal_claims', type: 'string[]', required: true, desc: 'Claims to disclose' },
        ],
        response: '{ presentation, disclosures, commitments }',
      },
      {
        id: 'revoke',
        method: 'POST',
        path: '/credentials/revoke',
        desc: 'Revoke a credential. Triggers cascade evaluation across the trust graph.',
        params: [
          { name: 'credential_id', type: 'string', required: true, desc: 'Credential to revoke' },
          { name: 'reason', type: 'string', required: true, desc: 'Revocation reason' },
        ],
        response: '{ revoked, cascadeImpact: { affected, atRisk } }',
      },
    ],
  },
  {
    title: 'Trust Registry',
    endpoints: [
      {
        id: 'registry-list',
        method: 'GET',
        path: '/registry',
        desc: 'List trusted issuers with trust scores, HAIP compliance, and federation status.',
        response: '{ issuers[], total, federatedCount }',
      },
      {
        id: 'registry-resolve',
        method: 'GET',
        path: '/registry/:did',
        desc: 'Resolve a DID to an issuer record.',
        response: '{ did, name, trustScore, haipCompliant, federationEntityId }',
      },
    ],
  },
  {
    title: 'Audit',
    endpoints: [
      {
        id: 'audit-events',
        method: 'GET',
        path: '/audit/events',
        desc: 'Retrieve audit event log. Supports filtering by type, clinician, and time range.',
        params: [
          { name: 'type', type: 'string', required: false, desc: 'Event type filter' },
          { name: 'clinician_id', type: 'string', required: false, desc: 'Filter by NPI/clinician' },
          { name: 'from', type: 'string', required: false, desc: 'ISO 8601 start time' },
          { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 50, max: 500)' },
        ],
        response: '{ events[], total, cursor }',
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export default function ApiReferencePage() {
  return (
    <div className="space-y-16 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-violet-400 mb-3">API Reference</p>
        <h1 className="text-3xl font-bold tracking-tight mb-4">REST API</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span>Base URL: <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">{BASE_URL}</code></span>
          <span>Auth: <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;api_key&gt;</code></span>
          <span>Format: <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">application/json</code></span>
        </div>
      </div>

      {/* Rate limits callout */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
        <strong>Rate limits:</strong> Starter 1,000 req/hr · Growth 10,000 req/hr · Enterprise unlimited.
        Limits enforced per API key. Headers: <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>.
      </div>

      {/* Endpoints */}
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200 border-b border-white/5 pb-3">{section.title}</h2>
          {section.endpoints.map((ep) => (
            <div key={ep.id} id={ep.id} className="rounded-xl border border-white/5 bg-white/2 overflow-hidden">
              {/* Method + path */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <span className={`text-xs font-mono font-bold px-2 py-1 rounded border ${METHOD_COLORS[ep.method]}`}>
                  {ep.method}
                </span>
                <code className="text-sm text-zinc-200 font-mono">{ep.path}</code>
              </div>
              <div className="px-5 py-4 space-y-4">
                <p className="text-sm text-zinc-400">{ep.desc}</p>
                {ep.params && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-zinc-600 mb-2">Parameters</p>
                    <div className="space-y-2">
                      {ep.params.map((p) => (
                        <div key={p.name} className="flex flex-wrap gap-2 items-start text-sm">
                          <code className="text-violet-300 font-mono">{p.name}</code>
                          <code className="text-zinc-600 font-mono text-xs">{p.type}</code>
                          {p.required && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">required</span>}
                          <span className="text-zinc-500 text-xs">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ep.response && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-zinc-600 mb-2">Response</p>
                    <code className="block text-xs bg-black/30 rounded px-3 py-2 text-emerald-300 font-mono">{ep.response}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Footer nav */}
      <div className="flex justify-between text-sm">
        <Link href="/docs" className="text-zinc-400 hover:text-white transition-colors">← Overview</Link>
        <Link href="/docs/sdk" className="text-violet-400 hover:text-violet-300 transition-colors">SDKs →</Link>
      </div>
    </div>
  );
}
