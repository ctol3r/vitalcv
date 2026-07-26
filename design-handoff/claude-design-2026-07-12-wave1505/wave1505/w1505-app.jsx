// Wave 1505 · w1505-app.jsx — route switch + wave index hub.

const HUB_CARDS = [
  { id: 'A · DG-12.1', t: 'Auth surfaces', d: 'Clerk themed to the house: sign-in, sign-up, verification, loading. Zero default purple.', links: [['#/auth', 'Overview + spec'], ['#/auth/sign-in', 'Sign in']] },
  { id: 'B · DG-12.2', t: 'Error & system states', d: '404, fail-closed error, offline banner, and the empty-state gallery — every state designed.', links: [['#/system', 'Gallery'], ['#/404', '404'], ['#/error', 'Error']] },
  { id: 'C · DG-12.3', t: 'Legal prose template', d: 'One template, four documents. 65ch Geist body, Fraunces headings, sticky TOC, mono stamps.', links: [['#/legal/privacy', 'Privacy'], ['#/legal/dpa', 'DPA']] },
  { id: 'D · DG-12.4 / 13.3', t: 'Contact · pricing · feedback', d: 'Form-kit contact with designed success; paper/ink pricing under the honesty doctrine; the feedback affordance on every chromed page.', links: [['#/contact', 'Contact'], ['#/pricing', 'Pricing']] },
  { id: 'E · DG-14 / 15', t: 'Responsive + a11y sweep', d: 'Findings → fixes → verified, across 7 viewports, keyboard, grayscale, screen readers, reduced motion.', links: [['#/audit', 'Checklist']] },
  { id: 'F · DG-18', t: 'Governance artifacts', d: 'DESIGN_SYSTEM.md, the /dev/design living style guide, the regression matrix, the lint rules.', links: [['#/dev/design', '/dev/design'], ['#/governance', 'Specs']] },
];

const ACCEPT = [
  { p: 'Zero default-styled third-party UI — Clerk fully themed, mapping shipped.', where: '#/auth' },
  { p: 'Every empty, error, and loading state designed; unknown routes land on the designed 404 for real.', where: '#/system' },
  { p: 'Grayscale + keyboard + reduced-motion + 360px passes on all surfaces, with fixes named.', where: '#/audit' },
  { p: 'DESIGN_SYSTEM.md is self-sufficient — palette rationale, ramps, states, component rules, do/don’t gallery.', where: 'DESIGN_SYSTEM.md' },
  { p: 'The do/don’t gallery encodes the honesty doctrine visually (gated + checkmark = never).', where: 'DESIGN_SYSTEM.md §9' },
];

const IndexRoute = () => (
  <S5Page eyebrow="Wave 1505 · closing wave · D-W7/W8" title={<span>The pages nobody designs — <span className="vt-accent-i">designed.</span></span>}
    lede="System pages, quality gates, and the governance that keeps the house from drifting. After this wave the design program is done — and guarded."
    label="Wave 1505 index">
    <S5Section first eyebrow="Scope" title="Six deliverables">
      <div className="hub-grid">
        {HUB_CARDS.map((c) => (
          <div className="hub-card" key={c.id}>
            <span className="hid">{c.id}</span>
            <h3>{c.t}</h3>
            <p>{c.d}</p>
            <div className="hub-links">{c.links.map(([h, l]) => <a key={h + l} href={h}>{l}</a>)}</div>
          </div>
        ))}
      </div>
    </S5Section>
    <S5Section eyebrow="Acceptance criteria" title="Checked against the brief">
      <div className="hub-accept" style={{ maxWidth: 760 }}>
        {ACCEPT.map((a) => (
          <div className="hub-accept-row" key={a.where + a.p.slice(0, 12)}>
            <StateChip state="checked" size="sm" label="Met" />
            <div>
              <p>{a.p}</p>
              <span className="where vt-num">{a.where}</span>
            </div>
          </div>
        ))}
      </div>
    </S5Section>
  </S5Page>
);

/* ---------- app ---------- */
const CHROMELESS = { auth_full: true };
const W1505App = () => {
  const route = useRoute5();
  const authFull = route.name === 'auth' && route.sub !== 'overview';
  const chromeless = authFull || route.name === '404' || route.name === 'error';
  if (chromeless) {
    if (route.name === '404') return <Sys404 requested={route.requested} />;
    if (route.name === 'error') return <SysError />;
    return <AuthRoute route={route} />;
  }
  return (
    <React.Fragment>
      <a className="skip-link" href="#main">Skip to content</a>
      <S5Nav route={route} />
      <main id="main" className="s5-main">
        {route.name === 'index' ? <IndexRoute /> : null}
        {route.name === 'auth' ? <AuthRoute route={route} /> : null}
        {route.name === 'system' ? <SystemRoute /> : null}
        {route.name === 'legal' ? <LegalRoute doc={route.doc} /> : null}
        {route.name === 'contact' ? <ContactRoute /> : null}
        {route.name === 'pricing' ? <PricingRoute /> : null}
        {route.name === 'audit' ? <AuditRoute /> : null}
        {route.name === 'devdesign' ? <DevDesignRoute /> : null}
        {route.name === 'governance' ? <GovernanceRoute /> : null}
      </main>
      <FeedbackWidget />
      <S5Footer />
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<W1505App />);
