// Wave 1502 · w1502-request.jsx — /review/request public employer intake (DG-8.3).
// Two columns: form kit left, "what happens next" timeline right; form first on mobile.

const RQ_STEPS = [
  { key: 'SUBMIT', title: 'Request recorded', meta: 'audit: REVIEW_REQUESTED',
    body: 'The NPI is validated and a file is assembled from public sources — every lane in its honest state, gated lanes left gated.' },
  { key: 'FIRST_VIEW', title: 'Your reviewer opens the file', meta: 'audit: REVIEW_OPENED',
    body: 'Blockers are sorted first. Freshness stamps show when each source was last read.' },
  { key: 'FIRST_ACTION', title: 'Accept, refresh, or route', meta: 'audit: REVIEW_ACCEPTED / REFRESH_REQUESTED / ROUTED_TO_COMMITTEE',
    body: 'Each action takes one confirmation and records an audit event. Nothing happens off the record.' },
  { key: 'START_READY', title: 'Head start delivered', meta: 'boundary: not a credentialing decision',
    body: 'Your committee proceeds with a file that is days further along. Committees remain the final step.' },
];

const RequestForm = () => {
  const [vals, setVals] = React.useState({ npi: '', org: '', email: '' });
  const [errors, setErrors] = React.useState({});
  const [done, setDone] = React.useState(null);
  const refs = { npi: React.useRef(null), org: React.useRef(null), email: React.useRef(null) };
  const labels = { npi: 'Clinician NPI', org: 'Organization', email: 'Work email' };
  const order = ['npi', 'org', 'email'];

  const validate = () => ({
    npi: !vals.npi ? 'Clinician NPI is required.'
      : vals.npi.length !== 10 ? `NPI needs 10 digits — ${vals.npi.length}/10 entered.`
      : !npiOk(vals.npi) ? 'Checksum failed — check for a typo.' : null,
    org: validateRequired(vals.org, 'Organization'),
    email: validateWorkEmail(vals.email),
  });
  const onBlur = (k) => () => setErrors((e) => ({ ...e, [k]: validate()[k] }));
  const onSubmit = (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    const bad = order.filter((k) => v[k]);
    if (bad.length) {
      const el = bad[0] === 'npi' ? document.getElementById('rq-npi') : refs[bad[0]].current;
      if (el) el.focus(); return;
    }
    setDone({
      receipt: `REV-REQ-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      iso: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      email: vals.email.trim(),
    });
  };

  if (done) return (
    <SuccessCard title="Review requested." receipt={`${done.receipt} · ${done.iso}`}
      onReset={() => { setDone(null); setVals({ npi: '', org: '', email: '' }); setErrors({}); }}
      resetLabel="Request another review">
      <p>The reviewer link goes to <strong>{done.email}</strong>. From here the file follows the four steps at right — timing targets come from internal simulation, not committed delivery.</p>
    </SuccessCard>
  );

  return (
    <form className="fk-form" noValidate onSubmit={onSubmit}>
      <ErrorSummary errors={errors} order={order} labels={labels}
        refs={{ ...refs, npi: { current: document.getElementById('rq-npi') } }} />
      <Field id="rq-npi" label="Clinician NPI" required>
        <NpiField id="rq-npi" value={vals.npi}
          onChange={(npi) => { setVals((v) => ({ ...v, npi })); setErrors((e) => ({ ...e, npi: null })); }}
          extError={errors.npi && vals.npi.length !== 10 ? errors.npi : null} />
      </Field>
      <Field id="rq-org" label="Organization" required error={errors.org}>
        <TextInput ref={refs.org} id="rq-org" value={vals.org} onChange={(e) => setVals((v) => ({ ...v, org: e.target.value }))}
          onBlur={onBlur('org')} autoComplete="organization" placeholder="Coastal Health Partners" error={errors.org} />
      </Field>
      <Field id="rq-email" label="Work email" required error={errors.email}
        hint="The reviewer link is sent here. Nothing is provisioned automatically.">
        <TextInput ref={refs.email} id="rq-email" type="email" value={vals.email} onChange={(e) => setVals((v) => ({ ...v, email: e.target.value }))}
          onBlur={onBlur('email')} autoComplete="email" placeholder="jordan.lee@organization.org" error={errors.email} />
      </Field>
      <div className="fk-callout">We read public sources only. The clinician is notified, and gated lanes stay gated until they grant access.</div>
      <div><PrimaryButton size="lg" type="submit">Request the review</PrimaryButton></div>
    </form>
  );
};

const RequestPage = () => (
  <main data-screen-label="/review/request — Employer review intake">
    <div className="s2-container">
      <header className="s2-head">
        <Reveal><span className="vt-eyebrow">Public review intake</span></Reveal>
        <Reveal delay={60}><h1>Request a review of <span className="vt-accent-i">one clinician.</span></h1></Reveal>
        <Reveal delay={120}><p className="lede">Enter the NPI and where to send the reviewer link. No account, no integration — and nothing read beyond public sources until access is granted.</p></Reveal>
      </header>
      <div className="rq-grid" style={{ paddingBottom: 'var(--space-16)' }}>
        <Reveal className="rq-form-card"><RequestForm /></Reveal>
        <Reveal delay={80}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <span className="vt-eyebrow">What happens next</span>
            <StepTimeline steps={RQ_STEPS} />
            <HonestyLabel>Step timing is a target from internal simulation — not committed delivery.</HonestyLabel>
          </div>
        </Reveal>
      </div>
    </div>
  </main>
);

Object.assign(window, { RequestPage });
