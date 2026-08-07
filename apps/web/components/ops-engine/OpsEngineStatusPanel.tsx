/**
 * Honest empty/unavailable state for the real Operations Engine route.
 *
 * Shown (in the engine's own dark `.w14` aesthetic) when there is no live data
 * source connected, or the source is reachable but empty. It never renders mock
 * providers — per the source-honesty doctrine, an unconfigured surface tells the
 * truth instead of inventing a roster.
 */
import * as React from 'react';
import type { OpsSnapshot } from '@/lib/ops-engine/contract';

export default function OpsEngineStatusPanel({ snapshot }: { snapshot: OpsSnapshot }) {
  const isEmpty = snapshot.status === 'empty';
  return (
    <div className="w14 min-h-screen" style={{ background: '#0b0e13', color: '#e6ecf3' }}>
      <style>{`.w14{--accent:#34d8e8} .w14 .mono{font-family:var(--font-geist-mono,'Geist Mono',ui-monospace,monospace)}`}</style>
      <div className="mx-auto max-w-[760px] px-6 py-24">
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#34d8e8',
          }}
        >
          Operations Engine · live
        </div>
        <h1
          style={{
            marginTop: 14,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: '#f8fafc',
          }}
        >
          {isEmpty ? 'No records in the pipeline yet' : 'No live data source connected'}
        </h1>
        <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: '#94a3b8' }}>
          {snapshot.reason ||
            'This console reads the live provider roster and the append-only operational ledger from the VitalCV backend. It is not connected for this deployment yet.'}
        </p>

        <div
          style={{
            marginTop: 28,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            background: '#141922',
            padding: 20,
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}
          >
            To bring this surface live
          </div>
          <ol style={{ marginTop: 12, paddingLeft: 18, color: '#cbd5e1', fontSize: 13, lineHeight: 1.8 }}>
            <li>Connect a backend API base for apps/web (NEXT_PUBLIC_API_BASE / BACKEND_URL).</li>
            <li>Ensure the backend database is active and holds real roster + ledger rows.</li>
            <li>Confirm the operator is a member of the organization whose pipeline this shows.</li>
          </ol>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="/operations-engine"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              background: '#34d8e8',
              color: '#08121a',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View the demonstration console →
          </a>
        </div>

        <div
          className="mono"
          style={{ marginTop: 32, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}
        >
          status: {snapshot.status} · vc.w1400 · org {snapshot.orgId || '—'}
        </div>
      </div>
    </div>
  );
}
