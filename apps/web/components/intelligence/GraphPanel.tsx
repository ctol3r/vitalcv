'use client';

import { useEffect, useState } from 'react';
import GraphCanvas from '@/components/graph-system/GraphCanvas';
import {
  DEFAULT_GRAPH_PHYSICS,
  DEFAULT_GRAPH_VISUALS,
} from '@/components/graph/state/graphDisplayState';
import type {
  IntelligenceGraphResponse,
  IntelligenceProvider,
} from '@/lib/intelligence/contracts';
import { findProviderForGraphNode } from '@/lib/intelligence/contracts';
import { SectionFrame, SurfaceState, ToneBadge } from './shared';

interface GraphPanelProps {
  graph: IntelligenceGraphResponse | null;
  providers: IntelligenceProvider[];
  selectedProvider: IntelligenceProvider | null;
  loading?: boolean;
  error?: string | null;
  onSelectProvider: (provider: IntelligenceProvider) => void;
  onRetry?: () => void;
}

export function GraphPanel({
  graph,
  providers,
  selectedProvider,
  loading,
  error,
  onSelectProvider,
  onRetry,
}: GraphPanelProps) {
  const [dimensions, setDimensions] = useState({ width: 320, height: 320 });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth >= 1280 ? 360 : window.innerWidth >= 1024 ? 320 : Math.max(280, window.innerWidth - 72);
      setDimensions({
        width,
        height: width >= 340 ? 320 : 280,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedNodeId = graph?.focusNodeId ?? null;

  return (
    <SectionFrame
      eyebrow="Graph"
      title="Graph Panel"
      detail={selectedProvider
        ? `Live graph context around ${selectedProvider.name}. Select a neighboring node to pivot the provider profile.`
        : 'Global trust graph. Select a provider to pivot into a local investigation neighborhood.'}
      action={graph ? <ToneBadge tone="neutral" label={`${graph.stats.totalNodes} nodes`} /> : null}
    >
      <SurfaceState
        loading={loading}
        error={error}
        empty={!graph || graph.nodes.length === 0}
        emptyTitle="Graph not available"
        emptyCopy="The graph engine has not returned any visible nodes for this scope."
        onRetry={onRetry}
      >
        {graph ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-2">
              <GraphCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                physics={DEFAULT_GRAPH_PHYSICS}
                visuals={{ ...DEFAULT_GRAPH_VISUALS, animate: false, clusterMode: 'type' }}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={null}
                highlightedNodeIds={new Set<string>()}
                highlightedEdgeIds={new Set<string>()}
                onSelectNode={(nodeId) => {
                  const provider = findProviderForGraphNode(nodeId, graph.nodes, providers);
                  if (provider) {
                    onSelectProvider(provider);
                  }
                }}
                onHoverNode={() => {}}
                onDoubleClickNode={() => {}}
                onDragNode={() => {}}
                onPinNode={() => {}}
                width={dimensions.width}
                height={dimensions.height}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Edges" value={String(graph.stats.totalEdges)} />
              <MetricCard label="Orphans" value={String(graph.stats.orphanCount)} />
              <MetricCard label="AI Links" value={String(graph.stats.aiSuggestedLinks)} />
            </div>
          </div>
        ) : null}
      </SurfaceState>
    </SectionFrame>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
