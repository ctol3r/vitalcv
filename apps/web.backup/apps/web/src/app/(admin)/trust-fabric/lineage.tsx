'use client';

import { useEffect, useMemo, useState } from 'react';
import { Branch, Network } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface LineageNode {
  did: string;
  depth: number;
  parents: string[];
  children: string[];
}

interface LineageGraphResponse {
  nodes: LineageNode[];
  edges: Array<{
    parentDid: string;
    childDid: string;
    trustLevel: number;
  }>;
  stats: {
    nodeCount: number;
    rootCount: number;
    maxDepth: number;
  };
  focusDid?: string;
  focusPath?: string[];
  generatedAt?: string;
}

export function LineagePanel({ focusDid }: { focusDid?: string }) {
  const [graph, setGraph] = useState<LineageGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusDid) {
      setGraph(null);
      return;
    }

    let cancelled = false;
    const fetchLineage = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/api/trust/fabric/lineage?issuerDid=${encodeURIComponent(focusDid)}`,
        );
        if (!response.ok) {
          throw new Error(`Unable to load lineage (${response.status})`);
        }
        const payload = (await response.json()) as LineageGraphResponse;
        if (!cancelled) {
          setGraph(payload);
        }
      } catch (err) {
        console.error('[trust-fabric] failed to load lineage', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLineage();
    return () => {
      cancelled = true;
    };
  }, [focusDid]);

  const columns = useMemo(() => {
    if (!graph?.nodes?.length) {
      return [];
    }
    const map = new Map<number, LineageNode[]>();
    graph.nodes.forEach((node) => {
      const bucket = map.get(node.depth) ?? [];
      bucket.push(node);
      map.set(node.depth, bucket);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, nodes]) => ({ depth, nodes }));
  }, [graph]);

  if (!focusDid) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Select an issuer from the table to visualize lineage depth.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Network className="h-4 w-4 animate-pulse" />
        Resolving lineage for {focusDid}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!graph?.nodes?.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No lineage data available for {focusDid}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Branch className="h-4 w-4" />
          Depth {graph.stats.maxDepth}
        </div>
        <div className="flex items-center gap-1">
          <Network className="h-4 w-4" />
          {graph.stats.nodeCount} issuers in cluster
        </div>
        {graph.focusPath?.length ? (
          <div className="flex flex-wrap items-center gap-1">
            Path:
            {graph.focusPath.map((did) => (
              <Badge key={did} variant={did === focusDid ? 'default' : 'outline'}>
                {did}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex gap-4 overflow-x-auto">
        {columns.map((column) => (
          <div key={column.depth} className="min-w-[180px] space-y-3 rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Depth {column.depth}
            </div>
            {column.nodes.map((node) => {
              const isFocus = node.did === focusDid;
              const inPath = graph.focusPath?.includes(node.did);
              return (
                <div
                  key={node.did}
                  className={cn(
                    'rounded-md border p-2 text-xs transition-colors',
                    isFocus
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : inPath
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-muted/30',
                  )}
                >
                  <div className="font-mono text-[11px]">{node.did}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{node.parents.length} parents</span>
                    <span>{node.children.length} children</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}










