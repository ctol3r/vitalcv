import * as React from 'react';
import { Info, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ConfidenceTierBadge,
  type ConfidenceTier,
} from './ConfidenceTierBadge';
import { IdentityField, type IdentityFieldData } from './IdentityField';

export interface IdentityFieldsCardProps {
  fields: IdentityFieldData[];
  title?: string;
  /** Optional muted footer note (e.g. "Resolved against NPPES on 2026-04-25"). */
  note?: React.ReactNode;
  /** Tiers to surface in the header legend. Defaults to all four. */
  legendTiers?: ConfidenceTier[];
  className?: string;
}

const DEFAULT_LEGEND: ConfidenceTier[] = [
  'verified',
  'inferred',
  'unknown',
  'contradicted',
];

/**
 * IdentityFieldsCard — wraps an `IdentityField[]` list with a brand
 * header (eyebrow + title + tier legend) and an optional footer note.
 * Mirrors the prototype's `IdentityFieldsCard` 1:1.
 */
export function IdentityFieldsCard({
  fields,
  title = 'Enriched profile',
  note,
  legendTiers = DEFAULT_LEGEND,
  className,
}: IdentityFieldsCardProps) {
  return (
    <section
      className={cn(
        'border border-[var(--vt-border)] rounded-md bg-[var(--vt-surface)] overflow-hidden',
        className,
      )}
    >
      <header className="px-5 py-2.5 border-b border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User size={13} className="text-[var(--vt-text-secondary)]" aria-hidden="true" />
          <span className="text-[12.5px] font-semibold text-[var(--vt-text-primary)]">
            {title}
          </span>
        </div>
        <div
          className="flex items-center gap-2 text-[10.5px] text-[var(--vt-text-muted)]"
          aria-label="Confidence tier legend"
        >
          {legendTiers.map((tier) => (
            <ConfidenceTierBadge key={tier} tier={tier} size="xs" />
          ))}
        </div>
      </header>

      <div className="px-5">
        {fields.map((field) => (
          <IdentityField key={field.id} field={field} />
        ))}
      </div>

      {note && (
        <footer className="px-5 py-2 border-t border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] text-[10.5px] text-[var(--vt-text-muted)] flex items-center gap-2">
          <Info size={11} className="text-[var(--vt-text-muted)]" aria-hidden="true" />
          <span>{note}</span>
        </footer>
      )}
    </section>
  );
}
