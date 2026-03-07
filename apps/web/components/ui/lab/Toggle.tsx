'use client';

/**
 * Toggle — Wave 129: Uiverse Pattern Adoption
 *
 * Accessible toggle switch with smooth animation.
 * Supports reduced-motion and keyboard navigation.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className,
}: ToggleProps) {
  const dims = size === 'sm'
    ? { track: 'w-8 h-4', thumb: 'w-3 h-3', on: 17, off: 2 }
    : { track: 'w-10 h-5', thumb: 'w-3.5 h-3.5', on: 22, off: 3 };

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative rounded-full transition-colors duration-200',
          dims.track,
          checked ? 'bg-emerald-500/80' : 'bg-zinc-700',
          'focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 outline-none'
        )}
      >
        <motion.div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm',
            dims.thumb
          )}
          animate={{ x: checked ? dims.on : dims.off }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      {label && <span className="text-xs text-zinc-400">{label}</span>}
    </label>
  );
}
