'use client';

/**
 * ParticleLayer.tsx — Wave 169: Interaction Engine
 *
 * Canvas-based ambient particle system for operator surfaces.
 * Particles drift with slight randomness; on mouse proximity they
 * are attracted toward the cursor (creates a trust-network "gravity" feel).
 *
 * Designed for: graph exploration, verification pipeline background, demo surfaces.
 * Performance: uses requestAnimationFrame + single canvas; pauses when tab hidden.
 *
 * Usage:
 *   <ParticleLayer count={60} color="#3b82f6" attract />
 */

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  alphaDir: number;
}

interface ParticleLayerProps {
  /** Number of particles (default: 48) */
  count?: number;
  /** Primary particle colour (default: #3b82f6 blue) */
  color?: string;
  /** Enable cursor attraction (default: true) */
  attract?: boolean;
  /** Attraction radius px (default: 120) */
  attractRadius?: number;
  /** Attraction strength 0–1 (default: 0.04) */
  attractStrength?: number;
  className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function ParticleLayer({
  count = 48,
  color = '#3b82f6',
  attract = true,
  attractRadius = 120,
  attractStrength = 0.04,
  className = '',
}: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const [r, g, b] = hexToRgb(color);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width  = rect?.width  ?? window.innerWidth;
      canvas.height = rect?.height ?? window.innerHeight;
    };
    resize();

    // Spawn particles
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.15,
      alphaDir: Math.random() > 0.5 ? 1 : -1,
    }));

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener('mousemove', handleMouse);

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let paused = false;
    const handleVisibility = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', handleVisibility);

    const draw = () => {
      if (paused) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const { x: mx, y: my } = mouseRef.current;

      for (const p of particles) {
        // Cursor attraction
        if (attract) {
          const dx = mx - p.x;
          const dy = my - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < attractRadius && dist > 0) {
            const force = (1 - dist / attractRadius) * attractStrength;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Velocity damping
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Drift cap
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1.2) { p.vx *= 1.2 / speed; p.vy *= 1.2 / speed; }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Breathe alpha
        p.alpha += p.alphaDir * 0.002;
        if (p.alpha > 0.65 || p.alpha < 0.08) p.alphaDir *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
        ctx.fill();
      }

      // Draw faint connections within 80px
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 80) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d / 80) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouse);
      document.removeEventListener('visibilitychange', handleVisibility);
      ro.disconnect();
    };
  }, [count, r, g, b, attract, attractRadius, attractStrength]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
    />
  );
}
