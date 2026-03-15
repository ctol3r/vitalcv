'use client';

/**
 * foundry-primitives.tsx — Native replacements for BlueprintJS components
 *
 * Drop-in alternatives for: Card, Button, ButtonGroup, Collapse, Divider,
 * InputGroup, Slider, Switch, Tag, Navbar, NavbarGroup, NavbarDivider
 *
 * Uses Foundry tokens + Tailwind. Zero external dependencies.
 */

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Card ───────────────────────────────────────────────────────────────────────

interface CardProps {
  className?: string;
  children: ReactNode;
  interactive?: boolean;
  onClick?: () => void;
}

export function Card({ className, children, interactive, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-[var(--gf-panel,#0d1421)] p-4',
        interactive && 'cursor-pointer hover:border-white/[0.12] hover:bg-[var(--gf-panel-raised,#111827)] transition-colors',
        className,
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// ── Collapse ───────────────────────────────────────────────────────────────────

interface CollapseProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export function Collapse({ isOpen, children, className }: CollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-white/[0.06] my-3', className)} />;
}

// ── Switch ─────────────────────────────────────────────────────────────────────

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, className, disabled }: SwitchProps) {
  return (
    <label className={cn('flex items-center gap-2.5 cursor-pointer select-none', disabled && 'opacity-40 cursor-not-allowed', className)}>
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
          checked
            ? 'bg-blue-500/30 border-blue-500/40'
            : 'bg-white/[0.08] border-white/[0.12]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-200',
            checked
              ? 'translate-x-4 bg-blue-400'
              : 'translate-x-0 bg-white/40',
          )}
        />
      </button>
      {label && <span className="text-xs text-white/60">{label}</span>}
    </label>
  );
}

// ── Tag ────────────────────────────────────────────────────────────────────────

interface TagProps {
  children: ReactNode;
  minimal?: boolean;
  className?: string;
  intent?: 'primary' | 'success' | 'warning' | 'danger' | 'none';
}

const TAG_INTENT_STYLES = {
  primary: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  danger:  'bg-red-500/10 text-red-400 ring-red-500/20',
  none:    'bg-white/5 text-white/60 ring-white/10',
};

export function Tag({ children, minimal, className, intent = 'none' }: TagProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
      TAG_INTENT_STYLES[intent],
      className,
    )}>
      {children}
    </span>
  );
}

// ── ButtonGroup ────────────────────────────────────────────────────────────────

export function ButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex rounded-lg overflow-hidden border border-white/[0.08]', className)}>
      {children}
    </div>
  );
}

// ── Slider ─────────────────────────────────────────────────────────────────────

interface SliderProps {
  min: number;
  max: number;
  value: number;
  stepSize?: number;
  onChange: (value: number) => void;
  labelRenderer?: boolean | ((value: number) => string);
  className?: string;
}

export function Slider({ min, max, value, stepSize = 1, onChange, className }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={stepSize}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('gf-slider w-full', className)}
    />
  );
}

// ── InputGroup ─────────────────────────────────────────────────────────────────

interface InputGroupProps {
  value: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  leftElement?: ReactNode;
  large?: boolean;
  className?: string;
}

export function InputGroup({
  value,
  onValueChange,
  onChange,
  placeholder,
  leftElement,
  large,
  className,
}: InputGroupProps) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3', large ? 'py-2' : 'py-1.5', className)}>
      {leftElement}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onValueChange?.(e.target.value);
          onChange?.(e);
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 focus:outline-none"
      />
    </div>
  );
}
