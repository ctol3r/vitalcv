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
  status:       TrustStatus;
  label:        string;
  source?:      string;
  timestamp?:   string;
  explanation?: string;
}

const STATUS_STYLE: Record<TrustStatus, { glyph: string; text: string; glyph_opacity: string }> = {
  confirmed: { glyph: '✓', text: 'text-white/70', glyph_opacity: 'text-white/30' },
  review:    { glyph: '!', text: 'text-white/50', glyph_opacity: 'text-white/25' },
  unchecked: { glyph: '·', text: 'text-white/30', glyph_opacity: 'text-white/15' },
  blocked:   { glyph: '–', text: 'text-white/40', glyph_opacity: 'text-white/20' },
  info:      { glyph: 'i', text: 'text-white/35', glyph_opacity: 'text-white/20' },
};

export function TrustLabel({ status, label, source, timestamp, explanation, className, ...props }: TrustLabelProps) {
  const { glyph, text, glyph_opacity } = STATUS_STYLE[status];

  return (
    <div className={cn('flex items-start gap-3 py-1.5', className)} {...props}>
      <span className={cn('shrink-0 w-4 text-center text-xs font-mono mt-0.5 select-none', glyph_opacity)} aria-hidden>
        {glyph}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn('font-medium text-[13px]', text)}>{label}</span>
          {source && (
            <span className="text-white/40 text-[11px]">Confirmed via {source}</span>
          )}
          {timestamp && (
            <span className="text-white/25 text-[11px]">{timestamp}</span>
          )}
        </div>
        {explanation && (
          <p className="text-white/30 text-xs mt-0.5 leading-relaxed">{explanation}</p>
        )}
      </div>
    </div>
  );
}
