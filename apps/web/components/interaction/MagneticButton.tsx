'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  as?: 'button' | 'div';
  strength?: number;
}

export function MagneticButton({
  children,
  className,
  onClick,
  as = 'button',
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.5 });

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const onMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Component = motion[as] as typeof motion.button;

  return (
    <Component
      ref={ref as React.Ref<HTMLButtonElement>}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-shadow duration-300',
        'hover:shadow-[0_0_30px_var(--ag-glow)]',
        className,
      )}
      style={{ x: springX, y: springY }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </Component>
  );
}
