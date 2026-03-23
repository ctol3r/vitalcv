import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TrustLabel — source-backed row for trust surfaces.
 *
 * Doctrine: no color on status. All hierarchy via opacity only.
 *   confirmed → text-white/70  (high opacity — most trust)
 *   review    → text-white/50  (mid)
 *   unchecked → text-white/30  (low — not yet verified)
 *   blocked   → text-white/40  (present but needs action)
 *   info      → text-white/35  (neutral annotation)
 *
 * Icons are glyph-only (·  ✓  !  –  i), not colored.
 * Green (emerald-*) is reserved exclusively for CTA buttons.
 */

export type TrustStatus = 'confirmed' | 'review' | 'unchecked' | 'blocked' | 'info';

interface TrustLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  status:   TrustStatus;
  label:    string;
  source?:  string;
  date?:    string;
  vintage?: string;
}

const STATUS_STYLE: Record<TrustStatus, { glyph: string; text: string; glyph_opacity: string }> = {
  confirmed: { glyph: '✓', text: 'text-white/70', glyph_opacity: 'text-white/30' },
  review:    { glyph: '!', text: 'text-white/50', glyph_opacity: 'text-white/25' },
  unchecked: { glyph: '·', text: 'text-white/30', glyph_opacity: 'text-white/15' },
  blocked:   { glyph: '–', text: 'text-white/40', glyph_opacity: 'text-white/20' },
  info:      { glyph: 'i', text: 'text-white/35', glyph_opacity: 'text-white/20' },
};

export function TrustLabel({ status, label, source, date, vintage, className, ...props }: TrustLabelProps) {
  const { glyph, text, glyph_opacity } = STATUS_STYLE[status];

  const detail = [source, date, vintage].filter(Boolean).join(' — ');

  return (
    <div className={cn('flex items-start gap-2.5 text-sm', className)} {...props}>
      <span
        className={cn('shrink-0 w-4 text-center text-xs font-mono mt-0.5 select-none', glyph_opacity)}
        aria-hidden
      >
        {glyph}
      </span>
      <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
        <span className={cn('font-medium', text)}>{label}</span>
        {detail && (
          <span className="text-white/25 text-xs">({detail})</span>
        )}
      </div>
    </div>
  );
}
