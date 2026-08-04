// Wave 1504 · w1504-attribution.jsx — /trust/attribution (DG-9.2 adjunct)
// Every source named, every limit stated verbatim. Same table language as /trust.

const ATTRIBUTION = [
  {
    source: 'NPPES', kind: 'CMS registry',
    covers: 'NPI record: provider name, taxonomy, and practice address as filed.',
    not: 'Employment history, license discipline, exclusion status.',
    lim: 'Provider-filed registry data. Accuracy depends on the provider\u2019s own updates.',
    state: 'checked', chipLabel: null, cadence: 're-read daily', fresh: '2h ago', iso: '2026-07-11T12:04:00Z',
  },
  {
    source: 'OIG LEIE', kind: 'HHS-OIG exclusion list',
    covers: 'Presence or absence on the federal exclusion list, as of its latest monthly publication.',
    not: 'State-level Medicaid exclusion lists; actions taken between publications.',
    lim: 'Published monthly. A clean read is only as fresh as the latest list.',
    state: 'checked', chipLabel: null, cadence: 're-read on monthly publication', fresh: '4h ago', iso: '2026-07-11T10:00:00Z',
  },
  {
    source: 'CMS PECOS', kind: 'Medicare enrollment',
    covers: 'Medicare enrollment status, once the holder authorizes the read.',
    not: 'Anything before authorization — this lane is gated, never assumed.',
    lim: 'Read occurs only after the holder\u2019s enrollment agreement.',
    state: 'gated', chipLabel: null, cadence: 'on authorization', fresh: null,
  },
  {
    source: 'Medical Board of California', kind: 'state-board adapter',
    covers: 'California license status, number, and expiration as published by the board.',
    not: 'Other states\u2019 boards; pending or non-public investigations.',
    lim: 'One board, one state. A clean read here says nothing about any other jurisdiction.',
    state: 'checked', chipLabel: null, cadence: 're-read every 24h', fresh: '1d ago', iso: '2026-07-10T08:30:00Z',
  },
  {
    source: 'Self-attested', kind: 'holder statements',
    covers: 'Employment entries and statements the holder provides.',
    not: 'Anything decision-grade — these are recorded, not checked.',
    lim: 'T1 by definition. Displayed as the holder\u2019s words, attributed as such.',
    state: 'notDecisionGrade', chipLabel: 'Self-attested', cadence: '\u2014', fresh: null,
  },
];

const AttrRow = ({ r }) => (
  <div className="attr-row" role="row">
    <span role="cell" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <span className="attr-cell-label">Source</span>
      <SrcChip name={r.source} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--vt-text-muted)' }}>{r.kind}</span>
    </span>
    <span role="cell" className="attr-covers"><span className="attr-cell-label">Covers</span>{r.covers}</span>
    <span role="cell" className="attr-not">
      <span className="attr-cell-label">Does not cover</span>
      {r.not}
      <span className="lim">{r.lim}</span>
    </span>
    <span role="cell"><span className="attr-cell-label">Coverage</span>
      <StateChip state={r.state} size="sm" label={r.chipLabel} source={r.source} />
    </span>
    <span role="cell" className="attr-cad vt-num">
      <span className="attr-cell-label">Cadence</span>
      {r.cadence}
      {r.fresh ? <span style={{ display: 'block', marginTop: 4 }}><FreshnessStamp rel={'last read ' + r.fresh} iso={r.iso} /></span> : null}
    </span>
  </div>
);

const AttributionPage = () => (
  <div data-screen-label="Source Attribution">
    <header className="s4-doctrine">
      <div className="s4-container">
        <span className="vt-eyebrow">vitalcv.com/trust/attribution</span>
        <h1>Source Attribution</h1>
        <div className="sub vt-num">
          <span>Doctrine v1.0</span>
          <span>adjunct to the Trust State Register</span>
        </div>
        <p className="lede">
          Every read names its source, and every source names its limits.
          Sources render as text — never as third-party logos.
        </p>
      </div>
    </header>

    <S4Section first eyebrow="Per-source coverage" title="What each source can and cannot say">
      <div className="attr-table" role="table" aria-label="Source attribution">
        <div className="attr-head" role="row">
          <span role="columnheader">Source</span>
          <span role="columnheader">Covers</span>
          <span role="columnheader">Does not cover</span>
          <span role="columnheader">Coverage</span>
          <span role="columnheader">Cadence</span>
        </div>
        {ATTRIBUTION.map((r) => <AttrRow r={r} key={r.source} />)}
      </div>
      <p style={{ margin: '18px 0 0' }}>
        <HonestyLabel>Limitations are stated verbatim on every surface that cites the source.</HonestyLabel>
      </p>
    </S4Section>

    <S4Section eyebrow="Machine-readable" title="This table, as JSON">
      <div className="ep-table" role="table" aria-label="Attribution endpoint">
        <div className="ep-row" role="row">
          <span role="cell" className="ep-method vt-num"><span className="ep-cell-label">Method</span>GET</span>
          <span role="cell" className="ep-path"><span className="ep-cell-label">Path</span><span>/api/attribution.json</span><CopyBtn text="https://vitalcv.com/api/attribution.json" /></span>
          <span role="cell" className="ep-ret"><span className="ep-cell-label">Returns</span>Source coverage map · JSON</span>
          <span role="cell"><span className="ep-cell-label">Auth</span><StateChip state="checked" size="sm" label="None" /></span>
        </div>
      </div>
    </S4Section>
  </div>
);

Object.assign(window, { AttributionPage, ATTRIBUTION });
