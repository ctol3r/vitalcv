'use client';

/**
 * InfrastructureMap.tsx — Wave 63: Global Trust Network Map
 *
 * Lightweight canvas-based graph showing clinicians, issuers, employers
 * with animated event packets. Designed for homepage embed — optimized
 * for <16ms frames at 60fps.
 */

import { useRef, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface InfrastructureMapProps {
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const NODE_COUNT = 18;
const EDGE_DENSITY = 1.4;
const COLORS = ['#34D399', '#60A5FA', '#A78BFA', '#DAA520', '#EC4899', '#F97316'];

// ── Simulation State ──────────────────────────────────────────────────────

interface MapNode {
  x: number; y: number; vx: number; vy: number;
  r: number; color: string;
}
interface MapEdge { a: number; b: number }
interface Packet { edge: number; t: number; speed: number; color: string }

function init(w: number, h: number): { nodes: MapNode[]; edges: MapEdge[]; packets: Packet[] } {
  const nodes: MapNode[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / NODE_COUNT;
    const ring = i < 6 ? 0.18 : i < 12 ? 0.32 : 0.44;
    nodes.push({
      x: w / 2 + Math.cos(angle) * w * ring + (Math.random() - 0.5) * 30,
      y: h / 2 + Math.sin(angle) * h * ring + (Math.random() - 0.5) * 30,
      vx: 0, vy: 0,
      r: 3 + Math.random() * 3,
      color: COLORS[i % COLORS.length],
    });
  }

  const edges: MapEdge[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const count = Math.floor(Math.random() * EDGE_DENSITY) + 1;
    for (let c = 0; c < count; c++) {
      const j = (i + 1 + Math.floor(Math.random() * 4)) % NODE_COUNT;
      if (i !== j) edges.push({ a: i, b: j });
    }
  }

  // Initial packets
  const packets: Packet[] = edges.slice(0, 6).map((_, i) => ({
    edge: i,
    t: Math.random(),
    speed: 0.003 + Math.random() * 0.004,
    color: COLORS[i % COLORS.length],
  }));

  return { nodes, edges, packets };
}

function physics(nodes: MapNode[], edges: MapEdge[], w: number, h: number): void {
  // Light repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d2 = dx * dx + dy * dy + 1;
      const f = 500 / d2;
      nodes[i].vx += dx * f; nodes[i].vy += dy * f;
      nodes[j].vx -= dx * f; nodes[j].vy -= dy * f;
    }
  }
  // Attraction
  for (const e of edges) {
    const a = nodes[e.a]; const b = nodes[e.b];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    const f = (dist - 80) * 0.002;
    a.vx += (dx / dist) * f; a.vy += (dy / dist) * f;
    b.vx -= (dx / dist) * f; b.vy -= (dy / dist) * f;
  }
  // Integrate
  for (const n of nodes) {
    n.vx += (w / 2 - n.x) * 0.0008;
    n.vy += (h / 2 - n.y) * 0.0008;
    n.vx *= 0.93; n.vy *= 0.93;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(15, Math.min(w - 15, n.x));
    n.y = Math.max(15, Math.min(h - 15, n.y));
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: MapNode[], edges: MapEdge[], packets: Packet[],
  w: number, h: number, time: number,
): void {
  ctx.clearRect(0, 0, w, h);

  // Edges
  for (const e of edges) {
    ctx.beginPath();
    ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
    ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Packets
  for (const p of packets) {
    const e = edges[p.edge]; if (!e) continue;
    const a = nodes[e.a]; const b = nodes[e.b];
    const px = a.x + (b.x - a.x) * p.t;
    const py = a.y + (b.y - a.y) * p.t;
    ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.color + '99'; ctx.fill();
  }

  // Nodes
  const pulse = Math.sin(time * 1.5) * 0.12 + 0.88;
  for (const n of nodes) {
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = n.color + '08'; ctx.fill();
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
    ctx.fillStyle = n.color + '77'; ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function InfrastructureMap({ className = '' }: InfrastructureMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ReturnType<typeof init> | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? 600;
    const h = parent?.clientHeight ?? 300;
    canvas.width = w; canvas.height = h;

    stateRef.current = init(w, h);
    const t0 = Date.now();
    let frame = 0;

    function animate() {
      if (!stateRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      if (frame < 300) physics(stateRef.current.nodes, stateRef.current.edges, w, h);

      // Update packets
      for (const p of stateRef.current.packets) {
        p.t += p.speed;
        if (p.t >= 1) {
          p.t = 0;
          p.edge = Math.floor(Math.random() * stateRef.current.edges.length);
          p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        }
      }

      // Spawn new packets occasionally
      if (frame % 120 === 0 && stateRef.current.packets.length < 12) {
        stateRef.current.packets.push({
          edge: Math.floor(Math.random() * stateRef.current.edges.length),
          t: 0,
          speed: 0.003 + Math.random() * 0.004,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }

      const t = (Date.now() - t0) / 1000;
      draw(ctx, stateRef.current.nodes, stateRef.current.edges, stateRef.current.packets, w, h, t);
      frame++;
      frameRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} />;
}

export default InfrastructureMap;
