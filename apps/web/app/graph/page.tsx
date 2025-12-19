'use client';

import VitalGraph from '@/components/graph/VitalGraph';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type GraphView = {
  nodes: Array<{ id: string; group: any; label: string }>;
  links: Array<{ source: string; target: string; weight: number }>;
};

export default function GraphPage() {
  const [data, setData] = useState<GraphView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setError(null);
        const resp = await fetch('/api/graph/view', { cache: 'no-store' });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(json?.error || `Graph view failed: HTTP ${resp.status}`);
        }
        if (!mounted) return;
        setData(json);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load graph');
        setData(null);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Network View</h1>
        <p className="text-muted-foreground mt-2">
          Visualize the connections between holders, issuers, verifiers, credentials, and jobs
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="font-semibold">Graph unavailable</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
          <div className="mt-3">
            <Link href="/status" className="underline underline-offset-2">
              See system status
            </Link>
          </div>
        </div>
      ) : data ? (
        <VitalGraph data={data as any} />
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading graph…</div>
      )}
    </main>
  );
}

