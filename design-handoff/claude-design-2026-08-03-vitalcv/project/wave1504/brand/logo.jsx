// VitalCV · brand/logo.jsx — THE wordmark lockup (DG-4.3).
// Fraunces-based fixed component. No other renderings of the name are
// permitted anywhere on vitalcv.com surfaces.
// Variants: ink (ink-on-paper, default) · inverse (paper-on-ink).
// Rules (documented on #/brand): clear space = 1× cap height on all
// sides; minimum lockup width 84px; minimum mark-only size 16px.

const VtMark = ({ size = 22, inverse = false }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect x="0" y="0" width="32" height="32"
      fill={inverse ? 'var(--ink-900)' : 'var(--paper-100)'} />
    <rect x="0.5" y="0.5" width="31" height="31" fill="none"
      stroke={inverse ? 'var(--ink-700)' : 'var(--ink-200)'} strokeWidth="1" />
    <path d="M8 8 L16 25 L24 8" fill="none"
      stroke={inverse ? 'var(--paper-50)' : 'var(--ink-900)'}
      strokeWidth="3.4" strokeLinecap="butt" strokeLinejoin="miter" />
  </svg>
);

const VtLogo = ({ size = 19, variant = 'ink', mark = true, sub }) => {
  const inverse = variant === 'inverse';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.5), whiteSpace: 'nowrap' }}>
      {mark ? <VtMark size={Math.round(size * 1.18)} inverse={inverse} /> : null}
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: size,
        letterSpacing: '-0.01em', lineHeight: 1,
        color: inverse ? 'var(--paper-50)' : 'var(--ink-900)' }}>
        VitalCV
      </span>
      {sub ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: Math.max(8, Math.round(size * 0.47)),
          letterSpacing: '0.14em', textTransform: 'uppercase', alignSelf: 'flex-end',
          color: inverse ? 'var(--ink-300)' : 'var(--ink-500)', paddingBottom: 1 }}>
          {sub}
        </span>
      ) : null}
    </span>
  );
};

Object.assign(window, { VtLogo, VtMark });
