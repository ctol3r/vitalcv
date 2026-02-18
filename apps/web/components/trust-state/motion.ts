// ─────────────────────────────────────────────────────────────
// Motion constants for Trust-State UI
// 280–420ms · cubic-bezier(0.2, 0.8, 0.2, 1) · No spring · No parallax
// ─────────────────────────────────────────────────────────────

export const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
export const DURATION_MS = { enter: 320, exit: 280 };

/** Tailwind-compatible transition class for panel reveal */
export const PANEL_TRANSITION =
  'transition-all duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]';

/** Stagger delay per panel index (ms) */
export const STAGGER_MS = 60;
