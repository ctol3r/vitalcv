// Wave 1500 · Gallery view — every primitive, every state (DG-4.2, 6.1–6.7)
const Cell = ({ label, children, span }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, gridColumn: span ? `span ${span}` : undefined }}>
    <span className="vt-eyebrow" style={{ fontSize: 9 }}>{label}</span>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
  </div>
);

const ViewGallery = () => {
  const [npi, setNpi] = React.useState('178068');
  const states = Object.keys(STATE_META).filter((s) => s !== 'p0' && s !== 'contradicted');
  return (
    <div>
      <SectionHead num="04" title="StateChip · 9 coverage states" lede="Glyph + label always paired — legible in grayscale (DG-15.3)." />
      <PaperCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px 24px' }}>
          {states.map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              borderBottom: '1px solid var(--vt-rule-soft)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--vt-text)' }}>{s}</code>
                <span style={{ fontSize: 10.5, color: 'var(--vt-text-muted)', lineHeight: 1.4 }}>{STATE_META[s].def}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                <StateChip state={s} />
                <StateChip state={s} size="sm" />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Cell label="Review-surface states"><StateChip state="p0" /><StateChip state="contradicted" /></Cell>
          <Cell label="Proof tiers T1–T4">{['T1', 'T2', 'T3', 'T4'].map((t) => <ProofTierBadge key={t} tier={t} />)}</Cell>
        </div>
      </PaperCard>

      <SectionHead num="05" title="SourceRow + ReadinessRing" lede="The atomic evidence row — shared by hero mock, passport, packet, review, register." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)' }}>
        <PaperCard>
          <SourceRow label="Identity" source="NPPES" state="checked" freshness="2h ago" iso="2026-07-11T12:04:00Z" />
          <SourceRow label="Exclusions" source="OIG LEIE" state="checked" freshness="2h ago" iso="2026-07-11T12:04:00Z" />
          <SourceRow label="Medicare enrollment" source="CMS PECOS" state="gated" action="Request access" />
          <SourceRow label="State license" source="State board" state="stale" freshness="41d ago" iso="2026-05-31T09:12:00Z" action="Refresh" />
          <SourceRow label="DEA registration" source="Adapter pending" state="unavailable" />
          <div style={{ paddingTop: 12 }}>
            <HonestyLabel>Gated sources are never shown as a bare checkmark</HonestyLabel>
          </div>
        </PaperCard>
        <PaperCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <ReadinessRing value={72} />
            <ReadinessRing value={91} size={72} />
            <ReadinessRing value={38} size={56} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--vt-text-muted)', textAlign: 'center' }}>Band color by threshold · sweeps once on first view · role="meter"</span>
        </PaperCard>
      </div>

      <SectionHead num="06" title="Buttons + form kit" lede="Ink is the workhorse; matcha appears on hover and Recognition moments." />
      <PaperCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 32px' }}>
          <Cell label="Primary · ink fill, matcha hover">
            <PrimaryButton size="lg">Present VitalCV Recognition</PrimaryButton>
            <PrimaryButton>Accept as head start</PrimaryButton>
            <PrimaryButton size="sm">Refresh</PrimaryButton>
          </Cell>
          <Cell label="Secondary / quiet / destructive">
            <SecondaryButton>View sources</SecondaryButton>
            <QuietButton>What this is not</QuietButton>
            <DestructiveButton size="sm">Revoke share</DestructiveButton>
          </Cell>
          <Cell label="States">
            <PrimaryButton disabled>Check readiness</PrimaryButton>
            <PrimaryButton loading>Checking</PrimaryButton>
          </Cell>
          <Cell label="Recognition moment · the one brand-solid use">
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--vt-brand)',
              color: 'var(--vt-text-inverse)', border: 'none', padding: '9px 20px', fontFamily: 'var(--font-body)',
              fontSize: 13.5, fontWeight: 500, borderRadius: 'var(--radius-1)', cursor: 'pointer' }}>
              <TrustGlyph state="checked" size={14} /> Recognition recorded
            </button>
          </Cell>
        </div>
        <div style={{ marginTop: 28, maxWidth: 560 }}>
          <div className="vt-eyebrow" style={{ marginBottom: 10 }}>NPI segmented input · 0/10 counter · no account required</div>
          <NpiInput value={npi} onChange={setNpi} />
          <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--vt-text-muted)' }}>No account required. We read public sources only.</p>
        </div>
      </PaperCard>

      <SectionHead num="07" title="Freshness + honesty labels" lede="CHECKED_AT everywhere; honesty as designed UI, not fine print (DG-17.2)." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <PaperCard>
          <Cell label="FreshnessStamp · hover for absolute ISO">
            <FreshnessStamp rel="2h ago" iso="2026-07-11T12:04:00Z" />
            <FreshnessStamp rel="41d ago · stale" iso="2026-05-31T09:12:00Z" stale />
          </Cell>
        </PaperCard>
        <PaperCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <HonestyLabel>Internal simulation · not a customer pilot result</HonestyLabel>
            <HonestyLabel>Past and future are illustrative</HonestyLabel>
            <HonestyLabel>Not a final credentialing decision</HonestyLabel>
          </div>
        </PaperCard>
      </div>
    </div>
  );
};

Object.assign(window, { ViewGallery });
