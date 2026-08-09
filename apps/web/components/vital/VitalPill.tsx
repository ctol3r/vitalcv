import * as React from 'react';

/**
 * VitalPill — a small mono label pill for NON-STATE facts (D-02).
 *
 * Owner chips ("VitalCV", "Your approval"), source names ("NPPES"), section
 * tags. Deliberately toneless: it renders in the register's secondary ink and
 * has no color prop, because the moment a pill can be green it becomes a
 * counterfeit StateChip. Anything that asserts an evidence state uses
 * StateChip, which carries glyph + word + attribution (EC-3/EC-4).
 */
export type VitalPillProps = {
  label: string;
  register?: 'scene' | 'paper';
  className?: string;
};

const REGISTER: Record<'scene' | 'paper', string> = {
  scene: 'border-[var(--vt-scene-line-strong)] text-[var(--vt-scene-text-secondary)]',
  paper: 'border-[var(--vt-scene-paper-line)] text-[var(--vt-scene-paper-text-secondary)]',
};

export function VitalPill({ label, register = 'scene', className }: VitalPillProps) {
  return (
    <span
      className={
        'inline-flex items-center whitespace-nowrap rounded-full border px-[8px] py-[4px] ' +
        'font-mono text-[9px] font-medium uppercase tracking-[0.07em] ' +
        `${REGISTER[register]} ${className ?? ''}`
      }
    >
      {label}
    </span>
  );
}
