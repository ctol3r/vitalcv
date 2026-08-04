// Wave 1503 · w1503-getready.jsx — /get-ready workspace gate (DG-10.1).
// Two designed states: signed-out pitch (server-renderable) and the
// checking gate (wordmark + paper skeleton + mono status). The gate must
// look intentional for the 1–2 seconds it exists — never bare text.

const GR_VALUES = [
  { idx: '01', verb: 'Carry', title: 'One wallet for your proof',
    body: 'Identity, exclusions, enrollment, licensure — read from primary sources into lanes you own.' },
  { idx: '02', verb: 'Present', title: 'A head start, honestly framed',
    body: 'Employers accept your packet as a head start. Gated stays gated; nothing is dressed up as a yes.' },
  { idx: '03', verb: 'Share', title: 'You choose what travels',
    body: 'Share a packet per opportunity. Withhold any section. Withdraw the link whenever you like.' },
  { idx: '04', verb: 'Keep', title: 'Recognitions stay with you',
    body: 'When an employer accepts your packet, that acceptance is kept on your record — employer to employer.' },
];

/* Checking gate — skeleton mirrors the passport it is about to draw. */
const CheckingGate = () => (
  <div className="gr-gate" role="status" aria-busy="true" aria-live="polite" data-screen-label="Get ready — checking gate">
    <span className="gr-gate-mark">VitalCV</span>
    <div className="gr-sk-card" aria-hidden="true">
      <div className="gr-sk-head">
        <span className="sk sk-circle"></span>
        <div className="gr-sk-id">
          <span className="sk sk-bar" style={{ width: '46%', height: 14 }}></span>
          <span className="sk sk-bar" style={{ width: '68%', height: 10 }}></span>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div className="gr-sk-row" key={i}>
          <span className="sk sk-bar" style={{ width: ['34%', '42%', '30%'][i] }}></span>
          <span className="sk sk-chip"></span>
        </div>
      ))}
    </div>
    <p className="gr-gate-status">
      Checking your workspace<span className="dot">·</span>NPI session
      <span className="dot">·</span>usually under two seconds
    </p>
  </div>
);

const GetReadyView = () => {
  const [mode, setMode] = React.useState('pitch'); // pitch | gate-auto | gate-hold
  React.useEffect(() => {
    if (mode !== 'gate-auto') return;
    const t = setTimeout(() => { window.location.hash = '#/onboarding'; }, 1700);
    return () => clearTimeout(t);
  }, [mode]);

  return (
    <React.Fragment>
      <DemoStrip label="/get-ready · two designed states">
        <DemoBtn on={mode === 'pitch'} onClick={() => setMode('pitch')}>Signed-out pitch</DemoBtn>
        <DemoBtn on={mode === 'gate-hold'} onClick={() => setMode(mode === 'gate-hold' ? 'pitch' : 'gate-hold')}>Checking state (hold)</DemoBtn>
      </DemoStrip>

      {mode === 'pitch' ? (
        <main data-screen-label="Get ready — signed-out pitch">
          <div className="s3-container">
            <header className="s3-head">
              <Reveal><span className="vt-eyebrow">VitalCV for clinicians</span></Reveal>
              <Reveal delay={60}>
                <h1>Your free, source-backed <span className="vt-accent-i">career wallet.</span></h1>
              </Reveal>
              <Reveal delay={120}>
                <p className="lede">
                  Enter your NPI once. VitalCV reads primary sources into a passport you carry —
                  every lane shown in its honest state, shared only on your terms.
                </p>
              </Reveal>
              <Reveal delay={180}>
                <div className="gr-cta-row">
                  <PrimaryButton size="lg" onClick={() => setMode('gate-auto')}>Connect your NPI</PrimaryButton>
                  <SecondaryButton size="lg" onClick={() => { window.location.hash = '#/passport'; }}>See a sample passport</SecondaryButton>
                </div>
                <p className="gr-micro">
                  Free for clinicians<span className="dot">·</span>no card
                  <span className="dot">·</span>no document uploads to start
                </p>
              </Reveal>
            </header>

            <section className="s3-section" style={{ paddingTop: 0 }}>
              <div className="gr-cards">
                {GR_VALUES.map((v, i) => (
                  <Reveal key={v.idx} delay={i * 60}>
                    <div className="gr-card" style={{ height: '100%', boxSizing: 'border-box' }}>
                      <span className="idx">{v.idx}</span>
                      <span className="verb">{v.verb}</span>
                      <h3>{v.title}</h3>
                      <p>{v.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          </div>
          <FunnelFooter tight />
        </main>
      ) : (
        <main>
          <CheckingGate />
        </main>
      )}
    </React.Fragment>
  );
};

Object.assign(window, { GetReadyView, CheckingGate });
