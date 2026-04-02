import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import {
  getPublicWedgeSurfaceBadgeMeta,
  type PublicWedgeSurfaceState,
} from '@/lib/trust/public-wedge-parity';

/**
 * TrustLabel — source-backed row for trust surfaces.
 *
 * Doctrine: no color on status. All hierarchy via opacity only.
 *   checked        → high opacity
 *   review/stale   → medium opacity
 *   pending/missing → low opacity
 *   blocked        → explicit hard stop
 *   preview only   → neutral annotation
 *
 * Icons are glyph-only (✔  ⚠  ○  ✕  ·), not colored.
 * Green (emerald-*) is reserved exclusively for CTA buttons.
 */

export type TrustStatus = PublicWedgeSurfaceState | 'blocked';

interface TrustLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  status:       TrustStatus;
  label:        string;
  source?:      string;
  timestamp?:   string;
  note?:        string;
  explanation?: string;
}

const STATUS_STYLE: Record<TrustStatus, { glyph: string; text: string; glyph_opacity: string }> = {
  checked: { glyph: '✔', text: 'text-white/72', glyph_opacity: 'text-muted-foreground' },
  pending: { glyph: '○', text: 'text-white/36', glyph_opacity: 'text-muted-foreground/40' },
  stale: { glyph: '⚠', text: 'text-white/56', glyph_opacity: 'text-muted-foreground/60' },
  access_required: { glyph: '○', text: 'text-muted-foreground', glyph_opacity: 'text-white/22' },
  unavailable: { glyph: '○', text: 'text-white/36', glyph_opacity: 'text-muted-foreground/40' },
  review_required: { glyph: '⚠', text: 'text-white/56', glyph_opacity: 'text-muted-foreground/60' },
  preview_only: { glyph: '·', text: 'text-muted-foreground', glyph_opacity: 'text-muted-foreground/40' },
  blocked: { glyph: '✕', text: 'text-foreground', glyph_opacity: 'text-white/24' },
};

function resolveBadgeMeta(
  status: TrustStatus,
): { badgeStatus: TrustBadgeStatus; badgeLabel: string } {
  if (status === 'blocked') {
    return { badgeStatus: 'blocked', badgeLabel: 'Blocked' };
  }

  const meta = getPublicWedgeSurfaceBadgeMeta(status);
  return {
    badgeStatus: meta.status,
    badgeLabel: meta.label,
  };
}

export function TrustLabel({ status, label, source, timestamp, note, explanation, className, ...props }: TrustLabelProps) {
  const { glyph, text, glyph_opacity } = STATUS_STYLE[status];
  const { badgeStatus, badgeLabel } = resolveBadgeMeta(status);

  return (
    <Card
      className={cn(
        'gap-0 rounded-xl border-white/8 bg-white/[0.03] py-0 shadow-none',
        className,
      )}
      {...props}
    >
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <span className={cn('mt-0.5 w-4 shrink-0 text-center text-xs font-mono select-none', glyph_opacity)} aria-hidden>
          {glyph}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={cn('text-sm font-medium', text)}>{label}</span>
                {source && (
                  <span className="text-[11px] text-white/32">Source: {source}</span>
                )}
                {timestamp && (
                  <span className="text-[11px] text-white/22">{timestamp}</span>
                )}
              </div>
              {note && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/28">{note}</p>
              )}
              {explanation && (
                <p className="mt-1 text-xs leading-relaxed text-white/38">{explanation}</p>
              )}
            </div>
            <TrustStatusBadge
              status={badgeStatus}
              label={badgeLabel}
              size="sm"
              className="shrink-0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
