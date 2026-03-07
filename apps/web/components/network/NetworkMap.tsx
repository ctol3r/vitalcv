'use client';

/**
 * NetworkMap.tsx — Wave 89: Global Trust Network Map
 *
 * Canvas-based visualization of the entire trust network
 * with animated packet flow between nodes.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { getApiBase } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────

interface MapNode {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer';
  val: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface MapEdge {
  source: string;
  target: string;
  label: string;
}

interface NetworkMapProps {
  width?: number;
  height?: number;
  className?: string;
}

// ── Colors ────────────────────────────────────────────────────────────

const GROUP_COLOR: Record<string, string> = {
  clinician: '#228B22',
  issuer: '#4A90D9',
  employer: '#8B5CF6',
};

// ── Component ─────────────────────────────────────────────────────────

export function NetworkMap({ width = 600, height = 400, className = '' }: NetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<MapNode[]>([]);
  const edgesRef = useRef<MapEdge[]>([]);
  const frameRef = useRef(0);
  const [loaded, setLoaded] = useState(false);

  const base = getApiBase();

  // Fetch network map data
  useEffect(() => {
    fetch(`${base}/api/network/map`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        // Initialize node positions
        const nodes: MapNode[] = data.nodes.map((n: { id: string; label: string; group: string; val: number }, i: number) => {
          const angle = (2 * Math.PI * i) / Math.max(data.nodes.length, 1);
          const spread = Math.min(width, height) * 0.35;
          return {
            ...n,
            x: width / 2 + Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
            y: height / 2 + Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
            vx: 0,
            vy: 0,
          };
        });
        nodesRef.current = nodes;
        edgesRef.current = data.edges;
        setLoaded(true);
      })
      .catch(() => {});
  }, [base, width, height]);

  // Animation loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Simple physics (first 200 frames)
    if (frameRef.current < 200) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 1;
          const f = 1500 / d2;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      for (const n of nodes) {
        n.vx += (width / 2 - n.x) * 0.002;
        n.vy += (height / 2 - n.y) * 0.002;
        n.vx *= 0.9; n.vy *= 0.9;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(20, Math.min(width - 20, n.x));
        n.y = Math.max(20, Math.min(height - 20, n.y));
      }
    }

    ctx.clearRect(0, 0, width, height);

    // Edges
    for (const e of edges) {
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Packet animation
    const packetPhase = (Date.now() % 4000) / 4000;
    for (const e of edges) {
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const px = s.x + (t.x - s.x) * packetPhase;
      const py = s.y + (t.y - s.y) * packetPhase;
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
    }

    // Nodes
    for (const n of nodes) {
      const color = GROUP_COLOR[n.group] ?? '#888';
      const r = Math.max(n.val * 0.4, 3);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + '88';
      ctx.fill();
    }

    frameRef.current++;
    requestAnimationFrame(draw);
  }, [width, height]);

  useEffect(() => {
    if (!loaded) return;
    frameRef.current = 0;
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [loaded, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`rounded-xl ${className}`}
      style={{ background: 'rgba(0,0,0,0.2)' }}
    />
  );
}

export default NetworkMap;
