'use client';

import { fetchGraphNodeData } from '@/lib/api';
import { useCallback, useRef, useState } from 'react';
// @ts-ignore
import ForceGraph2D, { LinkObject, NodeObject } from 'react-force-graph-2d';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ScalingNode extends NodeObject {
  id: string;
  label: string;
  group: 'global' | 'state' | 'organization' | 'clinician' | 'credential' | 'issuer' | 'decision' | 'employer' | 'trust_state' | string;
  status?: string;
  trustState?: string;
  val?: number; // Size in the graph
  expanded?: boolean;
}

export interface ScalingLink extends LinkObject {
  source: string | ScalingNode;
  target: string | ScalingNode;
  label: string;
}

interface ScalingGraphProps {
  initialNodes?: ScalingNode[];
  initialEdges?: ScalingLink[];
  width?: number;
  height?: number;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  global: '#ffffff',
  state: '#94a3b8',
  organization: '#3b82f6',
  clinician: '#22c55e',
  credential: '#DAA520',
  issuer: '#4A90D9',
  decision: '#F97316',
  employer: '#8B5CF6',
  monitoring: '#EC4899',
  trust_state: '#94a3b8',
};

// ── Component ─────────────────────────────────────────────────────────────

export function ScalingGraph({
  initialNodes = [{ id: 'us-global', label: 'United States', group: 'global', val: 30 }],
  initialEdges = [],
  width,
  height,
  className = '',
}: ScalingGraphProps) {
  const fgRef = useRef<any>(null);
  const [data, setData] = useState<{ nodes: ScalingNode[]; links: ScalingLink[] }>({
    nodes: initialNodes,
    links: initialEdges,
  });

  // Track expanded nodes to avoid redundant fetches
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // ── Node Expansion Logic ────────────────────────────────────────────────

  const expandNode = useCallback(
    async (node: ScalingNode) => {
      if (expandedNodes.has(node.id)) return; // Already expanded

      const newNodes: ScalingNode[] = [];
      const newLinks: ScalingLink[] = [];

      // Progressive Mock Expansion Logic
      if (node.group === 'global') {
        const stateNode: ScalingNode = { id: 'state-ca', label: 'California', group: 'state', val: 20 };
        newNodes.push(stateNode);
        newLinks.push({ source: node.id, target: stateNode.id, label: 'CONTAINS' });
      } else if (node.group === 'state') {
        const orgNode: ScalingNode = { id: 'org-cedars', label: 'Cedars-Sinai', group: 'organization', val: 15 };
        newNodes.push(orgNode);
        newLinks.push({ source: node.id, target: orgNode.id, label: 'CONTAINS' });
      } else if (node.group === 'organization') {
        const clinicianNode: ScalingNode = { id: '0000000000', label: 'Dr. Jenkins', group: 'clinician', val: 10 };
        newNodes.push(clinicianNode);
        newLinks.push({ source: node.id, target: clinicianNode.id, label: 'EMPLOYS' });
      } else if (node.group === 'clinician' || node.group === 'issuer' || node.group === 'employer') {
        // Fetch actual graph data for this node using the updated API
        const graphData = await fetchGraphNodeData(node.id);
        if (graphData && graphData.graph) {
          graphData.graph.nodes.forEach((n: any) => {
            if (!data.nodes.some((existing) => existing.id === n.id) && !newNodes.some(x => x.id === n.id)) {
              newNodes.push({
                id: n.id,
                label: n.label,
                group: n.group,
                val: n.group === 'credential' ? 8 : 10,
              });
            }
          });
          graphData.graph.edges.forEach((e: any) => {
            newLinks.push({
              source: e.source,
              target: e.target,
              label: e.label,
            });
          });
        }
      }

      if (newNodes.length > 0 || newLinks.length > 0) {
        setData((prev) => ({
          nodes: [...prev.nodes, ...newNodes],
          links: [...prev.links, ...newLinks],
        }));
      }

      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.add(node.id);
        return next;
      });
    },
    [data.nodes, expandedNodes]
  );

  const handleNodeClick = useCallback(
    (node: ScalingNode) => {
      // Center the camera on the node when clicked
      if (fgRef.current && (node as any).x !== undefined) {
        fgRef.current.centerAt((node as any).x, (node as any).y, 1000);
        fgRef.current.zoom(8, 2000);
      }
      expandNode(node);
    },
    [expandNode]
  );

  // ── Canvas Rendering ────────────────────────────────────────────────────

  const renderNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y, label, group, val } = node as ScalingNode & { x: number; y: number };
    const radius = val || 10;

    // Clustering detail visibility (semantic zoom)
    const showLabel = globalScale >= 1.5;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = GROUP_COLORS[group] || '#555';
    // Add glow effect for "Antigravity UX"
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fill();

    // Reset shadow for text
    ctx.shadowBlur = 0;

    if (showLabel || group === 'global') {
      const fontSize = group === 'global' ? 12 / globalScale : 14 / globalScale;
      ctx.font = `${Math.max(fontSize, 4)}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = group === 'global' ? '#000' : 'rgba(255,255,255,0.9)';
      ctx.fillText(label, x, y + radius + (8 / globalScale));
    }
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/50 backdrop-blur-md ${className}`}>
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h3 className="text-white/80 font-mono text-sm uppercase tracking-widest">Global Network</h3>
        <p className="text-white/40 text-xs mt-1">Nodes: {data.nodes.length} | Edges: {data.links.length}</p>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={data}
        nodeLabel="label"
        nodeRelSize={6}
        nodeColor={(n: any) => GROUP_COLORS[n.group] || '#fff'}
        nodeCanvasObject={renderNode}
        onNodeClick={handleNodeClick}

        // Edge styling
        linkColor={() => 'rgba(255, 255, 255, 0.15)'}
        linkWidth={1.5}

        // Packet Simulation (Moving Particles)
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => 'rgba(255, 255, 255, 0.8)'}

        // Performance features
        warmupTicks={100}
        cooldownTicks={0} // Disable constant running for better performance after layout settles
        enableNodeDrag={true}
      />
    </div>
  );
}

export default ScalingGraph;
