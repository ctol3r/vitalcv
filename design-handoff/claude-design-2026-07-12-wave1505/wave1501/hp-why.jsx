// Wave 1501 · hp-why.jsx — Why this compounds (DG-7.6): three paper cards + CanonicalPath strip.

const WHY_CARDS = [
  {
    key: 'recognition', dot: 'recognition', eyebrow: 'Recognition',
    t: 'Recognition you keep',
    b: 'Every clean read from a primary source becomes recognition attached to your record — not to one employer\u2019s filing cabinet.',
  },
  {
    key: 'acceptance', dot: 'acceptance', eyebrow: 'Acceptance',
    t: 'Acceptance that spreads',
    b: 'Each organization that accepts your snapshot as a head start makes the next acceptance easier. Org by org — never all at once.',
  },
  {
    key: 'start', dot: 'start', eyebrow: 'Start',
    t: 'Starts that arrive sooner',
    b: 'As re-collection drops out of the path, the distance from signed offer to first shift shrinks.',
  },
];

const WhySection = () => (
  <section className="hp-section" id="why" data-screen-label="Why this compounds">
    <div className="hp-container">
      <SecHead
        eyebrow="Why this compounds"
        title={<React.Fragment>Proof, made <span className="vt-accent-i">portable.</span></React.Fragment>}
        lede="A career is a sequence of checks passed. VitalCV keeps each one, so the sequence adds up instead of starting over."
      />
      <div className="why-grid">
        {WHY_CARDS.map((c, i) => (
          <Reveal key={c.key} delay={i * 60}>
            <PaperCard lift style={{ height: '100%', boxSizing: 'border-box' }} className="why-card">
              <span className="cpath-label" style={{ fontSize: 10, letterSpacing: '0.2em',
                color: c.key === 'recognition' ? 'var(--vt-brand)' : 'var(--vt-text-faint)' }}>
                <span className={`cpath-dot ${c.dot}`}></span>{c.eyebrow.toUpperCase()}
              </span>
              <h3>{c.t}</h3>
              <p>{c.b}</p>
            </PaperCard>
          </Reveal>
        ))}
      </div>
      <Reveal delay={180}>
        <CanonicalPath />
      </Reveal>
    </div>
  </section>
);

Object.assign(window, { WhySection });
