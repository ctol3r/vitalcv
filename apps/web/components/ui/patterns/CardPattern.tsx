'use client';

import { cn } from '@/lib/utils';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { MouseEvent, ReactNode } from 'react';

interface CardPatternProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function CardPattern({ children, className, glowColor = 'rgba(255, 255, 255, 0.1)' }: CardPatternProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-zinc-200 bg-white/50 p-6 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900/80 overflow-hidden',
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              600px circle at ${mouseX}px ${mouseY}px,
              ${glowColor},
              transparent 40%
            )
          `,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
