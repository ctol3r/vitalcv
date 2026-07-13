// Wave 1505 · w1505-contact.jsx — /contact with form-kit form,
// expectation copy, designed success state (DG-12.4.1).

const CONTACT_TOPICS = [
  'Employer pilot inquiry',
  'Review request',
  'Data correction',
  'Security disclosure',
  'Press',
  'Something else',
];

const ContactRoute = () => {
  const [v, setV] = React.useState({ name: '', email: '', org: '', topic: '', msg: '' });
  const [errors, setErrors] = React.useState({});
  const [sent, setSent] = React.useState(false);
  const refs = {
    name: React.useRef(null), email: React.useRef(null),
    topic: React.useRef(null), msg: React.useRef(null),
  };
  const labels = { name: 'Your name', email: 'Work email', topic: 'Topic', msg: 'Message' };
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    errs.name = validateRequired(v.name, 'Your name');
    errs.email = validateWorkEmail(v.email);
    errs.topic = v.topic ? null : 'Choose a topic so it reaches the right person.';
    errs.msg = validateRequired(v.msg, 'Message');
    Object.keys(errs).forEach((k) => { if (!errs[k]) delete errs[k]; });
    setErrors(errs);
    if (!Object.keys(errs).length) setSent(true);
  };
  return (
    <S5Page eyebrow="DG-12.4.1 · Contact" title={<span>A person reads <span className="vt-accent-i">every</span> message.</span>}
      lede="No chatbot, no ticket deflection. Say what you need; we route it to whoever can actually decide."
      label="Contact">
      <S5Section first>
        <div className="ct-grid">
          <div style={{ maxWidth: 560 }}>
            {!sent ? (
              <form className="fk-form" onSubmit={submit} noValidate>
                <ErrorSummary errors={errors} order={['name', 'email', 'topic', 'msg']} labels={labels} refs={refs} />
                <Field id="ct-name" label="Your name" required error={errors.name}>
                  <TextInput ref={refs.name} id="ct-name" autoComplete="name" value={v.name} onChange={set('name')} error={errors.name} />
                </Field>
                <Field id="ct-email" label="Work email" required error={errors.email}
                  hint="Personal email is fine for clinician topics.">
                  <TextInput ref={refs.email} id="ct-email" type="email" autoComplete="email"
                    placeholder="you@organization.org" value={v.email} onChange={set('email')} error={errors.email} />
                </Field>
                <Field id="ct-org" label="Organization" hint="Optional.">
                  <TextInput id="ct-org" autoComplete="organization" value={v.org} onChange={set('org')} />
                </Field>
                <Field id="ct-topic" label="Topic" required error={errors.topic}>
                  <select ref={refs.topic} id="ct-topic" className={`fk-input${errors.topic ? ' err' : ''}`}
                    aria-invalid={!!errors.topic} aria-describedby={errors.topic ? 'ct-topic-err' : undefined}
                    value={v.topic} onChange={set('topic')}>
                    <option value="">Choose one</option>
                    {CONTACT_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field id="ct-msg" label="Message" required error={errors.msg}
                  hint="Please don't include patient information — this form isn't for PHI, and we'd have to delete it.">
                  <TextArea ref={refs.msg} id="ct-msg" rows={6} value={v.msg} onChange={set('msg')} error={errors.msg} />
                </Field>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <PrimaryButton size="lg" type="submit">Send message</PrimaryButton>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em', color: 'var(--vt-text-muted)' }}>
                    Reviewed within two business days
                  </span>
                </div>
              </form>
            ) : (
              <SuccessCard title="Message recorded." receipt="msg_2026-07-12_84c2 · keep this reference"
                onReset={() => { setSent(false); setV({ name: '', email: '', org: '', topic: '', msg: '' }); }}
                resetLabel="Send another message">
                <p>It's in front of a person, not a queue-bot. You'll hear back at
                  {' '}<strong style={{ fontWeight: 600 }}>{v.email || 'your email'}</strong> within two business days —
                  security disclosures are triaged the same day.</p>
              </SuccessCard>
            )}
          </div>
          <aside className="ct-aside" aria-label="What to expect">
            <div className="ct-expect">
              <span className="vt-eyebrow">What to expect</span>
              <div className="row"><TrustGlyph state="reviewRequired" size={14} />
                <p><strong>Reviewed within two business days.</strong> Every message, by a person with authority to act on it.</p></div>
              <div className="row"><TrustGlyph state="stale" size={14} />
                <p><strong>Security disclosures</strong> are triaged same-day. Use the topic above and include the run reference if you have one.</p></div>
              <div className="row"><TrustGlyph state="notDecisionGrade" size={14} />
                <p><strong>Data corrections</strong> usually belong at the source. We'll tell you which registry to correct and re-read it once you have.</p></div>
            </div>
            <div className="ct-expect">
              <span className="vt-eyebrow">Prefer email</span>
              <div className="row"><TrustGlyph state="previewOnly" size={14} />
                <p><span className="vt-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>hello@vitalcv.com</span><br />
                Same inbox, same two-day promise.</p></div>
            </div>
          </aside>
        </div>
      </S5Section>
    </S5Page>
  );
};

Object.assign(window, { ContactRoute, CONTACT_TOPICS });
