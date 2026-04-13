'use client';

import { useEffect, useState } from 'react';
import { TrustGraphCanvas } from '../graph/TrustGraphCanvas';
import { CredentialInspector } from '../graph/CredentialInspector';
import { GraphNode, GraphEdge } from '../graph/types';

interface TrustGraphProps {
  npi: string;
}

export function TrustGraph({ npi }: TrustGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [activeNode, setActiveNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchGraph() {
      try {
        const res = await fetch(`/api/graph/${npi}`);
        if (cancelled) return;
        if (!res.ok) { setFailed(true); setLoading(false); return; }
        const data = await res.json();
        if (cancelled) return;

        setNodes(data.nodes || []);

        const rawEdges = data.edges || [];
        const processedEdges = rawEdges.map((e: Record<string, unknown>) => {
          let type = 'ISSUED_BY';
          const targetNode = (data.nodes as GraphNode[] | undefined)?.find((n) => n.id === e.target);
          const sourceNode = (data.nodes as GraphNode[] | undefined)?.find((n) => n.id === e.source);

          if (sourceNode?.group === 'employer' || targetNode?.group === 'employer') {
            type = 'ACCEPTED_BY';
          } else if (sourceNode?.group === 'credential' || targetNode?.group === 'credential') {
            type = 'VERIFIED_BY';
          } else if (sourceNode?.group === 'clinician' || targetNode?.group === 'clinician') {
            type = 'DEPENDS_ON';
          }

          return { ...e, type };
        });

        setEdges(processedEdges);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchGraph();
    return () => { cancelled = true; };
  }, [npi]);

  if (loading) {
    return (
      <div className="relative w-full h-[600px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading trust graph…</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="relative w-full h-[600px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Trust graph data is not available right now.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px]">
      <TrustGraphCanvas
        nodes={nodes}
        edges={edges}
        onNodeClick={(node) => setActiveNode(node.id === activeNode?.id ? null : node)}
        activeNodeId={activeNode?.id || null}
      />
      <CredentialInspector
        node={activeNode}
        onClose={() => setActiveNode(null)}
      />
    </div>
  );
}
