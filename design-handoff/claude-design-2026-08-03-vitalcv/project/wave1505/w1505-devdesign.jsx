// Wave 1505 · w1505-devdesign.jsx — /dev/design living style guide
// (DG-18.2). Every primitive rendered in every state, with the usage
// rule beside it. If it isn't here, it isn't in the system.

const DD_SECTIONS = [
  ['palette', 'Palette'], ['type', 'Type ramp'], ['space', 'Spacing'], ['glyphs', 'Glyphs'],
  ['chips', 'StateChip ×9(+2)'], ['tiers', 'Tier badges'], ['buttons', 'Buttons'], ['forms', 'Forms'],
  ['rows', 'Evidence rows'], ['ring', 'ReadinessRing'], ['honesty', 'Honesty kit'], ['recognition', 'Recognition'],
  ['triad', 'Empty/Loading/Error'], ['motion', 'Motion'], ['z', 'Z-scale'],
];

const DDBand = ({ id, title, dg, rule, children, first }) => (
  <section id={`dd-${id}`} className={`dd-band${first ? ' first' : ''}`}>
    <div className="dd-band-head">
      <h2>{title}</h2>
      {dg ? <span className="dg vt-num">{dg}</span> : null}
    </div>
    {rule ? <p className="dd-rule">{rule}</p> : null}
    {children}
  </section>
);

const DD_PALETTE = [
  { t: '--vt-surface-page', h: '#f4f2ec', c: 'var(--vt-surface-page)', b: true },
  { t: '--vt-surface-card', h: '#ffffff', c: 'var(--vt-surface-card)', b: true },
  { t: '--vt-surface-sunken', h: '#efede7', c: 'var(--vt-surface-sunken)', b: true },
  { t: '--vt-text', h: '#141414', c: 'var(--vt-text)' },
  { t: '--vt-text-secondary', h: '#474540', c: 'var(--vt-text-secondary)' },
  { t: '--vt-text-muted', h: '#6b6860', c: 'var(--vt-text-muted)' },
  { t: '--vt-rule', h: '#dddbd3', c: 'var(--vt-rule)', b: true },
  { t: '--vt-brand', h: '#2c3e2d', c: 'var(--vt-brand)' },
  { t: '--vt-brand-soft', h: '#f0f4ef', c: 'var(--vt-brand-soft)', b: true },
  { t: '--vt-accent-editorial', h: '#4f46e5', c: 'var(--vt-accent-editorial)' },
  { t: '--vt-state-checked', h: '#1c5c38', c: 'var(--vt-state-checked)' },
  { t: '--vt-state-stale', h: '#7d5a1e', c: 'var(--vt-state-stale)' },
  { t: '--vt-state-p0', h: '#7a1414', c: 'var(--vt-state-p0)' },
  { t: '--vt-state-preview', h: '#1a3e6b', c: 'var(--vt-state-preview)' },
  { t: '--vt-state-contradicted', h: '#5b2a86', c: 'var(--vt-state-contradicted)' },
];

const DD_TYPE = [
  { m: 'display · Fraunces 560', style: { fontFamily: 'var(--font-display)', fontWeight: 560, fontSize: 'var(--text-3xl)', letterSpacing: '-0.015em', lineHeight: 1.1 }, s: 'Readiness is a record.' },
  { m: 'h2 · Fraunces 560 · 24', style: { fontFamily: 'var(--font-display)', fontWeight: 560, fontSize: 'var(--text-xl)', letterSpacing: '-0.015em' }, s: 'Sources, stated plainly' },
  { m: 'italic accent · indigo', style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 480, fontSize: 'var(--text-xl)', color: 'var(--vt-accent-editorial)' }, s: 'checked, not claimed' },
  { m: 'body · Geist 400 · 14/1.6', style: { fontSize: 14, lineHeight: 1.6 }, s: 'Body copy runs at fourteen over one-point-six, ink on paper, never lighter than --vt-text-secondary.' },
  { m: 'caption · Geist 400 · 12.5', style: { fontSize: 12.5, color: 'var(--vt-text-secondary)' }, s: 'Support copy passes 4.5:1 on paper.' },
  { m: 'eyebrow · Mono 500 · 10 caps', style: { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--vt-text-faint)', fontWeight: 500 }, s: 'Section eyebrow' },
  { m: 'data · Mono · tabular', style: { fontFamily: 'var(--font-mono)', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }, s: 'npi:1234567893 · run_2026-07-11_0642Z · 06:42Z' },
];

const DevDesignRoute = () => {
  const [motionKey, setMotionKey] = React.useState(0);
  const [npi, setNpi] = React.useState('123456');
  return (
    <S5Page eyebrow="DG-18.2 · /dev/design" title={<span>The system, <span className="vt-accent-i">rendered.</span></span>}
      lede="Every primitive in every state, with its usage rule. This page is the arbiter: if a surface disagrees with /dev/design, the surface is wrong."
      label="/dev/design style guide">
      <div className="s5-container">
        <nav className="dd-jump" aria-label="Sections">
          {DD_SECTIONS.map(([id, l]) => (
            <a key={id} href="#/dev/design" onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`dd-${id}`);
              if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset - 60);
            }}>{l}</a>
          ))}
        </nav>

        <DDBand first id="palette" title="Palette" dg="DG-1.1"
          rule="Tokens only — raw hex is lint-illegal outside wave1500 theme files. Matcha is reserved for Recognition moments and primary-button hover. Indigo exists solely for the italic display phrase, ≤1 per section.">
          <div className="dd-swatches">
            {DD_PALETTE.map((s) => (
              <div className="dd-swatch" key={s.t}>
                <div className="chip" style={{ background: s.c, borderBottom: s.b ? '1px solid var(--vt-rule-soft)' : 'none' }}></div>
                <div className="meta"><span className="t">{s.t}</span><span className="h vt-num">{s.h}</span></div>
              </div>
            ))}
          </div>
        </DDBand>

        <DDBand id="type" title="Type ramp" dg="DG-2.1"
          rule="Three faces, no more: Fraunces (display, optical sizing on), Geist (body), Geist Mono (eyebrows, identifiers, timestamps — always tabular-nums for metrics).">
          {DD_TYPE.map((r) => (
            <div className="dd-type-row" key={r.m}>
              <span className="m">{r.m}</span>
              <span style={r.style} className={r.m.includes('tabular') ? 'vt-num' : undefined}>{r.s}</span>
            </div>
          ))}
        </DDBand>

        <DDBand id="space" title="Spacing scale" dg="DG-1.5"
          rule="4px base. Section padding uses space-10/12/16; card padding space-4/5/6; never literal pixel margins between siblings — flex/grid gap only.">
          {[['--space-2', 8], ['--space-4', 16], ['--space-6', 24], ['--space-8', 32], ['--space-12', 48], ['--space-16', 64], ['--space-24', 96]].map(([t, w]) => (
            <div className="dd-space-row" key={t}>
              <span className="m vt-num">{t} · {w}px</span>
              <span className="bar" style={{ width: w * 3 }}></span>
            </div>
          ))}
        </DDBand>

        <DDBand id="glyphs" title="TrustGlyph set" dg="DG-4.2"
          rule="Monochrome, currentColor, stroke 1.5, legible at 14px. Glyph + label are always paired — a glyph alone is lint-illegal in chips. Grayscale legibility is the acceptance test.">
          <div className="dd-glyph-grid">
            {Object.keys(STATE_META).map((k) => (
              <div className="dd-glyph-cell" key={k}>
                <span className="g"><TrustGlyph state={k} size={20} /></span>
                <span className="n">{k}</span>
              </div>
            ))}
            {['T1', 'T2', 'T3', 'T4'].map((t) => (
              <div className="dd-glyph-cell" key={t}>
                <span className="g"><TrustGlyph state={t} size={20} /></span>
                <span className="n">{t} · fill {['¼', '½', '¾', 'full'][['T1', 'T2', 'T3', 'T4'].indexOf(t)]}</span>
              </div>
            ))}
          </div>
        </DDBand>

        <DDBand id="chips" title="StateChip — 9 coverage states + 2 review states" dg="DG-3.2 · 6.1"
          rule="The atomic visual unit. Dashed border = pending/previewOnly only. Tooltip carries source + freshness + definition. Never restyle locally; never a checkmark on gated/unavailable.">
          <div className="dd-grid">
            {Object.keys(STATE_META).map((s) => (
              <div className="dd-spec" key={s}>
                <span className="lab">{s}</span>
                <StateChip state={s} />
                <StateChip state={s} size="sm" />
              </div>
            ))}
          </div>
        </DDBand>

        <DDBand id="tiers" title="ProofTierBadge" dg="DG-6.6"
          rule="T1 self-attested → T4 signed institutional artifact. The fill fraction is the grayscale signal; the tooltip is the definition. Tier never substitutes for state.">
          <div className="dd-grid">
            {['T1', 'T2', 'T3', 'T4'].map((t) => (
              <div className="dd-spec" key={t}>
                <span className="lab">{t} · {TIER_DEFS[t].split('.')[0]}</span>
                <ProofTierBadge tier={t} />
              </div>
            ))}
          </div>
        </DDBand>

        <DDBand id="buttons" title="Buttons" dg="DG-6.3"
          rule="Primary = ink fill, matcha-900 hover — never matcha at rest. Secondary = rule outline. Quiet = underline-on-hover. Destructive = p0 outline, reserved for revocation. All ≥44px targets at coarse pointers.">
          <div className="dd-grid">
            <div className="dd-spec"><span className="lab">primary · rest / disabled / loading</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <PrimaryButton>Check readiness</PrimaryButton>
                <PrimaryButton disabled>Check readiness</PrimaryButton>
                <PrimaryButton loading>Checking</PrimaryButton>
              </div>
            </div>
            <div className="dd-spec"><span className="lab">secondary / quiet / destructive</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <SecondaryButton>View lineage</SecondaryButton>
                <QuietButton>Refresh source</QuietButton>
                <DestructiveButton>Revoke link</DestructiveButton>
              </div>
            </div>
            <div className="dd-spec"><span className="lab">focus ring — uniform everywhere</span>
              <button className="ck-primary" style={{ width: 'auto', padding: '0 20px', boxShadow: 'var(--vt-focus-ring)' }}>Focused state</button>
            </div>
          </div>
        </DDBand>

        <DDBand id="forms" title="Form kit" dg="DG-6.7 · 8.2"
          rule="46px inputs, rule-strong borders, radius-1. Errors are mono + glyph + aria-live, never color alone. The NPI field announces its digit count. Every form ships a designed error summary and success state.">
          <div className="s5-twocol">
            <div className="dd-spec" style={{ gap: 16 }}>
              <span className="lab">field · default / hint / error</span>
              <Field id="dd-f1" label="Work email" hint="We answer within two business days.">
                <TextInput id="dd-f1" placeholder="you@organization.org" />
              </Field>
              <Field id="dd-f2" label="Work email" required error="Enter a work email — personal domains are fine for clinicians.">
                <TextInput id="dd-f2" defaultValue="adaeze@" error="err" />
              </Field>
              <div className="fk-field">
                <label className="fk-label" htmlFor="dd-npi">NPI · live count</label>
                <NpiInput value={npi} onChange={setNpi} />
              </div>
            </div>
            <div className="dd-spec" style={{ gap: 16 }}>
              <span className="lab">error summary + success</span>
              <div className="fk-summary" role="presentation">
                <span className="t"><TrustGlyph state="p0" size={12} /> 2 fields need attention</span>
                <ul>
                  <li><button type="button">Work email — required.</button></li>
                  <li><button type="button">Topic — choose one.</button></li>
                </ul>
              </div>
              <div className="fk-success" style={{ padding: 'var(--space-5)' }} role="presentation">
                <StateChip state="checked" label="Recorded" />
                <h3 style={{ fontSize: 18 }}>Request recorded.</h3>
                <span className="receipt vt-num">req_2026-07-12_31bd</span>
              </div>
            </div>
          </div>
        </DDBand>

        <DDBand id="rows" title="Evidence rows" dg="DG-6.4 · 10.2"
          rule="Label / mono source / chip / freshness / action — same metrics everywhere. Blockers sort first and carry the p0 chip; gated stays gated until authorized, never assumed.">
          <div style={{ maxWidth: 640 }}>
            <SourceRow label="NPPES record" source="NPPES" state="checked" freshness="2h ago" iso="2026-07-11T12:04:00Z" />
            <SourceRow label="Exclusion list" source="OIG LEIE" state="stale" freshness="34d ago" iso="2026-06-08T09:00:00Z" action="Refresh" />
            <SourceRow label="Medicare enrollment" source="CMS PECOS" state="gated" action="Authorize read" />
            <SourceRow label="Texas license" source="TEXAS MEDICAL BOARD" state="p0" chipLabel="Blocker" freshness="21d ago" iso="2026-06-20T09:00:00Z" action="Resolve" />
          </div>
        </DDBand>

        <DDBand id="ring" title="ReadinessRing" dg="DG-6.5"
          rule='role="meter" with aria values; band by threshold (≥80 ready · ≥50 head start · else early); band is also written as text — never color alone. Sweeps once; static under reduced motion.'>
          <div className="dd-grid">
            {[[0, 'Early band'], [45, 'Early band'], [72, 'Head-start band'], [88, 'Ready band']].map(([v, b]) => (
              <div className="dd-spec" key={v} style={{ alignItems: 'center' }}>
                <span className="lab vt-num">{v}% · {b}</span>
                <ReadinessRing value={v} size={92} />
              </div>
            ))}
          </div>
        </DDBand>

        <DDBand id="honesty" title="Honesty kit" dg="DG-8.4 · 17.2"
          rule="HonestyLabel is designed UI, never fine print — mandatory on every illustrative number. HonestyPanel pairs 'what you get' with 'what stays outside' at equal visual weight.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <HonestyLabel>Illustrative figure — the signed scope carries the real one.</HonestyLabel>
            <div className="hn-pair" style={{ maxWidth: 760 }}>
              <HonestyPanel tone="ok" title="Checked today" items={[
                { label: 'NPPES record', source: 'NPPES', state: 'checked' },
                { label: 'California license', source: 'MBC', state: 'checked' },
              ]} />
              <HonestyPanel tone="watch" title="Stays outside" items={[
                { label: 'Medicare enrollment', source: 'CMS PECOS', state: 'gated', chipLabel: 'Gated' },
                { label: 'Employment history', source: 'SELF-ATTESTED', state: 'notDecisionGrade', chipLabel: 'Self-attested' },
              ]} foot="A partial proof stays partial." />
            </div>
          </div>
        </DDBand>

        <DDBand id="recognition" title="Recognition stamp" dg="DG-10.5"
          rule="THE reserved matcha moment — the only solid matcha on clinician surfaces. Archival tone: mono timestamp, packet id, numbered stamp. Never animated beyond its single entrance.">
          <div style={{ maxWidth: 640 }}>
            <RecognitionRow employer="Mercy General Health" iso="2026-06-30T14:22Z" packet={'pk_7f3a\u00b7d91c'} n="0012" />
          </div>
        </DDBand>

        <DDBand id="triad" title="Empty · loading · error" dg="DG-12.2"
          rule="Every data region ships all three in the same footprint. Empty states name the surface, say why, and offer ONE action. Errors never claim partial success.">
          <div className="hub-grid">
            <div className="hub-card"><span className="hid">loading</span><SkeletonStack /></div>
            <div className="hub-card"><span className="hid">empty</span>
              <EmptyState glyph="pending" title="No sources checked yet." why="Enter an NPI to run the first check." action="Enter an NPI" /></div>
            <div className="hub-card"><span className="hid">error</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--vt-state-p0)' }}>
                <TrustGlyph state="p0" size={13} /> Couldn't load. Nothing recorded.
              </span>
              <QuietButton small>Retry</QuietButton>
            </div>
          </div>
        </DDBand>

        <DDBand id="motion" title="Motion" dg="DG-5.2"
          rule="One curve: cubic-bezier(0.2, 0.8, 0.2, 1). 160/320/420ms. Single-shot entrances; hover lift ≤2px; no infinite loops on public surfaces except skeleton shimmer and the /status pulse. Reduced motion: static, opacity fades only.">
          <div className="dd-motion-demo">
            <div key={motionKey} className="dd-motion-box play"></div>
            <SecondaryButton onClick={() => setMotionKey(motionKey + 1)}>Replay .vt-enter</SecondaryButton>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--vt-text-muted)', letterSpacing: '0.05em' }}>
              var(--ease-house) · var(--dur-base) · translateY(10px) → 0
            </span>
          </div>
        </DDBand>

        <DDBand id="z" title="Z-index scale" dg="DG-12.5"
          rule="Literal z-index values are lint-illegal. Six stops, promoted this wave.">
          <div className="dd-ztable">
            {[['--vt-z-base', '0', 'page flow'], ['--vt-z-raised', '10', 'lifted cards, in-flow dropdowns'], ['--vt-z-nav', '40', 'sticky nav'], ['--vt-z-banner', '45', 'offline/degraded banner'], ['--vt-z-widget', '50', 'feedback affordance'], ['--vt-z-overlay', '60', 'panels above widgets'], ['--vt-z-skip', '100', 'skip link']].map(([t, v, u]) => (
              <div className="tok-row" key={t}>
                <span className="tok-key">{v}</span>
                <span className="tok-val vt-num">{t} · {u}</span>
                <CopyBtn text={`var(${t})`} />
              </div>
            ))}
          </div>
        </DDBand>
      </div>
    </S5Page>
  );
};

Object.assign(window, { DevDesignRoute });
