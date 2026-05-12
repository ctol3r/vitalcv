'use client';

/**
 * VerifierQuickReadRail — 4px left-edge color bar for instant state orientation.
 *
 * Visual grammar:
 *   Solid border  = clean / degraded / unsigned (internal states)
 *   Dashed border = anonymous / issuer_gap (unbound / external)
 *
 * Desktop: narrow 4px left rail with rotated Bloomberg-style label
 * Mobile:  full-width colored top strip with horizontal label
 */

export interface QuickReadRailProps {
  /** The primary state signal */
  state: 'clean' | 'degraded' | 'unsigned' | 'anonymous' | 'issuer_gap';
  /** Compact mode: only the color bar, no labels */
  compact?: boolean;
}

interface RailConfig {
  colorClass: string;   // border color
  label: string;
  labelColor: string;
  dashed: boolean;
}

const RAIL_CONFIG: Record<QuickReadRailProps['state'], RailConfig> = {
  clean: {
    colorClass: 'border-green-500',
    label: 'CLEAN',
    labelColor: 'text-green-700',
    dashed: false,
  },
  degraded: {
    colorClass: 'border-amber-400',
    label: 'DEGRADED',
    labelColor: 'text-amber-700',
    dashed: false,
  },
  unsigned: {
    colorClass: 'border-blue-400',
    label: 'UNSIGNED',
    labelColor: 'text-blue-700',
    dashed: false,
  },
  anonymous: {
    colorClass: 'border-gray-300',
    label: 'ANONYMOUS',
    labelColor: 'text-gray-500',
    dashed: true,
  },
  issuer_gap: {
    colorClass: 'border-red-400',
    label: 'ISSUER GAP',
    labelColor: 'text-red-700',
    dashed: true,
  },
};

export function VerifierQuickReadRail({
  state,
  compact = false,
}: QuickReadRailProps) {
  const cfg = RAIL_CONFIG[state];
  const borderEdgeClass = cfg.dashed
    ? `border-l-2 border-dashed ${cfg.colorClass}`
    : `border-l-4 ${cfg.colorClass}`;

  if (compact) {
    // Color bar only — no label
    return (
      <div
        className={`w-1 self-stretch ${borderEdgeClass}`}
        aria-label={`State: ${cfg.label}`}
        role="img"
      />
    );
  }

  return (
    <>
      {/* Mobile: full-width top strip */}
      <div
        className={[
          'flex items-center gap-2 px-3 py-1.5 md:hidden',
          cfg.dashed
            ? `border-b-2 border-dashed ${cfg.colorClass}`
            : `border-b-4 ${cfg.colorClass}`,
        ].join(' ')}
        aria-label={`State: ${cfg.label}`}
      >
        <span
          className={`text-[9px] font-mono uppercase tracking-[0.12em] ${cfg.labelColor}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Desktop: narrow left rail with rotated label (Bloomberg column header style) */}
      <div
        className={[
          'hidden md:flex flex-col items-center w-8 self-stretch flex-shrink-0',
          borderEdgeClass,
        ].join(' ')}
        aria-label={`State: ${cfg.label}`}
        role="img"
      >
        <span
          className={`text-[9px] font-mono uppercase tracking-[0.12em] mt-3 select-none ${cfg.labelColor}`}
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {cfg.label}
        </span>
      </div>
    </>
  );
}
