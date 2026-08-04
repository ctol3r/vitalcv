// Wave 1500 · Foundation view — palette + type spec (DG-1.1, DG-2.x)
const Swatch = ({ name, varName, hex, role, note }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '44px 150px 130px 1fr', alignItems: 'center',
    gap: 14, padding: '8px 0', borderBottom: '1px solid var(--vt-rule-soft)' }}>
    <div style={{ width: 44, height: 28, background: hex || `var(${varName})`,
      border: '1px solid var(--vt-rule)', borderRadius: 'var(--radius-1)' }}></div>
    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--vt-text)' }}>{varName}</code>
    <span style={{ fontSize: 12, fontWeight: 500 }}>{name}</span>
    <span style={{ fontSize: 11.5, color: 'var(--vt-text-secondary)' }}>{role}{note ? <em style={{ color: 'var(--vt-text-muted)' }}> — {note}</em> : null}</span>
  </div>
);

const SectionHead = ({ num, title, lede }) => (
  <div style={{ borderBottom: '1px solid var(--vt-rule-strong)', paddingBottom: 10, margin: '56px 0 20px',
    display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
    <span className="vt-eyebrow">{num}</span>
    <h2 style={{ fontSize: 22 }}>{title}</h2>
    {lede ? <span style={{ fontSize: 12.5, color: 'var(--vt-text-secondary)', marginLeft: 'auto', maxWidth: 420 }}>{lede}</span> : null}
  </div>
);

const KilledChip = ({ children }) => (
  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px',
    color: 'var(--vt-state-p0)', border: '1px dashed var(--vt-state-p0-rule)',
    textDecoration: 'line-through', borderRadius: 'var(--radius-1)' }}>{children}</span>
);

const ViewFoundation = () => (
  <div>
    <SectionHead num="01" title="Canonical palette" lede="One accent decision, resolved. Trust Blue and teal are dead." />

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
      <PaperCard>
        <div className="vt-eyebrow" style={{ marginBottom: 12 }}>Paper + Ink · Workhorse</div>
        <Swatch name="Page paper" varName="--vt-surface-page" role="Every public page background" />
        <Swatch name="Card paper" varName="--vt-surface-card" role="Raised cards — rules, never shadows" />
        <Swatch name="Ink" varName="--vt-text" role="Body text, primary buttons, borders, focus" note="the brutalist character" />
        <Swatch name="Ink secondary" varName="--vt-text-secondary" role="Supporting copy — passes 4.5:1 on paper" />
        <Swatch name="Ink muted" varName="--vt-text-muted" role="Captions ≥12px only; replaces 40%-alpha ink (DG-3.1)" />
        <Swatch name="Rule" varName="--vt-rule" role="Hairlines, card borders" />
      </PaperCard>
      <PaperCard>
        <div className="vt-eyebrow" style={{ marginBottom: 12 }}>Accents · Exactly two, strictly scoped</div>
        <Swatch name="Matcha" varName="--vt-brand" role="THE brand accent: Recognition moments, brand chips, primary hover, meta theme-color" />
        <Swatch name="Matcha strong" varName="--vt-brand-strong" role="Hover/pressed brand" />
        <Swatch name="Matcha soft" varName="--vt-brand-soft" role="Brand tint surfaces, selection" />
        <Swatch name="Indigo" varName="--vt-accent-editorial" role="Italic Fraunces display accent ONLY — ≤1 phrase per section (DG-2.4)" />
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="vt-eyebrow">Killed</span>
          <KilledChip>Trust Blue oklch(.55 .2 255)</KilledChip>
          <KilledChip>teal #0a7b7f</KilledChip>
          <KilledChip>--vt-glow-*</KilledChip>
          <KilledChip>glass on public</KilledChip>
        </div>
      </PaperCard>
    </div>

    <SectionHead num="02" title="Typography" lede="Fraunces × Geist × Geist Mono — loaded for real (DG-2.1)." />
    <PaperCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div className="vt-eyebrow" style={{ marginBottom: 8 }}>Display · Fraunces · italic accent rule</div>
          <h1 style={{ fontSize: 'var(--text-3xl)', lineHeight: 1.06 }}>
            Your career record <span className="vt-accent-i">follows you.</span>
          </h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div className="vt-eyebrow" style={{ marginBottom: 8 }}>Body · Geist</div>
            <p style={{ margin: 0, maxWidth: '48ch', fontSize: 14, color: 'var(--vt-text-secondary)' }}>
              VitalCV reads primary sources and shows each one's honest state. What it cannot check, it says so — a gated source is never a bare checkmark.
            </p>
          </div>
          <div>
            <div className="vt-eyebrow" style={{ marginBottom: 8 }}>Data · Geist Mono · tabular</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11.5 }} className="vt-num">
              <span>NPI 1780 6842 39</span>
              <span>RUN_ID a41c-2209 · CHECKED_AT 2026-07-11T14:02:11Z</span>
              <span>sha256 9f2b…c4e1</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', borderTop: '1px solid var(--vt-rule-soft)', paddingTop: 14 }}>
          {[['Eyebrow', 'mono 10 · caps · +0.2em'], ['Body', 'Geist 14/1.6'], ['Display', 'Fraunces clamp(38–68)'], ['Metric', 'Fraunces + tabular-nums']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="vt-eyebrow">{k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--vt-text-secondary)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </PaperCard>

    <SectionHead num="03" title="Motion + radius doctrine" lede="Single-shot 320ms house curve. Near-sharp radii. No loops, no glows." />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-6)' }}>
      {[
        ['House curve', 'cubic-bezier(.2,.8,.2,1) · 240–420ms · entrances play once. Loops allowed only: skeleton shimmer while loading, live pulse on /status.'],
        ['Radius', '2–6px on all public surfaces. 12px reserved for ops. One scale — the --radius-* / --vt-radius-* duplication is gone.'],
        ['Shadows', 'Paper uses rules, not shadows. One exception: the hover lift (≤2px translate + --vt-lift). Ambient glows killed.'],
      ].map(([t, c]) => (
        <PaperCard key={t}>
          <div className="vt-eyebrow" style={{ marginBottom: 8 }}>{t}</div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--vt-text-secondary)', lineHeight: 1.6 }}>{c}</p>
        </PaperCard>
      ))}
    </div>
  </div>
);

Object.assign(window, { ViewFoundation, SectionHead });
