// Wave 1504 · w1504-shared.jsx — router, nav, footer, CopyBtn, TokenRow,
// SlotGrid (promotion candidate), SrcChip, DlPanel, section scaffold.
// Consumes wave1500 tokens/primitives + brand/logo.jsx only.

/* ---------- shared issuer facts (single source of truth for this wave) ---------- */
const ISSUER = {
  did: 'did:web:vitalcv.com',
  didDoc: 'https://vitalcv.com/.well-known/did.json',
  jwks: 'https://vitalcv.com/.well-known/jwks.json',
  kid: 'vitalcv-2026-01',
  kidPrev: 'vitalcv-2025-07',
  fingerprint: 'SHA-256 a7:2f:19:c4:8e:0b:52:d6:33:91:ee:47:b8:05:6c:aa',
  alg: 'EC P-256 · ES256',
  runId: 'run_2026-07-11_0642Z',
  checkedAt: '2026-07-11T06:42Z',
  artifact: 'vc_okafor_9d2e',
  snapshot: 'psp_okafor_7f3a',
  npi: 'npi:1234567893',
};

/* ---------- hash router ---------- */
const parseRoute4 = (h) => {
  const hash = h || window.location.hash || '#/trust';
  const m = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (m[0] === 'trust' && m[1] === 'attribution') return { name: 'attribution' };
  if (m[0] === 'trust' && m[1] === 'graph') return { name: 'graph' };
  if (m[0] === 'status') return { name: 'status' };
  if (m[0] === 'brand') return { name: 'brand' };
  return { name: 'trust' };
};
const useRoute4 = () => {
  const [route, setRoute] = React.useState(() => parseRoute4());
  React.useEffect(() => {
    const fn = () => { setRoute(parseRoute4()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
};

/* ---------- nav ---------- */
const S4_ROUTES = [
  { hash: '#/trust', label: 'Trust register', match: 'trust' },
  { hash: '#/trust/attribution', label: 'Attribution', match: 'attribution' },
  { hash: '#/status', label: 'Status', match: 'status' },
  { hash: '#/trust/graph', label: 'Graph', match: 'graph' },
  { hash: '#/brand', label: 'Brand assets', match: 'brand' },
];
const S4Nav = ({ route }) => (
  <header className="s4-nav">
    <div className="s4-container s4-nav-inner">
      <a className="s4-brand-link" href="../wave1501/index.html" aria-label="VitalCV home">
        <VtLogo size={18} />
      </a>
      <span className="s4-wave vt-eyebrow">Wave 1504 · trust surfaces</span>
      <nav className="s4-tabs" aria-label="Surfaces">
        {S4_ROUTES.map((r) => (
          <a key={r.hash} className="s4-tab" href={r.hash}
            aria-current={route.name === r.match ? 'page' : undefined}>{r.label}</a>
        ))}
      </nav>
    </div>
  </header>
);

/* ---------- footer ---------- */
const S4Footer = () => (
  <footer className="s4-foot">
    <div className="s4-container">
      <p className="s4-boundary">
        <TrustGlyph state="reviewRequired" size={16} />
        <span>Built to be checked — <span className="vt-accent-i">not</span> taken on faith.</span>
      </p>
      <ul className="s4-foot-links">
        <li><a href="#/trust">Trust State Register</a></li>
        <li><a href="#/trust/attribution">Source attribution</a></li>
        <li><a href="#/status">Operational status</a></li>
        <li><a href="#/trust/graph">Verifier graph</a></li>
      </ul>
      <p className="s4-foot-base">© 2026 VitalCV · {ISSUER.did} · Doctrine v1.0 · A partial proof stays partial.</p>
    </div>
  </footer>
);

/* ---------- copy affordance (acceptance: every copyable value) ---------- */
const copyText = (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
};
const copyFallback = (text) => {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { /* noop */ }
  document.body.removeChild(ta);
};
const CopyBtn = ({ text, label = 'Copy' }) => {
  const [copied, setCopied] = React.useState(false);
  const tRef = React.useRef(null);
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
const TokenRow = ({ k, value, display, href, children }) => (
  <div className="tok-row">
    <span className="tok-key">{k}</span>
    <span className="tok-val vt-num">
      {href ? <a href={href} onClick={(e) => e.preventDefault()} title="Live endpoint — stubbed in prototype">{display || value}</a> : (display || value)}
      {children}
    </span>
    <CopyBtn text={value} />
  </div>
);

/* ---------- SrcChip — source names as mono small-caps, NEVER logos (DG-4.6) ---------- */
const SrcChip = ({ name }) => <span className="src-chip">{name}</span>;

/* ---------- SlotGrid (promotion candidate — documented in CHANGES.md) ----------
   The canonical 6-slot lineage grid: OBJECT / OWNERSHIP / CHECKED_AT /
   CHANNEL / REPLAY / RUN_ID. A slot with no binding renders "─ ─ ─" in a
   dashed cell (--vt-degraded-border) — degraded is a designed state, never
   reduced opacity, never hidden. */
const SLOT_KEYS = ['OBJECT', 'OWNERSHIP', 'CHECKED_AT', 'CHANNEL', 'REPLAY', 'RUN_ID'];
const UNBOUND = '─ ─ ─';
const SlotGrid = ({ slots = {}, dense }) => (
  <div className="sg" role="table" aria-label="Lineage slot grid">
    {SLOT_KEYS.map((key) => {
      const s = slots[key];
      return (
        <div key={key} role="row" className={`sg-cell${s ? '' : ' unbound'}`}>
          <span role="rowheader" className="sg-key">{key}</span>
          <span role="cell" className="sg-val vt-num"
            aria-label={s ? undefined : `${key} unbound`}>
            <span>{s ? s.v : UNBOUND}</span>
            {s && s.copy ? <CopyBtn text={s.copy === true ? s.v : s.copy} /> : null}
          </span>
          {s && s.sub && !dense ? <span className="sg-sub">{s.sub}</span> : null}
        </div>
      );
    })}
  </div>
);

/* ---------- definition-list panel (mono keys, ink values) ---------- */
const DlPanel = ({ title, items }) => (
  <section className="dl-panel" aria-label={title}>
    <h3>{title}</h3>
    <dl className="dl">
      {items.map((it) => (
        <div key={it.k}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  </section>
);

/* ---------- section scaffold ---------- */
const S4Section = ({ eyebrow, title, lede, first, children, id }) => (
  <section id={id} className={`s4-section${first ? ' first' : ''}`}>
    <div className="s4-container">
      <div className="s4-sechead">
        {eyebrow ? <span className="vt-eyebrow">{eyebrow}</span> : null}
        {title ? <h2>{title}</h2> : null}
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {children}
    </div>
  </section>
);

Object.assign(window, {
  ISSUER, parseRoute4, useRoute4, S4_ROUTES, S4Nav, S4Footer,
  CopyBtn, copyText, TokenRow, SrcChip, SLOT_KEYS, UNBOUND, SlotGrid,
  DlPanel, S4Section,
});
