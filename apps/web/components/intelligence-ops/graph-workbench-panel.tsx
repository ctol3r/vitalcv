'use client';

import { useEffect, useRef, useState } from 'react';
import { Layers, Maximize2, RefreshCw } from 'lucide-react';
import GraphCanvas from '@/components/graph-system/GraphCanvas';
import { colorForNodeType } from '@/components/graph/graphPalette';
import {
  DEFAULT_GRAPH_PHYSICS,
  DEFAULT_GRAPH_VISUALS,
} from '@/components/graph/state/graphDisplayState';
import { SectionFrame, SurfaceState, ToneBadge } from '@/components/intelligence/shared';
import type {
  IntelligenceGraphResponse,
  IntelligenceProvider,
} from '@/lib/intelligence/contracts';
import { findProviderForGraphNode } from '@/lib/intelligence/contracts';

interface GraphWorkbenchPanelProps {
  graph: IntelligenceGraphResponse | null;
  providers: IntelligenceProvider[];
  selectedProvider: IntelligenceProvider | null;
  loading?: boolean;
  error?: string | null;
  onSelectProvider: (provider: IntelligenceProvider) => void;
  onRetry?: () => void;
}

const LEGEND_ENTRIES: Array<{ type: string; label: string; color: string }> = [
  { type: 'clinician', label: 'Clinician', color: colorForNodeType('clinician') },
  { type: 'credential', label: 'Credential', color: colorForNodeType('credential') },
  { type: 'institution', label: 'Institution', color: colorForNodeType('institution') },
  { type: 'specialty', label: 'Specialty', color: colorForNodeType('specialty') },
  { type: 'exclusion', label: 'Exclusion', color: colorForNodeType('exclusion') },
];

export function GraphWorkbenchPanel({
  graph,
  providers,
  selectedProvider,
  loading,
  error,
  onSelectProvider,
  onRetry,
}: GraphWorkbenchPanelProps) {
  const [dimensions, setDimensions] = useState({ width: 340, height: 380 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const highlightedNodeIds = useRef(new Set<string>());
  const highlightedEdgeIds = useRef(new Set<string>());

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth >= 1280
        ? 380
        : window.innerWidth >= 1024
          ? 340
          : Math.max(280, window.innerWidth - 72);
      setDimensions({ width, height: Math.round(width * 1.05) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!graph || !hoveredNodeId) {
      highlightedNodeIds.current = new Set();
      highlightedEdgeIds.current = new Set();
      return;
    }

    const neighborNodeIds = new Set<string>([hoveredNodeId]);
    const neighborEdgeIds = new Set<string>();

    for (const edge of graph.edges) {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
        neighborNodeIds.add(edge.source);
        neighborNodeIds.add(edge.target);
        neighborEdgeIds.add(edge.id);
      }
    }

    highlightedNodeIds.current = neighborNodeIds;
    highlightedEdgeIds.current = neighborEdgeIds;
  }, [graph, hoveredNodeId]);

  const selectedNodeId = graph?.focusNodeId ?? selectedProvider?.npi ?? null;
  const visibleTypes = graph ? [...new Set(graph.nodes.map((node) => node.type))].slice(0, 5) : [];
  const legendEntries = LEGEND_ENTRIES.filter((entry) => (
    visibleTypes.includes(entry.type as (typeof visibleTypes)[number])
  ));

  return (
    <SectionFrame
      eyebrow="Trust Graph"
      title={selectedProvider ? selectedProvider.name : 'Network Graph'}
      detail={selectedProvider
        ? `Live graph context for ${selectedProvider.name} (NPI ${selectedProvider.npi}). Hover a node to highlight its local neighborhood and click a provider node to re-scope the workbench.`
        : 'Global trust graph. Select a provider from the dashboard to pivot into its local neighborhood.'}
      action={graph ? (
        <div className="flex items-center gap-1.5">
          <ToneBadge tone="neutral" label={`${graph.stats.totalNodes}n`} />
          <ToneBadge tone="neutral" label={`${graph.stats.totalEdges}e`} />
        </div>
      ) : null}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <ToolbarButton title="Reset graph layout" onClick={() => setResetKey((key) => key + 1)}>
                  <RefreshCw className="h-3 w-3" />
                </ToolbarButton>
                <ToolbarButton
                  title={showLegend ? 'Hide legend' : 'Show legend'}
                  onClick={() => setShowLegend((value) => !value)}
                  active={showLegend}
                >
                  <Layers className="h-3 w-3" />
                </ToolbarButton>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[var(--vt-text-3)]">
                <Maximize2 className="h-2.5 w-2.5" />
                <span>scroll to zoom · drag to pan · click to select</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-2">
              <GraphCanvas
                key={resetKey}
                nodes={graph.nodes}
                edges={graph.edges}
                physics={DEFAULT_GRAPH_PHYSICS}
                visuals={{
                  ...DEFAULT_GRAPH_VISUALS,
                  animate: true,
                  clusterMode: 'type',
                  showArrows: false,
                  nodeSize: 6,
                  linkThickness: 1.2,
                }}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={hoveredNodeId}
                highlightedNodeIds={highlightedNodeIds.current}
                highlightedEdgeIds={highlightedEdgeIds.current}
                onSelectNode={(nodeId) => {
                  if (!nodeId) {
                    return;
                  }

                  const provider = findProviderForGraphNode(nodeId, graph.nodes, providers);
                  if (provider) {
                    onSelectProvider(provider);
                  }
                }}
                onHoverNode={setHoveredNodeId}
                onDoubleClickNode={() => {}}
                onDragNode={() => {}}
                onPinNode={() => {}}
                width={dimensions.width}
                height={dimensions.height}
              />

              {selectedNodeId ? (
                <div className="pointer-events-none absolute bottom-3 left-3">
                  <span className="rounded-full border border-yellow-400/20 bg-[var(--vt-surface)]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-200/80 backdrop-blur">
                    focus
                  </span>
                </div>
              ) : null}
            </div>

            {showLegend && legendEntries.length > 0 ? (
              <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-1)]/35">Node types</p>
                <div className="flex flex-wrap gap-2">
                  {legendEntries.map((entry) => (
                    <div key={entry.type} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-[10px] text-[var(--vt-text-3)]">{entry.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <EdgeLegendItem color="var(--vt-info)" dash={false} label="Explicit" />
                  <EdgeLegendItem color="var(--vt-accent)" dash label="Backlink" />
                  <EdgeLegendItem color="var(--vt-warning)" dash label="AI link" />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Nodes" value={String(graph.stats.totalNodes)} />
              <MetricCard label="Edges" value={String(graph.stats.totalEdges)} />
              <MetricCard label="AI links" value={String(graph.stats.aiSuggestedLinks)} />
            </div>
          </div>
        ) : null}
      </SurfaceState>
    </SectionFrame>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-3)] hover:border-[var(--vt-border)] hover:text-[var(--vt-text-2)]'
      }`}
    >
      {children}
    </button>
  );
}

function EdgeLegendItem({
  color,
  dash,
  label,
}: {
  color: string;
  dash: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="18" height="6" className="shrink-0">
        <line
          x1="0"
          y1="3"
          x2="18"
          y2="3"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={dash ? '3,3' : undefined}
        />
      </svg>
      <span className="text-[10px] text-[var(--vt-text-3)]">{label}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1.5 text-sm font-semibold tabular-nums text-[var(--vt-text-1)]">{value}</p>
    </div>
  );
}
