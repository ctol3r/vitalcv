'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Maximize2, RefreshCw } from 'lucide-react';
import GraphCanvas from '@/components/graph-system/GraphCanvas';
import {
  DEFAULT_GRAPH_PHYSICS,
  DEFAULT_GRAPH_VISUALS,
} from '@/components/graph/state/graphDisplayState';
import { colorForNodeType } from '@/components/graph/graphPalette';
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

const LEGEND_ENTRIES: Array<{ type: string; label: string; color: string }> = [
  { type: 'clinician', label: 'Clinician', color: colorForNodeType('clinician') },
  { type: 'credential', label: 'Credential', color: colorForNodeType('credential') },
  { type: 'institution', label: 'Institution', color: colorForNodeType('institution') },
  { type: 'specialty', label: 'Specialty', color: colorForNodeType('specialty') },
  { type: 'exclusion', label: 'Exclusion', color: colorForNodeType('exclusion') },
];

const MAX_CONTEXT_NODES = 180;
const MAX_CONTEXT_EDGES = 320;

export function GraphPanel({
  graph,
  providers,
  selectedProvider,
  loading,
  error,
  onSelectProvider,
  onRetry,
}: GraphPanelProps) {
  const [dimensions, setDimensions] = useState({ width: 340, height: 380 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const highlightedNodeIds = useRef(new Set<string>());
  const highlightedEdgeIds = useRef(new Set<string>());

  useEffect(() => {
    const handleResize = () => {
      const width =
        window.innerWidth >= 1280
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

  const panelGraph = useMemo(() => {
    if (!graph) {
      return null;
    }

    const focusNodeId = graph.focusNodeId
      ?? graph.nodes.find((node) => (
        node.id === selectedProvider?.npi
        || (typeof node.metadata?.npi === 'string' && node.metadata.npi === selectedProvider?.npi)
      ))?.id
      ?? null;
    const expandedIds = new Set([focusNodeId, ...Array.from(expandedNodeIds)]);
    
    const relevantEdges = graph.edges.filter(
      (edge) => expandedIds.has(edge.source) || expandedIds.has(edge.target)
    );

    const sortedEdges = relevantEdges
      .sort((left, right) => (
        Number(right.source === focusNodeId || right.target === focusNodeId) -
          Number(left.source === focusNodeId || left.target === focusNodeId) ||
        right.weight - left.weight ||
        right.confidence - left.confidence
      ))
      .slice(0, MAX_CONTEXT_EDGES);

    const connectedNodeIds = new Set<string>();
    for (const edge of sortedEdges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    if (focusNodeId) connectedNodeIds.add(focusNodeId);

    const sortedNodes = [...graph.nodes]
      .filter((node) => connectedNodeIds.has(node.id))
      .sort((left, right) => (
        Number(right.id === focusNodeId) - Number(left.id === focusNodeId) ||
        right.degree - left.degree ||
        left.label.localeCompare(right.label)
      ));

    const visibleNodes = sortedNodes.slice(0, MAX_CONTEXT_NODES);
    return {
      focusNodeId,
      nodes: visibleNodes,
      edges: sortedEdges,
      cappedNodeCount: Math.max(0, graph.nodes.length - visibleNodes.length),
      cappedEdgeCount: Math.max(0, graph.edges.length - sortedEdges.length),
    };
  }, [graph, selectedProvider?.npi]);

  useEffect(() => {
    if (!panelGraph || !hoveredNodeId) {
      highlightedNodeIds.current = new Set();
      highlightedEdgeIds.current = new Set();
      return;
    }

    const neighborNodeIds = new Set<string>([hoveredNodeId]);
    const neighborEdgeIds = new Set<string>();

    for (const edge of panelGraph.edges) {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
        neighborNodeIds.add(edge.source);
        neighborNodeIds.add(edge.target);
        neighborEdgeIds.add(edge.id);
      }
    }

    highlightedNodeIds.current = neighborNodeIds;
    highlightedEdgeIds.current = neighborEdgeIds;
  }, [hoveredNodeId, panelGraph]);

  const visibleTypes = useMemo(
    () => panelGraph ? [...new Set(panelGraph.nodes.map((node) => node.type))].slice(0, 5) : [],
    [panelGraph],
  );
  const legendEntries = LEGEND_ENTRIES.filter((entry) => (
    visibleTypes.includes(entry.type as (typeof visibleTypes)[number])
  ));

  return (
    <SectionFrame
      eyebrow="Trust Graph"
      title={selectedProvider ? selectedProvider.name : 'Network Graph'}
      detail={
        selectedProvider
          ? `Panel-optimized graph context for ${selectedProvider.name} (NPI ${selectedProvider.npi}). Hover highlights neighbors without disturbing layout.`
          : 'Global trust graph. Select a provider from the sidebar to pivot into a local neighborhood.'
      }
      action={
        panelGraph ? (
          <div className="flex items-center gap-1.5">
            <ToneBadge tone="neutral" label={`${panelGraph.nodes.length}n`} />
            <ToneBadge tone="neutral" label={`${panelGraph.edges.length}e`} />
            {(panelGraph.cappedNodeCount > 0 || panelGraph.cappedEdgeCount > 0) ? (
              <ToneBadge tone="neutral" label="Panel cap" />
            ) : null}
          </div>
        ) : null
      }
    >
      <SurfaceState
        loading={loading}
        error={error}
        empty={!panelGraph || panelGraph.nodes.length === 0}
        emptyTitle="Graph not available"
        emptyCopy="The graph engine has not returned any visible nodes for this scope."
        onRetry={onRetry}
      >
        {panelGraph ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <ToolbarButton
                  title="Reset graph layout"
                  onClick={() => setResetKey((current) => current + 1)}
                >
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
                nodes={panelGraph.nodes}
                edges={panelGraph.edges}
                layoutVersion={resetKey}
                physics={{
                  ...DEFAULT_GRAPH_PHYSICS,
                  preset: 'presentation',
                  centerForce: 0.011,
                  repelForce: 120,
                  linkForce: 0.065,
                  linkDistance: 128,
                  clusterForce: 0.038,
                  frozen: true,
                }}
                visuals={{
                  ...DEFAULT_GRAPH_VISUALS,
                  animate: false,
                  clusterMode: 'type',
                  showArrows: false,
                  nodeSize: 6,
                  linkThickness: 1,
                }}
                selectedNodeId={panelGraph.focusNodeId}
                hoveredNodeId={hoveredNodeId}
                highlightedNodeIds={highlightedNodeIds.current}
                highlightedEdgeIds={highlightedEdgeIds.current}
                onSelectNode={(nodeId) => {
                  if (!nodeId) {
                    return;
                  }

                  const provider = findProviderForGraphNode(nodeId, panelGraph.nodes, providers);
                  if (provider) {
                    onSelectProvider(provider);
                  }
                }}
                onHoverNode={setHoveredNodeId}
                onDoubleClickNode={(nodeId) => {
                  if (nodeId) {
                    setExpandedNodeIds(prev => {
                      const next = new Set(prev);
                      if (next.has(nodeId)) next.delete(nodeId);
                      else next.add(nodeId);
                      return next;
                    });
                  }
                }}
                onDragNode={() => {}}
                onPinNode={() => {}}
                width={dimensions.width}
                height={dimensions.height}
              />

              {panelGraph.focusNodeId ? (
                <div className="pointer-events-none absolute bottom-3 left-3">
                  <span className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-2)] backdrop-blur shadow-sm">
                    focus isolated
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
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-[10px] text-[var(--vt-text-3)]">{entry.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <EdgeLegendItem color="rgba(96,165,250,0.7)" dash={false} label="Explicit" />
                  <EdgeLegendItem color="rgba(34,211,238,0.7)" dash label="Backlink" />
                  <EdgeLegendItem color="rgba(192,132,252,0.7)" dash label="AI link" />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Nodes" value={String(panelGraph.nodes.length)} />
              <MetricCard label="Edges" value={String(panelGraph.edges.length)} />
              <MetricCard label="AI links" value={String(panelGraph.edges.filter((edge) => edge.type === 'ai_suggested_link').length)} />
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
  children: ReactNode;
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
          ? 'border-[var(--vt-border)] bg-[var(--vt-surface-3)] text-[var(--vt-text-1)] shadow-sm'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-3)] hover:bg-[var(--vt-surface-3)] hover:text-[var(--vt-text-2)]'
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
