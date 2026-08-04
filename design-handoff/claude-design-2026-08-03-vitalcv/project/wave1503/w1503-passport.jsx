// Wave 1503 · w1503-passport.jsx — /passport (DG-10.3) + Recognition ledger
// (DG-10.5) + share affordance with recipient preview. Paper document:
// mono metadata strip, hairline rules, blockers sorted first.

const RAISE_ITEMS = [
  { state: 'p0', text: 'Resolve the Texas license blocker', d: '+9' },
  { state: 'gated', text: 'Authorize the PECOS enrollment read', d: '+8' },
  { state: 'notDecisionGrade', text: 'Request employer review of self-attested roles', d: '+6' },
];

const PassportRaise = () => (
  <div className="ps-raise s3-enter" role="region" aria-label="What would raise this">
    {RAISE_ITEMS.map((r) => (
      <div className="ps-raise-row" key={r.text}>
        <TrustGlyph state={r.state} size={13} />
        <span>{r.text}</span>
        <span className="d vt-num">{r.d}</span>
      </div>
    ))}
    <p className="ps-raise-foot">Estimates · recomputed at next compile</p>
  </div>
);

const PassportDoc = () => {
  const [raise, setRaise] = React.useState(false);
  const p = FUNNEL_PERSONA;
  const band = bandFor3(p.ring);
  return (
    <article className="ps-doc" aria-label="Clinician passport">
      <div className="ps-meta">
        <span>Passport</span><span className="dot">·</span>
        <span className="vt-num">{p.doc}</span><span className="dot">·</span>
        <span className="vt-num">compiled {p.compiled}</span>
        <span className="right">Carried by the clinician</span>
      </div>

      <div className="ps-id">
        <div>
          <h2 className="ps-name">{p.name}</h2>
          <div className="ps-idlines">
            <span className="ps-idline vt-num"><span className="k">NPI</span>{p.npi}</span>
            <span className="ps-idline"><span className="k">Specialty</span>{p.specialty}</span>
            <span className="ps-idline"><span className="k">Location</span>{p.location}</span>
          </div>
        </div>
        <div className="ps-ringside">
          <ReadinessRing value={p.ring} size={112} />
          <div className="ps-ringmeta">
            <span className="ps-band">{band.label}</span>
            <QuietButton small onClick={() => setRaise(!raise)} aria-expanded={raise}>
              {raise ? 'Hide' : 'What would raise this'}
            </QuietButton>
            {raise ? <PassportRaise /> : null}
          </div>
        </div>
      </div>

      {FUNNEL_GROUPS.map((g) => {
        const blockers = g.rows.filter((r) => r.blocker).length;
        return (
          <section className="ps-group" key={g.name} aria-label={g.name}>
            <header className="ps-group-h">
              <span className="ps-group-name">{g.name}</span>
              <span className="ps-group-n">
                {g.rows.length} {g.rows.length === 1 ? 'lane' : 'lanes'}
                {blockers ? <span className="blk"> · {blockers} blocker</span> : null}
              </span>
            </header>
            {g.rows.map((r) => <EvidenceRow key={r.label} {...r} />)}
          </section>
        );
      })}

      <section className="ps-group" aria-label="Recognitions">
        <header className="ps-group-h">
          <span className="ps-group-name">Recognitions</span>
          <span className="ps-group-n">employer acceptances · kept on the record</span>
        </header>
        <div className="rec-list">
          {FUNNEL_RECOGNITIONS.map((r) => <RecognitionRow key={r.n} {...r} />)}
        </div>
      </section>
    </article>
  );
};

/* ---------- share affordance: selective disclosure + recipient preview ---------- */
const groupChip = (g) => {
  const worst = g.rows.find((r) => r.blocker) || g.rows[0];
  return { state: worst.state, label: worst.chipLabel };
};

const PassportShare = () => {
  const [sel, setSel] = React.useState({ Identity: true, Exclusions: true, Enrollment: true, Licensure: true, Employment: false });
  const [link, setLink] = React.useState(false);
  const withheld = FUNNEL_GROUPS.filter((g) => !sel[g.name]).map((g) => g.name);
  return (
    <section className="ps-share" aria-label="Share proof packet">
      <div className="ps-share-card">
        <h3>Share proof packet</h3>
        <p><span className="vt-accent-i">You choose what travels.</span> Withhold any section; the packet says so honestly. Withdraw the link whenever you like.</p>
        <div className="ps-toggles" role="group" aria-label="Sections in this packet">
          {FUNNEL_GROUPS.map((g) => (
            <button key={g.name} type="button" className="ps-toggle" role="checkbox" aria-checked={sel[g.name]}
              onClick={() => { setSel({ ...sel, [g.name]: !sel[g.name] }); }}>
              <span className="ps-box" aria-hidden="true">{sel[g.name] ? <TrustGlyph state="checked" size={12} /> : null}</span>
              <span>{g.name}</span>
              <span className="src">{g.rows.length} {g.rows.length === 1 ? 'lane' : 'lanes'}</span>
            </button>
          ))}
        </div>
        <PrimaryButton onClick={() => setLink(true)}>{link ? 'Packet link created' : 'Create packet link'}</PrimaryButton>
        {link ? (
          <div className="s3-enter">
            <div className="ps-linkline">
              <span className="url">vitalcv.com/p/{FUNNEL_PERSONA.slug}</span>
              <span style={{ flex: 1 }}></span>
              <QuietButton small onClick={() => { window.location.hash = '#/p/' + FUNNEL_PERSONA.slug; }}>Open as recipient</QuietButton>
            </div>
            <p className="ps-expiry">Readable 30 days · withdraw anytime · each open receipted</p>
          </div>
        ) : null}
      </div>

      <div className="ps-prev" aria-label="What the recipient sees">
        <div className="ps-prev-bar">What the recipient sees</div>
        <div className="ps-prev-body">
          <div className="ps-prev-id">
            <div>
              <div className="ps-prev-name">{FUNNEL_PERSONA.name}</div>
              <div className="ps-prev-sub vt-num">NPI {FUNNEL_PERSONA.npi} · {FUNNEL_PERSONA.specialty}</div>
            </div>
            <span style={{ marginLeft: 'auto' }}><ReadinessRing value={FUNNEL_PERSONA.ring} size={56} label="Ready" /></span>
          </div>
          <div className="ps-prev-rows">
            {FUNNEL_GROUPS.filter((g) => sel[g.name]).map((g) => {
              const c = groupChip(g);
              return (
                <div className="ps-prev-row" key={g.name}>
                  <span>{g.name}</span>
                  <span className="chip"><StateChip state={c.state} size="sm" label={c.label} /></span>
                </div>
              );
            })}
          </div>
          {withheld.length ? (
            <div className="ps-prev-with">Withheld by you: {withheld.join(' · ')}</div>
          ) : null}
        </div>
        <div className="ps-prev-foot vt-num">packet pk_7f3a·d91c · verify at vitalcv.com/api/receipts/verify</div>
      </div>
    </section>
  );
};

const PassportView = () => (
  <React.Fragment>
    <DemoStrip label="/passport · the clinician document" />
    <main data-screen-label="Passport">
      <div className="ps-wrap">
        <Reveal><PassportDoc /></Reveal>
        <Reveal delay={80}><PassportShare /></Reveal>
      </div>
      <FunnelFooter />
    </main>
  </React.Fragment>
);

Object.assign(window, { PassportView, PassportDoc, PassportShare });
