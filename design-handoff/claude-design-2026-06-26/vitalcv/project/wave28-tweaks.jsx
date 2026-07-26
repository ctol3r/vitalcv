// wave28-tweaks.jsx — Tweaks Panel components (developer-only)
// All exports attached to window for cross-script availability.

/* ──────────────────────────────────────────────────────────────────────────
   Token catalog — read on demand from the v2 CSS variables installed by
   tokens-v2.css. We enumerate the v2 names; resolveToken() pulls the live
   computed value off documentElement so dark/light/print modes are honored.
   ────────────────────────────────────────────────────────────────────────── */

const TOKENS_V2_CATALOG = {
  status: [
    'status-verified-v2', 'status-pending-v2', 'status-access-v2',
    'status-blocked-v2',  'status-contradicted-v2', 'status-unknown-v2',
  ],
  risk: [
    'risk-low-v2', 'risk-watch-v2', 'risk-elevated-v2', 'risk-high-v2', 'risk-critical-v2',
  ],
  surface: [
    'surface-page-v2', 'surface-card-v2', 'surface-muted-v2', 'surface-inset-v2', 'surface-overlay-v2',
  ],
  ink: [
    'ink-default-v2', 'ink-strong-v2', 'ink-muted-v2', 'ink-subtle-v2', 'ink-inverse-v2',
  ],
  accent: [
    'accent-primary-v2', 'accent-secondary-v2', 'accent-tertiary-v2',
  ],
};

const SPACING_TOKENS_V2 = [
  'space-0-v2', 'space-1-v2', 'space-2-v2', 'space-3-v2', 'space-4-v2',
  'space-5-v2', 'space-6-v2', 'space-7-v2', 'space-8-v2',
];

const TYPE_TOKENS_V2 = [
  { name: 'type-display-v2', label: 'Display', sample: 'System of record' },
  { name: 'type-h1-v2',      label: 'Heading 1', sample: 'Status verified' },
  { name: 'type-h2-v2',      label: 'Heading 2', sample: 'Pending review' },
  { name: 'type-h3-v2',      label: 'Heading 3', sample: 'Acceptance gate' },
  { name: 'type-h4-v2',      label: 'Heading 4', sample: 'Lane summary' },
  { name: 'type-h5-v2',      label: 'Heading 5', sample: 'Trust tier' },
  { name: 'type-h6-v2',      label: 'Heading 6', sample: 'Footnote header' },
  { name: 'type-body-v2',    label: 'Body',      sample: 'Body copy renders here as a single paragraph for visual rhythm checks.' },
  { name: 'type-small-v2',   label: 'Small',     sample: 'Inline annotation copy.' },
  { name: 'type-mono-v2',    label: 'Mono',      sample: 'NPI 1346·xxxxxx · oklch(58% 0.13 152)' },
  { name: 'type-micro-v2',   label: 'Micro',     sample: 'CHIP-LABEL · 11PX' },
];

/* Pre-defined a11y pairs — at least one intentional failure included. */
const A11Y_PAIRS_TO_CHECK = [
  { fg: 'ink-default-v2',     bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Body on card'           },
  { fg: 'ink-default-v2',     bg: 'surface-page-v2',  requiredAA: true,  requiredAAA: false, label: 'Body on page'           },
  { fg: 'ink-muted-v2',       bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Muted body on card'     },
  { fg: 'ink-subtle-v2',      bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Subtle body on card'    },
  { fg: 'status-verified-v2', bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Verified token on card' },
  { fg: 'status-pending-v2',  bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Pending token on card'  },
  { fg: 'status-access-v2',   bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Access token on card'   },
  { fg: 'status-blocked-v2',  bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Blocked token on card'  },
  /* intentional near-fail: low-contrast subtle on muted */
  { fg: 'ink-subtle-v2',      bg: 'surface-muted-v2', requiredAA: true,  requiredAAA: false, label: 'Subtle on muted (watch)' },
  /* intentional fail: status-pending on muted often misses AA at small */
  { fg: 'status-pending-v2',  bg: 'surface-muted-v2', requiredAA: true,  requiredAAA: false, label: 'Pending on muted'       },
  { fg: 'accent-primary-v2',  bg: 'surface-card-v2',  requiredAA: true,  requiredAAA: false, label: 'Primary CTA color'      },
  { fg: 'ink-inverse-v2',     bg: 'accent-primary-v2', requiredAA: true, requiredAAA: false, label: 'Inverse on primary'     },
];

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function resolveToken(name) {
  if (typeof document === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--vt-' + name).trim();
  return v;
}

function resolveTokenFallback(name) {
  if (typeof document === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--vt-' + name + '-fallback').trim();
  return v;
}

/* parse hex to RGB 0-255 */
function parseHex(hex) {
  const m = hex.match(/^#?([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length === 6) {
    return { r: parseInt(s.slice(0,2),16), g: parseInt(s.slice(2,4),16), b: parseInt(s.slice(4,6),16), a: 1 };
  }
  return null;
}

/* relative luminance per WCAG */
function relLuminance({ r, g, b }) {
  const lin = c => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return null;
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* approximate LAB delta — tiny shim using hex → rgb → xyz → lab */
function rgbToLab({ r, g, b }) {
  const sr = (r/255), sg = (g/255), sb = (b/255);
  const lin = c => c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  const Rl = lin(sr), Gl = lin(sg), Bl = lin(sb);
  const X = (Rl*0.4124 + Gl*0.3576 + Bl*0.1805) / 0.95047;
  const Y = (Rl*0.2126 + Gl*0.7152 + Bl*0.0722) / 1.0;
  const Z = (Rl*0.0193 + Gl*0.1192 + Bl*0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
  const L = 116*f(Y) - 16;
  const a = 500*(f(X) - f(Y));
  const bb = 200*(f(Y) - f(Z));
  return { L, a, b: bb };
}

function labDelta(hex1, hex2) {
  const c1 = parseHex(hex1), c2 = parseHex(hex2);
  if (!c1 || !c2) return null;
  const l1 = rgbToLab(c1), l2 = rgbToLab(c2);
  return Math.sqrt(Math.pow(l1.L-l2.L,2) + Math.pow(l1.a-l2.a,2) + Math.pow(l1.b-l2.b,2));
}

/* ──────────────────────────────────────────────────────────────────────────
   ColorTokenSwatch
   ────────────────────────────────────────────────────────────────────────── */

function ColorTokenSwatch({ name }) {
  const oklch = resolveToken(name);
  const fallback = resolveTokenFallback(name);
  return (
    <div className="vt-card-v2 vt-card-v2--inset" style={{ padding: '0.75rem' }}>
      <div
        aria-hidden="true"
        style={{
          width: '100%', height: 64,
          borderRadius: 'var(--vt-radius-md-v2)',
          background: oklch || fallback || '#ccc',
          border: '1px solid var(--vt-surface-inset-v2)',
        }}
      />
      <div style={{ marginTop: '0.5rem', font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-muted-v2)' }}>
        --vt-{name}
      </div>
      <div style={{ font: 'var(--vt-type-mono-v2)', color: 'var(--vt-ink-default-v2)' }}>
        {oklch || '—'}
      </div>
      <div style={{ font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-subtle-v2)' }}>
        fallback {fallback || '—'}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SpacingTokenBar
   ────────────────────────────────────────────────────────────────────────── */

function SpacingTokenBar({ name }) {
  const v = resolveToken(name);
  return (
    <div className="vt-card-v2 vt-card-v2--inset" style={{ padding: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          height: 12,
          width: v || 0,
          minWidth: 1,
          background: 'var(--vt-accent-primary-v2)',
          borderRadius: 'var(--vt-radius-sm-v2)',
        }}/>
        <span style={{ font: 'var(--vt-type-mono-v2)', color: 'var(--vt-ink-default-v2)' }}>
          {v || '—'}
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-muted-v2)' }}>
        --vt-{name}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   TypeTokenSample
   ────────────────────────────────────────────────────────────────────────── */

function TypeTokenSample({ name, label, sample }) {
  return (
    <div className="vt-card-v2 vt-card-v2--inset" style={{ padding: '0.75rem' }}>
      <div style={{ font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-muted-v2)', marginBottom: '0.25rem' }}>
        --vt-{name} · {label}
      </div>
      <div style={{ font: `var(--vt-${name})`, color: 'var(--vt-ink-default-v2)' }}>
        {sample}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   TokensGrid
   ────────────────────────────────────────────────────────────────────────── */

function TokensGrid() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vt-space-6-v2)' }}>
      {Object.entries(TOKENS_V2_CATALOG).map(([scale, tokens]) => (
        <section key={scale}>
          <h3 style={{ font: 'var(--vt-type-h4-v2)', color: 'var(--vt-ink-strong-v2)', marginBottom: '0.5rem' }}>
            {scale === 'status' ? 'Status (verified, pending, access, blocked)' :
              scale.charAt(0).toUpperCase() + scale.slice(1)}
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--vt-space-3-v2)',
          }}>
            {tokens.map(t => <ColorTokenSwatch key={t} name={t} />)}
          </div>
        </section>
      ))}
      <section>
        <h3 style={{ font: 'var(--vt-type-h4-v2)', color: 'var(--vt-ink-strong-v2)', marginBottom: '0.5rem' }}>Spacing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--vt-space-3-v2)' }}>
          {SPACING_TOKENS_V2.map(t => <SpacingTokenBar key={t} name={t} />)}
        </div>
      </section>
      <section>
        <h3 style={{ font: 'var(--vt-type-h4-v2)', color: 'var(--vt-ink-strong-v2)', marginBottom: '0.5rem' }}>Type</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--vt-space-3-v2)' }}>
          {TYPE_TOKENS_V2.map(t => <TypeTokenSample key={t.name} {...t} />)}
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   VariantExplorer
   ────────────────────────────────────────────────────────────────────────── */

const VARIANT_PRIMITIVES = [
  {
    id: 'chip',
    name: 'Chip',
    variants: [
      { variant: 'verified',     state: 'rest',  label: 'Verified' },
      { variant: 'verified',     state: 'hover', label: 'Verified' },
      { variant: 'pending',      state: 'rest',  label: 'Pending' },
      { variant: 'access',       state: 'rest',  label: 'Access' },
      { variant: 'blocked',      state: 'rest',  label: 'Blocked' },
      { variant: 'contradicted', state: 'rest',  label: 'Contradicted' },
      { variant: 'unknown',      state: 'rest',  label: 'Unknown' },
    ],
  },
  {
    id: 'button',
    name: 'Button',
    variants: [
      { variant: 'primary', state: 'rest',     label: 'Primary' },
      { variant: 'primary', state: 'hover',    label: 'Primary' },
      { variant: 'primary', state: 'disabled', label: 'Primary' },
      { variant: 'ghost',   state: 'rest',     label: 'Ghost' },
      { variant: 'ghost',   state: 'hover',    label: 'Ghost' },
      { variant: 'danger',  state: 'rest',     label: 'Danger' },
      { variant: 'danger',  state: 'disabled', label: 'Danger' },
    ],
  },
  {
    id: 'card',
    name: 'Card',
    variants: [
      { variant: 'default', state: 'rest', label: 'Default card' },
      { variant: 'inset',   state: 'rest', label: 'Inset card' },
    ],
  },
  {
    id: 'modal',
    name: 'Modal',
    variants: [
      { variant: 'default', state: 'rest', label: 'Modal panel preview' },
    ],
  },
  {
    id: 'confidence',
    name: 'Confidence badge (Wave 19)',
    variants: [
      { variant: 't1', state: 'rest', label: 'T1 · Self-attested' },
      { variant: 't2', state: 'rest', label: 'T2 · Federated' },
      { variant: 't3', state: 'rest', label: 'T3 · Authoritative' },
      { variant: 't4', state: 'rest', label: 'T4 · Primary-sealed' },
    ],
  },
];

function VariantCard({ primitiveId, variant, state, label }) {
  let body = null;
  if (primitiveId === 'chip') {
    body = <span className={`vt-chip-v2 vt-chip-v2--${variant}`}>{label}</span>;
  } else if (primitiveId === 'button') {
    body = (
      <button
        className={`vt-btn-v2 vt-btn-v2--${variant}`}
        disabled={state === 'disabled'}
      >
        {label}
      </button>
    );
  } else if (primitiveId === 'card') {
    body = (
      <div className={`vt-card-v2 ${variant === 'inset' ? 'vt-card-v2--inset' : ''}`}
           style={{ padding: 'var(--vt-space-4-v2)' }}>
        <div style={{ font: 'var(--vt-type-h5-v2)', color: 'var(--vt-ink-strong-v2)' }}>{label}</div>
        <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginTop: '0.25rem' }}>
          Surface preview
        </div>
      </div>
    );
  } else if (primitiveId === 'modal') {
    body = (
      <div style={{ position: 'relative', height: 140, background: 'var(--vt-surface-overlay-v2)', borderRadius: 'var(--vt-radius-md-v2)' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          background: 'var(--vt-surface-card-v2)', color: 'var(--vt-ink-default-v2)',
          padding: 'var(--vt-space-3-v2) var(--vt-space-4-v2)',
          borderRadius: 'var(--vt-radius-md-v2)',
          boxShadow: 'var(--vt-shadow-md-v2)',
          font: 'var(--vt-type-small-v2)',
        }}>
          {label}
        </div>
      </div>
    );
  } else if (primitiveId === 'confidence') {
    body = <span className={`vt-confidence-v2 vt-confidence-v2--${variant}`}>{label}</span>;
  }

  return (
    <div className="vt-card-v2 vt-card-v2--inset" style={{ padding: 'var(--vt-space-3-v2)' }}>
      <div style={{ font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-muted-v2)', marginBottom: '0.5rem' }}>
        {variant} · {state}
      </div>
      <div style={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>
        {body}
      </div>
    </div>
  );
}

function VariantExplorer({ activePrimitiveId, onSelect }) {
  const active = VARIANT_PRIMITIVES.find(p => p.id === activePrimitiveId) || VARIANT_PRIMITIVES[0];
  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--vt-space-2-v2)', flexWrap: 'wrap', marginBottom: 'var(--vt-space-4-v2)' }}>
        {VARIANT_PRIMITIVES.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            data-panel-control
            className={`vt-btn-v2 ${p.id === active.id ? 'vt-btn-v2--primary' : 'vt-btn-v2--ghost'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--vt-space-3-v2)',
      }}>
        {active.variants.map((v, i) => (
          <VariantCard key={i} primitiveId={active.id} {...v} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   A11y contrast scanner
   ────────────────────────────────────────────────────────────────────────── */

function A11yContrastScanner({ onComplete }) {
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [results, setResults] = React.useState(null);

  const run = React.useCallback(() => {
    setRunning(true);
    setProgress(0);
    setResults(null);
    const out = [];
    let i = 0;
    const tick = () => {
      const pair = A11Y_PAIRS_TO_CHECK[i];
      const fg = resolveTokenFallback(pair.fg) || resolveToken(pair.fg);
      const bg = resolveTokenFallback(pair.bg) || resolveToken(pair.bg);
      const ratio = contrastRatio(fg, bg);
      const aa  = ratio !== null && ratio >= 4.5;
      const aaa = ratio !== null && ratio >= 7.0;
      out.push({ ...pair, fgHex: fg, bgHex: bg, ratio, aa, aaa, pass: aa });
      i += 1;
      setProgress(i / A11Y_PAIRS_TO_CHECK.length);
      if (i < A11Y_PAIRS_TO_CHECK.length) {
        setTimeout(tick, 60);
      } else {
        setResults(out);
        setRunning(false);
        if (onComplete) onComplete(out);
      }
    };
    setTimeout(tick, 60);
  }, [onComplete]);

  return (
    <div className="vt-card-v2">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ font: 'var(--vt-type-h4-v2)', color: 'var(--vt-ink-strong-v2)' }}>
            Accessibility contrast scanner
          </div>
          <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)' }}>
            Computes WCAG ratios across {A11Y_PAIRS_TO_CHECK.length} pre-defined token pairs.
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          data-panel-control
          className="vt-btn-v2 vt-btn-v2--primary"
        >
          {running ? 'Scanning…' : 'Run scan'}
        </button>
      </div>

      {running && (
        <div style={{ marginTop: 'var(--vt-space-4-v2)' }}>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--vt-surface-inset-v2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: 'var(--vt-accent-primary-v2)',
              transition: 'width 80ms linear',
            }} />
          </div>
          <div style={{ marginTop: '0.5rem', font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-muted-v2)' }}>
            {Math.round(progress * 100)}% — checking pair {Math.round(progress * A11Y_PAIRS_TO_CHECK.length)} of {A11Y_PAIRS_TO_CHECK.length}
          </div>
        </div>
      )}

      {results && <A11yViolationList results={results} />}
    </div>
  );
}

function A11yViolationList({ results }) {
  const violations = results.filter(r => !r.pass);
  return (
    <div style={{ marginTop: 'var(--vt-space-4-v2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--vt-space-3-v2)', marginBottom: 'var(--vt-space-2-v2)' }}>
        <span className={`vt-chip-v2 ${violations.length === 0 ? 'vt-chip-v2--verified' : 'vt-chip-v2--blocked'}`}>
          {violations.length === 0 ? 'All AA' : `${violations.length} below AA`}
        </span>
        <span style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)' }}>
          {results.length} pairs scanned
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vt-space-2-v2)' }}>
        {results.map((r, i) => (
          <div key={i} className="vt-card-v2 vt-card-v2--inset"
               style={{ display: 'flex', alignItems: 'center', gap: 'var(--vt-space-3-v2)', padding: 'var(--vt-space-3-v2)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--vt-radius-sm-v2)',
              background: r.bgHex || '#fff', color: r.fgHex || '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: 'var(--vt-type-small-v2)', fontWeight: 600,
              border: '1px solid var(--vt-surface-inset-v2)',
            }}>
              Aa
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-default-v2)' }}>
                {r.label}
              </div>
              <div style={{ font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-subtle-v2)' }}>
                --vt-{r.fg} on --vt-{r.bg}
              </div>
            </div>
            <div style={{ font: 'var(--vt-type-mono-v2)', color: 'var(--vt-ink-default-v2)' }}>
              {r.ratio !== null ? r.ratio.toFixed(2) : '—'}:1
            </div>
            <span className={`vt-chip-v2 ${r.aa ? 'vt-chip-v2--verified' : 'vt-chip-v2--blocked'}`}>
              {r.aa ? 'AA' : 'Below AA'}
            </span>
            <span className={`vt-chip-v2 ${r.aaa ? 'vt-chip-v2--verified' : 'vt-chip-v2--unknown'}`}>
              {r.aaa ? 'AAA' : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Token export modal
   ────────────────────────────────────────────────────────────────────────── */

function buildTokenSnapshot() {
  const sortedColor = {};
  Object.entries(TOKENS_V2_CATALOG).forEach(([scale, tokens]) => {
    sortedColor[scale] = {};
    [...tokens].sort().forEach(t => {
      sortedColor[scale][t] = {
        oklch:    resolveToken(t),
        fallback: resolveTokenFallback(t),
      };
    });
  });
  const sortedSpacing = {};
  [...SPACING_TOKENS_V2].sort().forEach(t => { sortedSpacing[t] = resolveToken(t); });
  const sortedType = {};
  [...TYPE_TOKENS_V2].sort((a,b) => a.name.localeCompare(b.name))
    .forEach(t => { sortedType[t.name] = resolveToken(t.name); });

  return {
    snapshotTakenAt: new Date().toISOString(),
    schemaVersion:   'tokens-v2.css/2026-04',
    color:   sortedColor,
    spacing: sortedSpacing,
    type:    sortedType,
  };
}

function TokenExportModal({ open, onClose }) {
  const snapshot = React.useMemo(() => open ? buildTokenSnapshot() : null, [open]);
  if (!open) return null;
  const json = JSON.stringify(snapshot, null, 2);
  const download = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vitalcv-tokens-v2.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="vt-modal-v2-backdrop" data-panel-control>
      <div className="vt-modal-v2-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--vt-space-3-v2)' }}>
          <div style={{ font: 'var(--vt-type-h4-v2)', color: 'var(--vt-ink-strong-v2)' }}>
            Token snapshot
          </div>
          <button onClick={onClose} className="vt-btn-v2 vt-btn-v2--ghost">Close</button>
        </div>
        <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginBottom: 'var(--vt-space-3-v2)' }}>
          Deterministic JSON — alphabetical within each scale.
        </div>
        <pre style={{
          background: 'var(--vt-surface-muted-v2)',
          color: 'var(--vt-ink-default-v2)',
          padding: 'var(--vt-space-4-v2)',
          borderRadius: 'var(--vt-radius-md-v2)',
          font: 'var(--vt-type-mono-v2)',
          maxHeight: 360,
          overflow: 'auto',
          whiteSpace: 'pre',
        }}>{json}</pre>
        <div style={{ marginTop: 'var(--vt-space-4-v2)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--vt-space-2-v2)' }}>
          <button onClick={onClose} className="vt-btn-v2 vt-btn-v2--ghost">Cancel</button>
          <button onClick={download} className="vt-btn-v2 vt-btn-v2--primary">Download .json</button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Mode toggle (light / dark / print preview)
   ────────────────────────────────────────────────────────────────────────── */

function ModeToggle({ mode, onChange }) {
  const modes = [
    { id: 'light', label: 'Light' },
    { id: 'dark',  label: 'Dark' },
    { id: 'print', label: 'Print' },
  ];
  return (
    <div style={{ display: 'inline-flex', gap: 0, border: '1px solid var(--vt-surface-inset-v2)', borderRadius: 'var(--vt-radius-md-v2)', overflow: 'hidden' }} data-panel-control>
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className="vt-btn-v2"
          style={{
            borderRadius: 0,
            background: m.id === mode ? 'var(--vt-accent-primary-v2)' : 'transparent',
            color: m.id === mode ? 'var(--vt-ink-inverse-v2)' : 'var(--vt-ink-default-v2)',
            border: 'none',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* expose to window */
Object.assign(window, {
  TOKENS_V2_CATALOG, SPACING_TOKENS_V2, TYPE_TOKENS_V2, A11Y_PAIRS_TO_CHECK,
  resolveToken, resolveTokenFallback, contrastRatio, labDelta, buildTokenSnapshot,
  ColorTokenSwatch, SpacingTokenBar, TypeTokenSample, TokensGrid,
  VariantCard, VariantExplorer, VARIANT_PRIMITIVES,
  A11yContrastScanner, A11yViolationList,
  TokenExportModal, ModeToggle,
});
