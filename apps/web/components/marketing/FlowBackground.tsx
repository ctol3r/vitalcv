"use client";

import { useEffect, useRef } from "react";

export default function FlowBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      angle: number;
      spin: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.02;
      }

      update() {
        if (prefersReducedMotion) return;
        this.x += this.speedX;
        this.y += this.speedY;
        this.angle += this.spin;

        if (this.x > width + 50) this.x = -50;
        if (this.x < -50) this.x = width + 50;
        if (this.y > height + 50) this.y = -50;
        if (this.y < -50) this.y = height + 50;
      }

      draw(context: CanvasRenderingContext2D) {
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.angle);
        context.beginPath();
        // Ring shape
        context.arc(0, 0, this.size * 3, 0, Math.PI * 2);
        context.strokeStyle = "rgba(180, 200, 220, 0.15)";
        context.lineWidth = 0.5;
        context.stroke();

        context.beginPath();
        context.arc(0, 0, this.size, 0, Math.PI * 2);
        context.fillStyle = "rgba(180, 200, 220, 0.4)";
        context.fill();
        context.restore();
      }
    }

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      const particleCount = Math.floor((width * height) / 15000);
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(Math.random() * width, Math.random() * height));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw flowing gradient orbs
      const gradient1 = ctx.createRadialGradient(
        width * 0.3, height * 0.3, 0,
        width * 0.3, height * 0.3, width * 0.5
      );
      gradient1.addColorStop(0, "rgba(20, 184, 166, 0.05)"); // teal-500
      gradient1.addColorStop(1, "rgba(20, 184, 166, 0)");

      const gradient2 = ctx.createRadialGradient(
        width * 0.7, height * 0.7, 0,
        width * 0.7, height * 0.7, width * 0.5
      );
      gradient2.addColorStop(0, "rgba(37, 99, 235, 0.05)"); // blue-600
      gradient2.addColorStop(1, "rgba(37, 99, 235, 0)");

      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.update();
        particle.draw(ctx);
      });

      // Connect particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(180, 200, 220, ${0.05 * (1 - distance / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    init();
    animate();

    const handleResize = () => {
      init();
      if (prefersReducedMotion) {
        animate(); // Draw once
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none -z-50"
      aria-hidden="true"
    />
  );
}
