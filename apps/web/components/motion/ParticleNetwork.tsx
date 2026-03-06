'use client';

import { useEffect, useRef } from 'react';

/**
 * ParticleNetwork — native Canvas 2D particle system.
 * Zero external dependencies. Replaces react-tsparticles.
 *
 * Features:
 *  - ~40 floating particles linked by proximity edges
 *  - Cursor repulse (100px radius)
 *  - Bounce off edges, 60fps via requestAnimationFrame
 *  - Respects prefers-reduced-motion
 */

const PARTICLE_COUNT = 40;
const LINK_DISTANCE = 150;
const PARTICLE_SPEED = 0.8;
const REPULSE_RADIUS = 100;
const REPULSE_FORCE = 2.5;

const COLORS = ['#2563EB', '#14B8A6', '#8B5CF6']; // waveBlue, waveTeal, wavePurple

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  opacity: number;
}

function makeParticle(w: number, h: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = (0.4 + Math.random() * 0.6) * PARTICLE_SPEED;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 1 + Math.random(),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: 0.35 + Math.random() * 0.35,
  };
}

export function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const particles = useRef<Particle[]>([]);
  const rafId = useRef(0);

  useEffect(() => {
    // Respect reduced-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ── Size canvas to parent ── */
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      // Re-seed when dimensions change
      particles.current = Array.from({ length: PARTICLE_COUNT }, () =>
        makeParticle(width, height),
      );
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* ── Mouse tracking ── */
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => {
      mouse.current = { x: -9999, y: -9999 };
    };
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    /* ── Animation loop ── */
    const draw = () => {
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;

      ctx.clearRect(0, 0, w, h);

      const ps = particles.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      // Update positions
      for (const p of ps) {
        // Cursor repulse
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSE_RADIUS && dist > 0) {
          const force = (REPULSE_RADIUS - dist) / REPULSE_RADIUS;
          p.vx += (dx / dist) * force * REPULSE_FORCE * 0.05;
          p.vy += (dy / dist) * force * REPULSE_FORCE * 0.05;
        }

        // Dampen velocity to avoid runaway speed
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpd = PARTICLE_SPEED * 3;
        if (spd > maxSpd) {
          p.vx = (p.vx / spd) * maxSpd;
          p.vy = (p.vy / spd) * maxSpd;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x <= p.r || p.x >= w - p.r) p.vx *= -1;
        if (p.y <= p.r || p.y >= h - p.r) p.vy *= -1;
        p.x = Math.max(p.r, Math.min(w - p.r, p.x));
        p.y = Math.max(p.r, Math.min(h - p.r, p.y));
      }

      // Draw links
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x;
          const dy = ps[i].y - ps[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DISTANCE) {
            const alpha = (1 - d / LINK_DISTANCE) * 0.2;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.strokeStyle = `rgba(37,99,235,${alpha})`; // waveBlue
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of ps) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId.current);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-40"
      aria-hidden="true"
    />
  );
}
