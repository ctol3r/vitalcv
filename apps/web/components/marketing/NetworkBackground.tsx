'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  pulse: number;
};

const MAX_DISTANCE = 130;
const EDGE_PADDING = 24;

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let frameId = 0;
    let animationActive = true;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: Particle[] = [];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const buildParticles = (count: number) =>
      Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: (Math.random() - 0.5) * 0.25,
        velocityY: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1.8 + 0.4,
        pulse: Math.random() * Math.PI * 2,
      }));

    const setupCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(70, Math.min(140, Math.floor((width * height) / 13000)));
      particles = buildParticles(count);
    };

    const drawGradient = () => {
      const background = context.createRadialGradient(
        width * 0.3,
        height * 0.2,
        0,
        width * 0.3,
        height * 0.2,
        width * 0.8,
      );
      background.addColorStop(0, 'rgba(191, 211, 231, 0.10)');
      background.addColorStop(1, 'rgba(191, 211, 231, 0)');

      const secondary = context.createRadialGradient(
        width * 0.75,
        height * 0.8,
        0,
        width * 0.75,
        height * 0.8,
        width * 0.8,
      );
      secondary.addColorStop(0, 'rgba(160, 210, 190, 0.09)');
      secondary.addColorStop(1, 'rgba(160, 210, 190, 0)');

      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.fillStyle = secondary;
      context.fillRect(0, 0, width, height);
    };

    const drawParticle = (particle: Particle) => {
      const glow = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * 10);
      const alpha = 0.15 + ((Math.sin(particle.pulse) + 1) / 2) * 0.2;

      glow.addColorStop(0, `rgba(191, 211, 231, ${alpha})`);
      glow.addColorStop(1, 'rgba(191, 211, 231, 0)');

      context.fillStyle = glow;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius * 9, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.fillStyle = `rgba(180, 210, 230, ${0.35 + alpha * 0.5})`;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    };

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;

          if (distSq > MAX_DISTANCE * MAX_DISTANCE) {
            continue;
          }

          const intensity = 1 - Math.sqrt(distSq) / MAX_DISTANCE;
          if (intensity <= 0) continue;

          context.beginPath();
          context.strokeStyle = `rgba(180, 210, 230, ${0.05 + intensity * 0.25})`;
          context.lineWidth = 0.6 + intensity * 0.5;
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    };

    const animate = () => {
      if (!animationActive) return;

      context.clearRect(0, 0, width, height);
      drawGradient();

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];

        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.pulse += 0.012;

        if (particle.x > width + EDGE_PADDING) particle.x = -EDGE_PADDING;
        if (particle.x < -EDGE_PADDING) particle.x = width + EDGE_PADDING;
        if (particle.y > height + EDGE_PADDING) particle.y = -EDGE_PADDING;
        if (particle.y < -EDGE_PADDING) particle.y = height + EDGE_PADDING;

        drawParticle(particle);
      }

      drawConnections();

      if (!prefersReducedMotion) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    const handleResize = () => {
      setupCanvas();
      animate();
    };

    setupCanvas();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      animationActive = false;
      window.removeEventListener('resize', handleResize);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-50 h-full w-full"
      aria-hidden="true"
    />
  );
}
