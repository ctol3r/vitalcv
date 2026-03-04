'use client';

import { motion, useMotionValue, useSpring } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

interface CursorContextValue {
  cursorX: ReturnType<typeof useMotionValue<number>>;
  cursorY: ReturnType<typeof useMotionValue<number>>;
}

const CursorContext = createContext<CursorContextValue | null>(null);

export function useCursor() {
  return useContext(CursorContext);
}

interface CursorPhysicsProps {
  children: ReactNode;
}

export function CursorPhysics({ children }: CursorPhysicsProps) {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springX = useSpring(cursorX, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(cursorY, { stiffness: 150, damping: 15, mass: 0.1 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [cursorX, cursorY]);

  return (
    <CursorContext.Provider value={{ cursorX, cursorY }}>
      {children}

      {/* Cursor glow follower */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-40"
        aria-hidden="true"
        style={{
          x: springX,
          y: springY,
          width: 300,
          height: 300,
          marginLeft: -150,
          marginTop: -150,
          background:
            'radial-gradient(circle, rgba(100, 140, 255, 0.06) 0%, transparent 70%)',
          willChange: 'transform',
        }}
      />
    </CursorContext.Provider>
  );
}

/* ── Magnetic wrapper for interactive elements ──────────── */

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

export function Magnetic({ children, strength = 0.3, className = '' }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 200, damping: 20 });
  const springY = useSpring(y, { stiffness: 200, damping: 20 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set((e.clientX - centerX) * strength);
      y.set((e.clientY - centerY) * strength);
    },
    [x, y, strength],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}
