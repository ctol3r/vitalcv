// ─────────────────────────────────────────────────────────────
// Motion constants for Trust-State UI
// 280–420ms · cubic-bezier(0.2, 0.8, 0.2, 1) · No spring · No parallax
// ─────────────────────────────────────────────────────────────

export const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
export const DURATION_FAST = 280;
export const DURATION_ENTER = 320;
export const TRANSITION =
  `transition-[transform,opacity] duration-[${DURATION_ENTER}ms] ease-[${EASING}]`;

/** Tailwind-compatible transition class for panel reveal */
export const PANEL_TRANSITION = `transition-[transform,opacity] duration-[${DURATION_ENTER}ms] ease-[${EASING}]`;

/** Stagger delay per panel index (ms) */
export const STAGGER_MS = 60;
