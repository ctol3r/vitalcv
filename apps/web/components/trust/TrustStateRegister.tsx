'use client';

import type { TrustRegisterSnapshot } from '@/lib/trust/register';
import { TrustRegisterCard } from './TrustRegisterCard';
import { TrustRegisterLegend } from './TrustRegisterLegend';
import type { TrustRegisterRowProps } from './TrustRegisterRow';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash >>> 0;
}

function derive8chars(snapshot: TrustRegisterSnapshot): string {
  const input = `${snapshot.issuerDid}:${snapshot.lastVerifiedAt}`;
  const hash = djb2Hash(input);
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TrustStateRegisterProps {
  snapshot: TrustRegisterSnapshot;
}

export function TrustStateRegister({ snapshot }: TrustStateRegisterProps) {
  const runId = derive8chars(snapshot);
  const checkedAt = formatDate(snapshot.lastVerifiedAt);

  // ── State A: Anonymous Preview ───────────────────────────────────────────
  const stateARows: TrustRegisterRowProps[] = [
    {
      object: 'NPPES Identity',
      ownership: null,
      checkedAt: null,
      channel: 'CMS NPPES Registry',
      replay: null,
      runId: '──────',
      state: 'anonymous',
      tier: 'T1',
    },
    {
      object: 'OIG Exclusions',
      ownership: null,
      checkedAt: null,
      channel: 'OIG LEIE',
      replay: null,
      runId: '──────',
      state: 'anonymous',
      tier: 'T1',
    },
    {
      object: 'State License',
      ownership: null,
      checkedAt: null,
      channel: 'State Board',
      replay: null,
      runId: '──────',
      state: 'anonymous',
      tier: 'T1',
    },
  ];

  // ── State B: Owned Snapshot ──────────────────────────────────────────────
  const stateBRows: TrustRegisterRowProps[] = [
    {
      object: 'NPPES Identity',
      ownership: 'vcv-system',
      checkedAt,
      channel: 'CMS NPPES Registry',
      replay: null,
      runId,
      state: 'owned',
      tier: 'T3',
    },
    {
      object: 'OIG Exclusions',
      ownership: 'vcv-system',
      checkedAt: null,
      channel: 'OIG LEIE',
      replay: null,
      runId,
      state: 'owned',
      tier: 'T1',
    },
    {
      object: 'No Adverse Findings',
      ownership: 'vcv-system',
      checkedAt,
      channel: 'OIG LEIE',
      replay: null,
      runId,
      state: 'owned',
      tier: 'T3',
      noAdverseFindings: true,
    },
  ];

  // ── State C: Signed Institutional Artifact ───────────────────────────────
  const stateCRows: TrustRegisterRowProps[] = [
    {
      object: 'NPPES Identity',
      ownership: snapshot.signingKeyId ?? 'vcv-es256-1',
      checkedAt,
      channel: 'CMS NPPES Registry',
      replay: 'Continuity confirmed',
      runId,
      state: 'signed',
      tier: 'T4',
    },
    {
      object: 'Receipt Issued',
      ownership: snapshot.issuerDid,
      checkedAt,
      channel: 'VitalCV Issuer',
      replay: 'Replay survivable',
      runId,
      state: 'signed',
      tier: 'T4',
    },
    {
      object: 'No Adverse Findings',
      ownership: snapshot.signingKeyId ?? 'vcv-es256-1',
      checkedAt,
      channel: 'OIG LEIE',
      replay: null,
      runId,
      state: 'signed',
      tier: 'T3',
      noAdverseFindings: true,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
      {/* Page header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Trust State Register
        </h1>
        <p className="mt-1.5 text-gray-500 text-sm">
          Institutional trust surface for VitalCV credential verification
        </p>
        <div className="mt-2 text-xs text-gray-400">
          Doctrine v{snapshot.doctrineVersion} · {snapshot.environment} ·{' '}
          <span className="trust-register-mono">{snapshot.issuerDid}</span>
        </div>
      </header>

      {/* Legend */}
      <TrustRegisterLegend />

      {/* State A */}
      <TrustRegisterCard
        state="anonymous"
        title="Anonymous Preview"
        description="Exploratory view — no ownership attribution, no lineage, no replay. All slots are unbound."
        runId="──────"
        checkedAt={null}
        rows={stateARows}
        replayAvailable={false}
      />

      {/* State B */}
      <TrustRegisterCard
        state="owned"
        title="Owned Snapshot"
        description="Attributed to vcv-system. Lineage is visible; replay is tracked. Source checks applied."
        runId={runId}
        checkedAt={checkedAt}
        rows={stateBRows}
        replayAvailable
        priorRunId={null}
      />

      {/* State C */}
      <TrustRegisterCard
        state="signed"
        title="Signed Institutional Artifact"
        description="Cryptographic plane. Issuer-signed, T4 capable, replay survivable. Full lineage chain."
        runId={runId}
        checkedAt={checkedAt}
        issuerDid={snapshot.issuerDid}
        signingKeyId={snapshot.signingKeyId ?? undefined}
        jwksUri={snapshot.jwksUri}
        rows={stateCRows}
        replayAvailable
        priorRunId={null}
      />

      {/* Machine-readable link */}
      <div className="border-t border-gray-200 pt-6">
        <p className="text-xs text-gray-400">
          Machine-readable:{' '}
          <a
            href="/.well-known/trust-register"
            className="trust-register-mono text-blue-600 hover:underline"
          >
            /.well-known/trust-register
          </a>
        </p>
      </div>
    </main>
  );
}
