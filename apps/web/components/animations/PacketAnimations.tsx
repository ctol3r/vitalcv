'use client';

import { useEffect, useRef } from 'react';

export type PacketType = 'verification' | 'revocation' | 'attestation';

interface PacketConfig {
  color: string;
  glow: string;
  speed: number;
}

const PACKET_CONFIGS: Record<PacketType, PacketConfig> = {
  verification: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', speed: 1.5 },
  revocation: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', speed: 2.0 },
  attestation: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', speed: 1.2 },
};

interface EdgePath {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: PacketType;
}

interface Packet {
  edge: EdgePath;
  progress: number;
  type: PacketType;
}

interface PacketAnimationsProps {
  edges: EdgePath[];
  width: number;
  height: number;
  className?: string;
  frequency?: number; // packets per second per edge
}

export function PacketAnimations({
  edges,
  width,
  height,
  className = '',
  frequency = 0.3,
}: PacketAnimationsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetsRef = useRef<Packet[]>([]);
  const rafRef = useRef(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const animate = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);

      // Spawn new packets periodically
      const spawnInterval = 1000 / frequency;
      if (timestamp - lastSpawnRef.current > spawnInterval && edges.length > 0) {
        const edge = edges[Math.floor(Math.random() * edges.length)];
        packetsRef.current.push({ edge, progress: 0, type: edge.type });
        lastSpawnRef.current = timestamp;
      }

      // Update and draw packets
      const alive: Packet[] = [];
      for (const pkt of packetsRef.current) {
        const config = PACKET_CONFIGS[pkt.type];
        pkt.progress += config.speed / 100;

        if (pkt.progress > 1) continue; // remove

        const x = pkt.edge.x1 + (pkt.edge.x2 - pkt.edge.x1) * pkt.progress;
        const y = pkt.edge.y1 + (pkt.edge.y2 - pkt.edge.y1) * pkt.progress;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = config.glow;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = config.color;
        ctx.fill();

        // Trail
        const trailLength = 0.08;
        const trailStart = Math.max(0, pkt.progress - trailLength);
        const tx = pkt.edge.x1 + (pkt.edge.x2 - pkt.edge.x1) * trailStart;
        const ty = pkt.edge.y1 + (pkt.edge.y2 - pkt.edge.y1) * trailStart;

        const gradient = ctx.createLinearGradient(tx, ty, x, y);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, config.glow);

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        alive.push(pkt);
      }

      packetsRef.current = alive;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [edges, width, height, frequency]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={{ willChange: 'transform' }}
    />
  );
}
