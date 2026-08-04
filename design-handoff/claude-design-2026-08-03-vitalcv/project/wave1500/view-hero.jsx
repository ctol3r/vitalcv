// Wave 1500 · Hero proof — DG-7.1–7.4 rebuilt on the new primitives.
// The wallet mock uses the SAME SourceRow/ReadinessRing/StateChip the real passport will.
const ViewHero = () => {
  const [npi, setNpi] = React.useState('');
  return (
    <div>
      <SectionHead num="08" title="Flagship proof · homepage hero" lede="Primitives in situ. The mock and the product are the same components — truth in advertising." />

      <div style={{ border: '1px solid var(--vt-rule-strong)', background: 'var(--vt-surface-page)', borderRadius: 'var(--radius-2)', overflow: 'hidden' }} data-screen-label="Homepage hero proof">
        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 40px',
          borderBottom: '1px solid var(--vt-rule)', background: 'var(--vt-surface-page)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>VitalCV</span>
          <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', alignItems: 'center' }}>
            {['For employers', 'Trust', 'Sign in'].map((l) => (
              <a key={l} href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, textDecoration: 'none', color: 'var(--vt-text-secondary)' }}>{l}</a>
            ))}
            <SecondaryButton size="sm">Check readiness</SecondaryButton>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, padding: '64px 40px 72px',
          maxWidth: 'var(--container-max)', margin: '0 auto', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <span className="vt-eyebrow">Career record · for clinicians</span>
            <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1.03 }}>
              Your next role, <span className="vt-accent-i">ready before day one.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--vt-text-secondary)', maxWidth: '46ch' }}>
              Enter your NPI. VitalCV reads primary sources and assembles a readiness snapshot you own — with every source's honest state shown.
            </p>
            <div style={{ maxWidth: 480 }}>
              <NpiInput value={npi} onChange={setNpi} />
              <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: 'var(--vt-text-muted)' }}>No account required. Public sources only.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="vt-eyebrow" style={{ fontSize: 9 }}>Reads</span>
              {[['NPPES', 'checked'], ['OIG LEIE', 'checked'], ['CMS PECOS', 'gated'], ['State boards', 'unavailable']].map(([src, st]) => (
                <StateChip key={src} state={st} size="sm" label={src} source={src} />
              ))}
            </div>
          </div>

          {/* Wallet mock — built ONLY from shared primitives */}
          <PaperCard style={{ padding: 0, overflow: 'hidden' }} data-screen-label="Wallet mock">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderBottom: '1px solid var(--vt-rule)', background: 'var(--vt-surface-sunken)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--vt-text-secondary)' }}>Readiness snapshot</span>
              <StateChip state="previewOnly" size="sm" />
            </div>
            <div style={{ padding: '18px 20px 8px', display: 'flex', gap: 18, alignItems: 'center' }}>
              <ReadinessRing value={72} size={84} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Dr. A. Okafor, MD</span>
                <span className="vt-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--vt-text-muted)', letterSpacing: '0.06em' }}>NPI 1780 6842 39 · Family Medicine</span>
                <FreshnessStamp rel="Checked 2h ago" iso="2026-07-11T12:04:00Z" />
              </div>
            </div>
            <div style={{ padding: '4px 20px 14px' }}>
              <SourceRow label="Identity" source="NPPES" state="checked" freshness="2h ago" iso="2026-07-11T12:04:00Z" />
              <SourceRow label="Exclusions" source="OIG LEIE" state="checked" freshness="2h ago" iso="2026-07-11T12:04:00Z" />
              <SourceRow label="Medicare enrollment" source="CMS PECOS" state="gated" />
              <div style={{ paddingTop: 12 }}>
                <HonestyLabel>Anonymous preview · not an owned snapshot</HonestyLabel>
              </div>
            </div>
          </PaperCard>
        </div>
      </div>

      <p style={{ margin: '16px 2px 0', fontSize: 12, color: 'var(--vt-text-muted)', maxWidth: '78ch' }}>
        Adopted from D56 zen lineage: warm ink scale, mono eyebrows, rule-not-shadow cards, dashed = degraded.
        Dropped from claude-design-2026-06-26 handoff: glass cards, ops gradients, Trust Blue, spring per-card motion.
      </p>
    </div>
  );
};

Object.assign(window, { ViewHero });
