// Wave 1502 · w1502-entity.jsx — /review/[entityId] reviewer decision surface (DG-11.1, 11.3).
// Blockers first, divergence designed visibly, sticky action bar with confirm states.

const ENTITY = {
  id: 'rev-2841',
  name: 'Dr. Renata Mehta, DO',
  npi: '1093 8174 62',
  specialty: 'Emergency Medicine',
  readiness: 58,
  updatedRel: '2h ago',
  updatedIso: '2026-07-11T07:12:44Z',
};

/* Evidence rows — sorted: p0 / contradicted / watch above resolved (DG-11.1) */
const EV_GROUPS = [
  { g: 'Needs action · 5', rows: [
    { lane: 'State license', source: 'GA Composite Medical Board', tier: 'T2', state: 'p0', chipLabel: 'Expired', cls: 'blocking',
      fresh: '2h ago', iso: '2026-07-11T07:12:44Z',
      note: 'Expired 2026-06-29 — 12 days. Georgia renewals often post within days of expiry; a refresh may clear this without a human chase.' },
    { lane: 'Practice address', source: 'NPPES ≠ GA Board', state: 'contradicted', cls: 'contra',
      fresh: '2h ago', iso: '2026-07-11T07:12:44Z', divergence: true,
      note: null },
    { lane: 'Exclusions', source: 'OIG LEIE', tier: 'T2', state: 'stale',
      fresh: '41d ago', iso: '2026-05-31T09:12:00Z',
      note: 'Clean at last read, 41 days ago — past the 30-day freshness threshold. Refresh before acceptance.' },
    { lane: 'Enrollment', source: 'CMS PECOS', state: 'gated',
      note: 'Requires an enrollment agreement before we read. Not read; nothing inferred.' },
    { lane: 'Board certification', source: 'Cert issuer · integration pending', state: 'pending',
      note: 'Issuer integration in progress. The lane stays pending — never assumed.' },
  ]},
  { g: 'Source-backed · 2', rows: [
    { lane: 'Identity', source: 'NPPES', tier: 'T2', state: 'checked',
      fresh: '2h ago', iso: '2026-07-11T07:12:44Z',
      note: 'Exact name + NPI match at source.' },
    { lane: 'Residency', source: 'Emory SOM GME · signed', tier: 'T4', state: 'checked',
      fresh: '30d ago', iso: '2026-06-11T15:40:00Z',
      note: 'Program-signed institutional artifact. Signature checked at import; artifacts do not go stale.' },
  ]},
  { g: 'Informational · 1', rows: [
    { lane: 'Work history', source: 'Holder statement', tier: 'T1', state: 'notDecisionGrade',
      fresh: '90d ago', iso: '2026-04-12T10:00:00Z',
      note: 'Self-attested (T1). Informational only — not for credentialing decisions.' },
  ]},
];

/* Divergence — side-by-side, contradicted treatment, nothing averaged (DG-11.3) */
const DivergencePanel = () => (
  <div className="dv">
    <div className="dv-head">
      <StateChip state="contradicted" size="sm" />
      <span>Two sources disagree. Both values shown — nothing averaged, nothing hidden.</span>
    </div>
    <div className="dv-pair">
      <div className="dv-cell">
        <span className="src">NPPES</span>
        <span className="val">4120 Mercy Blvd, Ste 300, Savannah, GA 31404</span>
        <FreshnessStamp rel="read 2h ago" iso="2026-07-11T07:12:44Z" />
      </div>
      <div className="dv-vs" aria-hidden="true">≠</div>
      <div className="dv-cell">
        <span className="src">GA Composite Medical Board</span>
        <span className="val">212 Bull St, Savannah, GA 31401</span>
        <FreshnessStamp rel="read 2h ago" iso="2026-07-11T07:12:44Z" />
      </div>
    </div>
    <p className="dv-note">Newer is not assumed truer. Resolve at review, or request a refresh — the disagreement stays on the record either way.</p>
  </div>
);

const EvRow = ({ r }) => (
  <div className={`ev-row${r.cls ? ` ${r.cls}` : ''}`}>
    <div className="ev-lane"><span className="n">{r.lane}</span><span className="s">{r.source}</span></div>
    <div className="ev-tier">{r.tier ? <ProofTierBadge tier={r.tier} /> : <span className="vt-eyebrow" style={{ fontSize: 9 }}>—</span>}</div>
    <div className="ev-state"><StateChip state={r.state} size="sm" label={r.chipLabel} /></div>
    <div className="ev-fresh">{r.fresh ? <FreshnessStamp rel={r.fresh} iso={r.iso} stale={r.state === 'stale'} /> : <span className="vt-eyebrow" style={{ fontSize: 9 }}>not read</span>}</div>
    {r.note ? <p className="ev-note">{r.note}</p> : null}
    {r.divergence ? <DivergencePanel /> : null}
  </div>
);

/* ---- action bar (DG-11.1) — confirm state per action, audit line always visible ---- */
const AB_ACTIONS = {
  accept: { label: 'Accept as head start', event: 'REVIEW_ACCEPTED',
    desc: 'Takes this snapshot as a head start. Your committee remains the final step.' },
  refresh: { label: 'Request refresh', event: 'REFRESH_REQUESTED',
    desc: 'Re-reads the expired license and stale exclusions lanes from their sources.' },
  route: { label: 'Route to review', event: 'ROUTED_TO_COMMITTEE',
    desc: 'Sends the file — blockers first — to committee review.' },
};
const ActionBar = () => {
  const [mode, setMode] = React.useState({ s: 'idle' });
  React.useEffect(() => {
    if (mode.s === 'confirm') { const el = document.getElementById('ab-confirm'); if (el) el.focus(); }
  }, [mode]);

  const record = (key) => setMode({
    s: 'recorded', key,
    id: `evt_${Math.random().toString(36).slice(2, 6)}`,
    iso: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });

  return (
    <div className="ab" role="region" aria-label="Reviewer actions">
      <div className="s2-container ab-inner" aria-live="polite">
        {mode.s === 'idle' ? (
          <React.Fragment>
            <PrimaryButton onClick={() => setMode({ s: 'confirm', key: 'accept' })}>{AB_ACTIONS.accept.label}</PrimaryButton>
            <SecondaryButton onClick={() => setMode({ s: 'confirm', key: 'refresh' })}>{AB_ACTIONS.refresh.label}</SecondaryButton>
            <SecondaryButton onClick={() => setMode({ s: 'confirm', key: 'route' })}>{AB_ACTIONS.route.label}</SecondaryButton>
            <span className="ab-audit"><TrustGlyph state="reviewRequired" size={12} /> An audit event will be recorded.</span>
          </React.Fragment>
        ) : mode.s === 'confirm' ? (
          <React.Fragment>
            <span className="ab-will vt-num">WILL RECORD: {AB_ACTIONS[mode.key].event}</span>
            <span className="ab-desc">{AB_ACTIONS[mode.key].desc}</span>
            <span style={{ flex: 1 }}></span>
            <PrimaryButton id="ab-confirm" onClick={() => record(mode.key)}>Confirm — {AB_ACTIONS[mode.key].label.toLowerCase()}</PrimaryButton>
            <SecondaryButton onClick={() => setMode({ s: 'idle' })}>Cancel</SecondaryButton>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span className="ab-recorded">
              <TrustGlyph state="checked" size={14} />
              <span className="ev vt-num">{AB_ACTIONS[mode.key].event} · {mode.id} · {mode.iso}</span>
              <span style={{ fontSize: 12.5, color: 'var(--vt-text-secondary)' }}>Recorded to the audit trail.</span>
            </span>
            <span style={{ flex: 1 }}></span>
            <QuietButton onClick={() => setMode({ s: 'idle' })}>Take another action</QuietButton>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};

/* ---- page ---- */
const EntityPage = ({ id }) => {
  const reduced = useReducedMotion();
  const [ring, setRing] = React.useState(reduced ? ENTITY.readiness : 0);
  React.useEffect(() => {
    if (reduced) { setRing(ENTITY.readiness); return; }
    const t = setTimeout(() => setRing(ENTITY.readiness), 240);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <main data-screen-label="/review/rev-2841 — Reviewer decision surface">
      <div className="s2-container">
        <div className="en-crumb vt-num">
          <span>review / {id || ENTITY.id}</span>
          <FreshnessStamp rel={`snapshot updated ${ENTITY.updatedRel}`} iso={ENTITY.updatedIso} />
        </div>

        <header className="en-head" data-screen-label="Identity header">
          <ReadinessRing value={ring} size={92} />
          <div className="en-id">
            <h1 className="en-name">{ENTITY.name}</h1>
            <span className="en-sub vt-num">NPI {ENTITY.npi} · {ENTITY.specialty}</span>
          </div>
          <div className="en-counts" aria-label="File status summary">
            <StateChip state="p0" size="sm" label="1 blocker" />
            <StateChip state="contradicted" size="sm" label="1 contradiction" />
            <StateChip state="stale" size="sm" label="3 attention" />
          </div>
        </header>

        <div className="ev-table" role="table" aria-label="Evidence by lane, blockers first">
          <div className="ev-h" role="row">
            <span role="columnheader">Lane</span><span role="columnheader">Tier</span>
            <span role="columnheader">State</span><span role="columnheader" style={{ textAlign: 'right', paddingRight: 20 }}>Checked</span>
          </div>
          {EV_GROUPS.map((g) => (
            <React.Fragment key={g.g}>
              <div className="ev-group vt-num">{g.g}</div>
              {g.rows.map((r) => <EvRow key={r.lane} r={r} />)}
            </React.Fragment>
          ))}
        </div>

        <div style={{ marginTop: 'var(--space-5)' }}>
          <HonestyLabel>Every lane is shown, including the ones that are not ready. A partial proof stays partial.</HonestyLabel>
        </div>
      </div>

      <ActionBar />
    </main>
  );
};

Object.assign(window, { EntityPage });
