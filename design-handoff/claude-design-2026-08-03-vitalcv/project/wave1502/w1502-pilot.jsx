// Wave 1502 · w1502-pilot.jsx — /pilot employer pilot page (DG-8.1, 8.2, 8.4, 8.5, 8.6).

/* ---- metric strip (DG-8.2) — honesty sub-rule designed into every card ---- */
const PL_STATS = [
  { num: <span className="vt-num">29<span className="arr" aria-hidden="true">→</span>9<span className="unit">days</span></span>,
    sr: '29 down to 9 days', cap: 'Median days, intake to reviewer-ready file' },
  { num: <span className="vt-num">74<span className="unit">%</span></span>,
    sr: '74 percent', cap: 'Files with zero blockers at first reviewer view' },
  { num: <span className="vt-num">4<span className="arr" aria-hidden="true">/</span>6</span>,
    sr: '4 of 6', cap: 'Evidence lanes source-backed at intake, median' },
  { num: <span className="vt-num">100<span className="unit">%</span></span>,
    sr: '100 percent', cap: 'Reviewer actions recorded as audit events' },
];
const StatCard = ({ s }) => (
  <div className="pl-stat">
    <span className="pl-stat-num" role="img" aria-label={s.sr}>{s.num}</span>
    <span className="pl-stat-cap">{s.cap}</span>
    <span className="pl-stat-honesty"><span className="hn-dot" aria-hidden="true"></span>Internal simulation · not a customer pilot result</span>
  </div>
);

/* ---- 2×2 scope grid (DG-8.1) ---- */
const PL_SCOPE = [
  { t: 'What this pilot is', b: 'A fixed-scope, 60-day measurement on up to 25 clinicians at one facility group. A signed scope document defines every source we read — before anything is measured.' },
  { t: 'What you provide', b: 'A named reviewer, your clinician list (names and NPIs), and your current baseline — how long offer-to-start runs today. No system integration is required to begin.' },
  { t: 'What VitalCV measures', b: 'Intake-to-reviewer-ready time per file, blockers surfaced and cleared, source freshness at first view, and every reviewer action — each recorded as an audit event.' },
  { t: 'What success looks like', b: 'Your committee opens files that are days further along, with fewer surprises — and an audit trail that shows why. Committees remain the final step, on every file.' },
];

/* ---- HonestyPanel data (DG-8.4) ---- */
const PL_LIVE = [
  { label: 'Identity read', source: 'NPPES', state: 'checked', note: 'Name, specialty, and practice data read at intake.' },
  { label: 'Exclusion read', source: 'OIG LEIE', state: 'checked', note: 'Checked at intake and on every refresh.' },
  { label: 'Proof-pack export', source: 'SHA256 + audit event', state: 'checked', note: 'Every export hashed and recorded — see the schematic below.' },
  { label: 'Reviewer audit trail', source: 'Every action', state: 'checked', note: 'Accept, refresh, and route each record an event.' },
];
const PL_PARTIAL = [
  { label: 'Enrollment', source: 'CMS PECOS', state: 'gated', note: 'Requires an enrollment agreement before we read. Nothing inferred past the gate.' },
  { label: 'State board coverage', source: 'License adapters', state: 'unavailable', chipLabel: '12 / 51 boards', note: 'Boards we cannot read appear as unavailable — never guessed.' },
  { label: 'Board certification', source: 'Issuer integration', state: 'pending', note: 'Integration in progress; the lane shows pending until it lands.' },
  { label: 'Sanctions beyond LEIE', source: 'Out of pilot scope', state: 'unavailable', note: 'Not read in this pilot; the lane says so on every file.' },
];

/* ---- limitation honesty list (DG-8.6) — verbatim, ink, never collapsed ---- */
const PL_LIMITS = [
  'The metric strip above is an internal simulation against public source data — not a customer pilot result.',
  'A readiness snapshot is a head start. Your committee remains the final step, on every file.',
  'Gated sources are not read until an agreement grants access. Nothing is inferred past a gate.',
  'State board coverage is adapter-dependent. Boards we cannot read are shown as unavailable — never guessed.',
  'Sources that disagree are shown side-by-side. We do not average, rank, or hide divergence.',
  'A partial proof stays partial until the source — or a human review — resolves it.',
];

/* ---- proof-pack schematic (DG-8.5) — mono diagram, no fake UI ---- */
const ProofPackSchematic = () => (
  <div className="pp">
    <div className="pp-flow" role="img" aria-label="Proof pack flow: snapshot packet, then SHA-256 hash, then ARTIFACT_EXPORTED audit event">
      <div className="pp-node">
        <span className="pp-node-k">Snapshot packet</span>
        <span className="pp-node-v">rev-2841.tar · 41,208 bytes</span>
        <span className="pp-node-s">12 source reads · 6 lanes · every state preserved, including gated and stale</span>
      </div>
      <div className="pp-link" aria-hidden="true"><span className="lab">hash</span><span className="arr">→</span></div>
      <div className="pp-node">
        <span className="pp-node-k">SHA256</span>
        <span className="pp-node-v">9f2c 41aa 5be1 03d7 … 07d1 c8e4</span>
        <span className="pp-node-s">Computed at export. Re-hash the packet you received; a match means nothing changed in transit.</span>
      </div>
      <div className="pp-link" aria-hidden="true"><span className="lab">record</span><span className="arr">→</span></div>
      <div className="pp-node">
        <span className="pp-node-k">Audit event</span>
        <span className="pp-node-v">ARTIFACT_EXPORTED · evt_9k42</span>
        <span className="pp-node-s">2026-07-11T09:14:02Z · actor: reviewer · scope: rev-2841 · retained with the file</span>
      </div>
    </div>
    <div className="pp-cap"><HonestyLabel>Schematic — hash truncated for display. No product screenshots on this page.</HonestyLabel></div>
  </div>
);

/* ---- pilot request form (DG-8.6 form) ---- */
const PilotForm = () => {
  const [vals, setVals] = React.useState({ org: '', name: '', email: '', baseline: '' });
  const [errors, setErrors] = React.useState({});
  const [done, setDone] = React.useState(null);
  const refs = { org: React.useRef(null), name: React.useRef(null), email: React.useRef(null) };
  const labels = { org: 'Organization', name: 'Contact name', email: 'Work email' };
  const order = ['org', 'name', 'email'];

  const set = (k) => (e) => setVals((v) => ({ ...v, [k]: e.target.value }));
  const validate = () => ({
    org: validateRequired(vals.org, 'Organization'),
    name: validateRequired(vals.name, 'Contact name'),
    email: validateWorkEmail(vals.email),
  });
  const onBlur = (k) => () => setErrors((e) => ({ ...e, ...(() => { const v = validate(); return { [k]: v[k] }; })() }));
  const onSubmit = (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    const bad = order.filter((k) => v[k]);
    if (bad.length) { const el = refs[bad[0]].current; if (el) el.focus(); return; }
    setDone({
      receipt: `PILOT-REQ-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      iso: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
  };

  if (done) return (
    <SuccessCard title="Request recorded." receipt={`${done.receipt} · ${done.iso}`}
      onReset={() => { setDone(null); setVals({ org: '', name: '', email: '', baseline: '' }); setErrors({}); }}>
      <p>Reviewed within two business days. No auto-provisioning — you see a signed scope document before anything is measured.</p>
    </SuccessCard>
  );

  return (
    <form className="fk-form" noValidate onSubmit={onSubmit}>
      <ErrorSummary errors={errors} order={order} labels={labels} refs={refs} />
      <Field id="pl-org" label="Organization" required error={errors.org}>
        <TextInput ref={refs.org} id="pl-org" value={vals.org} onChange={set('org')} onBlur={onBlur('org')}
          autoComplete="organization" placeholder="Coastal Health Partners" error={errors.org} />
      </Field>
      <Field id="pl-name" label="Contact name" required error={errors.name}>
        <TextInput ref={refs.name} id="pl-name" value={vals.name} onChange={set('name')} onBlur={onBlur('name')}
          autoComplete="name" placeholder="Jordan Lee" error={errors.name} />
      </Field>
      <Field id="pl-email" label="Work email" required error={errors.email}
        hint="We reply from a named person, to this address.">
        <TextInput ref={refs.email} id="pl-email" type="email" value={vals.email} onChange={set('email')} onBlur={onBlur('email')}
          autoComplete="email" placeholder="jordan.lee@organization.org" error={errors.email} />
      </Field>
      <Field id="pl-baseline" label="Your current baseline" hint="Optional — a rough baseline is what makes the readout meaningful.">
        <TextArea id="pl-baseline" value={vals.baseline} onChange={set('baseline')}
          placeholder="e.g. Offer-to-first-shift currently runs 45–60 days; the state license check is usually the long pole." />
      </Field>
      <div className="fk-callout">Reviewed within two business days. No auto-provisioning — you see a signed scope document before anything is measured.</div>
      <div><PrimaryButton size="lg" type="submit">Request the pilot</PrimaryButton></div>
    </form>
  );
};

/* ---- page ---- */
const PilotPage = () => (
  <main data-screen-label="/pilot — Employer pilot">
    <div className="s2-container">
      <header className="s2-head">
        <Reveal><span className="vt-eyebrow">Employer pilot</span></Reveal>
        <Reveal delay={60}><h1>Cut credentialing uncertainty <span className="vt-accent-i">before the start date slips.</span></h1></Reveal>
        <Reveal delay={120}><p className="lede">A fixed-scope pilot that measures how much lead time a readiness snapshot removes — with every source shown in its honest state, and every reviewer action on the record.</p></Reveal>
      </header>
    </div>

    <section className="s2-section first" style={{ paddingTop: 0 }}>
      <div className="s2-container">
        <Reveal><div className="pl-metrics">{PL_STATS.map((s, i) => <StatCard key={i} s={s} />)}</div></Reveal>
      </div>
    </section>

    <section className="s2-section">
      <div className="s2-container">
        <SecHead eyebrow="Scope" title="A pilot with edges." lede="Four questions, answered before you sign anything." />
        <Reveal><div className="pl-grid2">
          {PL_SCOPE.map((c, i) => (
            <div className="pl-scope" key={c.t}>
              <span className="idx vt-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{c.t}</h3>
              <p>{c.b}</p>
            </div>
          ))}
        </div></Reveal>
      </div>
    </section>

    <section className="s2-section">
      <div className="s2-container">
        <SecHead eyebrow="Coverage, honestly" title={<React.Fragment>What is live — and what <span className="vt-accent-i">isn&rsquo;t yet.</span></React.Fragment>}
          lede="You should trust the pilot because we show you its edges. Both columns appear on every file, in the product, exactly like this." />
        <Reveal><div className="hn-pair">
          <HonestyPanel tone="ok" title="What is live now" items={PL_LIVE}
            foot="Live = reading production sources today, on every intake." />
          <HonestyPanel tone="watch" title="What remains partial or pending" items={PL_PARTIAL}
            foot="Partial lanes appear in their honest state — never as a bare checkmark." />
        </div></Reveal>
      </div>
    </section>

    <section className="s2-section">
      <div className="s2-container">
        <SecHead eyebrow="Proof pack" title="What you can hand your committee." lede="Every accepted file exports as a packet you can independently re-hash. The export itself becomes part of the record." />
        <Reveal><ProofPackSchematic /></Reveal>
      </div>
    </section>

    <section className="s2-section">
      <div className="s2-container">
        <SecHead eyebrow="Limitations" title="Read this before you request the pilot." lede="These lines are permanent fixtures of the page. They do not collapse." />
        <Reveal as="ul" className="pl-limits">
          {PL_LIMITS.map((l) => <li key={l.slice(0, 24)}>{l}</li>)}
        </Reveal>
      </div>
    </section>

    <section className="s2-section" id="pilot-form">
      <div className="s2-container">
        <div className="pl-form-grid">
          <SecHead eyebrow="Request" title="Start the conversation." lede="Three fields and an optional baseline. A person reads this queue — replies are written, not automated." />
          <Reveal className="pl-form-card"><PilotForm /></Reveal>
        </div>
      </div>
    </section>
  </main>
);

Object.assign(window, { PilotPage });
