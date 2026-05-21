'use client';

/**
 * VerifierContinuityStatusBoard
 *
 * Live probe runner for all .well-known and key verifier endpoints.
 * Fetches each endpoint, verifies status + content-type + required fields.
 * Shows per-probe status: verified / degraded / untested.
 */

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContinuityProbe {
  id: string;
  endpoint: string;
  expectedContentType: string;
  requiredFields: string[];
  publicAccess: boolean;
  lastChecked: string | null;
  status: 'verified' | 'degraded' | 'untested';
}

export interface VerifierContinuityStatusBoardProps {
  probes?: ContinuityProbe[];
}

// ─── Default probes ───────────────────────────────────────────────────────────

const DEFAULT_PROBES: ContinuityProbe[] = [
  {
    id: 'jwks',
    endpoint: '/.well-known/jwks.json',
    expectedContentType: 'application/json',
    requiredFields: ['keys'],
    publicAccess: true,
    lastChecked: null,
    status: 'untested',
  },
  {
    id: 'did',
    endpoint: '/.well-known/did.json',
    expectedContentType: 'application/json',
    requiredFields: ['@context', 'id'],
    publicAccess: true,
    lastChecked: null,
    status: 'untested',
  },
  {
    id: 'oidc',
    endpoint: '/.well-known/openid-credential-issuer',
    expectedContentType: 'application/json',
    requiredFields: ['issuer', 'jwks_uri'],
    publicAccess: true,
    lastChecked: null,
    status: 'untested',
  },
  {
    id: 'trust',
    endpoint: '/.well-known/trust.json',
    expectedContentType: 'application/json',
    requiredFields: ['issuer', 'proof_tiers'],
    publicAccess: true,
    lastChecked: null,
    status: 'untested',
  },
  {
    id: 'trust-register',
    endpoint: '/.well-known/trust-register',
    expectedContentType: 'application/json',
    requiredFields: ['doctrine', 'issuer'],
    publicAccess: true,
    lastChecked: null,
    status: 'untested',
  },
  {
    id: 'verify',
    endpoint: '/api/receipts/verify',
    expectedContentType: 'application/json',
    requiredFields: [],
    publicAccess: true,
    lastChecked: null,
    status: 'untested',
  },
];

// ─── Status indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ContinuityProbe['status'] }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-mono text-[11px]">
        <span className="text-[14px] leading-none">●</span> SOURCE-CONFIRMED
      </span>
    );
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-500 font-mono text-[11px]">
        <span className="text-[14px] leading-none">⚠</span> DEGRADED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-400 font-mono text-[11px]">
      <span className="text-[14px] leading-none">○</span> UNTESTED
    </span>
  );
}

// ─── Probe runner ─────────────────────────────────────────────────────────────

async function runProbe(probe: ContinuityProbe): Promise<ContinuityProbe> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  try {
    const res = await fetch(probe.endpoint, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ...probe, status: 'degraded', lastChecked: now };
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes(probe.expectedContentType)) {
      return { ...probe, status: 'degraded', lastChecked: now };
    }

    if (probe.requiredFields.length > 0) {
      let body: Record<string, unknown>;
      try {
        body = await res.json() as Record<string, unknown>;
      } catch {
        return { ...probe, status: 'degraded', lastChecked: now };
      }
      for (const field of probe.requiredFields) {
        if (!(field in body)) {
          return { ...probe, status: 'degraded', lastChecked: now };
        }
      }
    }

    return { ...probe, status: 'verified', lastChecked: now };
  } catch {
    return { ...probe, status: 'degraded', lastChecked: now };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VerifierContinuityStatusBoard({
  probes: initialProbes,
}: VerifierContinuityStatusBoardProps) {
  const [probes, setProbes] = useState<ContinuityProbe[]>(
    initialProbes ?? DEFAULT_PROBES,
  );
  const [running, setRunning] = useState(false);

  async function handleRunProbes() {
    setRunning(true);
    const results = await Promise.all(probes.map(runProbe));
    setProbes(results);
    setRunning(false);
  }

  const verifiedCount = probes.filter((p) => p.status === 'verified').length;
  const degradedCount = probes.filter((p) => p.status === 'degraded').length;

  return (
    <div className="font-mono">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-900">
          Verifier Continuity Status Board
        </h2>
        <div className="text-[10px] text-gray-400 space-x-2">
          {verifiedCount > 0 && (
            <span className="text-green-600">{verifiedCount} verified</span>
          )}
          {degradedCount > 0 && (
            <span className="text-amber-500">{degradedCount} degraded</span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 mb-0" />

      {/* Table */}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-4 text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
              Endpoint
            </th>
            <th className="py-2 pr-4 text-[9px] uppercase tracking-widest text-gray-400 font-semibold text-center">
              Public
            </th>
            <th className="py-2 pr-4 text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
              Required Fields
            </th>
            <th className="py-2 text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {probes.map((probe) => (
            <tr key={probe.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 pr-4 text-[11px] text-gray-700 whitespace-nowrap">
                {probe.endpoint}
              </td>
              <td className="py-2 pr-4 text-[11px] text-center text-gray-500">
                {probe.publicAccess ? 'YES' : 'NO'}
              </td>
              <td className="py-2 pr-4 text-[11px] text-gray-500">
                {probe.requiredFields.length > 0
                  ? probe.requiredFields.join(', ')
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-2 whitespace-nowrap">
                <StatusDot status={probe.status} />
                {probe.lastChecked && (
                  <div className="text-[9px] text-gray-300 mt-0.5">{probe.lastChecked}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Divider */}
      <div className="border-t border-gray-200 mt-0 mb-3" />

      {/* Run probes button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRunProbes}
          disabled={running}
          className="font-mono text-[10px] uppercase text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running ? 'Running probes…' : 'Run probes →'}
        </button>
      </div>
    </div>
  );
}

export default VerifierContinuityStatusBoard;
