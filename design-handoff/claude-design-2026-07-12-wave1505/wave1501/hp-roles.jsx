// Wave 1501 · hp-roles.jsx — By-role doors (DG-7.9), Who buys in (DG-7.10), footer (DG-7.11).

const DOORS = [
  {
    role: 'clinician', name: 'Clinician', href: '/clinicians',
    b: 'Claim your snapshot, keep it current, and walk into the next role with evidence in hand.',
    cta: 'Start with your NPI',
  },
  {
    role: 'verifier', name: 'Verifier', href: '/verify', /* must NOT link to "/" */
    b: 'Read a shared snapshot: every field carries its source, freshness, and coverage state.',
    cta: 'Open a shared view',
  },
  {
    role: 'employer', name: 'Employer', href: '/employers',
    b: 'Accept a claimed snapshot as a head start. Your credentialing committee keeps the decision.',
    cta: 'See the pipeline view',
  },
  {
    role: 'issuer', name: 'Issuer', href: '/issuers',
    b: 'Sign artifacts once — they travel with the clinician as portable, checkable proof.',
    cta: 'Issue signed records',
  },
];

const DoorsSection = () => (
  <section className="hp-section" id="roles" data-screen-label="By role">
    <div className="hp-container">
      <SecHead
        eyebrow="By role"
        title="Four doors into the same record."
        lede="Everyone reads the same honest states — what differs is what you can do with them."
      />
      <div className="door-grid">
        {DOORS.map((d, i) => (
          <Reveal key={d.role} delay={i * 60} style={{ display: 'grid' }}>
            <a className="door" href={d.href} onClick={(e) => e.preventDefault()} aria-label={`${d.name}: ${d.cta}`}>
              <span style={{ color: 'var(--vt-text)' }}><RoleGlyph role={d.role} /></span>
              <h3>{d.name}</h3>
              <p>{d.b}</p>
              <span className="door-cta">{d.cta} <span aria-hidden="true">→</span></span>
            </a>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const WHO = [
  { dt: 'The clinician', dd: 'Proves the career once, keeps the record, and grants access on their own terms — instead of re-assembling a packet for every application.' },
  { dt: 'The medical staff office', dd: 'Starts from a claimed snapshot instead of a blank file. Re-checks what its process requires; stops re-collecting what already reads clean at the source.' },
  { dt: 'The recruiter', dd: 'Screens against a readiness picture with sources attached, not a resume\u2019s claims — and sees exactly which items are gated or stale.' },
  { dt: 'The issuing institution', dd: 'Answers each attestation request once, as a signed artifact that keeps working after it leaves the building.' },
];

const WhoSection = () => (
  <section className="hp-section" id="who" data-screen-label="Who buys in">
    <div className="hp-container">
      <SecHead
        eyebrow="Who buys in"
        title="Built for the people who carry the work."
        lede="Adoption starts where the re-collection burden lives today."
      />
      <dl className="who-dl">
        {WHO.map((x, i) => (
          <Reveal key={x.dt} delay={i * 60} className="who-item" as="div">
            <dt>{x.dt}</dt>
            <dd>{x.dd}</dd>
          </Reveal>
        ))}
      </dl>
    </div>
  </section>
);

const FOOT_COLS = [
  { h: 'Product', links: ['Readiness check', 'Career passport', 'MATCHA', 'Source coverage'] },
  { h: 'Roles', links: ['Clinicians', 'Verifiers', 'Employers', 'Issuers'] },
  { h: 'Trust', links: ['How reading works', 'Honesty labels', 'Coverage states', 'Contact'] },
];

const HpFooter = () => (
  <footer className="hp-foot" data-screen-label="Footer">
    <div className="hp-container">
      <div className="foot-grid">
        <div>
          <span className="hp-brand" style={{ fontSize: 22 }}>VitalCV</span>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '30ch' }}>
            The Provider Career Evidence Network. Find the opportunity, prove the career once, start faster.
          </p>
        </div>
        {FOOT_COLS.map((c) => (
          <div className="foot-col" key={c.h}>
            <h4>{c.h}</h4>
            <ul>
              {c.links.map((l) => (
                <li key={l}><a href="#" onClick={(e) => e.preventDefault()}>{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="foot-base">
        <span className="foot-copy vt-num">© 2026 VITALCV · PAPER+INK · W1501</span>
        <HonestyLabel>Illustrative product preview · not a final credentialing decision</HonestyLabel>
      </div>
    </div>
  </footer>
);

Object.assign(window, { DoorsSection, WhoSection, HpFooter });
