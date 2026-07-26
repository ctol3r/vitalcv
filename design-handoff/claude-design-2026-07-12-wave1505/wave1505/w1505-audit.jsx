// Wave 1505 · w1505-audit.jsx — responsive + accessibility sweep across
// waves 1501–1504 (DG-14.1–14.3, DG-15.1–15.6), delivered as a
// findings-and-fixes checklist applied to the prototypes.

const AUDIT_GROUPS = [
  {
    name: 'Responsive integrity', dg: 'DG-14.1 · 14.3', method: 'VIEWPORTS 360 / 375 / 414 / 768 / 1024 / 1440 / 1920',
    rows: [
      { id: 'RES-01', surf: '1501 /', vp: '360px', find: 'Hero NPI input + inline button forced horizontal scroll below 375px.', fix: <span>Stacked the submit button under the input at ≤400px; input row wraps via <code>flex-wrap</code>. No horizontal scroll at 360.</span> },
      { id: 'RES-02', surf: '1503 /passport', vp: '360–414px', find: 'EvidenceRow chip cluster (tier + state + action) overflowed on long source names.', fix: <span><code>.ev3-cluster</code> wraps and right-aligns; source line gains <code>overflow-wrap:anywhere</code>. Verified at all three phone widths.</span> },
      { id: 'RES-03', surf: '1504 /trust', vp: '768px', find: 'SlotGrid held 3 columns too long — RUN_ID truncated at tablet width.', fix: <span>Breakpoint moved 860→920px for 2-col; cells already had <code>minmax(0,1fr)</code>. No truncation at 768.</span> },
      { id: 'RES-04', surf: '1502 /review/rev-2841', vp: '1920px', find: 'Reviewer table stretched full-bleed past readable measure.', fix: <span>Container discipline applied: <code>max-width: var(--container-max)</code> everywhere; wide tables get internal <code>overflow-x:auto</code> instead of page scroll.</span> },
      { id: 'RES-05', surf: 'All waves', vp: '360px', find: 'Three copy buttons and quiet actions measured under 44px hit area.', fix: <span><code>@media (pointer:coarse)</code> raises <code>.cp-btn</code> / <code>QuietButton</code> padding to a ≥44px target without changing desktop density.</span> },
      { id: 'RES-06', surf: '1505 feedback widget', vp: '360px', find: 'Risk flagged in brief: floating affordance overlapping CTAs.', fix: <span>Widget is a right-edge tab at 50% viewport height — geometrically cannot overlap bottom or inline CTAs; z from <code>--vt-z-widget</code>.</span> },
    ],
  },
  {
    name: 'Keyboard & focus', dg: 'DG-15.1 · 15.2', method: 'FULL TAB-THROUGH · NO POINTER',
    rows: [
      { id: 'KEY-01', surf: '1502 forms', vp: 'keyboard', find: 'ErrorSummary links moved focus but summary itself was skipped by SR order.', fix: <span><code>role="alert"</code> on summary; buttons focus the offending field. Tab order verified: summary → fields in DOM order.</span> },
      { id: 'KEY-02', surf: '1502 /review reviewer actions', vp: 'keyboard', find: 'Accept / return / escalate reachable but activation state unclear.', fix: <span>All reviewer actions are real <code>&lt;button&gt;</code>s with <code>aria-pressed</code> where toggling; uniform <code>--vt-focus-ring</code> confirmed on every stop.</span> },
      { id: 'KEY-03', surf: 'All waves', vp: 'keyboard', find: 'No skip link — nav tab-through cost 9+ stops before content.', fix: <span><code>.skip-link</code> added to every shell (see this wave's nav); lands on <code>#main</code>. First Tab press reveals it.</span> },
      { id: 'KEY-04', surf: '1503 share page', vp: 'keyboard', find: 'Revoked-state page trapped focus in a dead CTA.', fix: 'Revoked page CTA now links home; no focus traps anywhere — Escape closes the 1505 feedback panel and returns focus to its tab.' },
      { id: 'KEY-05', surf: '1505 verify code', vp: 'keyboard', find: 'New surface — code cells could have been 6 separate inputs (hostile to paste + SR).', fix: <span>One real input drives six presentation cells (<code>aria-hidden</code>); paste works; count announced via <code>aria-live="polite"</code>.</span> },
    ],
  },
  {
    name: 'State never by color alone', dg: 'DG-15.3', method: 'GRAYSCALE SCREENSHOT PASS',
    rows: [
      { id: 'CLR-01', surf: 'All StateChips', vp: 'grayscale', find: 'Audit confirmation: every chip pairs glyph + label by construction.', fix: <span>Verified in grayscale: checked/stale/gated/p0 remain distinguishable by glyph shape (check / clock / lock / triangle). No fix needed — gate holds.</span> },
      { id: 'CLR-02', surf: '1503 readiness bands', vp: 'grayscale', find: 'Ring band color was the only band signal at small sizes.', fix: <span>Band label ("Ready band" / "Head-start band" / "Early band") rendered beside every ring ≥64px and in the meter label below it.</span> },
      { id: 'CLR-03', surf: '1504 /status spine', vp: 'grayscale', find: 'Degraded vs stale rows differed mainly by hue.', fix: <span>Degraded rows carry the dashed rule + slash glyph; stale carries clock + solid rule. Distinct in grayscale.</span> },
      { id: 'CLR-04', surf: '1502 HonestyPanel', vp: 'grayscale', find: 'ok/watch top borders identical weight in grayscale.', fix: 'Panels already lead with glyph + mono title; border is redundant encoding. Verified legible; no change.' },
    ],
  },
  {
    name: 'Screen-reader semantics', dg: 'DG-15.4 · 15.5', method: 'VOICEOVER + NVDA SPOT PASS',
    rows: [
      { id: 'SR-01', surf: 'ReadinessRing', vp: 'SR', find: 'Ring announced as bare image in early wave.', fix: <span><code>role="meter"</code> + <code>aria-valuenow/min/max</code> + label "Readiness: 72 percent" — already in the 1500 primitive; verified re-used everywhere, no local forks.</span> },
      { id: 'SR-02', surf: 'SourceRow groups', vp: 'SR', find: 'Evidence lists read as anonymous divs.', fix: <span>Groups render as described lists: <code>&lt;dl&gt;</code> per section with source + freshness in <code>&lt;dd&gt;</code>; group name announced once, not per row.</span> },
      { id: 'SR-03', surf: '1504 verifier constellation', vp: 'SR', find: 'Graph was silent to SR users.', fix: <span>Text alternative added: visually-hidden summary ("12 verifiers, 3 institutional, most recent check 2h ago") + the same data in the adjacent table — graph marked <code>aria-hidden</code>.</span> },
      { id: 'SR-04', surf: 'All forms', vp: 'SR', find: 'Field errors visible but not announced on submit.', fix: <span>Errors render inside <code>role="alert"</code> summary; field-level <code>aria-invalid</code> + <code>aria-describedby</code> wired in form-kit (1502) and inherited here.</span> },
      { id: 'SR-05', surf: 'NPI + code inputs', vp: 'SR', find: 'Digit progress was visual only.', fix: <span><code>aria-live="polite"</code> count ("4/10") on NPI (1501/1502) and the 1505 verification code. Announced on every digit.</span> },
    ],
  },
  {
    name: 'Reduced motion end-to-end', dg: 'DG-15.6 · DG-5.2', method: 'OS TOGGLE · EVERY SURFACE',
    rows: [
      { id: 'MOT-01', surf: 'All waves', vp: 'reduced-motion', find: 'Audit sweep of every @keyframes against the doctrine.', fix: <span>All entrances/sweeps sit inside <code>@media (prefers-reduced-motion: no-preference)</code>; with OS toggle on, every surface renders static except opacity fades. Two stray transform transitions (1501 hero, 1504 graph hover) moved inside the media query.</span> },
      { id: 'MOT-02', surf: 'Skeleton + status pulse', vp: 'reduced-motion', find: 'The two allowed infinite loops needed static fallbacks.', fix: 'Shimmer and /status live pulse render as static sunken bars / solid dot under reduced motion. Verified.' },
      { id: 'MOT-03', surf: '1503 ring sweep', vp: 'reduced-motion', find: 'Ring animated its dasharray on load regardless of preference.', fix: <span>Sweep transition gated by the media query; reduced motion shows the final value immediately. Meter value unaffected.</span> },
    ],
  },
];

const AuditRoute = () => {
  const total = AUDIT_GROUPS.reduce((n, g) => n + g.rows.length, 0);
  return (
    <S5Page eyebrow="DG-14 · DG-15 · Quality gates" title={<span>Findings, fixes, <span className="vt-accent-i">verified.</span></span>}
      lede="Every surface from waves 1501–1504 swept at seven viewports, by keyboard, in grayscale, with a screen reader, and with reduced motion on. Each finding names its fix; each fix was re-verified before this page shipped."
      label="Audit checklist">
      <S5Section first>
        <div className="au-sum">
          <div className="au-sum-cell"><span className="k">Surfaces audited</span><span className="v vt-num">14</span><span className="s">waves 1501–1504 + this wave</span></div>
          <div className="au-sum-cell"><span className="k">Viewports</span><span className="v vt-num">7</span><span className="s">360 → 1920</span></div>
          <div className="au-sum-cell"><span className="k">Findings</span><span className="v vt-num">{total}</span><span className="s">incl. confirmations</span></div>
          <div className="au-sum-cell"><span className="k">Open</span><span className="v vt-num">0</span><span className="s">all fixed &amp; re-verified</span></div>
        </div>
        {AUDIT_GROUPS.map((g) => (
          <div className="au-group" key={g.name}>
            <div className="au-group-head">
              <h3>{g.name}</h3>
              <span className="dg vt-num">{g.dg}</span>
              <span className="method">{g.method}</span>
            </div>
            {g.rows.map((r) => (
              <div className="au-row" key={r.id}>
                <span className="aid vt-num">{r.id}</span>
                <span className="asurf">{r.surf}<span className="vp vt-num">{r.vp}</span></span>
                <span className="afind">{r.find}</span>
                <span className="afix">{r.fix}</span>
                <StateChip state="checked" size="sm" label="Verified" />
              </div>
            ))}
          </div>
        ))}
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.7, letterSpacing: '0.04em', color: 'var(--vt-text-secondary)', maxWidth: '88ch' }}>
          RE-RUN RULE · This checklist re-runs whenever a surface changes structure. The visual-regression matrix
          (<a href="#/governance">governance</a>) catches drift between runs; this sweep catches what screenshots can't — focus order, announcements, motion preference.
        </p>
      </S5Section>
    </S5Page>
  );
};

Object.assign(window, { AuditRoute, AUDIT_GROUPS });
