// Wave 1505 · w1505-shared.jsx — router, nav, footer, prototype bar,
// FeedbackWidget (DG-12.5), OfflineBanner (DG-12.2.3), EmptyState,
// SkeletonStack. Consumes wave1500 tokens/primitives + prior-wave kit only.

/* ---------- hash router ---------- */
const parseRoute5 = (h) => {
  const hash = h || window.location.hash || '#/';
  const seg = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  if (!seg.length) return { name: 'index' };
  if (seg[0] === 'auth') {
    const sub = seg[1] || 'overview';
    if (['sign-in', 'sign-up', 'verify', 'loading', 'overview'].includes(sub)) return { name: 'auth', sub };
    return { name: '404', requested: hash };
  }
  if (seg[0] === '404') return { name: '404', requested: '/passport/old-share-link' };
  if (seg[0] === 'error') return { name: 'error' };
  if (seg[0] === 'system') return { name: 'system' };
  if (seg[0] === 'legal') {
    const doc = seg[1] || 'privacy';
    if (['privacy', 'terms', 'dpa', 'cookies'].includes(doc)) return { name: 'legal', doc };
    return { name: '404', requested: hash };
  }
  if (seg[0] === 'contact') return { name: 'contact' };
  if (seg[0] === 'pricing') return { name: 'pricing' };
  if (seg[0] === 'audit') return { name: 'audit' };
  if (seg[0] === 'dev') return { name: 'devdesign' };
  if (seg[0] === 'governance') return { name: 'governance' };
  return { name: '404', requested: hash };
};
const useRoute5 = () => {
  const [route, setRoute] = React.useState(() => parseRoute5());
  React.useEffect(() => {
    const fn = () => { setRoute(parseRoute5()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
};

/* ---------- nav ---------- */
const S5_ROUTES = [
  { hash: '#/', label: 'Index', match: 'index' },
  { hash: '#/auth', label: 'Auth', match: 'auth' },
  { hash: '#/system', label: 'System states', match: 'system' },
  { hash: '#/legal/privacy', label: 'Legal', match: 'legal' },
  { hash: '#/contact', label: 'Contact', match: 'contact' },
  { hash: '#/pricing', label: 'Pricing', match: 'pricing' },
  { hash: '#/audit', label: 'Audit', match: 'audit' },
  { hash: '#/dev/design', label: '/dev/design', match: 'devdesign' },
  { hash: '#/governance', label: 'Governance', match: 'governance' },
];
const S5Nav = ({ route }) => (
  <header className="s5-nav">
    <div className="s5-container s5-nav-inner">
      <a className="s5-brand-link" href="../wave1501/index.html" aria-label="VitalCV home">
        <VtLogo size={18} />
      </a>
      <span className="vt-eyebrow" style={{ whiteSpace: 'nowrap' }}>Wave 1505 · system &amp; governance</span>
      <nav className="s5-tabs" aria-label="Wave 1505 surfaces">
        {S5_ROUTES.map((r) => (
          <a key={r.hash} className="s5-tab" href={r.hash}
            aria-current={route.name === r.match ? 'page' : undefined}>{r.label}</a>
        ))}
      </nav>
    </div>
  </header>
);

/* ---------- footer ---------- */
const S5Footer = () => (
  <footer className="s5-foot">
    <div className="s5-container">
      <p className="s5-boundary">
        <TrustGlyph state="notDecisionGrade" size={16} />
        <span>Every state designed — <span className="vt-accent-i">especially</span> the ones nobody sees twice.</span>
      </p>
      <ul className="s5-foot-links">
        <li><a href="#/legal/privacy">Privacy</a></li>
        <li><a href="#/legal/terms">Terms</a></li>
        <li><a href="#/legal/dpa">DPA</a></li>
        <li><a href="#/legal/cookies">Cookies</a></li>
        <li><a href="#/contact">Contact</a></li>
        <li><a href="../wave1504/index.html#/status">Status</a></li>
        <li><a href="#/dev/design">/dev/design</a></li>
      </ul>
      <p className="s5-foot-base">© 2026 VitalCV · did:web:vitalcv.com · Doctrine v1.0 · A partial proof stays partial.</p>
    </div>
  </footer>
);

/* ---------- prototype bar (chrome-less full-page states) ---------- */
const ProtoBar = ({ viewing }) => (
  <nav className="s5-proto no-print" aria-label="Prototype navigation">
    <a href="#/">← Wave 1505 index</a>
    {viewing ? <a href={viewing.href} aria-current="page">{viewing.label}</a> : null}
  </nav>
);

/* ---------- page scaffold ---------- */
const S5Page = ({ eyebrow, title, lede, children, label }) => (
  <div className="s5-fade" data-screen-label={label || title}>
    <div className="s5-container s5-doctrine">
      {eyebrow ? <span className="vt-eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
    {children}
  </div>
);
const S5Section = ({ eyebrow, title, lede, first, children, id }) => (
  <section id={id} className={`s5-section${first ? ' first' : ''}`}>
    <div className="s5-container">
      {(eyebrow || title || lede) ? (
        <div className="s5-sechead">
          {eyebrow ? <span className="vt-eyebrow">{eyebrow}</span> : null}
          {title ? <h2>{title}</h2> : null}
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  </section>
);

/* ---------- OfflineBanner (DG-12.2.3) ----------
   Dashed rule = degraded semantics (never opacity). role="status",
   polite announcement. `inline` renders the pattern inside flow for
   the gallery; default is sticky under the nav at --vt-z-banner. */
const OfflineBanner = ({ inline, onRetry }) => (
  <div className={`off-banner${inline ? ' inline' : ''}`} role="status" aria-live="polite">
    <div className={inline ? 'off-inner' : 's5-container off-inner'}>
      <span className="off-glyph"><TrustGlyph state="unavailable" size={14} /></span>
      <span className="off-label">Connection lost</span>
      <span className="off-copy">Showing the last checked data — freshness stamps stay honest.</span>
      <span className="off-act"><QuietButton small onClick={onRetry}>Retry now</QuietButton></span>
    </div>
  </div>
);

/* ---------- EmptyState (DG-12.2.4) ----------
   Honest and calm: glyph in a plain frame (solid rule — dashed is
   reserved for degraded), one Fraunces line, one reason, ONE action. */
const EmptyState = ({ glyph = 'pending', title, why, action, onAction, secondary }) => (
  <div className="empty-card" role="status">
    <span className="empty-glyph"><TrustGlyph state={glyph} size={20} /></span>
    <h3>{title}</h3>
    <p className="why">{why}</p>
    {action ? (
      <span className="act">
        {secondary
          ? <SecondaryButton onClick={onAction}>{action}</SecondaryButton>
          : <PrimaryButton onClick={onAction}>{action}</PrimaryButton>}
      </span>
    ) : null}
  </div>
);

/* ---------- SkeletonStack — loading placeholder (allowed shimmer) ---------- */
const SkeletonStack = ({ lines = ['w80', 'w60', 'w40'] }) => (
  <div className="sk-stack" role="status" aria-label="Loading">
    {lines.map((w, i) => <span key={i} className={`sk-line ${w}`}></span>)}
  </div>
);

/* ---------- FeedbackWidget (DG-12.5) ----------
   Right-edge vertical tab at mid-height: never overlaps bottom CTAs at
   360px by construction. z from the token scale. Non-modal panel,
   Escape closes, focus returns to the tab. */
const FeedbackWidget = () => {
  const [open, setOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const tabRef = React.useRef(null);
  const areaRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); if (tabRef.current) tabRef.current.focus(); } };
    document.addEventListener('keydown', onKey);
    if (areaRef.current) areaRef.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const close = () => { setOpen(false); setSent(false); setMsg(''); if (tabRef.current) tabRef.current.focus(); };
  return (
    <React.Fragment>
      {!open ? (
        <button ref={tabRef} type="button" className="fb-tab no-print"
          aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          Feedback
        </button>
      ) : null}
      {open ? (
        <div className="fb-panel no-print" role="dialog" aria-label="Send feedback">
          {!sent ? (
            <React.Fragment>
              <div className="fb-head">
                <h2>Feedback</h2>
                <button type="button" className="fb-close" onClick={close}>Close</button>
              </div>
              <p className="fb-note">Read by the design team. Not for support, account issues, or anything patient-related.</p>
              <div className="fk-field">
                <label className="fk-label" htmlFor="fb-msg">What should we know?</label>
                <textarea ref={areaRef} id="fb-msg" rows={4} className="fk-input"
                  value={msg} onChange={(e) => setMsg(e.target.value)}
                  placeholder="Something unclear, broken, or dishonest — tell us where." />
              </div>
              <PrimaryButton disabled={!msg.trim()} onClick={() => setSent(true)}>Send feedback</PrimaryButton>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="fb-head">
                <h2>Recorded</h2>
                <button type="button" className="fb-close" onClick={close}>Close</button>
              </div>
              <StateChip state="checked" label="Received" />
              <p className="fb-note vt-num">fb_2026-07-12_c3a1 · Goes to the next design review. No reply is sent unless you asked a question.</p>
            </React.Fragment>
          )}
        </div>
      ) : null}
    </React.Fragment>
  );
};

Object.assign(window, {
  parseRoute5, useRoute5, S5_ROUTES, S5Nav, S5Footer, ProtoBar, S5Page, S5Section,
  OfflineBanner, EmptyState, SkeletonStack, FeedbackWidget,
});
