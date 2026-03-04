'use client';

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { GraphEdge, GraphNode } from '../graph/TrustGraph'; // Reusing types
import { SimulationPhase } from './SimulationTimeline';

interface SimulationGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  currentPhase: SimulationPhase;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  clinician: '#228B22',   // sage green
  issuer: '#4A90D9',      // mist blue
  credential: '#DAA520',  // warm amber
  employer: '#8B5CF6',    // purple
  policy: '#EC4899',      // pink
  decision: '#F97316',    // orange
};

const NODE_LABELS: Record<string, string> = {
  clinician: 'Clinician',
  issuer: 'Issuer',
  credential: 'Credential',
  employer: 'Employer',
  policy: 'Policy',
  decision: 'Decision',
};

// ── Force Simulation ──────────────────────────────────────────────────────

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function initializeLayout(nodes: GraphNode[], width: number, height: number): SimNode[] {
  const cx = width / 2;
  const cy = height / 2;

  // Manual layout for deterministic simulation presentation
  return nodes.map((node) => {
    let x = cx;
    let y = cy;

    // Spread them out nicely
    if (node.group === 'clinician') {
       x = cx - 150; y = cy;
    } else if (node.group === 'credential') {
       x = cx; y = cy;
    } else if (node.group === 'employer') {
      // Stack employers on the right
      const index = parseInt(node.id.split('-')[1] || '0');
      x = cx + 200;
      y = cy + (index - 1) * 100;
    } else if (node.group === 'decision') {
      const index = parseInt(node.id.split('-')[1] || '0');
      x = cx + 100;
      y = cy + (index - 1) * 100;
    }

    return { ...node, x, y, vx: 0, vy: 0 };
  });
}

function tickSimulation(simNodes: SimNode[], edges: GraphEdge[], width: number, height: number) {
   // Simplified physics for simulation
   const damping = 0.9;
   const repulsion = 1000;

   for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i];
      const b = simNodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      // Only repel slightly to maintain manual layout roughly
      if (dist < 50) {
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
  }

  for (const node of simNodes) {
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx;
    node.y += node.vy;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

function SimulationGraphInner({ nodes, edges, width = 800, height = 600, currentPhase, className = '' }: SimulationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const frameRef = useRef<number>(0);

  // Initialize
  const stableNodeIds = useMemo(() => nodes.map(n => n.id).join(','), [nodes]);

  useEffect(() => {
    simNodesRef.current = initializeLayout(nodes, width, height);
  }, [stableNodeIds, width, height, nodes]);

  // Render Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const simNodes = simNodesRef.current;
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    tickSimulation(simNodes, edges, width, height);

    ctx.clearRect(0, 0, width, height);

    const now = Date.now();

    // Draw Edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      let edgeColor = 'rgba(255, 255, 255, 0.15)';
      let lineWidth = 1;

      // Determine simulation state for edges
      const isCascadePath = (currentPhase === 'cascade' || currentPhase === 'revocation')
                            && (source.group === 'credential' || source.group === 'decision');

      if (isCascadePath) {
        edgeColor = 'rgba(239, 68, 68, 0.6)'; // Red glow for cascade
        lineWidth = 2;

        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      ctx.shadowBlur = 0; // reset
    }

    // Draw Nodes
    for (const node of simNodes) {
      const baseColor = NODE_COLORS[node.group] ?? '#888';
      let radius = Math.max(node.val * 0.6, 8);

      let fillStyle: string | CanvasGradient = baseColor;
      let strokeStyle = 'rgba(255, 255, 255, 0.3)';
      let lineWidth = 1;

      // Simulation Effects
      if (node.group === 'credential') {
        if (currentPhase === 'verification') {
          // Pulse green
          const pulse = (Math.sin(now / 150) + 1) / 2;
          ctx.shadowColor = '#22C55E';
          ctx.shadowBlur = 20 * pulse;
          fillStyle = '#22C55E';
        } else if (currentPhase === 'revocation' || currentPhase === 'cascade') {
          // Flash red heavily
          const flash = (Math.sin(now / 50) + 1) / 2;
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 30 * flash;
          fillStyle = '#EF4444';
          // Shockwave expanding ring
          if (currentPhase === 'revocation') {
             const waveRadius = (now % 1000) / 1000 * 100;
             const waveAlpha = 1 - (now % 1000) / 1000;
             ctx.strokeStyle = `rgba(239, 68, 68, ${waveAlpha})`;
             ctx.beginPath();
             ctx.arc(node.x, node.y, waveRadius, 0, Math.PI * 2);
             ctx.stroke();
          }
        }
      }

      if ((node.group === 'employer' || node.group === 'decision') && currentPhase === 'cascade') {
          // Downstream nodes turning red
          const flash = (Math.sin(now / 100) + 1) / 2;
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 15;
          fillStyle = '#EF4444';
          radius += 2 * flash;
      }

      // Draw the circle
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow for border and text
      ctx.shadowBlur = 0;

      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + radius + 14);
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [edges, width, height, currentPhase]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-2xl border border-white/5"
        style={{
          background: 'radial-gradient(circle at center, rgba(30,30,40,0.8) 0%, rgba(10,10,15,1) 100%)',
          boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)'
        }}
      />
    </div>
  );
}

export const SimulationGraph = memo(SimulationGraphInner);
