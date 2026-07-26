'use client';

/**
 * Wave 1500 primitives — verbatim port of the handoff's `w15-glyphs.jsx` and
 * `w15-primitives.jsx` (design-handoff/claude-design-2026-07-12-wave1505/wave1500/).
 *
 * These keep the handoff's INLINE styles rather than being rewritten into
 * classes. That is deliberate: the inline values are the design contract, and
 * keeping them literal makes a future diff against the handoff mechanical
 * instead of a judgement call. The `--vt-*` tokens they read are supplied by
 * `styles/wave1501-home.css`, scoped to `.w1501` — outside that subtree these
 * components would pick up the app's own (different) `--vt-*` values, so they
 * must only ever render inside the island.
 *
 * `--font-display` / `--font-body` / `--font-mono` are intentionally read from
 * the APP (set on <html> by next/font) rather than the handoff's Google Fonts
 * link, so the port uses the self-hosted Fraunces/Geist shipped in #644.
 */

import * as React from 'react';

/* ---------- TrustGlyph (DG-4.2) ---------- */

type GlyphProps = { children: React.ReactNode; size?: number };

const G = ({ children, size = 14 }: GlyphProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export type CoverageState =
  | 'checked'
  | 'stale'
  | 'pending'
  | 'gated'
  | 'unavailable'
  | 'accessRequired'
  | 'reviewRequired'
  | 'notDecisionGrade'
  | 'previewOnly'
  | 'p0'
  | 'contradicted';

const TRUST_GLYPHS: Record<CoverageState, (s: number) => React.ReactElement> = {
  checked: (s) => (
    <G size={s}>
      <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" />
    </G>
  ),
  stale: (s) => (
    <G size={s}>
      <circle cx="7" cy="7" r="5.25" />
      <path d="M7 4.2 V7 L9 8.6" />
    </G>
  ),
  pending: (s) => (
    <G size={s}>
      <circle cx="7" cy="7" r="5.25" strokeDasharray="2.4 2.2" />
    </G>
  ),
  gated: (s) => (
    <G size={s}>
      <rect x="3" y="6.2" width="8" height="5.6" rx="1" />
      <path d="M4.8 6.2 V4.6 a2.2 2.2 0 0 1 4.4 0 V6.2" />
    </G>
  ),
  unavailable: (s) => (
    <G size={s}>
      <circle cx="7" cy="7" r="5.25" />
      <path d="M3.3 10.7 L10.7 3.3" />
    </G>
  ),
  accessRequired: (s) => (
    <G size={s}>
      <circle cx="4.6" cy="9.4" r="2.6" />
      <path d="M6.6 7.4 L11.5 2.5 M9.4 4.6 L11.2 6.4" />
    </G>
  ),
  reviewRequired: (s) => (
    <G size={s}>
      <path d="M1.8 7 C3.2 4.4 5 3.2 7 3.2 C9 3.2 10.8 4.4 12.2 7 C10.8 9.6 9 10.8 7 10.8 C5 10.8 3.2 9.6 1.8 7 Z" />
      <circle cx="7" cy="7" r="1.6" />
    </G>
  ),
  notDecisionGrade: (s) => (
    <G size={s}>
      <path d="M7 2.2 V11.8 M2.9 4.6 L11.1 9.4 M11.1 4.6 L2.9 9.4" />
    </G>
  ),
  previewOnly: (s) => (
    <G size={s}>
      <rect x="2.2" y="2.2" width="9.6" height="9.6" rx="2" strokeDasharray="2.6 2.2" />
    </G>
  ),
  p0: (s) => (
    <G size={s}>
      <path d="M7 2 L12.6 11.6 H1.4 Z" />
      <path d="M7 6 V8.4 M7 10.1 V10.2" />
    </G>
  ),
  contradicted: (s) => (
    <G size={s}>
      <path d="M5.6 7 H1.8 M1.8 7 L3.6 5.2 M1.8 7 L3.6 8.8 M8.4 7 H12.2 M12.2 7 L10.4 5.2 M12.2 7 L10.4 8.8" />
    </G>
  ),
};

export const TrustGlyph = ({ state, size = 14 }: { state: CoverageState; size?: number }) => {
  const fn = TRUST_GLYPHS[state];
  return fn ? fn(size) : null;
};

/* ---------- STATE METADATA (DG-3.2 single table) ---------- */

type StateMeta = { label: string; tone: string; def: string };

export const STATE_META: Record<CoverageState, StateMeta> = {
  checked: { label: 'Checked', tone: 'checked', def: 'Source-backed and within freshness threshold.' },
  stale: { label: 'Stale', tone: 'stale', def: 'Previously checked; past freshness threshold. Refresh available.' },
  pending: { label: 'Pending', tone: 'pending', def: 'Check in flight. Result not yet available.' },
  gated: { label: 'Gated', tone: 'gated', def: 'Source requires enrollment or agreement before access.' },
  unavailable: { label: 'Unavailable', tone: 'unavailable', def: 'Source not reachable or out of scope.' },
  accessRequired: { label: 'Access required', tone: 'access', def: 'Holder must grant access before this source is read.' },
  reviewRequired: { label: 'Review required', tone: 'review', def: 'Human review needed before decision-grade.' },
  notDecisionGrade: { label: 'Not decision-grade', tone: 'ndg', def: 'Informational only. Not for credentialing decisions.' },
  previewOnly: { label: 'Preview only', tone: 'preview', def: 'Anonymous preview plane. Not an owned snapshot.' },
  p0: { label: 'Blocker', tone: 'p0', def: 'Blocks readiness until resolved.' },
  contradicted: { label: 'Contradicted', tone: 'contradicted', def: 'Sources disagree. Both values shown side-by-side.' },
};

/* ---------- StateChip (DG-6.1) — THE atomic visual unit ---------- */

export const StateChip = ({
  state,
  size = 'md',
  source,
  freshness,
  label,
}: {
  state: CoverageState;
  size?: 'sm' | 'md';
  source?: string;
  freshness?: string;
  label?: string;
}) => {
  const m = STATE_META[state] ?? STATE_META.pending;
  const t = m.tone;
  const dashed = state === 'previewOnly' || state === 'pending';
  const sm = size === 'sm';
  return (
    <span
      title={`${m.label}${source ? ` · ${source}` : ''}${freshness ? ` · ${freshness}` : ''} — ${m.def}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sm ? 4 : 6,
        fontFamily: 'var(--font-mono)',
        fontSize: sm ? 9 : 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap',
        padding: sm ? '2px 6px' : '3px 8px',
        color: `var(--vt-state-${t})`,
        background: `var(--vt-state-${t}-bg)`,
        border: `1px ${dashed ? 'dashed' : 'solid'} var(--vt-state-${t}-rule)`,
        borderRadius: 'var(--radius-1)',
      }}
    >
      <TrustGlyph state={state} size={sm ? 11 : 13} />
      {label || m.label}
    </span>
  );
};

/* ---------- FreshnessStamp (DG-6.8) ---------- */

export const FreshnessStamp = ({ rel, iso, stale }: { rel: string; iso?: string; stale?: boolean }) => (
  <time
    className="vt-num"
    dateTime={iso}
    title={iso}
    style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.04em',
      color: stale ? 'var(--vt-state-stale)' : 'var(--vt-text-muted)',
    }}
  >
    {rel}
  </time>
);

/* ---------- HonestyLabel (DG-17.2) — first-class UI, not fine print ---------- */

export const HonestyLabel = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.08em',
      color: 'var(--vt-text-secondary)',
      borderBottom: '1px solid var(--vt-degraded-border)',
      paddingBottom: 3,
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        border: '1px solid var(--vt-degraded-border)',
        borderRadius: '50%',
        flexShrink: 0,
      }}
    />
    {children}
  </span>
);

/* ---------- QuietButton (DG-6.3) ---------- */

export const QuietButton = ({
  children,
  small,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean }) => (
  <button
    type="button"
    {...rest}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: small ? '2px 4px' : '6px 8px',
      fontFamily: 'var(--font-body)',
      fontSize: small ? 11.5 : 13,
      fontWeight: 500,
      color: 'var(--vt-text)',
      textDecoration: 'underline',
      textDecorationColor: 'transparent',
      textUnderlineOffset: 3,
      transition: 'text-decoration-color var(--dur-fast) var(--ease-house)',
    }}
  >
    {children}
  </button>
);

/* ---------- SourceRow (DG-6.4) ---------- */

export const SourceRow = ({
  label,
  source,
  state,
  freshness,
  iso,
  action,
  chipLabel,
}: {
  label: string;
  source: string;
  state: CoverageState;
  freshness?: string;
  iso?: string;
  action?: string;
  chipLabel?: string;
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--vt-rule-soft)',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vt-text)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--vt-text-muted)',
          }}
        >
          {source}
        </span>
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

export const ReadinessRing = ({
  value = 72,
  size = 96,
  label = 'Readiness',
}: {
  value?: number;
  size?: number;
  label?: string;
}) => {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const band =
    value >= 80 ? 'var(--vt-state-checked)' : value >= 50 ? 'var(--vt-brand)' : 'var(--vt-state-stale)';
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${value} percent`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--vt-rule-soft)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={band}
          strokeWidth="5"
          strokeLinecap="butt"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray var(--dur-slow) var(--ease-house)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            className="vt-num"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: size * 0.26,
              fontWeight: 560,
              lineHeight: 1,
            }}
          >
            {value}
            <span style={{ fontSize: size * 0.14 }}>%</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--vt-text-muted)',
              marginTop: 2,
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Buttons (DG-6.3) ---------- */

const btnBase = (sz?: 'sm' | 'lg'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: sz === 'sm' ? 12 : sz === 'lg' ? 15 : 13.5,
  padding: sz === 'sm' ? '6px 14px' : sz === 'lg' ? '13px 26px' : '9px 20px',
  borderRadius: 'var(--radius-1)',
  border: '1px solid transparent',
  transition:
    'background var(--dur-fast) var(--ease-house), border-color var(--dur-fast) var(--ease-house), color var(--dur-fast) var(--ease-house)',
});

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'lg' };

export const PrimaryButton = ({ children, size, disabled, ...rest }: BtnProps) => (
  <button
    type="button"
    disabled={disabled}
    {...rest}
    onMouseEnter={(e) => {
      if (!disabled) e.currentTarget.style.background = 'var(--vt-brand-strong)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = disabled ? 'var(--vt-rule)' : 'var(--ink-900)';
    }}
    style={{
      ...btnBase(size),
      background: disabled ? 'var(--vt-rule)' : 'var(--ink-900)',
      color: disabled ? 'var(--vt-text-muted)' : 'var(--vt-text-inverse)',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
  >
    {children}
  </button>
);

export const SecondaryButton = ({ children, size, ...rest }: BtnProps) => (
  <button
    type="button"
    {...rest}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--vt-surface-card)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
    style={{
      ...btnBase(size),
      background: 'transparent',
      color: 'var(--vt-text)',
      borderColor: 'var(--vt-rule-strong)',
    }}
  >
    {children}
  </button>
);

/* ---------- PaperCard (DG-6.2) ---------- */

export const PaperCard = ({
  children,
  lift,
  style: st,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { lift?: boolean }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      {...rest}
      onMouseEnter={() => lift && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--vt-surface-card)',
        border: '1px solid var(--vt-rule)',
        borderRadius: 'var(--radius-2)',
        padding: 'var(--space-5)',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? 'var(--vt-lift)' : 'none',
        transition:
          'transform var(--dur-fast) var(--ease-house), box-shadow var(--dur-fast) var(--ease-house)',
        ...st,
      }}
    >
      {children}
    </div>
  );
};
