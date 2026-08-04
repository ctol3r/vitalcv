// Wave 1503 · w1503-onboarding.jsx — /onboarding NPI ingestion (DG-10.2).
// The loading sequence IS the product demo: lanes appear one at a time,
// pending → checked/gated/unavailable, then the ring sweeps once.
// Reduced motion collapses the staged reveal to instant static rows.

const OB_LANES = [
  { id: 'nppes', label: 'NPPES identity', source: 'NPPES', result: 'checked', tier: 'T2',
    freshness: 'just now', iso: '2026-07-11T14:01:12Z',
    note: 'Name, taxonomy and practice location read from the registry record.' },
  { id: 'oig', label: 'Exclusion list', source: 'OIG LEIE', result: 'checked', tier: 'T2',
    freshness: 'just now', iso: '2026-07-11T14:01:14Z',
    failResult: 'unavailable',
    failNote: 'OIG LEIE did not respond. Shown as unavailable — never assumed clear.' },
  { id: 'pecos', label: 'Medicare enrollment', source: 'CMS PECOS', result: 'gated', action: 'Authorize read',
    note: 'Reads only after your enrollment agreement — gated until then.' },
  { id: 'board', label: 'State board license', source: 'STATE MEDICAL BOARDS', result: 'gated', action: 'Connect board',
    note: 'Adapter-dependent by state. Gated until your board lane is connected — shown honestly, not guessed.' },
];

/* Own the flow control here; cells + checksum come from 1501 (DG-7.2). */
const ObNpiEntry = ({ onRun }) => {
  const [digits, setDigits] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const complete = digits.length === 10;
  const valid = complete && npiChecksumOk(digits);
  const error = complete && !valid;
  const activeIdx = focused && !complete ? digits.length : -1;
  return (
    <div>
      <span className="vt-eyebrow" style={{ display: 'block', marginBottom: 12 }}>Step 1 · your NPI</span>
      <div className={`npi-cells${error ? ' error' : ''}`} onClick={() => inputRef.current && inputRef.current.focus()}>
        <input ref={inputRef} className="npi-real" value={digits}
          inputMode="numeric" pattern="[0-9]*" autoComplete="off"
          aria-label="National Provider Identifier, 10 digits"
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} aria-hidden="true"
            className={`npi-cell${digits[i] ? ' filled' : ''}${i === activeIdx ? ' active' : ''}`}>
            {digits[i] || ''}
          </span>
        ))}
      </div>
      <div className="npi-meta">
        <span className={`npi-count${valid ? ' done' : ''}`} aria-live="polite">{digits.length}/10{valid ? ' · format OK' : ''}</span>
        <span className="npi-micro">Public sources only · no card · no uploads</span>
      </div>
      {error ? (
        <div className="npi-err" role="alert">
          <span style={{ flexShrink: 0, marginTop: 1 }}><TrustGlyph state="p0" size={12} /></span>
          <span>CHECKSUM FAILED — these ten digits don't validate as an NPI. Check for a typo.</span>
        </div>
      ) : null}
      <div className="ob-cta" style={{ marginTop: 'var(--space-5)' }}>
        <PrimaryButton size="lg" disabled={!valid} onClick={() => onRun(digits)}>Run source check</PrimaryButton>
        <QuietButton onClick={() => { setDigits(FUNNEL_PERSONA.npiRaw); setTimeout(() => inputRef.current && inputRef.current.focus(), 0); }}>
          Use the demo NPI
        </QuietButton>
      </div>
    </div>
  );
};

const OnboardingView = () => {
  const reduced = useReducedMotion();
  const [phase, setPhase] = React.useState('entry');      // entry | run
  const [outage, setOutage] = React.useState(false);       // fail-closed demo
  const [shown, setShown] = React.useState(0);             // lanes revealed
  const [resolved, setResolved] = React.useState({});      // id -> true
  const [ringVal, setRingVal] = React.useState(0);
  const [finale, setFinale] = React.useState(false);
  const timers = React.useRef([]);
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  React.useEffect(() => clearAll, []);

  const lanes = OB_LANES.map((l) => ({
    ...l,
    state: outage && l.failResult ? l.failResult : l.result,
    note: outage && l.failNote ? l.failNote : l.note,
    tier: outage && l.failResult ? undefined : l.tier,
    action: outage && l.failResult ? 'Retry read' : l.action,
  }));
  const score = outage ? 44 : 58;
  const band = bandFor3(score);
  const checkedN = lanes.filter((l) => l.state === 'checked').length;

  const start = () => {
    clearAll();
    setPhase('run');
    if (reduced) { setShown(OB_LANES.length); setResolved({ nppes: 1, oig: 1, pecos: 1, board: 1 }); setRingVal(score); setFinale(true); return; }
    setShown(0); setResolved({}); setRingVal(0); setFinale(false);
    OB_LANES.forEach((l, i) => {
      timers.current.push(setTimeout(() => setShown(i + 1), 260 + i * 420));
      timers.current.push(setTimeout(() => setResolved((r) => ({ ...r, [l.id]: true })), 260 + i * 420 + 680));
    });
    const tEnd = 260 + (OB_LANES.length - 1) * 420 + 680;
    timers.current.push(setTimeout(() => { setFinale(true); setRingVal(0); }, tEnd + 380));
    timers.current.push(setTimeout(() => setRingVal(score), tEnd + 520));
  };
  const reset = () => { clearAll(); setPhase('entry'); setShown(0); setResolved({}); setRingVal(0); setFinale(false); };

  /* outage toggled mid/post-run: keep resolved states, values re-derive */
  React.useEffect(() => { if (finale) setRingVal(score); }, [outage]); // eslint-disable-line

  return (
    <React.Fragment>
      <DemoStrip label="/onboarding · staged reveal">
        <DemoBtn on={phase === 'entry'} onClick={reset}>Restart</DemoBtn>
        <DemoBtn onClick={start}>{phase === 'entry' ? 'Skip entry · run' : 'Replay run'}</DemoBtn>
        <DemoBtn on={outage} onClick={() => setOutage(!outage)}>Fail-closed: OIG outage</DemoBtn>
      </DemoStrip>

      <main data-screen-label="Onboarding — NPI ingestion">
        <div className="s3-container">
          <header className="s3-head" style={{ paddingBottom: 'var(--space-8)' }}>
            <Reveal><span className="vt-eyebrow">VitalCV for clinicians · onboarding</span></Reveal>
            <Reveal delay={60}><h1>Watch your sources <span className="vt-accent-i">get read.</span></h1></Reveal>
            <Reveal delay={120}>
              <p className="lede">
                Ten digits, then VitalCV reads each primary source in front of you.
                Every lane lands in its honest state — a checkmark only when a source was actually read.
              </p>
            </Reveal>
          </header>

          <section className="ob-grid" style={{ paddingBottom: 'var(--space-16)' }}>
            <Reveal className="ob-card" aria-live="polite">
              {phase === 'entry' ? <ObNpiEntry onRun={start} /> : (
                <div>
                  <div className="ob-run-head">
                    <span className="ob-run-title">Reading primary sources</span>
                    <span className="ob-run-meta vt-num">NPI {FUNNEL_PERSONA.npi}</span>
                  </div>
                  <div className="ob-lanes">
                    {lanes.slice(0, shown).map((l) => (
                      <div className="s3-enter" key={l.id}>
                        <EvidenceRow
                          label={l.label} source={l.source}
                          state={resolved[l.id] ? l.state : 'pending'}
                          tier={resolved[l.id] ? l.tier : undefined}
                          freshness={resolved[l.id] ? l.freshness : undefined} iso={l.iso}
                          note={resolved[l.id] ? l.note : undefined}
                          action={resolved[l.id] ? l.action : undefined} />
                      </div>
                    ))}
                  </div>
                  {finale ? (
                    <div className="ob-finale s3-enter">
                      <ReadinessRing value={ringVal} size={104} />
                      <div className="ob-finale-body">
                        <span className="ob-band">{band.label}</span>
                        <span className="ob-count">
                          {checkedN} of {lanes.length} lanes source-backed{outage ? ' · 1 unavailable' : ''} · gated lanes
                          open after you authorize — never before.
                        </span>
                        <div className="ob-cta">
                          <PrimaryButton size="lg" onClick={() => { window.location.hash = '#/passport'; }}>Open your passport</PrimaryButton>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Reveal>

            <Reveal delay={100} className="ob-aside">
              <h2>The check runs in the open.</h2>
              <p>
                No spinner hiding the work. Each lane appears as its source is read, and the state
                you see is the state an employer will see. A typical run finishes in under a minute.
              </p>
              <ul className="ob-honest">
                <li><TrustGlyph state="checked" size={15} /><span>A checkmark appears only after a source is actually read.<span className="m"> Never on hope.</span></span></li>
                <li><TrustGlyph state="gated" size={15} /><span>Gated lanes say gated.<span className="m"> Authorization opens them — optimism doesn't.</span></span></li>
                <li><TrustGlyph state="unavailable" size={15} /><span>A source that doesn't respond reads unavailable.<span className="m"> Fail closed, retry visible.</span></span></li>
              </ul>
            </Reveal>
          </section>
        </div>
        <FunnelFooter tight />
      </main>
    </React.Fragment>
  );
};

Object.assign(window, { OnboardingView, OB_LANES });
