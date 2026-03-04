'use client';

/**
 * BidirectionalGraph.tsx — Wave 58: Obsidian-Style Knowledge Graph
 *
 * Canvas-based bidirectional knowledge graph with force-directed layout.
 * Edges show directionality with animated arrowheads and labels.
 *
 * Edge model:
 *   credential → issuer    (ISSUED_BY)
 *   credential → decision  (INFORMS)
 *   decision → employer    (EVALUATED_FOR)
 *   employer → monitoring  (MONITORED_BY)
 */

import { useRef, useEffect, useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  group: 'credential' | 'issuer' | 'decision' | 'employer' | 'monitoring' | 'clinician';
  metadata?: Record<string, string>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  bidirectional?: boolean;
}

interface BidirectionalGraphProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  width?: number;
  height?: number;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  credential: '#DAA520',
  issuer: '#4A90D9',
  decision: '#F97316',
  employer: '#8B5CF6',
  monitoring: '#EC4899',
  clinician: '#228B22',
};

const GROUP_SHAPES: Record<string, 'circle' | 'diamond' | 'square'> = {
  credential: 'circle',
  issuer: 'diamond',
  decision: 'square',
  employer: 'diamond',
  monitoring: 'circle',
  clinician: 'circle',
};

// ── Force Simulation ──────────────────────────────────────────────────────

interface SimNode {
  id: string;
  label: string;
  group: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  shape: 'circle' | 'diamond' | 'square';
}

interface SimEdge {
  source: string;
  target: string;
  relation: string;
  bidirectional: boolean;
}

function initSim(nodes: KnowledgeNode[], edges: KnowledgeEdge[], w: number, h: number): { simNodes: SimNode[]; simEdges: SimEdge[] } {
  const simNodes: SimNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    const spread = Math.min(w, h) * 0.3;
    return {
      id: n.id,
      label: n.label.length > 14 ? n.label.slice(0, 12) + '…' : n.label,
      group: n.group,
      x: w / 2 + Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
      y: h / 2 + Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
      radius: n.group === 'clinician' ? 18 : 12,
      color: GROUP_COLORS[n.group] ?? '#888',
      shape: GROUP_SHAPES[n.group] ?? 'circle',
    };
  });

  const simEdges: SimEdge[] = edges.map((e) => ({
    source: e.source, target: e.target, relation: e.relation, bidirectional: e.bidirectional ?? false,
  }));

  return { simNodes, simEdges };
}

function tick(nodes: SimNode[], edges: SimEdge[], w: number, h: number): void {
  const repulsion = 2200;
  const attraction = 0.008;
  const gravity = 0.003;
  const damping = 0.88;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]; const b = nodes[j];
      const dx = a.x - b.x; const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy + 1;
      const f = repulsion / dist2;
      a.vx += dx * f; a.vy += dy * f;
      b.vx -= dx * f; b.vy -= dy * f;
    }
  }

  const map = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const s = map.get(edge.source); const t = map.get(edge.target);
    if (!s || !t) continue;
    const dx = t.x - s.x; const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    const f = (dist - 120) * attraction;
    s.vx += (dx / dist) * f; s.vy += (dy / dist) * f;
    t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f;
  }

  for (const n of nodes) {
    n.vx += (w / 2 - n.x) * gravity;
    n.vy += (h / 2 - n.y) * gravity;
    n.vx *= damping; n.vy *= damping;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(n.radius + 20, Math.min(w - n.radius - 20, n.x));
    n.y = Math.max(n.radius + 20, Math.min(h - n.radius - 20, n.y));
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.5); ctx.lineTo(-size, size * 0.5);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, node: SimNode, hovered: boolean): void {
  const { x, y, color, shape } = node;
  const r = hovered ? node.radius * 1.2 : node.radius;

  if (hovered) {
    ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color + '15'; ctx.fill();
  }

  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  } else if (shape === 'square') {
    const h = r * 0.8; ctx.rect(x - h, y - h, h * 2, h * 2);
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  ctx.fillStyle = color + (hovered ? 'CC' : '99'); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = hovered ? 2 : 1; ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(node.label, x, y + r + 13);
}

function render(ctx: CanvasRenderingContext2D, nodes: SimNode[], edges: SimEdge[], w: number, h: number, hovId: string | null): void {
  ctx.clearRect(0, 0, w, h);
  const map = new Map(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const s = map.get(edge.source); const t = map.get(edge.target);
    if (!s || !t) continue;
    const dx = t.x - s.x; const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    const angle = Math.atan2(dy, dx);
    const hl = hovId === s.id || hovId === t.id;
    const op = hl ? 0.4 : 0.12;

    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = `rgba(255,255,255,${op})`; ctx.lineWidth = hl ? 1.5 : 0.8; ctx.stroke();

    drawArrow(ctx, t.x - (dx / dist) * (t.radius + 6), t.y - (dy / dist) * (t.radius + 6), angle, 6, `rgba(255,255,255,${op + 0.1})`);
    if (edge.bidirectional) {
      drawArrow(ctx, s.x + (dx / dist) * (s.radius + 6), s.y + (dy / dist) * (s.radius + 6), angle + Math.PI, 6, `rgba(255,255,255,${op + 0.1})`);
    }

    if (hl) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '8px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(edge.relation, (s.x + t.x) / 2, (s.y + t.y) / 2 - 4);
    }
  }

  for (const node of nodes) drawShape(ctx, node, hovId === node.id);
}

// ── Component ─────────────────────────────────────────────────────────────

export function BidirectionalGraph({ nodes, edges, width = 800, height = 500, className = '', onNodeClick }: BidirectionalGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);
  const frameRef = useRef(0);
  const [hovId, setHovId] = useState<string | null>(null);

  useEffect(() => {
    const { simNodes, simEdges } = initSim(nodes, edges, width, height);
    simRef.current = { nodes: simNodes, edges: simEdges };
    let frame = 0;

    function animate() {
      if (!simRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      if (frame < 300) tick(simRef.current.nodes, simRef.current.edges, width, height);
      render(ctx, simRef.current.nodes, simRef.current.edges, width, height, hovId);
      frame++;
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frameRef.current);
  }, [nodes, edges, width, height, hovId]);

  const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!simRef.current || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    for (const n of simRef.current.nodes) {
      if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (n.radius + 4) ** 2) return n.id;
    }
    return null;
  }, []);

  return (
    <canvas
      ref={canvasRef} width={width} height={height}
      className={`${className} ${hovId ? 'cursor-pointer' : 'cursor-default'}`}
      onMouseMove={(e) => setHovId(hitTest(e))}
      onMouseLeave={() => setHovId(null)}
      onClick={(e) => { const id = hitTest(e); if (id && onNodeClick) onNodeClick(id); }}
    />
  );
}

export default BidirectionalGraph;
