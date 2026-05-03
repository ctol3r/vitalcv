import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ConfidenceTierBadge,
  type ConfidenceTier,
} from './ConfidenceTierBadge';

export interface IdentityFieldData {
  id: string;
  label: string;
  value: React.ReactNode;
  confidence: ConfidenceTier;
  source: string;
  /** Optional explanatory hint shown beneath the value. */
  hint?: React.ReactNode;
}

export interface IdentityFieldProps {
  field: IdentityFieldData;
  /** Reduces vertical padding for tight stacks. */
  dense?: boolean;
  className?: string;
}

/**
 * IdentityField — a single attested fact about a clinician's identity.
 *
 * Renders label, value, confidence-tier badge, source attribution, and
 * an optional hint. Used inside `IdentityFieldsCard` lists (passport,
 * employer review header) but also drop-in standalone.
 */
export function IdentityField({ field, dense, className }: IdentityFieldProps) {
  const valueToneClass =
    field.confidence === 'verified'
      ? 'text-[var(--vt-text-primary)] font-medium'
      : field.confidence === 'inferred'
        ? 'text-[var(--vt-text-secondary)]'
        : field.confidence === 'unknown'
          ? 'text-[var(--vt-text-muted)] italic'
          : 'text-[var(--vt-text-primary)] font-medium';

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-[var(--vt-border-subtle)] last:border-b-0',
        dense ? 'py-2' : 'py-2.5',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
          {field.label}
        </div>
        <div className="mt-0.5 flex items-center flex-wrap gap-2">
          <span className={cn('text-[12.5px]', valueToneClass)}>{field.value}</span>
          <ConfidenceTierBadge tier={field.confidence} />
        </div>
        {field.hint && (
          <div className="text-[10.5px] text-[var(--vt-text-muted)] mt-1 leading-snug max-w-[480px]">
            {field.hint}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
          Source
        </div>
        <div className="font-mono text-[10.5px] text-[var(--vt-text-secondary)] mt-0.5">
          {field.source}
        </div>
      </div>
    </div>
  );
}
