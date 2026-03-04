'use client';

/**
 * LiveNetworkMap.tsx — Wave 61 + Bonus 2: Living Trust Network
 *
 * Canvas-based visualization of the global trust network with animated
 * event packets flowing between nodes. Nodes represent clinicians,
 * issuers, and employers; edges represent trust relationships.
 */

import { useRef, useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface NetworkEvent {
  id: string;
  type: 'verification' | 'attestation' | 'revocation';
  npi: string;
  timestamp: string;
}

interface LiveNetworkMapProps {
  events: NetworkEvent[];
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  verification: '#34D399',
  attestation: '#60A5FA',
  revocation: '#EF4444',
};

// ── Simulation ────────────────────────────────────────────────────────────

interface NetNode {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color: string;
  label: string;
}

interface NetEdge {
  from: number; to: number;
}

interface Particle {
  edgeIdx: number;
  progress: number;
  speed: number;
  color: string;
}

function generateNetwork(w: number, h: number): { nodes: NetNode[]; edges: NetEdge[] } {
  const nodeCount = 24;
  const nodes: NetNode[] = [];
  const colors = ['#34D399', '#60A5FA', '#A78BFA', '#DAA520', '#EC4899'];
  const labels = ['Clinician', 'Issuer', 'Hospital', 'Board', 'Employer', 'Registry', 'Agency', 'Lab'];

  for (let i = 0; i < nodeCount; i++) {
    const angle = (2 * Math.PI * i) / nodeCount;
    const ring = i < 8 ? 0.2 : i < 16 ? 0.35 : 0.48;
    nodes.push({
      id: `node-${i}`,
      x: w / 2 + Math.cos(angle) * w * ring + (Math.random() - 0.5) * 40,
      y: h / 2 + Math.sin(angle) * h * ring + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
      radius: 4 + Math.random() * 4,
      color: colors[i % colors.length],
      label: labels[i % labels.length],
    });
  }

  const edges: NetEdge[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const connections = 1 + Math.floor(Math.random() * 2);
    for (let c = 0; c < connections; c++) {
      const j = (i + 1 + Math.floor(Math.random() * 5)) % nodeCount;
      if (i !== j) edges.push({ from: i, to: j });
    }
  }

  return { nodes, edges };
}

function stepPhysics(nodes: NetNode[], edges: NetEdge[], w: number, h: number): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d2 = dx * dx + dy * dy + 1;
      const f = 800 / d2;
      nodes[i].vx += dx * f; nodes[i].vy += dy * f;
      nodes[j].vx -= dx * f; nodes[j].vy -= dy * f;
    }
  }

  for (const e of edges) {
    const a = nodes[e.from]; const b = nodes[e.to];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    const f = (dist - 100) * 0.003;
    a.vx += (dx / dist) * f; a.vy += (dy / dist) * f;
    b.vx -= (dx / dist) * f; b.vy -= (dy / dist) * f;
  }

  for (const n of nodes) {
    n.vx += (w / 2 - n.x) * 0.001;
    n.vy += (h / 2 - n.y) * 0.001;
    n.vx *= 0.92; n.vy *= 0.92;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(20, Math.min(w - 20, n.x));
    n.y = Math.max(20, Math.min(h - 20, n.y));
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: NetNode[], edges: NetEdge[], particles: Particle[],
  w: number, h: number, time: number,
): void {
  ctx.clearRect(0, 0, w, h);

  // Edges
  for (const e of edges) {
    const a = nodes[e.from]; const b = nodes[e.to];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // Particles
  for (const p of particles) {
    const e = edges[p.edgeIdx];
    if (!e) continue;
    const a = nodes[e.from]; const b = nodes[e.to];
    const px = a.x + (b.x - a.x) * p.progress;
    const py = a.y + (b.y - a.y) * p.progress;
    ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color + 'BB'; ctx.fill();
  }

  // Nodes
  for (const n of nodes) {
    const pulse = Math.sin(time * 2 + n.x * 0.01) * 0.15 + 0.85;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = n.color + '10'; ctx.fill();
    ctx.beginPath(); ctx.arc(n.x, n.y, n.radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = n.color + '88'; ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function LiveNetworkMap({ events, className = '' }: LiveNetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const netRef = useRef<{ nodes: NetNode[]; edges: NetEdge[] } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);
  const sizeRef = useRef({ w: 800, h: 600 });

  // Spawn particles from events
  useEffect(() => {
    if (!netRef.current) return;
    const edgeCount = netRef.current.edges.length;
    const newParticles = events.slice(0, 5).map((ev, i) => ({
      edgeIdx: (i * 7) % edgeCount,
      progress: 0,
      speed: 0.005 + Math.random() * 0.005,
      color: TYPE_COLORS[ev.type] ?? '#34D399',
    }));
    particlesRef.current = [...particlesRef.current.slice(-20), ...newParticles];
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.parentElement?.clientWidth ?? 800;
    const h = canvas.parentElement?.clientHeight ?? 600;
    canvas.width = w; canvas.height = h;
    sizeRef.current = { w, h };

    netRef.current = generateNetwork(w, h);
    const startTime = Date.now();
    let frame = 0;

    function animate() {
      if (!canvasRef.current || !netRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const { w: cw, h: ch } = sizeRef.current;

      if (frame < 400) stepPhysics(netRef.current.nodes, netRef.current.edges, cw, ch);

      // Update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.progress += p.speed;
        return p.progress < 1;
      });

      const t = (Date.now() - startTime) / 1000;
      draw(ctx, netRef.current.nodes, netRef.current.edges, particlesRef.current, cw, ch, t);
      frame++;
      frameRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} />;
}

export default LiveNetworkMap;
