import * as React from 'react';

import { RECORD_EDGE, RECORD_RADIUS } from './anatomy';

/**
 * ConsentGate — the boundary nothing crosses without the clinician (ILL-04).
 *
 * Ported from the founder's ILL prototype, where it is the element that makes
 * consent a *place* rather than a caption. That is worth keeping: the scene's
 * hardest idea is that movement is gated, and a gate you can see is a stronger
 * argument than a sentence saying so.
 *
 * Material: frost. EC-20 as amended A-1 permits `--vt-frost-*` on chrome and
 * scene overlays and bars it from evidence surfaces — a gate is scene overlay,
 * and the record on either side of it stays solid paper. Because both frost
 * tokens are `color-mix` over scene surfaces, the gate degrades to a flat panel
 * wherever `backdrop-filter` is unsupported rather than vanishing.
 *
 * `open` is presentation only. It does not represent, and must never be wired
 * to, a real consent decision — consent semantics are inherited product
 * contract and explicitly out of bounds for a design wave (EC-0).
 */
export interface ConsentGateProps {
  /** Illustrative posture only — never a real consent state. */
  open?: boolean;
  className?: string;
}

export function ConsentGate({ open = false, className }: ConsentGateProps) {
  return (
    <div
      data-consent-gate=""
      data-gate-posture={open ? 'open' : 'closed'}
      aria-hidden="true"
      className={`relative w-[13px] shrink-0 self-stretch ${className ?? ''}`}
      style={{
        minHeight: 110,
        background: 'var(--vt-frost-bg)',
        // The frost border alone (12% ink) left the gate all but invisible
        // against the canvas, and the gate is the element carrying the scene's
        // hardest idea. Fill stays frost; the edge takes the structural rule so
        // the boundary is actually legible.
        border: `${RECORD_EDGE.hairlinePx}px solid var(--vt-scene-line-strong)`,
        borderRadius: `${RECORD_RADIUS.evidencePx}px`,
        backdropFilter: 'blur(3px)',
        boxShadow: 'none',
        // The gate parts rather than lights up. Opening is a change in the
        // object, not a change in colour — nothing here means anything by hue.
        opacity: open ? 0.45 : 1,
      }}
    >
      {[30, 70].map((top) => (
        <span
          key={top}
          className="absolute inset-x-[3px] block h-px"
          style={{ top: `${top}%`, background: 'var(--vt-frost-border)' }}
        />
      ))}
    </div>
  );
}
