// Wave 1501 · hp-how.jsx — How it works, steps 1–5 (DG-7.5).
// Fraunces numerals punched into a hairline connecting rule; ≤60ms stagger.

const HOW_STEPS = [
  { n: '1', t: 'Enter your NPI', b: 'Ten digits, no account. The check runs against public primary sources.' },
  { n: '2', t: 'Sources are read', b: 'NPPES and OIG LEIE read directly. Gated sources say so — no checkmark until a source is actually read.' },
  { n: '3', t: 'Claim your snapshot', b: 'One claim makes the readiness picture yours — to keep, refresh, and carry between roles.' },
  { n: '4', t: 'Share a scoped view', b: 'Grant a verifier exactly the fields they need, each with its source, freshness, and state.' },
  { n: '5', t: 'Start sooner', b: 'Employers accept the snapshot as a head start. Credentialing committees still make the decision.' },
];

const HowSection = () => (
  <section className="hp-section" id="how" data-screen-label="How it works">
    <div className="hp-container">
      <SecHead
        eyebrow="How it works"
        title={<React.Fragment>Five steps, <span className="vt-accent-i">nothing hidden.</span></React.Fragment>}
        lede="The same honest states you see on this page are the ones verifiers see. That is the point."
      />
      <div className="how-grid">
        {HOW_STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 60} className="how-step">
            <span className="how-num" aria-hidden="true">{s.n}</span>
            <h3>{s.t}</h3>
            <p>{s.b}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

Object.assign(window, { HowSection });
