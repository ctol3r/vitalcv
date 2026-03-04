'use client';

/**
 * RevocationGraph.tsx — Wave 59: Revocation Impact Visualization
 *
 * Canvas-based force-directed graph with red pulse animation on
 * affected nodes and edges. Directly revoked node glows intensely.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { SimNode, SimEdge } from '@/app/simulation/revocation/page';

// ── Props ─────────────────────────────────────────────────────────────────

interface RevocationGraphProps {
  nodes: SimNode[];
  edges: SimEdge[];
  width?: number;
  height?: number;
  className?: string;
}

// ── Colors ────────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  credential: '#DAA520', issuer: '#4A90D9', decision: '#F97316',
  employer: '#8B5CF6', policy: '#EC4899', clinician: '#228B22',
};

const AFFECTED_COLOR = '#EF4444';
const REVOKED_COLOR = '#DC2626';

// ── Sim Types ─────────────────────────────────────────────────────────────

interface PhysNode extends SimNode {
  x: number; y: number; vx: number; vy: number; radius: number;
}

// ── Physics ───────────────────────────────────────────────────────────────

function initPhysics(nodes: SimNode[], w: number, h: number): PhysNode[] {
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    const spread = Math.min(w, h) * 0.32;
    return {
      ...n,
      x: w / 2 + Math.cos(angle) * spread + (Math.random() - 0.5) * 30,
      y: h / 2 + Math.sin(angle) * spread + (Math.random() - 0.5) * 30,
      vx: 0, vy: 0,
      radius: n.directlyRevoked ? 20 : n.group === 'clinician' ? 16 : 11,
    };
  });
}

function stepPhysics(nodes: PhysNode[], edges: SimEdge[], w: number, h: number): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]; const b = nodes[j];
      const dx = a.x - b.x; const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy + 1;
      const f = 2000 / d2;
      a.vx += dx * f; a.vy += dy * f;
      b.vx -= dx * f; b.vy -= dy * f;
    }
  }

  const map = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const s = map.get(e.source); const t = map.get(e.target);
    if (!s || !t) continue;
    const dx = t.x - s.x; const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    const f = (dist - 110) * 0.007;
    s.vx += (dx / dist) * f; s.vy += (dy / dist) * f;
    t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f;
  }

  for (const n of nodes) {
    n.vx += (w / 2 - n.x) * 0.003;
    n.vy += (h / 2 - n.y) * 0.003;
    n.vx *= 0.87; n.vy *= 0.87;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(n.radius + 15, Math.min(w - n.radius - 15, n.x));
    n.y = Math.max(n.radius + 15, Math.min(h - n.radius - 15, n.y));
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: PhysNode[],
  edges: SimEdge[],
  w: number, h: number,
  time: number,
  hovId: string | null,
): void {
  ctx.clearRect(0, 0, w, h);
  const map = new Map(nodes.map((n) => [n.id, n]));
  const pulse = Math.sin(time * 3) * 0.3 + 0.7; // 0.4–1.0

  // Edges
  for (const e of edges) {
    const s = map.get(e.source); const t = map.get(e.target);
    if (!s || !t) continue;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
    if (e.affected) {
      ctx.strokeStyle = `rgba(239,68,68,${0.15 + pulse * 0.25})`;
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.8;
    }
    ctx.stroke();
  }

  // Nodes
  for (const n of nodes) {
    const hovered = hovId === n.id;
    const r = hovered ? n.radius * 1.15 : n.radius;

    if (n.directlyRevoked) {
      // Intense red glow
      const glowR = r * (2.5 + pulse * 0.8);
      const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, glowR);
      grad.addColorStop(0, 'rgba(220,38,38,0.35)');
      grad.addColorStop(1, 'rgba(220,38,38,0)');
      ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
    } else if (n.affected) {
      // Subtle red pulse
      const glowR = r * (1.8 + pulse * 0.4);
      ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239,68,68,${0.06 + pulse * 0.06})`; ctx.fill();
    }

    // Node circle
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    const baseColor = n.directlyRevoked ? REVOKED_COLOR : n.affected ? AFFECTED_COLOR : (GROUP_COLORS[n.group] ?? '#888');
    ctx.fillStyle = baseColor + (hovered ? 'DD' : '99');
    ctx.fill();
    ctx.strokeStyle = baseColor; ctx.lineWidth = hovered ? 2.5 : 1.5; ctx.stroke();

    // Label
    ctx.fillStyle = n.affected ? 'rgba(252,165,165,0.8)' : 'rgba(255,255,255,0.6)';
    ctx.font = `${n.directlyRevoked ? 'bold ' : ''}10px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(n.label.length > 14 ? n.label.slice(0, 12) + '…' : n.label, n.x, n.y + r + 13);
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function RevocationGraph({ nodes, edges, width = 700, height = 500, className = '' }: RevocationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const physRef = useRef<PhysNode[]>([]);
  const frameRef = useRef(0);
  const startRef = useRef(Date.now());
  const [hovId, setHovId] = useState<string | null>(null);

  useEffect(() => {
    physRef.current = initPhysics(nodes, width, height);
    startRef.current = Date.now();
    let frame = 0;

    function animate() {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      if (frame < 300) stepPhysics(physRef.current, edges, width, height);
      const t = (Date.now() - startRef.current) / 1000;
      draw(ctx, physRef.current, edges, width, height, t, hovId);
      frame++;
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frameRef.current);
  }, [nodes, edges, width, height, hovId]);

  const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    for (const n of physRef.current) {
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
    />
  );
}

export default RevocationGraph;
