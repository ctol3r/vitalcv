// VitalCV Wave 1500 · Core primitives (DG-6.1–6.6, 6.7 subset, 6.8, 17.2)
// Every component consumes ONLY --vt-* semantic tokens.

/* ---------- STATE METADATA (DG-3.2 single table) ---------- */
const STATE_META = {
  checked:          { label: 'Checked',            tone: 'checked',      def: 'Source-backed and within freshness threshold.' },
  stale:            { label: 'Stale',              tone: 'stale',        def: 'Previously checked; past freshness threshold. Refresh available.' },
  pending:          { label: 'Pending',            tone: 'pending',      def: 'Check in flight. Result not yet available.' },
  gated:            { label: 'Gated',              tone: 'gated',        def: 'Source requires enrollment or agreement before access.' },
  unavailable:      { label: 'Unavailable',        tone: 'unavailable',  def: 'Source not reachable or out of scope.' },
  accessRequired:   { label: 'Access required',    tone: 'access',       def: 'Holder must grant access before this source is read.' },
  reviewRequired:   { label: 'Review required',    tone: 'review',       def: 'Human review needed before decision-grade.' },
  notDecisionGrade: { label: 'Not decision-grade', tone: 'ndg',          def: 'Informational only. Not for credentialing decisions.' },
  previewOnly:      { label: 'Preview only',       tone: 'preview',      def: 'Anonymous preview plane. Not an owned snapshot.' },
  p0:               { label: 'Blocker',            tone: 'p0',           def: 'Blocks readiness until resolved.' },
  contradicted:     { label: 'Contradicted',       tone: 'contradicted', def: 'Sources disagree. Both values shown side-by-side.' },
};

/* ---------- StateChip (DG-6.1) — THE atomic visual unit ---------- */
const StateChip = ({ state, size = 'md', source, freshness, label }) => {
  const m = STATE_META[state] || STATE_META.pending;
  const t = m.tone;
  const dashed = state === 'previewOnly' || state === 'pending';
  const sm = size === 'sm';
  return (
    <span
      title={`${m.label}${source ? ` · ${source}` : ''}${freshness ? ` · ${freshness}` : ''} — ${m.def}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 6,
        fontFamily: 'var(--font-mono)', fontSize: sm ? 9 : 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
        padding: sm ? '2px 6px' : '3px 8px',
        color: `var(--vt-state-${t})`,
        background: `var(--vt-state-${t}-bg)`,
        border: `1px ${dashed ? 'dashed' : 'solid'} var(--vt-state-${t}-rule)`,
        borderRadius: 'var(--radius-1)',
      }}>
      <TrustGlyph state={state === 'p0' || state === 'contradicted' ? state : state} size={sm ? 11 : 13} />
      {label || m.label}
    </span>
  );
};

/* ---------- ProofTierBadge (DG-6.6) ---------- */
const TIER_DEFS = {
  T1: 'Self-attested. Holder statement, no external source.',
  T2: 'Source-backed. Read from a primary source; freshness tracked.',
  T3: 'Reviewed. Source-backed plus human review.',
  T4: 'Signed institutional artifact. Cryptographically signed record.',
};
const ProofTierBadge = ({ tier }) => (
  <span title={`${tier} — ${TIER_DEFS[tier]}`}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 8px',
      color: 'var(--vt-text)', border: '1px solid var(--vt-rule-strong)', borderRadius: 'var(--radius-1)' }}>
    <TrustGlyph state={tier} size={12} />{tier}
  </span>
);

/* ---------- FreshnessStamp (DG-6.8) ---------- */
const FreshnessStamp = ({ rel, iso, stale }) => (
  <time className="vt-num" dateTime={iso} title={iso}
    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
      color: stale ? 'var(--vt-state-stale)' : 'var(--vt-text-muted)' }}>
    {rel}
  </time>
);

/* ---------- HonestyLabel (DG-17.2) — first-class UI, not fine print ---------- */
const HonestyLabel = ({ children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
    color: 'var(--vt-text-secondary)', borderBottom: '1px solid var(--vt-degraded-border)',
    paddingBottom: 3 }}>
    <span style={{ width: 6, height: 6, border: '1px solid var(--vt-degraded-border)', borderRadius: '50%', flexShrink: 0 }}></span>
    {children}
  </span>
);

/* ---------- SourceRow (DG-6.4) ---------- */
const SourceRow = ({ label, source, state, freshness, iso, action, chipLabel }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center',
    gap: 12, padding: '10px 0', borderBottom: '1px solid var(--vt-rule-soft)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vt-text)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--vt-text-muted)' }}>{source}</span>
        {freshness ? <FreshnessStamp rel={freshness} iso={iso} stale={state === 'stale'} /> : null}
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <StateChip state={state} size="sm" source={source} freshness={freshness} label={chipLabel} />
      {action ? <QuietButton small>{action}</QuietButton> : null}
    </div>
  </div>
);

/* ---------- ReadinessRing (DG-6.5) ---------- */
const ReadinessRing = ({ value = 72, size = 96, label = 'Readiness' }) => {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const band = value >= 80 ? 'var(--vt-state-checked)' : value >= 50 ? 'var(--vt-brand)' : 'var(--vt-state-stale)';
  return (
    <div role="meter" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100"
      aria-label={`${label}: ${value} percent`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--vt-rule-soft)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={band} strokeWidth="5"
          strokeLinecap="butt" strokeDasharray={`${c * value / 100} ${c}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dasharray var(--dur-slow) var(--ease-house)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="vt-num" style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.26, fontWeight: 560, lineHeight: 1 }}>{value}<span style={{ fontSize: size * 0.14 }}>%</span></div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--vt-text-muted)', marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Buttons (DG-6.3) ---------- */
const btnBase = (sz) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer',
  fontSize: sz === 'sm' ? 12 : sz === 'lg' ? 15 : 13.5,
  padding: sz === 'sm' ? '6px 14px' : sz === 'lg' ? '13px 26px' : '9px 20px',
  borderRadius: 'var(--radius-1)', border: '1px solid transparent',
  transition: 'background var(--dur-fast) var(--ease-house), border-color var(--dur-fast) var(--ease-house), color var(--dur-fast) var(--ease-house)',
});
const PrimaryButton = ({ children, size, disabled, loading, ...rest }) => (
  <button disabled={disabled || loading} {...rest}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--vt-brand-strong)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? 'var(--vt-rule)' : 'var(--ink-900)'; }}
    style={{ ...btnBase(size), background: disabled ? 'var(--vt-rule)' : 'var(--ink-900)',
      color: disabled ? 'var(--vt-text-muted)' : 'var(--vt-text-inverse)',
      cursor: disabled ? 'not-allowed' : 'pointer' }}>
    {loading ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>···</span> : null}{children}
  </button>
);
const SecondaryButton = ({ children, size, ...rest }) => (
  <button {...rest}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vt-surface-card)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    style={{ ...btnBase(size), background: 'transparent', color: 'var(--vt-text)', borderColor: 'var(--vt-rule-strong)' }}>
    {children}
  </button>
);
const QuietButton = ({ children, small, ...rest }) => (
  <button {...rest}
    onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'var(--vt-brand)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: small ? '2px 4px' : '6px 8px',
      fontFamily: 'var(--font-body)', fontSize: small ? 11.5 : 13, fontWeight: 500, color: 'var(--vt-text)',
      textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3,
      transition: 'text-decoration-color var(--dur-fast) var(--ease-house)' }}>
    {children}
  </button>
);
const DestructiveButton = ({ children, size, ...rest }) => (
  <button {...rest} style={{ ...btnBase(size), background: 'transparent',
    color: 'var(--vt-state-p0)', borderColor: 'var(--vt-state-p0-rule)' }}>
    {children}
  </button>
);

/* ---------- PaperCard (DG-6.2) ---------- */
const PaperCard = ({ children, lift, style: st, ...rest }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <div {...rest}
      onMouseEnter={() => lift && setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'var(--vt-surface-card)', border: '1px solid var(--vt-rule)',
        borderRadius: 'var(--radius-2)', padding: 'var(--space-5)',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? 'var(--vt-lift)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-house), box-shadow var(--dur-fast) var(--ease-house)',
        ...st }}>
      {children}
    </div>
  );
};

/* ---------- NPI segmented input (DG-6.7 / DG-7.2) ---------- */
const NpiInput = ({ value, onChange }) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--vt-surface-card)',
      border: '1px solid var(--vt-rule-strong)', borderRadius: 'var(--radius-2)', padding: '4px 6px 4px 16px' }}>
      <input
        value={digits} inputMode="numeric" pattern="[0-9]*" placeholder="Enter your NPI"
        aria-label="National Provider Identifier, 10 digits"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: 16, letterSpacing: '0.18em',
          color: 'var(--vt-text)', padding: '10px 0' }} />
      <span className="vt-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
        color: digits.length === 10 ? 'var(--vt-state-checked)' : 'var(--vt-text-muted)', flexShrink: 0 }}
        aria-live="polite">{digits.length}/10</span>
      <PrimaryButton disabled={digits.length !== 10}>Check readiness</PrimaryButton>
    </div>
  );
};

Object.assign(window, {
  STATE_META, TIER_DEFS, StateChip, ProofTierBadge, FreshnessStamp, HonestyLabel,
  SourceRow, ReadinessRing, PrimaryButton, SecondaryButton, QuietButton,
  DestructiveButton, PaperCard, NpiInput,
});
