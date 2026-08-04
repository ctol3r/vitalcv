// VitalCV Wave 1500 · TrustGlyph set (DG-4.2)
// 9 coverage states + T1–T4 proof tiers + p0/contradicted.
// Monochrome, currentColor only, readable at 14px, stroke 1.5.
const G = ({ children, size = 14, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
       aria-hidden="true" {...rest}>{children}</svg>
);

const TRUST_GLYPHS = {
  // checked = solid check
  checked: (s) => <G size={s}><path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" /></G>,
  // stale = clock
  stale: (s) => <G size={s}><circle cx="7" cy="7" r="5.25" /><path d="M7 4.2 V7 L9 8.6" /></G>,
  // pending = dashed circle
  pending: (s) => <G size={s}><circle cx="7" cy="7" r="5.25" strokeDasharray="2.4 2.2" /></G>,
  // gated = lock
  gated: (s) => <G size={s}><rect x="3" y="6.2" width="8" height="5.6" rx="1" /><path d="M4.8 6.2 V4.6 a2.2 2.2 0 0 1 4.4 0 V6.2" /></G>,
  // unavailable = slash
  unavailable: (s) => <G size={s}><circle cx="7" cy="7" r="5.25" /><path d="M3.3 10.7 L10.7 3.3" /></G>,
  // accessRequired = key
  accessRequired: (s) => <G size={s}><circle cx="4.6" cy="9.4" r="2.6" /><path d="M6.6 7.4 L11.5 2.5 M9.4 4.6 L11.2 6.4" /></G>,
  // reviewRequired = eye
  reviewRequired: (s) => <G size={s}><path d="M1.8 7 C3.2 4.4 5 3.2 7 3.2 C9 3.2 10.8 4.4 12.2 7 C10.8 9.6 9 10.8 7 10.8 C5 10.8 3.2 9.6 1.8 7 Z" /><circle cx="7" cy="7" r="1.6" /></G>,
  // notDecisionGrade = asterisk
  notDecisionGrade: (s) => <G size={s}><path d="M7 2.2 V11.8 M2.9 4.6 L11.1 9.4 M11.1 4.6 L2.9 9.4" /></G>,
  // previewOnly = ghost outline (dashed rounded frame)
  previewOnly: (s) => <G size={s}><rect x="2.2" y="2.2" width="9.6" height="9.6" rx="2" strokeDasharray="2.6 2.2" /></G>,
  // p0 blocker = solid triangle-bang
  p0: (s) => <G size={s}><path d="M7 2 L12.6 11.6 H1.4 Z" /><path d="M7 6 V8.4 M7 10.1 V10.2" /></G>,
  // contradicted = diverging arrows
  contradicted: (s) => <G size={s}><path d="M5.6 7 H1.8 M1.8 7 L3.6 5.2 M1.8 7 L3.6 8.8 M8.4 7 H12.2 M12.2 7 L10.4 5.2 M12.2 7 L10.4 8.8" /></G>,
};

// Proof tiers T1–T4 (filled fraction of a square — legible grayscale)
const TIER_GLYPHS = {
  T1: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" /><rect x="2" y="9.5" width="10" height="2.5" fill="currentColor" stroke="none" /></G>,
  T2: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" /><rect x="2" y="7" width="10" height="5" fill="currentColor" stroke="none" /></G>,
  T3: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" /><rect x="2" y="4.5" width="10" height="7.5" fill="currentColor" stroke="none" /></G>,
  T4: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" fill="currentColor" /></G>,
};

const TrustGlyph = ({ state, size = 14 }) => {
  const fn = TRUST_GLYPHS[state] || TIER_GLYPHS[state];
  return fn ? fn(size) : null;
};

Object.assign(window, { TrustGlyph, TRUST_GLYPHS, TIER_GLYPHS });
