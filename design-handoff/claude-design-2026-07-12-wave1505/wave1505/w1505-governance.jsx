// Wave 1505 · w1505-governance.jsx — visual-regression matrix (DG-18.3)
// + design-lint rules (DG-18.4), rendered. Canonical text lives in
// REGRESSION_MATRIX.md and DESIGN_LINT.md beside this file.

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
    det: 'CI grep over app/ + content/: /\\b(cheapest|guaranteed ROI|as seen in|trusted by \\d|100% (secure|verified)|blockchain-verified)\\b/i fails the build. Pricing adds: unlabeled $-figures — any /\\$\\d/ in app/(public)/pricing must sit within 3 lines of <HonestyLabel>.',
    allow: 'Legal docs may quote prohibited phrases when prohibiting them.' },
  { id: 'LINT-09', sev: 'warn', what: 'Font-family literals',
    det: "stylelint: font-family must be var(--font-display|body|mono). Warn (not error) because next/font emits its own literals in generated files — allowlist .next/ and fonts.ts.",
    allow: 'lib/fonts.ts.' },
  { id: 'LINT-10', sev: 'warn', what: 'Glyph without label inside chips',
    det: 'eslint-plugin-jsx-a11y custom: <TrustGlyph> rendered as only child of a chip-role element without sibling text or aria-label warns. Grayscale legibility depends on the pairing.',
    allow: 'Decorative glyphs beside full sentences (aria-hidden).' },
];

const GovernanceRoute = () => (
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
          <li>Masking: elements carry data-vr-mask="freshness|runid|timestamp"; the spec masks by attribute selector — never by pixel coordinates.</li>
          <li>Threshold: maxDiffPixelRatio 0.001 · animations: 'disabled' · prefers-reduced-motion: 'reduce' · deviceScaleFactor 2.</li>
          <li>Wait: document.fonts.ready + network idle; /status additionally masks the live pulse cell rather than freezing it.</li>
          <li>Baseline updates require a CHANGES.md entry naming the intentional visual change — CI links the diff to the entry.</li>
        </ul>
      </div>
      <p style={{ marginTop: 16 }}><a href="REGRESSION_MATRIX.md" download>REGRESSION_MATRIX.md</a> — full Playwright spec, ready to implement.</p>
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
      <p style={{ marginTop: 20 }}><a href="DESIGN_LINT.md" download>DESIGN_LINT.md</a> — rule set with exact configs · <a href="DESIGN_SYSTEM.md" download>DESIGN_SYSTEM.md</a> — the canonical doc (DG-18.1).</p>
    </S5Section>
  </S5Page>
);

Object.assign(window, { GovernanceRoute, VR_ROUTES, LINT_RULES });
