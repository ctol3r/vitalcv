// Wave 1504 · w1504-trust.jsx — /trust · Trust State Register (DG-9.1, 9.2)
// The surface a skeptical verifier inspects before trusting anything.

/* Canonical tier vocabulary for this register (DG-9.1). Supersedes the
   Wave-1500 TIER_DEFS strings — noted in CHANGES.md. */
const TIER_VOCAB = [
  { tier: 'T1', name: 'Self-Asserted', def: 'A holder statement. Recorded verbatim, attributed to the holder, never displayed as source-backed.',
    ex: 'Hospitalist \u00b7 St. Rose Community Hospital (holder statement)' },
  { tier: 'T2', name: 'Inferred', def: 'Derived from a named source\u2019s data without a direct claim — the derivation rule is recorded with the value.',
    ex: 'specialty \u2190 NPPES taxonomy 207Q00000X' },
  { tier: 'T3', name: 'Source Checked', def: 'Read directly from a primary source over a recorded channel, with timestamp and RUN_ID retained.',
    ex: 'license A123456 \u2190 Medical Board of California \u00b7 2026-07-10T08:30Z' },
  { tier: 'T4', name: 'Issuer Signed', def: 'A signed institutional artifact. The signature binds object, subject, and issuing key; it survives replay.',
    ex: 'vc_okafor_9d2e \u00b7 JWS ES256 \u00b7 kid vitalcv-2026-01' },
];

/* ---------- three state planes (DG-9.2) — same slot grid, rising binding ---------- */
const PLANES = [
  {
    key: 'p1', n: 'PLANE 01', title: 'Anonymous preview', chip: { state: 'previewOnly' },
    sub: 'What anyone sees before an NPI is claimed. Every slot is unbound by design — the empty state is rendered, not hidden.',
    slots: {},
  },
  {
    key: 'p2', n: 'PLANE 02', title: 'Owned snapshot', chip: { state: 'checked', label: 'Attributed' },
    sub: 'A holder has claimed the record. Lineage becomes visible: what was read, when, over which channel, under which run.',
    slots: {
      OBJECT:     { v: 'psp_okafor_7f3a', copy: true, sub: 'snapshot document' },
      OWNERSHIP:  { v: 'npi:1234567893', sub: 'holder-claimed' },
      CHECKED_AT: { v: '2026-07-11T06:42Z' },
      CHANNEL:    { v: 'https \u00b7 source read' },
      REPLAY:     { v: 'AVAILABLE', sub: 'run record retained' },
      RUN_ID:     { v: 'run_2026-07-11_0642Z', copy: true },
    },
  },
  {
    key: 'p3', n: 'PLANE 03', title: 'Signed institutional artifact', chip: { state: 'checked', label: 'T4-capable' },
    tier: 'T4',
    sub: 'The snapshot materialized as a signed artifact. Ownership binds to the issuing key; the record survives replay unchanged.',
    slots: {
      OBJECT:     { v: 'vc_okafor_9d2e', copy: true, sub: 'signed artifact' },
      OWNERSHIP:  { v: 'did:web:vitalcv.com', sub: 'issuer-bound \u00b7 subject npi:1234567893' },
      CHECKED_AT: { v: '2026-07-11T06:42Z' },
      CHANNEL:    { v: 'JWS \u00b7 ES256' },
      REPLAY:     { v: 'SURVIVABLE', sub: 're-runnable from artifact + JWKS' },
      RUN_ID:     { v: 'run_2026-07-11_0642Z', copy: true },
    },
  },
];

/* ---------- doctrine panels ---------- */
const DOCTRINE_ITEMS = [
  { k: 'Assertion', v: 'Nothing renders as checked without a named source and a timestamp beside it.' },
  { k: 'Tiering', v: 'Every value carries a proof tier, T1\u2013T4. The tier is displayed, not implied.' },
  { k: 'Degradation', v: 'A degraded or unbound slot renders dashed — never dimmed, never hidden.' },
  { k: 'Contradiction', v: 'When sources disagree, both values render side-by-side until resolved.' },
];
const CONTINUITY_ITEMS = [
  { k: 'DID method', v: 'did:web — resolvable from the domain itself, no intermediary.' },
  { k: 'Key rotation', v: 'New keys publish to the JWKS URI; retired kids stay retained so old artifacts still check.' },
  { k: 'Artifact format', v: 'JWS, ES256 over EC P-256. Payload carries object, subject, RUN_ID.' },
  { k: 'Audit trail', v: 'Append-only run log. Every snapshot names the run that produced it.' },
];
const GUARANTEE_ITEMS = [
  { k: 'Public JWKS', v: 'The key set is fetchable by anyone at the JWKS URI.' },
  { k: 'Public DID document', v: 'The DID document is fetchable at /.well-known/did.json.' },
  { k: 'No API key', v: 'Verification requires no account, no agreement, no API key.' },
];

/* ---------- machine-readable endpoints ---------- */
const ENDPOINTS = [
  { method: 'GET', path: '/.well-known/did.json', ret: 'DID document \u00b7 JSON' },
  { method: 'GET', path: '/.well-known/jwks.json', ret: 'Active + retained public keys \u00b7 JSON' },
  { method: 'GET', path: '/api/status.json', ret: 'Lane states + last-check times \u00b7 JSON' },
  { method: 'GET', path: '/api/attribution.json', ret: 'Source coverage map \u00b7 JSON' },
  { method: 'GET', path: '/api/replay/{run_id}', ret: 'Recorded run record \u00b7 JSON' },
];
const EndpointTable = () => (
  <div className="ep-table" role="table" aria-label="Machine-readable endpoints">
    <div className="ep-head" role="row">
      <span role="columnheader">Method</span>
      <span role="columnheader">Path</span>
      <span role="columnheader">Returns</span>
      <span role="columnheader">Auth</span>
    </div>
    {ENDPOINTS.map((e) => (
      <div className="ep-row" role="row" key={e.path}>
        <span role="cell" className="ep-method vt-num"><span className="ep-cell-label">Method</span>{e.method}</span>
        <span role="cell" className="ep-path"><span className="ep-cell-label">Path</span><span>{e.path}</span><CopyBtn text={'https://vitalcv.com' + e.path.replace('{run_id}', '')} /></span>
        <span role="cell" className="ep-ret"><span className="ep-cell-label">Returns</span>{e.ret}</span>
        <span role="cell"><span className="ep-cell-label">Auth</span><StateChip state="checked" size="sm" label="None" /></span>
      </div>
    ))}
  </div>
);

/* ---------- page ---------- */
const TrustPage = () => (
  <div data-screen-label="Trust State Register">
    <header className="s4-doctrine">
      <div className="s4-container">
        <span className="vt-eyebrow">vitalcv.com/trust</span>
        <h1>Trust State Register</h1>
        <div className="sub vt-num">
          <span>Doctrine v1.0</span>
          <span>pilot</span>
          <span>{ISSUER.did}</span>
        </div>
        <p className="lede">
          The canonical record of what this system asserts, at which tier, under which key.
          Everything on this page is checkable without an account.
        </p>
      </div>
    </header>

    <S4Section first eyebrow="§ 1 · Proof tier vocabulary" title="Four tiers, displayed everywhere"
      lede="Every value on every surface carries exactly one of these tiers. This rendering is canonical — other surfaces reference it.">
      <div className="tier-grid">
        {TIER_VOCAB.map((t) => (
          <article className="tier-card" key={t.tier}>
            <ProofTierBadge tier={t.tier} />
            <span className="tname">{t.name}</span>
            <p className="tdef">{t.def}</p>
            <span className="tex vt-num">{t.ex}</span>
          </article>
        ))}
      </div>
    </S4Section>

    <S4Section eyebrow="§ 2 · State planes" title="Three planes, one grid"
      lede="A record moves through three planes. The slot grid is identical in each — only the bindings change, so the progression reads at a glance, even in grayscale.">
      {PLANES.map((p, i) => (
        <React.Fragment key={p.key}>
          {i > 0 ? <div className="plane-arrow" aria-hidden="true">binding increases ↓</div> : null}
          <section className={`plane ${p.key}`} aria-label={p.title}>
            <div className="plane-head">
              <span className="plane-n vt-num">{p.n}</span>
              <span className="plane-title">{p.title}</span>
              <span className="plane-chips">
                {p.tier ? <ProofTierBadge tier={p.tier} /> : null}
                <StateChip state={p.chip.state} size="sm" label={p.chip.label} />
              </span>
            </div>
            <p className="plane-sub">{p.sub}</p>
            <SlotGrid slots={p.slots} />
            {p.key === 'p3' ? (
              <div className="plane-extra">
                <TokenRow k="signature" value="eyJhbGciOiJFUzI1NiIsImtpZCI6InZpdGFsY3YtMjAyNi0wMSJ9..8VbG" display="eyJhbGciOiJFUzI1NiIsImtpZCI6InZpdGFsY3YtMjAyNi0wMSJ9\u2026" />
              </div>
            ) : null}
          </section>
        </React.Fragment>
      ))}
    </S4Section>

    <S4Section eyebrow="§ 3 · Issuer continuity" title="One issuer, one key discipline"
      lede="The identifiers a verifier needs, copyable as-is. Keys rotate; retired keys stay published so earlier artifacts keep checking.">
      <div className="iss-grid">
        <div className="iss-card">
          <TokenRow k="DID" value={ISSUER.did} />
          <TokenRow k="DID document" value={ISSUER.didDoc} href={ISSUER.didDoc} />
          <TokenRow k="JWKS URI" value={ISSUER.jwks} href={ISSUER.jwks} />
          <TokenRow k="Active kid" value={ISSUER.kid} />
          <TokenRow k="Fingerprint" value={ISSUER.fingerprint} />
          <TokenRow k="Retained kid" value={ISSUER.kidPrev} display={ISSUER.kidPrev + ' \u00b7 replay only'} />
        </div>
        <div className="iss-side">
          <div className="row">
            <StateChip state="checked" label={ISSUER.alg + ' \u00b7 Active'} />
          </div>
          <div className="iss-acts">
            <a className="mono-act" href={ISSUER.didDoc} onClick={(e) => e.preventDefault()} title="Live endpoint — stubbed in prototype">Open DID document →</a>
            <a className="mono-act" href={ISSUER.jwks} onClick={(e) => e.preventDefault()} title="Live endpoint — stubbed in prototype">Fetch JWKS →</a>
            <a className="mono-act" href="#endpoints">Replay a RUN_ID →</a>
          </div>
          <p className="iss-note">
            Signature check is possible offline from an artifact plus the published key set.
            No account, no agreement, no API key.
          </p>
        </div>
      </div>
    </S4Section>

    <S4Section eyebrow="§ 4 · Doctrine" title="What this register commits to">
      <div className="dl-grid">
        <DlPanel title="Trust doctrine" items={DOCTRINE_ITEMS} />
        <DlPanel title="Infrastructure continuity" items={CONTINUITY_ITEMS} />
        <DlPanel title="Verifier guarantees" items={GUARANTEE_ITEMS} />
      </div>
    </S4Section>

    <S4Section id="endpoints" eyebrow="§ 5 · Machine-readable" title="Endpoints"
      lede="Everything above, as JSON. Auth column states what is required — for verification, nothing is.">
      <EndpointTable />
    </S4Section>
  </div>
);

Object.assign(window, { TrustPage, TIER_VOCAB, ENDPOINTS, EndpointTable });
