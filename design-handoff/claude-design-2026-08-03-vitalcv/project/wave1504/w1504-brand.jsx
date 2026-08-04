// Wave 1504 · w1504-brand.jsx — /brand · Brand asset suite (DG-4.3–4.6)
// Wordmark lockup rules, OG image set, favicon suite, source-name treatment.

const OG_SET = [
  { file: 'og-default.html',  name: 'Default',        use: 'any page without a specific card' },
  { file: 'og-homepage.html', name: 'Homepage',       use: 'vitalcv.com' },
  { file: 'og-pilot.html',    name: 'Pilot',          use: 'vitalcv.com/pilot' },
  { file: 'og-trust.html',    name: 'Trust register', use: 'vitalcv.com/trust' },
  { file: 'og-profile.html',  name: 'Profile template', use: '/p/[slug] \u00b7 name slot, no baked numbers' },
];

/* scaled 1200×630 iframe preview */
const OgFrame = ({ file, name, use }) => {
  const ref = React.useRef(null);
  const [scale, setScale] = React.useState(0.3);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1200));
    ro.observe(el);
    setScale(el.clientWidth / 1200);
    return () => ro.disconnect();
  }, []);
  return (
    <figure style={{ margin: 0 }}>
      <div className="og-frame" ref={ref}>
        <iframe src={'brand/' + file} title={`OG image — ${name}`} loading="lazy"
          style={{ transform: `scale(${scale})` }} tabIndex={-1} />
      </div>
      <figcaption className="br-caption">
        <span>{name}</span>
        <span className="vt-num">1200 × 630 · {use}</span>
      </figcaption>
    </figure>
  );
};

const FAVS = [
  { f: 'favicon-16.png', s: 16 }, { f: 'favicon-32.png', s: 32 }, { f: 'favicon-48.png', s: 48 },
  { f: 'apple-touch-180.png', s: 180, show: 64 }, { f: 'icon-192.png', s: 192, show: 64 },
  { f: 'icon-512.png', s: 512, show: 64 }, { f: 'icon-maskable-512.png', s: 512, show: 64, mask: true },
];

const BrandPage = () => (
  <div data-screen-label="Brand Assets">
    <header className="s4-doctrine">
      <div className="s4-container">
        <span className="vt-eyebrow">internal · brand asset suite</span>
        <h1>Brand Assets</h1>
        <div className="sub vt-num">
          <span>DG-4.3 wordmark</span>
          <span>DG-4.4 OG set</span>
          <span>DG-4.5 icon suite</span>
          <span>DG-4.6 source-name rule</span>
        </div>
      </div>
    </header>

    <S4Section first eyebrow="§ 1 · Wordmark" title="One lockup, two inks"
      lede="The name renders through the Logo component only — Fraunces 600, fixed mark, fixed spacing. No other renderings are permitted.">
      <div className="br-grid2">
        <div>
          <div className="br-stage"><VtLogo size={44} /></div>
          <p className="br-caption"><span>ink-on-paper · default</span><span>variant="ink"</span></p>
        </div>
        <div>
          <div className="br-stage inverse"><VtLogo size={44} variant="inverse" /></div>
          <p className="br-caption"><span>paper-on-ink · ops chrome, dark embeds</span><span>variant="inverse"</span></p>
        </div>
      </div>

      <div className="br-grid2" style={{ marginTop: 'var(--space-5)' }}>
        <div>
          <div className="br-stage" style={{ padding: 'var(--space-8)' }}>
            <span className="br-clearbox">
              <span className="cs" style={{ top: -14, left: '50%', transform: 'translateX(-50%)' }}>1× cap height</span>
              <span className="cs" style={{ left: -8, top: '50%', transform: 'translate(-100%, -50%)' }}>1×</span>
              <span className="cs" style={{ right: -8, top: '50%', transform: 'translate(100%, -50%)' }}>1×</span>
              <span className="cs" style={{ bottom: -14, left: '50%', transform: 'translateX(-50%)' }}>1×</span>
              <VtLogo size={30} />
            </span>
          </div>
          <p className="br-caption"><span>clear space — nothing inside the dashed zone</span></p>
        </div>
        <div>
          <ul className="br-rules">
            <li><span className="k">Clear space</span><span>1× cap height of the wordmark on all four sides.</span></li>
            <li><span className="k">Minimum size</span><span>Lockup 84px wide · mark alone 16px. Below that, use the mark only.</span></li>
            <li><span className="k">Color</span><span>Ink on paper, or paper on ink. Never matcha, never indigo, never on imagery.</span></li>
            <li><span className="k">Construction</span><span>Mark is the V counterform in a paper field — geometric, stroke-drawn, near-sharp.</span></li>
            <li><span className="k">Prohibited</span><span>Outlines, shadows, gradients, rotation, stretching, third-party co-branding lockups.</span></li>
          </ul>
        </div>
      </div>
    </S4Section>

    <S4Section eyebrow="§ 2 · OG / Twitter cards" title="Editorial paper, five templates"
      lede="1200 × 630, type-first, legible at thumbnail size. The profile template carries a name slot and the ring motif — never real readiness numbers.">
      <div className="br-og-grid">
        {OG_SET.map((o) => <OgFrame key={o.file} {...o} />)}
      </div>
    </S4Section>

    <S4Section eyebrow="§ 3 · Favicon / app icons" title="Icon suite"
      lede="SVG source mark plus raster sizes 16–512, with a maskable variant. Paper background matches the public-page manifest theme.">
      <div className="fav-row">
        {FAVS.map((f) => (
          <div className="fav-cell" key={f.f}>
            <img src={'brand/' + f.f} width={f.show || f.s} height={f.show || f.s} alt={`App icon ${f.s} pixels${f.mask ? ', maskable' : ''}`}
              style={f.mask ? { borderRadius: '50%' } : undefined} />
            <span className="s vt-num">{f.s}px{f.mask ? ' · maskable' : ''}{f.show ? ' (scaled)' : ''}</span>
          </div>
        ))}
        <div className="fav-cell">
          <img src="brand/mark.svg" width="64" height="64" alt="SVG source mark" />
          <span className="s">SVG source</span>
        </div>
      </div>
    </S4Section>

    <S4Section eyebrow="§ 4 · Source names" title="Sources are text, never logos"
      lede="External sources render as mono small-caps chips in every context — tables, chips, footnotes, OG images.">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <SrcChip name="NPPES" />
        <SrcChip name="OIG LEIE" />
        <SrcChip name="CMS PECOS" />
        <SrcChip name="Medical Board of California" />
      </div>
      <div className="br-dont">
        <p>
          <strong>No third-party logos.</strong> Rendering an agency&rsquo;s seal or logotype implies an
          endorsement no source has given. The chip states where a value was read from —
          attribution is a citation, not a partnership.
        </p>
      </div>
    </S4Section>
  </div>
);

Object.assign(window, { BrandPage });
