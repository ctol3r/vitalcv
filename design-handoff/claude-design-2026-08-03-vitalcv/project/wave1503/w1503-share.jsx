// Wave 1503 · w1503-share.jsx — /p/[slug] public share page (DG-10.4).
// Cold recruiter view: readable in under a minute, screenshot-worthy,
// prints ink-on-white with the verify line in the footer.

const SHARE_SECTIONS = FUNNEL_GROUPS.filter((g) => g.name !== 'Employment');
const SHARE_WITHHELD = ['Employment'];

const SHARE_IS = [
  { label: 'A head start for employer review', src: 'Carried and shared by the clinician', state: 'checked', chipLabel: 'Source-backed' },
  { label: 'Primary-source reads, each one dated', src: 'NPPES · OIG LEIE · State board', state: 'checked' },
  { label: 'Selective by design', src: 'The clinician chose what travels', state: 'gated', chipLabel: 'Withheld shown' },
];
const SHARE_ISNOT = [
  { label: 'Not a final credentialing decision', src: 'Committees decide — this speeds them up', state: 'notDecisionGrade' },
  { label: 'Not a complete file', src: 'A partial proof stays partial', state: 'gated', chipLabel: 'Gated stays gated' },
  { label: 'Not a background check', src: 'Public primary sources only', state: 'notDecisionGrade', chipLabel: 'Informational' },
];

const ShareView = () => {
  const p = FUNNEL_PERSONA;
  const band = bandFor3(p.ring);
  return (
    <React.Fragment>
      <DemoStrip label={'/p/' + p.slug + ' · cold recruiter view'}>
        <DemoBtn onClick={() => window.print()}>Print</DemoBtn>
      </DemoStrip>

      <main className="sh-page" data-screen-label="Public share page">
        <header className="sh-head">
          <a className="sh-mark" href="../wave1501/index.html">VitalCV</a>
          <span className="sh-eyebrow">Source-backed career evidence</span>
          <span className="sh-open vt-num">Read-only · opened 2026-07-11</span>
        </header>

        <Reveal className="sh-card">
          <div className="sh-id">
            <div>
              <h1 className="sh-name">{p.name}</h1>
              <div className="sh-sub vt-num">NPI {p.npi} · {p.specialty} · {p.location}</div>
              <div className="sh-holdline"><HonestyLabel>Shared by the clinician · selective disclosure</HonestyLabel></div>
            </div>
            <div className="sh-ringside">
              <ReadinessRing value={p.ring} size={96} />
              <span className="ps-band">{band.label}</span>
            </div>
          </div>
        </Reveal>

        {SHARE_SECTIONS.map((g, i) => (
          <Reveal className="sh-card" key={g.name} delay={40 + i * 40}>
            <header className="sh-sec-h">
              <span className="sh-sec-name">{g.name}</span>
              <span className="sh-sec-n vt-num">{g.rows.length} {g.rows.length === 1 ? 'lane' : 'lanes'}</span>
            </header>
            {g.rows.map((r) => <EvidenceRow key={r.label} {...r} action={undefined} />)}
          </Reveal>
        ))}

        <Reveal className="sh-card" delay={200}>
          <div className="sh-withheld" style={{ marginTop: 0 }}>
            <TrustGlyph state="gated" size={13} />
            <span>Withheld by the clinician: {SHARE_WITHHELD.join(' · ')} — absence here is a choice, not a gap.</span>
          </div>
        </Reveal>

        <Reveal className="sh-card" delay={220}>
          <header className="sh-sec-h">
            <span className="sh-sec-name">Recognitions</span>
            <span className="sh-sec-n">employer acceptances, kept on the record</span>
          </header>
          <div className="rec-list">
            {FUNNEL_RECOGNITIONS.map((r) => <RecognitionRow key={r.n} {...r} />)}
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="sh-verify" role="note">
            <span className="k">Verify this packet</span>
            packet pk_7f3a·d91c · doc {p.doc}<br />
            verify at vitalcv.com/api/receipts/verify — no API key required
          </div>
        </Reveal>

        <Reveal delay={260}>
          <div className="hn-pair">
            <SharePanel tone="ok" title="What this is" items={SHARE_IS} />
            <SharePanel tone="watch" title="What this is not" items={SHARE_ISNOT} />
          </div>
        </Reveal>

        <Reveal delay={280}>
          <p className="sh-boundary">
            <TrustGlyph state="notDecisionGrade" size={16} />
            <span>A head start for employer review — <span className="vt-accent-i">not</span> a final credentialing decision.</span>
          </p>
          <p className="sh-base">
            Link withdrawable by the clinician · each open receipted · © 2026 VitalCV
          </p>
          <p className="sh-print-foot vt-num">
            Printed from vitalcv.com/p/{p.slug} · verify at vitalcv.com/api/receipts/verify · packet pk_7f3a·d91c
          </p>
        </Reveal>
      </main>
    </React.Fragment>
  );
};

Object.assign(window, { ShareView });
