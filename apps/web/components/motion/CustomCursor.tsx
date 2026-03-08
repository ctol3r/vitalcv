'use client';

/**
 * CustomCursor.tsx — Wave 169: Interaction Engine
 *
 * Enhanced custom cursor with:
 *   - Inner dot (snaps to pointer)
 *   - Outer ring (spring-lag for depth)
 *   - Context-aware modes: default | graph | verify | demo
 *   - Magnetic pull toward [data-magnetic] elements
 *   - Label on hover ([data-cursor-label])
 *
 * Extends CursorPhysics with semantic context awareness.
 * Mount once in layout — replaces the system cursor on non-touch devices.
 *
 * Usage:
 *   <CustomCursor mode="graph" />
 *
 * To trigger magnetic mode on any element:
 *   <button data-magnetic>...</button>
 *
 * To show a label:
 *   <button data-cursor-label="Inspect">...</button>
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export type CursorMode = 'default' | 'graph' | 'verify' | 'demo';

interface CustomCursorProps {
  mode?: CursorMode;
}

const MODE_CONFIG: Record<CursorMode, {
  dotColor: string;
  ringColor: string;
  ringSize: number;
  dotSize: number;
}> = {
  default: { dotColor: '#fff',     ringColor: 'rgba(255,255,255,0.2)', ringSize: 32, dotSize: 6 },
  graph:   { dotColor: '#3b82f6', ringColor: 'rgba(59,130,246,0.25)',  ringSize: 36, dotSize: 5 },
  verify:  { dotColor: '#10b981', ringColor: 'rgba(16,185,129,0.25)',  ringSize: 34, dotSize: 5 },
  demo:    { dotColor: '#8b5cf6', ringColor: 'rgba(139,92,246,0.25)',  ringSize: 38, dotSize: 7 },
};

export default function CustomCursor({ mode = 'default' }: CustomCursorProps) {
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [isMagnetic, setIsMagnetic] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 28, stiffness: 280, mass: 0.5 };
  const lagConfig   = { damping: 20, stiffness: 120, mass: 1.0 };

  const dotX  = useSpring(mouseX, springConfig);
  const dotY  = useSpring(mouseY, springConfig);
  const ringX = useSpring(mouseX, lagConfig);
  const ringY = useSpring(mouseY, lagConfig);

  const magnetTargetRef = useRef<{ x: number; y: number } | null>(null);
  const cfg = MODE_CONFIG[mode];

  useEffect(() => {
    // Only show on non-touch devices
    if (window.matchMedia('(hover: none)').matches) return;

    const onMove = (e: MouseEvent) => {
      if (!visible) setVisible(true);

      const target = e.target as HTMLElement;

      // Magnetic elements
      const magnetic = target.closest('[data-magnetic]');
      if (magnetic) {
        const rect = magnetic.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        magnetTargetRef.current = { x: cx, y: cy };
        const dx = (e.clientX - cx) * 0.35;
        const dy = (e.clientY - cy) * 0.35;
        mouseX.set(cx + dx - cfg.dotSize / 2);
        mouseY.set(cy + dy - cfg.dotSize / 2);
        setIsMagnetic(true);
      } else {
        magnetTargetRef.current = null;
        setIsMagnetic(false);
        mouseX.set(e.clientX - cfg.dotSize / 2);
        mouseY.set(e.clientY - cfg.dotSize / 2);
      }

      // Label
      const labelled = target.closest('[data-cursor-label]');
      setLabel(labelled?.getAttribute('data-cursor-label') ?? null);

      // Hover detection
      const interactive = target.closest('a, button, [role="button"], [data-magnetic]');
      setHovering(!!interactive);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
  }, [visible, cfg.dotSize, mouseX, mouseY]);

  if (!visible) return null;

  const hoverScale = hovering || isMagnetic ? 1.8 : 1;
  const ringOpacity = visible ? 1 : 0;

  return (
    <>
      {/* Outer lag ring */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ x: ringX, y: ringY }}
        aria-hidden="true"
      >
        <motion.div
          animate={{ scale: hoverScale, opacity: ringOpacity }}
          transition={{ duration: 0.2 }}
          style={{
            width: cfg.ringSize,
            height: cfg.ringSize,
            marginLeft: -(cfg.ringSize / 2) + cfg.dotSize / 2,
            marginTop: -(cfg.ringSize / 2) + cfg.dotSize / 2,
            border: `1.5px solid ${cfg.ringColor}`,
            borderRadius: '50%',
          }}
        />
      </motion.div>

      {/* Inner dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ x: dotX, y: dotY }}
        aria-hidden="true"
      >
        <motion.div
          animate={{ scale: hovering ? 0.5 : 1 }}
          transition={{ duration: 0.15 }}
          style={{
            width: cfg.dotSize,
            height: cfg.dotSize,
            backgroundColor: cfg.dotColor,
            borderRadius: '50%',
          }}
        />
      </motion.div>

      {/* Cursor label */}
      {label && (
        <motion.div
          className="fixed top-0 left-0 pointer-events-none z-[9999]"
          style={{ x: dotX, y: dotY }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        >
          <div
            className="absolute left-5 -top-1 whitespace-nowrap rounded-md bg-zinc-900/90 border border-zinc-700/50 px-2 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur-sm"
          >
            {label}
          </div>
        </motion.div>
      )}
    </>
  );
}
