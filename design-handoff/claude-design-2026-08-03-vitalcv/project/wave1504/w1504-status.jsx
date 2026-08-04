// Wave 1504 · w1504-status.jsx — /status · Operational Status (DG-9.5)
// The ONLY page in the product with a looping animation: one pulse dot.

/* 4-level operational spine — token aliases defined in w1504.css */
const SPINE = {
  HEALTHY:  { label: 'HEALTHY',  glyph: 'checked',     cls: 'healthy',  def: 'Lane returning source data within its freshness threshold.' },
  DEGRADED: { label: 'DEGRADED', glyph: 'unavailable', cls: 'degraded', def: 'Lane partially failing; reads retried. Rendered dashed, never dimmed.' },
  STALE:    { label: 'STALE',    glyph: 'stale',       cls: 'stale',    def: 'Last clean read is past threshold. Values display with stale coloring.' },
  CRITICAL: { label: 'CRITICAL', glyph: 'p0',          cls: 'critical', def: 'Lane down or returning errors. Dependent values stop rendering as checked.' },
};

const SpineChip = ({ level }) => {
  const s = SPINE[level];
  return (
    <span className={`spine-chip ${s.cls}`}>
      <TrustGlyph state={s.glyph} size={11} />{s.label}
    </span>
  );
};

/* ---------- lanes ---------- */
const LANES = [
  { source: 'NPPES', what: 'NPI registry reads', level: 'HEALTHY',
    fresh: 'last check 12m ago', iso: '2026-07-11T06:30:00Z', cadence: 'daily cadence' },
  { source: 'OIG LEIE', what: 'Federal exclusion list reads', level: 'HEALTHY',
    fresh: 'last check 4h ago', iso: '2026-07-11T02:42:00Z', cadence: 'monthly publication' },
  { source: 'CMS PECOS', what: 'Gated enrollment reads', level: 'DEGRADED',
    fresh: 'last clean read 6h ago', iso: '2026-07-11T00:40:00Z', cadence: 'on authorization',
    note: 'Upstream intermittent since 04:10Z. Reads retried; authorized lanes queue rather than fail.' },
  { source: 'Medical Board of California', what: 'State-board adapter reads', level: 'STALE',
    fresh: 'last clean read 31h ago', iso: '2026-07-09T23:20:00Z', cadence: '24h threshold',
    note: 'Past the 24h threshold — dependent license values now display with stale coloring.' },
];

const LaneRow = ({ l }) => (
  <div className="lane-row" role="row">
    <span className="lane-id" role="cell">
      <SrcChip name={l.source} />
    </span>
    <span className="lane-whatcell" role="cell">
      <span className="lane-what">{l.what}</span>
      {l.note ? <p className="lane-note">{l.note}</p> : null}
    </span>
    <span className="lane-fresh" role="cell">
      <FreshnessStamp rel={l.fresh} iso={l.iso} stale={l.level === 'STALE'} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--vt-text-muted)' }}>{l.cadence}</span>
    </span>
    <span className="lane-chipcell" role="cell"><SpineChip level={l.level} /></span>
  </div>
);

/* ---------- page ---------- */
const StatusPage = () => (
  <div data-screen-label="Operational Status">
    <header className="s4-doctrine">
      <div className="s4-container">
        <span className="vt-eyebrow">vitalcv.com/status</span>
        <h1>Operational Status</h1>
        <div className="sub vt-num">
          <span>window: last 90 days</span>
          <span>updated 2026-07-11T06:42Z</span>
        </div>
      </div>
    </header>

    <section className="s4-section first" data-comment-anchor="status-banner">
      <div className="s4-container">
        <div className="st-banner" role="status">
          <span className="glyph"><TrustGlyph state="checked" size={22} /></span>
          <span className="label vt-num">HEALTHY — 2 OF 4 LANES CLEAN, 1 DEGRADED, 1 STALE</span>
          <span className="st-live"><span className="live-dot" aria-hidden="true"></span>LIVE</span>
          <p className="desc">
            Overall state is the worst read lane a decision could depend on, rounded up honestly.
            Two lanes are currently outside their thresholds — shown below, not summarized away.
          </p>
        </div>
      </div>
    </section>

    <S4Section eyebrow="§ 1 · The spine" title="Four levels, no fifth"
      lede="Every lane reports exactly one of these. Glyph and label are always paired — the spine survives a grayscale screenshot.">
      <div className="spine-legend">
        {Object.keys(SPINE).map((k) => (
          <div className={`spine-cell ${SPINE[k].cls}`} key={k}>
            <span className="h" style={{ color: `var(--vt-spine-${SPINE[k].cls})` }}>
              <TrustGlyph state={SPINE[k].glyph} size={13} />{SPINE[k].label}
            </span>
            <span className="d">{SPINE[k].def}</span>
          </div>
        ))}
      </div>
    </S4Section>

    <S4Section eyebrow="§ 2 · Read lanes" title="Per-lane state">
      <div className="lane-rows" role="table" aria-label="Read lane status">
        {LANES.map((l) => <LaneRow l={l} key={l.source} />)}
      </div>
    </S4Section>

    <S4Section eyebrow="§ 3 · Check it yourself" title="Independently verifiable · no auth required">
      <div className="st-sig">
        <span className="t">This page has a machine-readable twin.</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
          GET /api/status.json
          <CopyBtn text="https://vitalcv.com/api/status.json" />
        </span>
        <a className="mono-act" href="#/trust" style={{ marginLeft: 'auto' }}>All endpoints →</a>
      </div>
    </S4Section>

    <S4Section eyebrow="§ 4 · Incidents" title="Incident history">
      <div className="inc-empty">
        <TrustGlyph state="notDecisionGrade" size={16} />
        <span className="t vt-num">No incidents recorded in this window.</span>
        <p className="d">
          Incident entries are append-only audit trail records. An empty window means
          nothing crossed CRITICAL — not that nothing degraded above.
        </p>
      </div>
    </S4Section>
  </div>
);

Object.assign(window, { StatusPage, SPINE, SpineChip, LANES });
