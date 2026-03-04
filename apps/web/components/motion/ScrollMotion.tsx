'use client';

import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ── Section Reveal ───────────────────────────────────────── */

interface SectionRevealProps {
  children: ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
}

const directionMap = {
  up: { y: 30, x: 0 },
  down: { y: -30, x: 0 },
  left: { x: -40, y: 0 },
  right: { x: 40, y: 0 },
};

export function SectionReveal({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  const { x: initialX, y: initialY } = directionMap[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: initialX, y: initialY, scale: 0.97 }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0, scale: 1 }
          : { opacity: 0, x: initialX, y: initialY, scale: 0.97 }
      }
      transition={{
        duration: 0.6,
        delay,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Graph Expansion (scales up on scroll into view) ──────── */

interface GraphExpansionProps {
  children: ReactNode;
  className?: string;
}

export function GraphExpansion({ children, className = '' }: GraphExpansionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
      animate={
        isInView
          ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
          : { opacity: 0, scale: 0.85, filter: 'blur(8px)' }
      }
      transition={{
        duration: 0.8,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Parallax wrapper ─────────────────────────────────────── */

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  speed?: number;
}

export function Parallax({ children, className = '', speed = 0.3 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * -60, speed * 60]);

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}

/* ── Terminal Typing (scroll-triggered) ───────────────────── */

interface TerminalTypingProps {
  text: string;
  className?: string;
  speed?: number;
}

export function TerminalTyping({ text, className = '', speed = 30 }: TerminalTypingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!isInView) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [isInView, text, speed]);

  return (
    <div ref={ref} className={`font-mono ${className}`}>
      {displayed}
      {isInView && displayed.length < text.length && (
        <span className="inline-block w-1.5 h-4 bg-infra-blue animate-pulse ml-0.5" />
      )}
    </div>
  );
}

