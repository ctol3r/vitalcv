// Wave 1501 · hp-hero.jsx — nav, hero (DG-7.1/7.2), wallet mock (DG-7.3/7.4).

/* NPI checksum — Luhn over '80840' + 10 digits (CMS card-issuer prefix). */
const npiChecksumOk = (d) => {
  if (d.length !== 10) return false;
  const s = '80840' + d;
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = +s[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

/* Segmented 10-digit NPI field (DG-7.2) — one real input, ten rendered cells. */
const NpiSegmented = () => {
  const [digits, setDigits] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const complete = digits.length === 10;
  const valid = complete && npiChecksumOk(digits);
  const error = complete && !valid;
  const activeIdx = focused && !complete ? digits.length : -1;
  return (
    <div style={{ maxWidth: 520 }}>
      <div
        className={`npi-cells${error ? ' error' : ''}`}
        onClick={() => inputRef.current && inputRef.current.focus()}>
        <input
          ref={inputRef} className="npi-real" value={digits}
          inputMode="numeric" pattern="[0-9]*" autoComplete="off"
          aria-label="National Provider Identifier, 10 digits"
          aria-invalid={error}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))} />
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} aria-hidden="true"
            className={`npi-cell${digits[i] ? ' filled' : ''}${i === activeIdx ? ' active' : ''}`}>
            {digits[i] || ''}
          </span>
        ))}
      </div>
      <div className="npi-meta">
        <span className={`npi-count${complete && valid ? ' done' : ''}`} aria-live="polite">
          {digits.length}/10{valid ? ' · format OK' : ''}
        </span>
        <span className="npi-micro">No account required · public sources only</span>
        <span style={{ flex: 1 }}></span>
        <PrimaryButton disabled={!valid} onClick={(e) => e.preventDefault()}>Check readiness</PrimaryButton>
      </div>
      {error ? (
        <div className="npi-err" role="alert">
          <span style={{ flexShrink: 0, marginTop: 1 }}><TrustGlyph state="p0" size={12} /></span>
          <span>CHECKSUM FAILED — these ten digits don't validate as an NPI. Check for a typo.</span>
        </div>
      ) : null}
    </div>
  );
};

/* Wallet mock (DG-7.3) — the same SourceRow / ReadinessRing / StateChip the product uses. */
const WalletMock = () => {
  const reduced = useReducedMotion();
  const [ring, setRing] = React.useState(reduced ? 72 : 0);
  React.useEffect(() => {
    if (reduced) { setRing(72); return; }
    const t = setTimeout(() => setRing(72), 260); /* ring sweeps once */
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <div>
      <PaperCard style={{ padding: 0, overflow: 'hidden' }} data-screen-label="Wallet mock">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid var(--vt-rule)', background: 'var(--vt-surface-sunken)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--vt-text-secondary)' }}>Readiness snapshot</span>
          <StateChip state="previewOnly" size="sm" />
        </div>
        <div style={{ padding: '18px 20px 8px', display: 'flex', gap: 18, alignItems: 'center' }}>
          <ReadinessRing value={ring} size={88} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Dr. A. Okafor, MD</span>
            <span className="vt-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--vt-text-muted)', letterSpacing: '0.06em' }}>NPI 1234 5678 93 · Family Medicine</span>
            <FreshnessStamp rel="Checked 2h ago" iso="2026-07-11T12:04:00Z" />
          </div>
        </div>
        <div style={{ padding: '4px 20px 16px' }}>
          <SourceRow label="Identity" source="NPPES" state="checked" chipLabel="Source-backed"
            freshness="2h ago" iso="2026-07-11T12:04:00Z" />
          <SourceRow label="Exclusions" source="OIG LEIE" state="checked"
            freshness="2h ago" iso="2026-07-11T12:04:00Z" />
          <SourceRow label="Enrollment" source="CMS PECOS" state="gated" />
          <div style={{ paddingTop: 14 }}>
            <HonestyLabel>Anonymous preview · not an owned snapshot</HonestyLabel>
          </div>
        </div>
      </PaperCard>
      {/* Reads primary sources — honest states, gated never gets a checkmark (DG-7.4) */}
      <div className="src-reads">
        <span className="vt-eyebrow" style={{ fontSize: 9 }}>Reads primary sources</span>
        <StateChip state="checked" size="sm" label="NPPES" source="NPPES · identity" />
        <StateChip state="checked" size="sm" label="OIG LEIE" source="OIG LEIE · exclusions" />
        <StateChip state="gated" size="sm" label="CMS PECOS" source="CMS PECOS · requires enrollment agreement" />
        <StateChip state="pending" size="sm" label="State boards · adapter-dependent"
          source="Coverage varies by state adapter — not checked here" />
      </div>
    </div>
  );
};

const HpNav = () => (
  <header className="hp-nav">
    <div className="hp-container hp-nav-inner">
      <a className="hp-brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }); }}>VitalCV</a>
      <nav className="hp-nav-links" aria-label="Primary">
        <a className="hp-nav-hide" href="#how" onClick={(e) => { e.preventDefault(); scrollToId('how'); }}>How it works</a>
        <a className="hp-nav-hide" href="#roles" onClick={(e) => { e.preventDefault(); scrollToId('roles'); }}>For your role</a>
        <a className="hp-nav-hide" href="/signin" onClick={(e) => e.preventDefault()}>Sign in</a>
        <SecondaryButton size="sm" onClick={() => scrollToId('npi')}>Check readiness</SecondaryButton>
      </nav>
    </div>
  </header>
);

const HeroSection = () => (
  <section className="hp-hero" id="top" data-screen-label="Hero">
    <div className="hp-container hp-hero-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Reveal><span className="vt-eyebrow">The Provider Career Evidence Network</span></Reveal>
        <Reveal delay={60}>
          <h1>Find the opportunity. Prove your career once. <span className="vt-accent-i">Start faster.</span></h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="lede">
            Enter your NPI and VitalCV reads primary sources into a readiness snapshot you own —
            every source shown in its honest state. Employers accept it as a head start;
            their committees still decide.
          </p>
        </Reveal>
        <Reveal delay={180} id="npi" style={{ scrollMarginTop: 84 }}>
          <NpiSegmented />
        </Reveal>
      </div>
      <Reveal delay={160}>
        <WalletMock />
      </Reveal>
    </div>
  </section>
);

Object.assign(window, { HpNav, HeroSection, NpiSegmented, WalletMock, npiChecksumOk });
