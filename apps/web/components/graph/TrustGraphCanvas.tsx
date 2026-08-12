'use client';

import { useRef, useMemo, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { TrustNode } from './TrustNode';
import { TrustEdge } from './TrustEdge';
import { GraphNode, GraphEdge } from './types';
import { GraphTokens } from '@/lib/design/graph-tokens';

interface TrustGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
  activeNodeId: string | null;
  /**
   * Label every node at rest rather than only the centre and the active one.
   * Suits a small curated graph; leave off for dense graphs where permanent
   * labels collide. Defaults to the existing hover-only behaviour.
   */
  showAllLabels?: boolean;
}

export function TrustGraphCanvas({
  nodes,
  edges,
  onNodeClick,
  activeNodeId,
  showAllLabels = false,
}: TrustGraphCanvasProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Compute fixed positions for the demo (radial layout)
  const computedNodes = useMemo(() => {
    const W = 800;
    const H = 600;
    const cx = W / 2;
    const cy = H / 2;

    return nodes.map((node) => {
      let x = cx;
      let y = cy;

      if (node.group === 'clinician') {
        x = cx;
        y = cy;
      } else {
        const circleNodes = nodes.filter(n => n.group !== 'clinician');
        const index = circleNodes.findIndex(n => n.id === node.id);
        const angle = (index / Math.max(1, circleNodes.length)) * 2 * Math.PI;
        
        // Distribution radiuses
        let radius = 160;
        if (node.group === 'employer') radius = 240;
        if (node.group === 'credential') radius = 190;
        if (node.group === 'decision') radius = 260;
        
         // Add some jitter for an organic feel
        const jitterX = Math.cos(index * 123) * 15;
        const jitterY = Math.sin(index * 321) * 15;

        x = cx + radius * Math.cos(angle) + jitterX;
        y = cy + radius * Math.sin(angle) + jitterY;
      }
      return { ...node, x, y };
    });
  }, [nodes]);

  const handlePointerDown = (event: React.PointerEvent) => {
    dragControls.start(event);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] overflow-hidden rounded-2xl border shadow-2xl bg-[#020617] border-slate-800"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
    >
      {/* Minimal grid background */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle at center, #475569 1px, transparent 1px)', 
          backgroundSize: '32px 32px' 
        }} 
      />

      <motion.svg
        drag
        dragControls={dragControls}
        dragConstraints={containerRef}
        dragElastic={0.1}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox="0 0 800 600"
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g className="edges">
          {edges.map((edge, i) => {
            const source = computedNodes.find(n => n.id === edge.source);
            const target = computedNodes.find(n => n.id === edge.target);
            if (!source || !target) return null;
            
            const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
            const isDimmed = (activeNodeId !== null || hoveredNodeId !== null) && 
                            !(hoveredNodeId === source.id || hoveredNodeId === target.id) &&
                            !(activeNodeId === source.id || activeNodeId === target.id);

            return (
              <TrustEdge
                key={i}
                source={source}
                target={target}
                type={edge.type || 'ISSUED_BY'}
                isHighlighted={isHovered}
                isDimmed={isDimmed}
              />
            );
          })}
        </g>

        <g className="nodes">
          {computedNodes.map((node) => {
            const isActive = activeNodeId === node.id || hoveredNodeId === node.id;
            let isDimmed = false;
            
            if (activeNodeId) {
              const isConnectedToActive = edges.some(e => 
                (e.source === activeNodeId && e.target === node.id) ||
                (e.target === activeNodeId && e.source === node.id)
              ) || activeNodeId === node.id;
              isDimmed = !isConnectedToActive;
            } else if (hoveredNodeId) {
              const isConnectedToHover = edges.some(e => 
                (e.source === hoveredNodeId && e.target === node.id) ||
                (e.target === hoveredNodeId && e.source === node.id)
              ) || hoveredNodeId === node.id;
              isDimmed = !isConnectedToHover;
            }

            return (
              <TrustNode
                key={node.id}
                id={node.id}
                x={node.x}
                y={node.y}
                label={node.label}
                group={node.group}
                val={node.val}
                isHovered={hoveredNodeId === node.id}
                isExpanded={activeNodeId === node.id}
                isDimmed={isDimmed && !isActive}
                alwaysShowLabel={showAllLabels}
                onHover={() => setHoveredNodeId(node.id)}
                onLeave={() => setHoveredNodeId(null)}
                onClick={() => onNodeClick(node as GraphNode)}
              />
            );
          })}
        </g>
      </motion.svg>
    </div>
  );
}
