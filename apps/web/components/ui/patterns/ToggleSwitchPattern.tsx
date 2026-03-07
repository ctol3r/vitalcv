'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface ToggleSwitchPatternProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function ToggleSwitchPattern({ checked, onChange, className, disabled = false }: ToggleSwitchPatternProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700',
        className
      )}
    >
      <span className="sr-only">Toggle</span>

      {/* Inner Shadow / Depth Layer */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-full w-full rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
      />

      {/* Thumb */}
      <motion.span
        layout
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
          mass: 0.5,
        }}
        className={cn(
          'pointer-events-none absolute left-[2px] h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-all z-10',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      >
        {/* Glow effect when active */}
        {checked && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-full bg-emerald-400 blur-[4px] -z-10"
          />
        )}
      </motion.span>
    </button>
  );
}
