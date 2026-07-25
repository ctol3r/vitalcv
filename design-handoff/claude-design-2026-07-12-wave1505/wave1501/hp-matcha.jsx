// Wave 1501 · hp-matcha.jsx — Try MATCHA (DG-7.7).
// Chip-tap demo. Instant scripted responses (≤200ms), tap targets ≥44px,
// visually quieter than the hero. MATCHA surfaces may use the matcha family.

const MATCHA_QA = [
  {
    id: 'ready',
    q: 'What does 72% readiness mean?',
    a: 'Readiness is the share of a role\u2019s evidence checklist that already reads clean from primary sources. 72% means most sources read clean; the rest are gated, stale, or waiting on access — and each one says which.',
    chips: [['checked', 'NPPES'], ['checked', 'OIG LEIE'], ['gated', 'CMS PECOS']],
  },
  {
    id: 'pecos',
    q: 'Why is PECOS shown as gated?',
    a: 'CMS PECOS requires an enrollment agreement before it can be read. VitalCV shows it as gated instead of pretending it was checked — a gated source never gets a checkmark.',
    chips: [['gated', 'CMS PECOS']],
  },
  {
    id: 'verifier',
    q: 'What can a verifier see?',
    a: 'Only the scoped view you grant: named fields, each carrying its source, freshness, and coverage state. No browsing, no full record, and the grant is yours to revoke.',
    chips: [['previewOnly', 'Scoped view']],
  },
  {
    id: 'replace',
    q: 'Do you replace credentialing?',
    a: 'No. Employers accept a claimed snapshot as a head start, and re-check what their process requires. Credentialing committees still make the decision — VitalCV never replaces them.',
    chips: [['notDecisionGrade', 'Not a decision']],
  },
];

const MatchaSection = () => {
  const [sel, setSel] = React.useState(MATCHA_QA[0].id);
  const cur = MATCHA_QA.find((x) => x.id === sel);
  return (
    <section className="hp-section" id="matcha" data-screen-label="Try MATCHA">
      <div className="hp-container">
        <SecHead
          brand
          eyebrow="MATCHA · Try it"
          title="Ask the record a hard question."
          lede={'MATCHA answers from the snapshot\u2019s honest states — the same chips you see everywhere on this page.'}
        />
        <Reveal>
          <div className="mt-panel">
            <div className="mt-chips" role="group" aria-label="Sample questions">
              {MATCHA_QA.map((x) => (
                <button key={x.id} type="button" className="mt-chip"
                  aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
                  {x.q}
                </button>
              ))}
            </div>
            <div className="mt-answer" key={cur.id} aria-live="polite">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, background: 'var(--vt-brand)', flexShrink: 0,
                  borderRadius: 'var(--radius-1)' }}></span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.16em', color: 'var(--vt-brand)' }}>MATCHA</span>
              </div>
              <p>{cur.a}</p>
              <div className="chips">
                {cur.chips.map(([st, lb]) => <StateChip key={lb} state={st} size="sm" label={lb} />)}
              </div>
              <HonestyLabel>Scripted demo · answers are illustrative</HonestyLabel>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

Object.assign(window, { MatchaSection });
