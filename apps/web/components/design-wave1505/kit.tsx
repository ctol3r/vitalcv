'use client';

/**
 * Wave 1505 port — shared component kit.
 *
 * Faithful port of the prototype primitives this wave consumes, from the
 * design handoff at design-handoff/claude-design-2026-07-12-wave1505/:
 *   - wave1500/w15-glyphs.jsx + w15-primitives.jsx (TrustGlyph, StateChip,
 *     buttons, ring, HonestyLabel, SourceRow, NpiInput)
 *   - wave1502/w1502-shared.jsx (form kit, validators, ErrorSummary,
 *     SuccessCard, HonestyPanel)
 *   - wave1503/w1503-shared.jsx (RecognitionRow)
 *   - wave1504/w1504-shared.jsx (CopyBtn, TokenRow)
 *   - wave1504/brand/logo.jsx (VtMark, VtLogo)
 *
 * The prototype published these on `window`; here they are module exports.
 * Inline styles consume only the --vt- / --font- / --space- tokens defined
 * by the scoped .w1505 stylesheet.
 */

import * as React from 'react';

/* ---------- TrustGlyph set (DG-4.2) ---------- */
const G = ({ children, size = 14, ...rest }: { children: React.ReactNode; size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...rest}>{children}</svg>
);

const TRUST_GLYPHS: Record<string, (s: number) => React.ReactElement> = {
  checked: (s) => <G size={s}><path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" /></G>,
  stale: (s) => <G size={s}><circle cx="7" cy="7" r="5.25" /><path d="M7 4.2 V7 L9 8.6" /></G>,
  pending: (s) => <G size={s}><circle cx="7" cy="7" r="5.25" strokeDasharray="2.4 2.2" /></G>,
  gated: (s) => <G size={s}><rect x="3" y="6.2" width="8" height="5.6" rx="1" /><path d="M4.8 6.2 V4.6 a2.2 2.2 0 0 1 4.4 0 V6.2" /></G>,
  unavailable: (s) => <G size={s}><circle cx="7" cy="7" r="5.25" /><path d="M3.3 10.7 L10.7 3.3" /></G>,
  accessRequired: (s) => <G size={s}><circle cx="4.6" cy="9.4" r="2.6" /><path d="M6.6 7.4 L11.5 2.5 M9.4 4.6 L11.2 6.4" /></G>,
  reviewRequired: (s) => <G size={s}><path d="M1.8 7 C3.2 4.4 5 3.2 7 3.2 C9 3.2 10.8 4.4 12.2 7 C10.8 9.6 9 10.8 7 10.8 C5 10.8 3.2 9.6 1.8 7 Z" /><circle cx="7" cy="7" r="1.6" /></G>,
  notDecisionGrade: (s) => <G size={s}><path d="M7 2.2 V11.8 M2.9 4.6 L11.1 9.4 M11.1 4.6 L2.9 9.4" /></G>,
  previewOnly: (s) => <G size={s}><rect x="2.2" y="2.2" width="9.6" height="9.6" rx="2" strokeDasharray="2.6 2.2" /></G>,
  p0: (s) => <G size={s}><path d="M7 2 L12.6 11.6 H1.4 Z" /><path d="M7 6 V8.4 M7 10.1 V10.2" /></G>,
  contradicted: (s) => <G size={s}><path d="M5.6 7 H1.8 M1.8 7 L3.6 5.2 M1.8 7 L3.6 8.8 M8.4 7 H12.2 M12.2 7 L10.4 5.2 M12.2 7 L10.4 8.8" /></G>,
};

const TIER_GLYPHS: Record<string, (s: number) => React.ReactElement> = {
  T1: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" /><rect x="2" y="9.5" width="10" height="2.5" fill="currentColor" stroke="none" /></G>,
  T2: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" /><rect x="2" y="7" width="10" height="5" fill="currentColor" stroke="none" /></G>,
  T3: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" /><rect x="2" y="4.5" width="10" height="7.5" fill="currentColor" stroke="none" /></G>,
  T4: (s) => <G size={s}><rect x="2" y="2" width="10" height="10" fill="currentColor" /></G>,
};

export const TrustGlyph = ({ state, size = 14 }: { state: string; size?: number }) => {
  const fn = TRUST_GLYPHS[state] || TIER_GLYPHS[state];
  return fn ? fn(size) : null;
};

/* ---------- state metadata (DG-3.2 single table) ---------- */
export const STATE_META: Record<string, { label: string; tone: string; def: string }> = {
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
export const StateChip = ({ state, size = 'md', source, freshness, label }: {
  state: string; size?: 'sm' | 'md'; source?: string; freshness?: string; label?: string;
}) => {
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
      <TrustGlyph state={state} size={sm ? 11 : 13} />
      {label || m.label}
    </span>
  );
};

/* ---------- ProofTierBadge (DG-6.6) ---------- */
export const TIER_DEFS: Record<string, string> = {
  T1: 'Self-attested. Holder statement, no external source.',
  T2: 'Source-backed. Read from a primary source; freshness tracked.',
  T3: 'Reviewed. Source-backed plus human review.',
  T4: 'Signed institutional artifact. Cryptographically signed record.',
};
export const ProofTierBadge = ({ tier }: { tier: string }) => (
  <span title={`${tier} — ${TIER_DEFS[tier]}`}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 8px',
      color: 'var(--vt-text)', border: '1px solid var(--vt-rule-strong)', borderRadius: 'var(--radius-1)' }}>
    <TrustGlyph state={tier} size={12} />{tier}
  </span>
);

/* ---------- FreshnessStamp (DG-6.8) ---------- */
export const FreshnessStamp = ({ rel, iso, stale }: { rel: string; iso?: string; stale?: boolean }) => (
  <time className="vt-num" dateTime={iso} title={iso}
    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
      color: stale ? 'var(--vt-state-stale)' : 'var(--vt-text-muted)' }}>
    {rel}
  </time>
);

/* ---------- HonestyLabel (DG-17.2) — first-class UI, not fine print ---------- */
export const HonestyLabel = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
    color: 'var(--vt-text-secondary)', borderBottom: '1px solid var(--vt-degraded-border)',
    paddingBottom: 3 }}>
    <span style={{ width: 6, height: 6, border: '1px solid var(--vt-degraded-border)', borderRadius: '50%', flexShrink: 0 }}></span>
    {children}
  </span>
);

/* ---------- SourceRow (DG-6.4) ---------- */
export const SourceRow = ({ label, source, state, freshness, iso, action, chipLabel }: {
  label: string; source: string; state: string; freshness?: string; iso?: string; action?: string; chipLabel?: string;
}) => (
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
export const ReadinessRing = ({ value = 72, size = 96, label = 'Readiness' }: { value?: number; size?: number; label?: string }) => {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const band = value >= 80 ? 'var(--vt-state-checked)' : value >= 50 ? 'var(--vt-brand)' : 'var(--vt-state-stale)';
  return (
    <div role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
      aria-label={`${label}: ${value} percent`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--vt-rule-soft)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={band} strokeWidth="5"
          strokeLinecap="butt" strokeDasharray={`${c * value / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
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
type BtnSize = 'sm' | 'md' | 'lg' | undefined;
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: BtnSize; loading?: boolean };

const btnBase = (sz: BtnSize): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer',
  fontSize: sz === 'sm' ? 12 : sz === 'lg' ? 15 : 13.5,
  padding: sz === 'sm' ? '6px 14px' : sz === 'lg' ? '13px 26px' : '9px 20px',
  borderRadius: 'var(--radius-1)', border: '1px solid transparent',
  transition: 'background var(--dur-fast) var(--ease-house), border-color var(--dur-fast) var(--ease-house), color var(--dur-fast) var(--ease-house)',
});

export const PrimaryButton = ({ children, size, disabled, loading, ...rest }: BtnProps) => (
  <button disabled={disabled || loading} {...rest}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--vt-brand-strong)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? 'var(--vt-rule)' : 'var(--ink-900)'; }}
    style={{ ...btnBase(size), background: disabled ? 'var(--vt-rule)' : 'var(--ink-900)',
      color: disabled ? 'var(--vt-text-muted)' : 'var(--vt-text-inverse)',
      cursor: disabled ? 'not-allowed' : 'pointer' }}>
    {loading ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>···</span> : null}{children}
  </button>
);

export const SecondaryButton = ({ children, size, ...rest }: BtnProps) => (
  <button {...rest}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vt-surface-card)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    style={{ ...btnBase(size), background: 'transparent', color: 'var(--vt-text)', borderColor: 'var(--vt-rule-strong)' }}>
    {children}
  </button>
);

export const QuietButton = ({ children, small, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean }) => (
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

export const DestructiveButton = ({ children, size, ...rest }: BtnProps) => (
  <button {...rest} style={{ ...btnBase(size), background: 'transparent',
    color: 'var(--vt-state-p0)', borderColor: 'var(--vt-state-p0-rule)' }}>
    {children}
  </button>
);

/* ---------- NPI segmented input (DG-6.7 / DG-7.2) ---------- */
export const NpiInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
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

/* ---------- form kit (wave1502) ---------- */
export const Field = ({ id, label, required, hint, error, children }: {
  id: string; label: string; required?: boolean; hint?: string; error?: string | null; children: React.ReactNode;
}) => (
  <div className="fk-field">
    <label className="fk-label" htmlFor={id}>
      {label}{required ? <span className="fk-req" aria-hidden="true">*</span> : null}
    </label>
    {children}
    {hint && !error ? <p className="fk-hint">{hint}</p> : null}
    {error ? (
      <p className="fk-err" id={`${id}-err`}>
        <TrustGlyph state="p0" size={11} />
        <span>{error}</span>
      </p>
    ) : null}
  </div>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { error?: string | null };
export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(function TextInput({ id, error, ...rest }, ref) {
  return (
    <input ref={ref} id={id} className={`fk-input${error ? ' err' : ''}`}
      aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
  );
});

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string | null };
export const TextArea = React.forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea({ id, error, rows = 4, ...rest }, ref) {
  return (
    <textarea ref={ref} id={id} rows={rows} className={`fk-input${error ? ' err' : ''}`}
      aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
  );
});

const FREEMAIL = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'proton.me', 'protonmail.com'];
export const validateWorkEmail = (v: string): string | null => {
  const t = (v || '').trim();
  if (!t) return 'Work email is required.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(t)) return 'Enter a valid email — e.g. name@organization.org.';
  const dom = t.split('@')[1].toLowerCase();
  if (FREEMAIL.includes(dom)) return 'Use your work address — pilot scope is tied to your organization’s domain.';
  return null;
};
export const validateRequired = (v: string, label: string): string | null =>
  ((v || '').trim() ? null : `${label} is required.`);

/* Error summary — designed failure state, role=alert, links focus fields */
export const ErrorSummary = ({ errors, order, labels, refs }: {
  errors: Record<string, string | null | undefined>;
  order: string[];
  labels: Record<string, string>;
  refs: Record<string, React.RefObject<HTMLElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>;
}) => {
  const keys = order.filter((k) => errors[k]);
  if (!keys.length) return null;
  return (
    <div className="fk-summary" role="alert">
      <span className="t"><TrustGlyph state="p0" size={12} /> {keys.length} field{keys.length > 1 ? 's' : ''} need{keys.length > 1 ? '' : 's'} attention</span>
      <ul>
        {keys.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => { const el = refs[k] && refs[k].current; if (el) (el as HTMLElement).focus(); }}>
              {labels[k]} — {errors[k]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* Success card — designed success state */
export const SuccessCard = ({ title, receipt, children, onReset, resetLabel }: {
  title: string; receipt: string; children?: React.ReactNode; onReset?: () => void; resetLabel?: string;
}) => (
  <div className="fk-success" role="status">
    <StateChip state="checked" label="Recorded" />
    <h3>{title}</h3>
    <span className="receipt vt-num">{receipt}</span>
    {children}
    {onReset ? <QuietButton onClick={onReset}>{resetLabel || 'Submit another request'}</QuietButton> : null}
  </div>
);

/* ---------- HonestyPanel (DG-8.4) — signature side-by-side pair ---------- */
export const HonestyPanel = ({ tone, title, items, foot }: {
  tone: 'ok' | 'watch';
  title: string;
  items: Array<{ label: string; source: string; state: string; chipLabel?: string; note?: string }>;
  foot?: string;
}) => (
  <section className={`hn-panel ${tone}`} aria-label={title}>
    <header className="hn-panel-head">
      <TrustGlyph state={tone === 'ok' ? 'checked' : 'stale'} size={14} />
      <span className="t">{title}</span>
      <span className="n vt-num">{items.length} lanes</span>
    </header>
    <ul className="hn-items">
      {items.map((it) => (
        <li className="hn-item" key={it.label}>
          <div>
            <span className="lab">{it.label}</span>
            <span className="src">{it.source}</span>
            {it.note ? <p className="note">{it.note}</p> : null}
          </div>
          <StateChip state={it.state} size="sm" label={it.chipLabel} />
        </li>
      ))}
    </ul>
    {foot ? <div className="hn-panel-foot"><HonestyLabel>{foot}</HonestyLabel></div> : null}
  </section>
);

/* ---------- RecognitionRow (DG-10.5) — the one reserved matcha moment ---------- */
export const RecognitionRow = ({ employer, iso, packet, n, entered }: {
  employer: string; iso: string; packet: string; n: string; entered?: boolean;
}) => (
  <div className={`rec-row${entered ? ' s3-enter' : ''}`}>
    <span className="rec-seal" aria-hidden="true"><TrustGlyph state="checked" size={15} /></span>
    <div className="rec-body">
      <span className="rec-emp">{employer}</span>
      <span className="rec-line">Accepted as head start — committee review continued on their side.</span>
      <span className="rec-meta vt-num">{iso} · packet {packet}</span>
    </div>
    <span className="rec-stamp" aria-hidden="true">Recognition Nº {n}</span>
  </div>
);

/* ---------- copy affordance (wave1504) ---------- */
const copyFallback = (text: string) => {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch { /* noop */ }
  document.body.removeChild(ta);
};
export const copyText = (text: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
};

export const CopyBtn = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [copied, setCopied] = React.useState(false);
  const tRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(tRef.current), []);
  return (
    <button type="button" className={`cp-btn${copied ? ' copied' : ''}`}
      aria-label={`Copy ${text}`} aria-live="polite"
      onClick={() => copyText(text).then(() => {
        setCopied(true);
        clearTimeout(tRef.current);
        tRef.current = setTimeout(() => setCopied(false), 1600);
      })}>
      {copied ? 'Copied ✓' : label}
    </button>
  );
};

/* ---------- mono token row (key · value · copy) ---------- */
export const TokenRow = ({ k, value, display, href, children }: {
  k: string; value: string; display?: string; href?: string; children?: React.ReactNode;
}) => (
  <div className="tok-row">
    <span className="tok-key">{k}</span>
    <span className="tok-val vt-num">
      {href ? <a href={href} onClick={(e) => e.preventDefault()} title="Live endpoint — stubbed in prototype">{display || value}</a> : (display || value)}
      {children}
    </span>
    <CopyBtn text={value} />
  </div>
);

/* ---------- brand lockup (wave1504/brand/logo.jsx — DG-4.3) ---------- */
export const VtMark = ({ size = 22, inverse = false }: { size?: number; inverse?: boolean }) => (
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

export const VtLogo = ({ size = 19, variant = 'ink', mark = true, sub }: {
  size?: number; variant?: 'ink' | 'inverse'; mark?: boolean; sub?: string;
}) => {
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
