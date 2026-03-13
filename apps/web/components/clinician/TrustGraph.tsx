'use client';

import { motion, useDragControls } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

export type GraphNode = {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer' | 'credential';
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
};

interface TrustGraphProps {
  npi: string;
}

function EdgeWithPackets({ source, target }: { source: GraphNode & { x: number; y: number }, target: GraphNode & { x: number; y: number } }) {
  return (
    <g>
      <motion.line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke="#475569"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      <motion.circle
        r="2"
        fill="#3b82f6"
        initial={{ cx: source.x, cy: source.y, opacity: 0 }}
        animate={{
          cx: [source.x, target.x],
          cy: [source.y, target.y],
          opacity: [0, 1, 0, 0],
        }}
        transition={{
          duration: 2,
          ease: "linear",
          repeat: Infinity,
          times: [0, 0.5, 0.6, 1]
        }}
      />
    </g>
  );
}

export function TrustGraph({ npi }: TrustGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch(`/api/graph/${npi}`);
        if (!res.ok) throw new Error('Failed to fetch graph');
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (err) {
        console.error('Error fetching graph data', err);
      }
    }
    fetchGraph();
  }, [npi]);

  // Compute fixed positions to render the "force" graph in a stunning radial pattern
  const computedNodes = useMemo(() => {
    const W = 600;
    const H = 400;
    const cx = W / 2;
    const cy = H / 2;

    const layout = nodes.map((node, i) => {
      let x = cx;
      let y = cy;

      if (node.group === 'clinician') {
        x = cx;
        y = cy;
      } else {
        // Distribute other nodes in a circle
        const circleNodes = nodes.filter(n => n.group !== 'clinician');
        const index = circleNodes.findIndex(n => n.id === node.id);
        const angle = (index / circleNodes.length) * 2 * Math.PI;
        const radius = node.group === 'employer' ? 150 : 120; // employers further out
        x = cx + radius * Math.cos(angle);
        y = cy + radius * Math.sin(angle);
      }
      return { ...node, x, y };
    });
    return layout;
  }, [nodes]);

  const dragControls = useDragControls();

  const handlePointerDown = (event: React.PointerEvent) => {
    dragControls.start(event);
  };

  return (
    <div
      className="relative w-full h-[500px] overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-xl"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "none" }}
    >
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #334155 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <motion.svg
        drag
        dragControls={dragControls}
        dragConstraints={containerRef}
        dragElastic={0.2}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox="0 0 600 400"
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g>
          {edges.map((edge, i) => {
            const source = computedNodes.find(n => n.id === edge.source);
            const target = computedNodes.find(n => n.id === edge.target);
            if (!source || !target) return null;
            return (
              <EdgeWithPackets
                key={i}
                source={source}
                target={target}
              />
            );
          })}
        </g>

        <g>
          {computedNodes.map((node) => {
            const isHovered = hoveredNode?.id === node.id;
            const isCenter = node.group === 'clinician';

            let fill = '#3b82f6'; // issuer
            if (node.group === 'employer') fill = '#8b5cf6';
            if (node.group === 'credential') fill = '#10b981';
            if (isCenter) fill = '#f59e0b';

            return (
              <motion.g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.25, transition: { type: 'spring', stiffness: 300 } }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isCenter ? 24 : node.val}
                  fill={fill}
                  filter={isHovered || isCenter ? 'url(#glow)' : ''}
                  stroke={isHovered || isCenter ? '#fff' : 'rgba(255,255,255,0.2)'}
                  strokeWidth="2"
                />
                <text
                  x={node.x}
                  y={node.y + (isCenter ? 36 : node.val + 14)}
                  textAnchor="middle"
                  fill="#f8fafc"
                  className="text-[10px] font-medium pointer-events-none"
                >
                  {node.label}
                </text>
              </motion.g>
            );
          })}
        </g>
      </motion.svg>

      {/* Hover Panel */}
      {hoveredNode && (
        <motion.div
          className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-2xl z-10 pointers-events-none text-slate-100"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">{hoveredNode.group}</span>
            {hoveredNode.trustState && (
              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${hoveredNode.trustState === 'GREEN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {hoveredNode.status || 'Verified'}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-base mb-2">{hoveredNode.label}</h3>

          {hoveredNode.auditHash && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500 block mb-0.5">W3C VC Cryptographic Audit Hash</span>
              <code className="text-[11px] text-slate-300 font-mono break-all bg-slate-800 p-1.5 rounded block">
                {hoveredNode.auditHash}
              </code>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
