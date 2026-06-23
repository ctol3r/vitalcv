'use client';

/**
 * Dev graph explorer (Wave 221, C6). Intentionally minimal — node list,
 * relationship list, raw JSON. Not a production UI.
 */

import { useEffect, useState } from 'react';
import type { GraphProjection, TrustProjection } from '@vitalcv/domain-evidence';

type GraphResponse = GraphProjection & { schema?: string };
type TrustResponse = TrustProjection & { schema?: string };

export default function GraphExplorerClient({ entityId }: { entityId: string }) {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [trust, setTrust] = useState<TrustResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [graphRes, trustRes] = await Promise.all([
          fetch(`/api/graph/${encodeURIComponent(entityId)}`, { cache: 'no-store' }),
          fetch(`/api/graph/${encodeURIComponent(entityId)}/trust`, { cache: 'no-store' }),
        ]);
        const graphBody = await graphRes.json();
        const trustBody = await trustRes.json();
        if (cancelled) return;
        if (!graphRes.ok) {
          setError(graphBody?.error_description ?? `Request failed (${graphRes.status})`);
          setData(null);
        } else {
          setData(graphBody as GraphResponse);
        }
        setTrust(trustRes.ok ? (trustBody as TrustResponse) : null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 font-mono text-sm">
      <h1 className="text-base font-semibold">Evidence Graph Explorer (dev)</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        entityId: <span className="font-semibold">{entityId}</span> · GET /api/graph/{entityId}
      </p>

      {loading && <p className="mt-6">Loading…</p>}
      {error && <p className="mt-6 text-rose-600">Error: {error}</p>}

      {data && (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="mb-2 font-semibold">
              Nodes ({data.stats.nodeCount}) · decision-grade: {data.stats.decisionGradeNodeCount}
            </h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-3">id</th>
                  <th scope="col" className="py-1 pr-3">type</th>
                  <th scope="col" className="py-1 pr-3">class</th>
                  <th scope="col" className="py-1 pr-3">status</th>
                  <th scope="col" className="py-1 pr-3">trustScore</th>
                  <th scope="col" className="py-1 pr-3">DG</th>
                  <th scope="col" className="py-1">label</th>
                </tr>
              </thead>
              <tbody>
                {data.nodes.map((n) => (
                  <tr key={n.id} className="border-b border-border/40">
                    <td className="py-1 pr-3">{n.id}</td>
                    <td className="py-1 pr-3">{n.type}</td>
                    <td className="py-1 pr-3">{n.evidenceClass ?? '—'}</td>
                    <td className="py-1 pr-3">{n.status ?? '—'}</td>
                    <td className="py-1 pr-3">{n.trustScore ?? '—'}</td>
                    <td className="py-1 pr-3">{n.decisionGrade ? 'yes' : 'no'}</td>
                    <td className="py-1">{n.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Relationships ({data.stats.relationshipCount})</h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-3">type</th>
                  <th scope="col" className="py-1 pr-3">from</th>
                  <th scope="col" className="py-1 pr-3">to</th>
                  <th scope="col" className="py-1">evidenceId</th>
                </tr>
              </thead>
              <tbody>
                {data.relationships.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1 pr-3">{r.type}</td>
                    <td className="py-1 pr-3">{r.from}</td>
                    <td className="py-1 pr-3">{r.to}</td>
                    <td className="py-1">{r.evidenceId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {trust && (
            <section>
              <h2 className="mb-2 font-semibold">
                Trust View — overall: {trust.overall.score ?? '—'} · DG evidence:{' '}
                {trust.overall.decisionGradeEvidence}/{trust.overall.totalEvidence} · trend: {trust.history.trend}
              </h2>

              <h3 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">Dimensions</h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-1 pr-3">dimension</th>
                    <th scope="col" className="py-1 pr-3">score</th>
                    <th scope="col" className="py-1 pr-3">contrib</th>
                    <th scope="col" className="py-1 pr-3">DG</th>
                    <th scope="col" className="py-1">origins</th>
                  </tr>
                </thead>
                <tbody>
                  {trust.dimensions.map((d) => (
                    <tr key={d.dimension} className="border-b border-border/40">
                      <td className="py-1 pr-3">{d.dimension}</td>
                      <td className="py-1 pr-3">{d.score ?? '—'}</td>
                      <td className="py-1 pr-3">{d.contributingCount}</td>
                      <td className="py-1 pr-3">{d.decisionGradeCount}</td>
                      <td className="py-1">{d.origins.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="mb-1 mt-4 text-xs font-semibold text-muted-foreground">
                Propagation paths (supporting → / weakening ✕)
              </h3>
              <ul className="space-y-1 text-xs">
                {trust.dimensions
                  .filter((d) => d.supporting.length > 0 || d.weakening.length > 0)
                  .map((d) => (
                    <li key={d.dimension}>
                      <span className="font-semibold">{d.dimension}:</span>{' '}
                      {d.supporting.map((id) => `→ ${id}`).join('  ')}{' '}
                      {d.weakening.map((id) => `✕ ${id}`).join('  ')}
                    </li>
                  ))}
              </ul>

              <h3 className="mb-1 mt-4 text-xs font-semibold text-muted-foreground">
                History — reinforcement: {trust.history.reinforcementCount} · decay: {trust.history.decayCount} · net:{' '}
                {trust.history.netDelta}
              </h3>
              <ul className="space-y-1 text-xs">
                {trust.history.entries.map((e, i) => (
                  <li key={i} className={e.type === 'decay' ? 'text-rose-600' : ''}>
                    [{e.type === 'decay' ? 'decay' : 'reinforce'}] {e.occurredAt ?? 'undated'} · {e.scoreDelta} ·{' '}
                    {e.detail}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-semibold">Raw JSON</h2>
            <pre className="overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
              {JSON.stringify({ graph: data, trust }, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </main>
  );
}
