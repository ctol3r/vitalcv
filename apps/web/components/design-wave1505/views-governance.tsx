'use client';

/**
 * Wave 1505 port — governance routes: responsive/a11y audit checklist
 * (DG-14/15), the /dev/design living style guide (DG-18.2), and the
 * visual-regression + design-lint specs (DG-18.3/18.4). Ported from
 * wave1505/w1505-{audit,devdesign,governance}.jsx.
 *
 * Port adaptation: the prototype stamped audit rows with a bare Verified
 * status label; the repo truth contract bans that word as a status label,
 * so rows read Re-checked (same claim: the fix was re-run and held).
 */

import * as React from 'react';
import {
  CopyBtn, DestructiveButton, Field, HonestyLabel, HonestyPanel, NpiInput, PrimaryButton,
  ProofTierBadge, QuietButton, ReadinessRing, RecognitionRow, SecondaryButton, SourceRow,
  STATE_META, StateChip, TIER_DEFS, TextInput, TokenRow, TrustGlyph,
} from './kit';
import { EmptyState, S5Page, S5Section, SkeletonStack } from './shared';

/* ================= audit (w1505-audit.jsx) ================= */

interface AuditRow { id: string; surf: string; vp: string; find: string; fix: React.ReactNode }
interface AuditGroup { name: string; dg: string; method: string; rows: AuditRow[] }

const AUDIT_GROUPS: AuditGroup[] = [
  {
    name: 'Responsive integrity', dg: 'DG-14.1 · 14.3', method: 'VIEWPORTS 360 / 375 / 414 / 768 / 1024 / 1440 / 1920',
    rows: [
      { id: 'RES-01', surf: '1501 /', vp: '360px', find: 'Hero NPI input + inline button forced horizontal scroll below 375px.', fix: <span>Stacked the submit button under the input at ≤400px; input row wraps via <code>flex-wrap</code>. No horizontal scroll at 360.</span> },
      { id: 'RES-02', surf: '1503 /passport', vp: '360–414px', find: 'EvidenceRow chip cluster (tier + state + action) overflowed on long source names.', fix: <span><code>.ev3-cluster</code> wraps and right-aligns; source line gains <code>overflow-wrap:anywhere</code>. Re-checked at all three phone widths.</span> },
      { id: 'RES-03', surf: '1504 /trust', vp: '768px', find: 'SlotGrid held 3 columns too long — RUN_ID truncated at tablet width.', fix: <span>Breakpoint moved 860→920px for 2-col; cells already had <code>minmax(0,1fr)</code>. No truncation at 768.</span> },
      { id: 'RES-04', surf: '1502 /review/rev-2841', vp: '1920px', find: 'Reviewer table stretched full-bleed past readable measure.', fix: <span>Container discipline applied: <code>max-width: var(--container-max)</code> everywhere; wide tables get internal <code>overflow-x:auto</code> instead of page scroll.</span> },
      { id: 'RES-05', surf: 'All waves', vp: '360px', find: 'Three copy buttons and quiet actions measured under 44px hit area.', fix: <span><code>@media (pointer:coarse)</code> raises <code>.cp-btn</code> / <code>QuietButton</code> padding to a ≥44px target without changing desktop density.</span> },
      { id: 'RES-06', surf: '1505 feedback widget', vp: '360px', find: 'Risk flagged in brief: floating affordance overlapping CTAs.', fix: <span>Widget is a right-edge tab at 50% viewport height — geometrically cannot overlap bottom or inline CTAs; z from <code>--vt-z-widget</code>.</span> },
    ],
  },
  {
    name: 'Keyboard & focus', dg: 'DG-15.1 · 15.2', method: 'FULL TAB-THROUGH · NO POINTER',
    rows: [
      { id: 'KEY-01', surf: '1502 forms', vp: 'keyboard', find: 'ErrorSummary links moved focus but summary itself was skipped by SR order.', fix: <span><code>role=&quot;alert&quot;</code> on summary; buttons focus the offending field. Tab order re-checked: summary → fields in DOM order.</span> },
      { id: 'KEY-02', surf: '1502 /review reviewer actions', vp: 'keyboard', find: 'Accept / return / escalate reachable but activation state unclear.', fix: <span>All reviewer actions are real <code>&lt;button&gt;</code>s with <code>aria-pressed</code> where toggling; uniform <code>--vt-focus-ring</code> confirmed on every stop.</span> },
      { id: 'KEY-03', surf: 'All waves', vp: 'keyboard', find: 'No skip link — nav tab-through cost 9+ stops before content.', fix: <span><code>.skip-link</code> added to every shell (see this wave&rsquo;s nav); lands on <code>#main</code>. First Tab press reveals it.</span> },
      { id: 'KEY-04', surf: '1503 share page', vp: 'keyboard', find: 'Revoked-state page trapped focus in a dead CTA.', fix: 'Revoked page CTA now links home; no focus traps anywhere — Escape closes the 1505 feedback panel and returns focus to its tab.' },
      { id: 'KEY-05', surf: '1505 verify code', vp: 'keyboard', find: 'New surface — code cells could have been 6 separate inputs (hostile to paste + SR).', fix: <span>One real input drives six presentation cells (<code>aria-hidden</code>); paste works; count announced via <code>aria-live=&quot;polite&quot;</code>.</span> },
    ],
  },
  {
    name: 'State never by color alone', dg: 'DG-15.3', method: 'GRAYSCALE SCREENSHOT PASS',
    rows: [
      { id: 'CLR-01', surf: 'All StateChips', vp: 'grayscale', find: 'Audit confirmation: every chip pairs glyph + label by construction.', fix: <span>Confirmed in grayscale: checked/stale/gated/p0 remain distinguishable by glyph shape (check / clock / lock / triangle). No fix needed — gate holds.</span> },
      { id: 'CLR-02', surf: '1503 readiness bands', vp: 'grayscale', find: 'Ring band color was the only band signal at small sizes.', fix: <span>Band label (&ldquo;Ready band&rdquo; / &ldquo;Head-start band&rdquo; / &ldquo;Early band&rdquo;) rendered beside every ring ≥64px and in the meter label below it.</span> },
      { id: 'CLR-03', surf: '1504 /status spine', vp: 'grayscale', find: 'Degraded vs stale rows differed mainly by hue.', fix: <span>Degraded rows carry the dashed rule + slash glyph; stale carries clock + solid rule. Distinct in grayscale.</span> },
      { id: 'CLR-04', surf: '1502 HonestyPanel', vp: 'grayscale', find: 'ok/watch top borders identical weight in grayscale.', fix: 'Panels already lead with glyph + mono title; border is redundant encoding. Confirmed legible; no change.' },
    ],
  },
  {
    name: 'Screen-reader semantics', dg: 'DG-15.4 · 15.5', method: 'VOICEOVER + NVDA SPOT PASS',
    rows: [
      { id: 'SR-01', surf: 'ReadinessRing', vp: 'SR', find: 'Ring announced as bare image in early wave.', fix: <span><code>role=&quot;meter&quot;</code> + <code>aria-valuenow/min/max</code> + label &ldquo;Readiness: 72 percent&rdquo; — already in the 1500 primitive; re-checked as re-used everywhere, no local forks.</span> },
      { id: 'SR-02', surf: 'SourceRow groups', vp: 'SR', find: 'Evidence lists read as anonymous divs.', fix: <span>Groups render as described lists: <code>&lt;dl&gt;</code> per section with source + freshness in <code>&lt;dd&gt;</code>; group name announced once, not per row.</span> },
      { id: 'SR-03', surf: '1504 verifier constellation', vp: 'SR', find: 'Graph was silent to SR users.', fix: <span>Text alternative added: visually-hidden summary (&ldquo;12 verifiers, 3 institutional, most recent check 2h ago&rdquo;) + the same data in the adjacent table — graph marked <code>aria-hidden</code>.</span> },
      { id: 'SR-04', surf: 'All forms', vp: 'SR', find: 'Field errors visible but not announced on submit.', fix: <span>Errors render inside <code>role=&quot;alert&quot;</code> summary; field-level <code>aria-invalid</code> + <code>aria-describedby</code> wired in form-kit (1502) and inherited here.</span> },
      { id: 'SR-05', surf: 'NPI + code inputs', vp: 'SR', find: 'Digit progress was visual only.', fix: <span><code>aria-live=&quot;polite&quot;</code> count (&ldquo;4/10&rdquo;) on NPI (1501/1502) and the 1505 verification code. Announced on every digit.</span> },
    ],
  },
  {
    name: 'Reduced motion end-to-end', dg: 'DG-15.6 · DG-5.2', method: 'OS TOGGLE · EVERY SURFACE',
    rows: [
      { id: 'MOT-01', surf: 'All waves', vp: 'reduced-motion', find: 'Audit sweep of every @keyframes against the doctrine.', fix: <span>All entrances/sweeps sit inside <code>@media (prefers-reduced-motion: no-preference)</code>; with OS toggle on, every surface renders static except opacity fades. Two stray transform transitions (1501 hero, 1504 graph hover) moved inside the media query.</span> },
      { id: 'MOT-02', surf: 'Skeleton + status pulse', vp: 'reduced-motion', find: 'The two allowed infinite loops needed static fallbacks.', fix: 'Shimmer and /status live pulse render as static sunken bars / solid dot under reduced motion. Re-checked.' },
      { id: 'MOT-03', surf: '1503 ring sweep', vp: 'reduced-motion', find: 'Ring animated its dasharray on load regardless of preference.', fix: <span>Sweep transition gated by the media query; reduced motion shows the final value immediately. Meter value unaffected.</span> },
    ],
  },
];

export const AuditRoute = () => {
  const total = AUDIT_GROUPS.reduce((n, g) => n + g.rows.length, 0);
  return (
    <S5Page eyebrow="DG-14 · DG-15 · Quality gates" title={<span>Findings, fixes, <span className="vt-accent-i">re-checked.</span></span>}
      lede="Every surface from waves 1501–1504 swept at seven viewports, by keyboard, in grayscale, with a screen reader, and with reduced motion on. Each finding names its fix; each fix was re-checked before this page shipped."
      label="Audit checklist">
      <S5Section first>
        <div className="au-sum">
          <div className="au-sum-cell"><span className="k">Surfaces audited</span><span className="v vt-num">14</span><span className="s">waves 1501–1504 + this wave</span></div>
          <div className="au-sum-cell"><span className="k">Viewports</span><span className="v vt-num">7</span><span className="s">360 → 1920</span></div>
          <div className="au-sum-cell"><span className="k">Findings</span><span className="v vt-num">{total}</span><span className="s">incl. confirmations</span></div>
          <div className="au-sum-cell"><span className="k">Open</span><span className="v vt-num">0</span><span className="s">all fixed &amp; re-checked</span></div>
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
                <StateChip state="checked" size="sm" label="Re-checked" />
              </div>
            ))}
          </div>
        ))}
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.7, letterSpacing: '0.04em', color: 'var(--vt-text-secondary)', maxWidth: '88ch' }}>
          RE-RUN RULE · This checklist re-runs whenever a surface changes structure. The visual-regression matrix
          (<a href="#/governance">governance</a>) catches drift between runs; this sweep catches what screenshots can&rsquo;t — focus order, announcements, motion preference.
        </p>
      </S5Section>
    </S5Page>
  );
};

/* ================= /dev/design (w1505-devdesign.jsx) ================= */

const DD_SECTIONS: Array<[string, string]> = [
  ['palette', 'Palette'], ['type', 'Type ramp'], ['space', 'Spacing'], ['glyphs', 'Glyphs'],
  ['chips', 'StateChip ×9(+2)'], ['tiers', 'Tier badges'], ['buttons', 'Buttons'], ['forms', 'Forms'],
  ['rows', 'Evidence rows'], ['ring', 'ReadinessRing'], ['honesty', 'Honesty kit'], ['recognition', 'Recognition'],
  ['triad', 'Empty/Loading/Error'], ['motion', 'Motion'], ['z', 'Z-scale'],
];

const DDBand = ({ id, title, dg, rule, children, first }: {
  id: string; title: string; dg?: string; rule?: string; children?: React.ReactNode; first?: boolean;
}) => (
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

const DD_TYPE: Array<{ m: string; style: React.CSSProperties; s: string }> = [
  { m: 'display · Fraunces 560', style: { fontFamily: 'var(--font-display)', fontWeight: 560, fontSize: 'var(--text-3xl)', letterSpacing: '-0.015em', lineHeight: 1.1 }, s: 'Readiness is a record.' },
  { m: 'h2 · Fraunces 560 · 24', style: { fontFamily: 'var(--font-display)', fontWeight: 560, fontSize: 'var(--text-xl)', letterSpacing: '-0.015em' }, s: 'Sources, stated plainly' },
  { m: 'italic accent · indigo', style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 480, fontSize: 'var(--text-xl)', color: 'var(--vt-accent-editorial)' }, s: 'checked, not claimed' },
  { m: 'body · Geist 400 · 14/1.6', style: { fontSize: 14, lineHeight: 1.6 }, s: 'Body copy runs at fourteen over one-point-six, ink on paper, never lighter than --vt-text-secondary.' },
  { m: 'caption · Geist 400 · 12.5', style: { fontSize: 12.5, color: 'var(--vt-text-secondary)' }, s: 'Support copy passes 4.5:1 on paper.' },
  { m: 'eyebrow · Mono 500 · 10 caps', style: { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--vt-text-faint)', fontWeight: 500 }, s: 'Section eyebrow' },
  { m: 'data · Mono · tabular', style: { fontFamily: 'var(--font-mono)', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }, s: 'npi:1234567893 · run_2026-07-11_0642Z · 06:42Z' },
];

export const DevDesignRoute = () => {
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
          {([['--space-2', 8], ['--space-4', 16], ['--space-6', 24], ['--space-8', 32], ['--space-12', 48], ['--space-16', 64], ['--space-24', 96]] as Array<[string, number]>).map(([t, w]) => (
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
            {([[0, 'Early band'], [45, 'Early band'], [72, 'Head-start band'], [88, 'Ready band']] as Array<[number, string]>).map(([v, b]) => (
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
            <RecognitionRow employer="Mercy General Health" iso="2026-06-30T14:22Z" packet={'pk_7f3a·d91c'} n="0012" />
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
                <TrustGlyph state="p0" size={13} /> Couldn&rsquo;t load. Nothing recorded.
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
            {([['--vt-z-base', '0', 'page flow'], ['--vt-z-raised', '10', 'lifted cards, in-flow dropdowns'], ['--vt-z-nav', '40', 'sticky nav'], ['--vt-z-banner', '45', 'offline/degraded banner'], ['--vt-z-widget', '50', 'feedback affordance'], ['--vt-z-overlay', '60', 'panels above widgets'], ['--vt-z-skip', '100', 'skip link']] as Array<[string, string, string]>).map(([t, v, u]) => (
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

/* ================= governance (w1505-governance.jsx) ================= */

const VR_ROUTES = [
  { route: '/', wave: '1501', mask: 'none' },
  { route: '/pricing', wave: '1505', mask: 'none' },
  { route: '/contact', wave: '1505', mask: 'none' },
  { route: '/legal/privacy', wave: '1505', mask: 'none' },
  { route: '/get-ready', wave: '1503', mask: '[data-vr-mask="freshness"]' },
  { route: '/passport', wave: '1503', mask: 'freshness · ring value · run_id' },
  { route: '/p/[slug]', wave: '1503', mask: 'freshness · compiled-at' },
  { route: '/review/request', wave: '1502', mask: 'none' },
  { route: '/trust', wave: '1504', mask: 'checked_at · run_id · key fingerprints' },
  { route: '/status', wave: '1504', mask: 'all timestamps · live pulse cell' },
];
const VR_VPS = ['360×740', '768×1024', '1440×900'];

const LINT_RULES = [
  { id: 'LINT-01', sev: 'error', what: 'No raw color outside theme files',
    det: 'stylelint declaration-property-value-allowed-list: forbid /#[0-9a-f]{3,8}/i, /oklch|rgb|hsl/ on color props. Inline style props linted by eslint-plugin-react regex on style={{...}}.',
    allow: 'Allowed only in wave1500/01-primitives.css and brand asset files (og.css, svg exports).' },
  { id: 'LINT-02', sev: 'error', what: 'No raw lucide imports outside <Icon>',
    det: "eslint no-restricted-imports: { name: 'lucide-react', message: 'Import via components/Icon — glyph set is closed.' } — allowlist: components/Icon.tsx only. TrustGlyph states are the ONLY state iconography.",
    allow: 'components/Icon.tsx.' },
  { id: 'LINT-03', sev: 'error', what: 'No new @keyframes outside motion.css',
    det: 'stylelint custom rule: at-rule "keyframes" fails outside styles/motion.css. Grep gate in CI: `grep -rn "@keyframes" app/ components/` must return 0.',
    allow: 'styles/motion.css (house set: vt-enter, sk-sweep, status-pulse, al-sweep).' },
  { id: 'LINT-04', sev: 'error', what: 'No dark/ops tokens on public routes',
    det: 'Grep gate: `data-theme="ops"`, var(--ink-950) as background, or --vt-surface-inverse anywhere under app/(public)/ fails. Playwright assert: body background = rgb(244,242,236) on all 10 matrix routes.',
    allow: 'app/(ops)/ surfaces only.' },
  { id: 'LINT-05', sev: 'error', what: 'No literal z-index',
    det: 'stylelint declaration-property-value-allowed-list: z-index must match /var\\(--vt-z-/. Six stops exist; a seventh requires a CHANGES.md entry.',
    allow: 'wave1500 token files.' },
  { id: 'LINT-06', sev: 'error', what: 'No shadows except --vt-lift; radius ≤6px public',
    det: 'stylelint: box-shadow value must be none or var(--vt-lift) or var(--vt-focus-ring); border-radius on public routes must be var(--radius-1|2|3). --radius-ops greps to app/(ops)/ only.',
    allow: 'ops theme may use --radius-ops.' },
  { id: 'LINT-07', sev: 'error', what: 'Gated/unavailable must never render a checkmark',
    det: 'Component-level test: StateChip snapshot for state=gated|unavailable|accessRequired must contain lock/slash/key path data, never the check path. Do/don’t pair #1 in DESIGN_SYSTEM.md.',
    allow: '—' },
  { id: 'LINT-08', sev: 'error', what: 'Copy prohibitions',
    det: 'CI grep over app/ + content/ for the prohibited-phrase list (invented counts, borrowed-logo strips, ROI guarantees, absolute-security claims). Pricing adds: unlabeled $-figures — any /\\$\\d/ in app/(public)/pricing must sit within 3 lines of <HonestyLabel>.',
    allow: 'Legal docs may quote prohibited phrases when prohibiting them.' },
  { id: 'LINT-09', sev: 'warn', what: 'Font-family literals',
    det: "stylelint: font-family must be var(--font-display|body|mono). Warn (not error) because next/font emits its own literals in generated files — allowlist .next/ and fonts.ts.",
    allow: 'lib/fonts.ts.' },
  { id: 'LINT-10', sev: 'warn', what: 'Glyph without label inside chips',
    det: 'eslint-plugin-jsx-a11y custom: <TrustGlyph> rendered as only child of a chip-role element without sibling text or aria-label warns. Grayscale legibility depends on the pairing.',
    allow: 'Decorative glyphs beside full sentences (aria-hidden).' },
];

export const GovernanceRoute = () => (
  <S5Page eyebrow="DG-18.3 · 18.4 · Governance" title={<span>Guarded, or it <span className="vt-accent-i">drifts.</span></span>}
    lede="Two machine-enforceable specs keep the system honest after the design program ends: a screenshot matrix that catches visual drift, and lint rules that make off-system code fail CI. Canonical text ships as REGRESSION_MATRIX.md and DESIGN_LINT.md."
    label="Governance">
    <S5Section first eyebrow="DG-18.3" title="Visual-regression matrix — 10 routes × 3 viewports"
      lede="Playwright screenshot tests. Fonts awaited via document.fonts.ready; reduced motion forced so entrances never race the capture; dynamic content masked, never mocked silently.">
      <div className="gv-matrix-wrap">
        <table className="gv-matrix">
          <thead>
            <tr><th scope="col">Route</th><th scope="col">Wave</th><th scope="col">Viewports</th><th scope="col">Masked regions</th></tr>
          </thead>
          <tbody>
            {VR_ROUTES.map((r) => (
              <tr key={r.route}>
                <td className="route">{r.route}</td>
                <td className="wave vt-num">{r.wave}</td>
                <td>{VR_VPS.map((v) => <span className="vp-ok vt-num" key={v}><TrustGlyph state="checked" size={10} />{v}</span>)}</td>
                <td className="mask">{r.mask}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 20 }}>
        <ul className="mono-list" style={{ maxWidth: '88ch' }}>
          <li>Masking: elements carry data-vr-mask=&quot;freshness|runid|timestamp&quot;; the spec masks by attribute selector — never by pixel coordinates.</li>
          <li>Threshold: maxDiffPixelRatio 0.001 · animations: &lsquo;disabled&rsquo; · prefers-reduced-motion: &lsquo;reduce&rsquo; · deviceScaleFactor 2.</li>
          <li>Wait: document.fonts.ready + network idle; /status additionally masks the live pulse cell rather than freezing it.</li>
          <li>Baseline updates require a CHANGES.md entry naming the intentional visual change — CI links the diff to the entry.</li>
        </ul>
      </div>
      {/* port: the canonical spec docs live in the design handoff, not as page downloads */}
      <p style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--vt-text-secondary)' }}>
        REGRESSION_MATRIX.md — full Playwright spec · in-repo at design-handoff/claude-design-2026-07-12-wave1505/wave1505/
      </p>
    </S5Section>

    <S5Section eyebrow="DG-18.4" title="Design-lint rules — off-system code fails CI"
      lede="Each rule: what it forbids, how it's detected, where exceptions live. Severity error blocks merge; warn blocks release.">
      <div>
        {LINT_RULES.map((r) => (
          <div className="gv-rule" key={r.id}>
            <span className="rid vt-num">{r.id}<span className={`sev${r.sev === 'warn' ? ' warn' : ''}`}>{r.sev.toUpperCase()}</span></span>
            <div className="rbody">
              <span className="what">{r.what}</span>
              <span className="det">{r.det}</span>
              <span className="allow"><strong style={{ fontWeight: 600 }}>Allowed:</strong> {r.allow}</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 20, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--vt-text-secondary)' }}>
        DESIGN_LINT.md — rule set with exact configs · DESIGN_SYSTEM.md — the canonical doc (DG-18.1) · both in-repo beside the matrix spec
      </p>
    </S5Section>
  </S5Page>
);
