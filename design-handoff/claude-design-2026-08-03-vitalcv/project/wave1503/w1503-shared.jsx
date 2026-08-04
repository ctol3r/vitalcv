// Wave 1503 · w1503-shared.jsx — funnel router, nav, prototype strip,
// EvidenceRow (SourceRow grammar + tier), RecognitionRow (DG-10.5),
// shared persona/data so passport + share page render identical truth.
// Consumes wave1500 tokens/primitives + 1501/1502 kit only.

/* ---------- shared persona (matches Wave 1501 wallet mock) ---------- */
const FUNNEL_PERSONA = {
  name: 'Adaeze Okafor, MD',
  specialty: 'Family Medicine',
  location: 'Sacramento, California',
  npi: '1234 5678 93',
  npiRaw: '1234567893',
  ring: 72,
  compiled: '2026-07-11T14:02Z',
  doc: 'psp_okafor_7f3a',
  slug: 'a-okafor-7f3a',
};

const bandFor3 = (v) => (v >= 80
  ? { key: 'ready', label: 'Ready band' }
  : v >= 50
    ? { key: 'head', label: 'Head-start band' }
    : { key: 'early', label: 'Early band' });

/* ---------- passport evidence groups (blockers sorted first) ---------- */
const FUNNEL_GROUPS = [
  { name: 'Identity', rows: [
    { label: 'NPPES record', source: 'NPPES', state: 'checked', tier: 'T2', freshness: '2h ago', iso: '2026-07-11T12:04:00Z' },
    { label: 'Specialty & taxonomy', source: 'NPPES', state: 'checked', tier: 'T2', freshness: '2h ago', iso: '2026-07-11T12:04:00Z' },
  ] },
  { name: 'Exclusions', rows: [
    { label: 'Exclusion list', source: 'OIG LEIE', state: 'checked', tier: 'T2', freshness: '2h ago', iso: '2026-07-11T12:04:00Z',
      note: 'Re-read monthly when OIG publishes.' },
  ] },
  { name: 'Enrollment', rows: [
    { label: 'Medicare enrollment', source: 'CMS PECOS', state: 'gated', action: 'Authorize read',
      note: 'Reads only after your enrollment agreement — gated until then, never assumed.' },
  ] },
  { name: 'Licensure', rows: [
    { label: 'Texas license', source: 'TEXAS MEDICAL BOARD', state: 'p0', chipLabel: 'Blocker', tier: 'T2',
      freshness: '21d ago', iso: '2026-06-20T09:00:00Z', blocker: true, action: 'Resolve',
      note: 'Expired 2026-05-31. Blocks the Texas lane only — California is unaffected.' },
    { label: 'California license', source: 'MEDICAL BOARD OF CALIFORNIA', state: 'checked', tier: 'T2',
      freshness: '1d ago', iso: '2026-07-10T08:30:00Z' },
  ] },
  { name: 'Employment', rows: [
    { label: 'Hospitalist — St. Rose Community Hospital', source: 'SELF-ATTESTED · 2022–PRESENT',
      state: 'notDecisionGrade', chipLabel: 'Self-attested', tier: 'T1', action: 'Request review' },
    { label: 'Attending — Lakeview Clinic', source: 'SELF-ATTESTED · 2019–2022',
      state: 'notDecisionGrade', chipLabel: 'Self-attested', tier: 'T1' },
  ] },
];

/* ---------- recognitions (DG-10.5) ---------- */
const FUNNEL_RECOGNITIONS = [
  { employer: 'Mercy General Health', iso: '2026-06-30T14:22Z', packet: 'pk_7f3a\u00b7d91c', n: '0012' },
  { employer: 'Sierra Valley Medical Group', iso: '2026-04-12T09:05Z', packet: 'pk_29be\u00b777e0', n: '0007' },
];

/* ---------- hash router ---------- */
const parseRoute3 = (h) => {
  const hash = h || window.location.hash || '#/get-ready';
  const m = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (m[0] === 'onboarding') return { name: 'onboarding' };
  if (m[0] === 'passport') return { name: 'passport' };
  if (m[0] === 'p' && m[1]) return { name: 'share', slug: m[1] };
  return { name: 'getready' };
};
const useRoute3 = () => {
  const [route, setRoute] = React.useState(() => parseRoute3());
  React.useEffect(() => {
    const fn = () => { setRoute(parseRoute3()); window.scrollTo({ top: 0, behavior: 'auto' }); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
};

/* ---------- nav ---------- */
const S3_ROUTES = [
  { hash: '#/get-ready', label: 'Get ready', match: 'getready' },
  { hash: '#/onboarding', label: 'Onboarding', match: 'onboarding' },
  { hash: '#/passport', label: 'Passport', match: 'passport' },
  { hash: '#/p/' + FUNNEL_PERSONA.slug, label: 'Share page', match: 'share' },
];
const S3Nav = ({ route }) => (
  <header className="s3-nav">
    <div className="s3-container s3-nav-inner">
      <a className="s3-brand" href="../wave1501/index.html">VitalCV</a>
      <span className="s3-wave vt-eyebrow">Wave 1503 · clinician funnel</span>
      <nav className="s3-tabs" aria-label="Surfaces">
        {S3_ROUTES.map((r) => (
          <a key={r.hash} className="s3-tab" href={r.hash}
            aria-current={route.name === r.match ? 'page' : undefined}>{r.label}</a>
        ))}
      </nav>
    </div>
  </header>
);

/* ---------- prototype control strip (design-review chrome) ---------- */
const DemoStrip = ({ label, children }) => (
  <div className="s3-demo no-print" role="group" aria-label="Prototype controls">
    <div className="s3-container s3-demo-inner">
      <span className="s3-demo-lab">Prototype{label ? ' · ' + label : ''}</span>
      <span className="s3-demo-ctl">{children}</span>
    </div>
  </div>
);
const DemoBtn = ({ on, children, ...rest }) => (
  <button type="button" className={`s3-demo-btn${on ? ' on' : ''}`} aria-pressed={on} {...rest}>{children}</button>
);

/* ---------- EvidenceRow — SourceRow grammar + ProofTierBadge cell ----------
   Promotion candidate (documented in CHANGES.md). Same metrics as DG-6.4. */
const EvidenceRow = ({ label, source, state, tier, freshness, iso, note, action, onAction, chipLabel, blocker }) => (
  <div className={`ev3-row${blocker ? ' blocker' : ''}`}>
    <div className="ev3-main">
      <span className="ev3-label">{label}</span>
      <span className="ev3-srcline">
        <span className="ev3-src">{source}</span>
        {freshness ? <FreshnessStamp rel={freshness} iso={iso} stale={state === 'stale'} /> : null}
      </span>
      {note ? <p className="ev3-note">{note}</p> : null}
    </div>
    <div className="ev3-cluster">
      {tier ? <ProofTierBadge tier={tier} /> : null}
      <span className="s3-fade" key={state}>
        <StateChip state={state} size="sm" source={source} freshness={freshness} label={chipLabel} />
      </span>
      {action ? <QuietButton small onClick={onAction}>{action}</QuietButton> : null}
    </div>
  </div>
);

/* ---------- RecognitionRow (DG-10.5) — the one reserved matcha moment ----------
   Mono timestamp · employer · "Accepted as head start" · stamp. Calm, archival. */
const RecognitionRow = ({ employer, iso, packet, n, entered }) => (
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

/* ---------- funnel footer boundary (DG-10.3 §6 wording) ---------- */
const FunnelFooter = ({ tight }) => (
  <footer className={`s3-foot${tight ? ' tight' : ''}`}>
    <div className="s3-container">
      <p className="s3-boundary">
        <TrustGlyph state="notDecisionGrade" size={16} />
        <span>A head start for employer review — <span className="vt-accent-i">not</span> a final credentialing decision.</span>
      </p>
      <p className="s3-foot-base">© 2026 VitalCV · Free for clinicians · A partial proof stays partial.</p>
    </div>
  </footer>
);

/* ---------- two-list honesty panel (1502 HonestyPanel classes, share wording) ----------
   Local variant: same hn-* rendering, item count label dropped (these are
   points, not lanes). Documented in CHANGES.md. */
const SharePanel = ({ tone, title, items }) => (
  <section className={`hn-panel ${tone}`} aria-label={title}>
    <header className="hn-panel-head">
      <TrustGlyph state={tone === 'ok' ? 'checked' : 'stale'} size={14} />
      <span className="t">{title}</span>
    </header>
    <ul className="hn-items">
      {items.map((it) => (
        <li className="hn-item" key={it.label}>
          <div>
            <span className="lab">{it.label}</span>
            <span className="src">{it.src}</span>
            {it.note ? <p className="note">{it.note}</p> : null}
          </div>
          <StateChip state={it.state} size="sm" label={it.chipLabel} />
        </li>
      ))}
    </ul>
  </section>
);

Object.assign(window, {
  FUNNEL_PERSONA, FUNNEL_GROUPS, FUNNEL_RECOGNITIONS, bandFor3,
  parseRoute3, useRoute3, S3Nav, S3_ROUTES, DemoStrip, DemoBtn,
  EvidenceRow, RecognitionRow, FunnelFooter, SharePanel,
});
