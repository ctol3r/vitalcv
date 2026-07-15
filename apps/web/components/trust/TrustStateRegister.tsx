'use client';

import type { TrustRegisterSnapshot } from '@/lib/trust/register';
import { TrustRegisterCard } from './TrustRegisterCard';
import { TrustRegisterLegend } from './TrustRegisterLegend';
import type { TrustRegisterRowProps } from './TrustRegisterRow';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Fixed instant for the ILLUSTRATIVE register rows. Never the live snapshot time
// (which is Date.now()) — nothing is verified on page render, so the example
// checkedAt + runId must be stable, not freshly generated on every load.
const EXAMPLE_CHECKED_AT = Date.parse('2026-01-01T00:00:00Z');

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
  // Derived from the FIXED example instant, so the illustrative run id is stable
  // across renders (never a fresh-looking id per load).
  const input = `${snapshot.issuerDid}:${EXAMPLE_CHECKED_AT}`;
  const hash = djb2Hash(input);
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TrustStateRegisterProps {
  snapshot: TrustRegisterSnapshot;
}

export function TrustStateRegister({ snapshot }: TrustStateRegisterProps) {
  const runId = derive8chars(snapshot);
  const checkedAt = formatDate(EXAMPLE_CHECKED_AT);

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
      object: 'No adverse result returned',
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

  // ── State C: Signed artifact (example) ───────────────────────────────────
  const stateCRows: TrustRegisterRowProps[] = [
    {
      object: 'NPPES Identity',
      ownership: snapshot.signingKeyId ?? 'vcv-es256-1',
      checkedAt,
      channel: 'CMS NPPES Registry',
      replay: 'Issuer continuity (example)',
      runId,
      state: 'signed',
      tier: 'T4',
    },
    {
      object: 'Receipt Issued',
      ownership: snapshot.issuerDid,
      checkedAt,
      channel: 'VitalCV Issuer',
      replay: 'Replay-verifiable by design',
      runId,
      state: 'signed',
      tier: 'T4',
    },
    {
      object: 'No adverse result returned',
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
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {/* Page header — Bloomberg-style label, not a hero h1 */}
      <header className="space-y-1">
        <h1 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-400">
          Trust State Register
        </h1>
        <p className="text-xs text-gray-400">
          Institutional trust surface for VitalCV credential verification
        </p>
        <div className="text-[10px] text-gray-400 font-mono pt-0.5">
          Doctrine v{snapshot.doctrineVersion} · {snapshot.environment} ·{' '}
          {snapshot.issuerDid}
        </div>
      </header>

      {/* Legend */}
      <TrustRegisterLegend />

      {/* State cards — gap-px creates hairline dividers via bg-gray-200 bleed */}
      <div className="grid gap-px bg-gray-200">
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
          title="Signed artifact (example)"
          description="Cryptographic plane. Issuer-signed (ES256), T4-capable — the signed-receipt grammar shown as an example, not a live artifact."
          runId={runId}
          checkedAt={checkedAt}
          issuerDid={snapshot.issuerDid}
          signingKeyId={snapshot.signingKeyId ?? undefined}
          jwksUri={snapshot.jwksUri}
          rows={stateCRows}
          replayAvailable
          priorRunId={null}
        />
      </div>

      {/* Machine-readable link */}
      <div className="border-t border-gray-100 pt-4">
        <p className="font-mono text-[10px] text-gray-400">
          machine-readable:{' '}
          <a
            href="/.well-known/trust-register"
            className="hover:text-gray-600 underline underline-offset-2"
          >
            /.well-known/trust-register
          </a>
        </p>
      </div>
    </main>
  );
}
