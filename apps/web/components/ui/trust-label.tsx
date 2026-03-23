import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TrustLabel — source-backed row for trust surfaces.
 *
 * Doctrine: no color on status. All hierarchy via opacity only.
 *   confirmed → high opacity
 *   review    → medium opacity
 *   unchecked → low opacity
 *   blocked   → present but needs action
 *   info      → text-white/35  (neutral annotation)
 *
 * Icons are glyph-only (✔  ⚠  ○  ✕  ·), not colored.
 * Green (emerald-*) is reserved exclusively for CTA buttons.
 */

export type TrustStatus = 'confirmed' | 'review' | 'unchecked' | 'blocked' | 'info';

interface TrustLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  status:       TrustStatus;
  label:        string;
  source?:      string;
  timestamp?:   string;
  note?:        string;
  explanation?: string;
}

const STATUS_STYLE: Record<TrustStatus, { glyph: string; text: string; glyph_opacity: string }> = {
  confirmed: { glyph: '✔', text: 'text-white/72', glyph_opacity: 'text-white/35' },
  review:    { glyph: '⚠', text: 'text-white/56', glyph_opacity: 'text-white/30' },
  unchecked: { glyph: '○', text: 'text-white/36', glyph_opacity: 'text-white/20' },
  blocked:   { glyph: '✕', text: 'text-white/45', glyph_opacity: 'text-white/24' },
  info:      { glyph: '·', text: 'text-white/35', glyph_opacity: 'text-white/20' },
};

export function TrustLabel({ status, label, source, timestamp, note, explanation, className, ...props }: TrustLabelProps) {
  const { glyph, text, glyph_opacity } = STATUS_STYLE[status];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3',
        className,
      )}
      {...props}
    >
      <span className={cn('shrink-0 w-4 text-center text-xs font-mono mt-0.5 select-none', glyph_opacity)} aria-hidden>
        {glyph}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn('font-medium text-[13px]', text)}>{label}</span>
          {source && (
            <span className="text-white/32 text-[11px]">Source: {source}</span>
          )}
          {timestamp && (
            <span className="text-white/22 text-[11px]">{timestamp}</span>
          )}
        </div>
        {note && (
          <p className="text-white/22 text-[11px] mt-1 leading-relaxed">{note}</p>
        )}
        {explanation && (
          <p className="text-white/30 text-xs mt-1 leading-relaxed">{explanation}</p>
        )}
      </div>
    </div>
  );
}
