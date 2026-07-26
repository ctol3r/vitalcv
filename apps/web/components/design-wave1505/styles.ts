/**
 * Wave 1505 scoped stylesheet — GENERATED from the verbatim design handoff at
 * design-handoff/claude-design-2026-07-12-wave1505/ (see scratchpad
 * build-w1505-css.mjs provenance note in the PR). Every selector is scoped
 * under the .w1505 root so tokens and element styles cannot leak into the
 * app shell; @keyframes are renamed w1505-* to avoid global collisions.
 *
 * Intentional deviations from the prototype (documented, minimal):
 *  - [data-theme="ops"] dark theme and the .mz compat alias are dropped
 *    (wave 1505 is public/light-only).
 *  - @page print-margin rules are dropped (global print state is not this
 *    surface's to set).
 *  - .s5-proto sits at bottom: 72px so it clears the app's floating
 *    feedback button.
 *  - .lg-prose ul gets list-style: disc back (Tailwind preflight strips it).
 */
// prettier-ignore
export const WAVE1505_CSS = `
/* ============================================================
   Wave 1505 scoped stylesheet — generated from the design handoff
   at design-handoff/claude-design-2026-07-12-wave1505/.
   Every selector is scoped under .w1505; keyframes are renamed
   w1505-*. Source order: wave1500 tokens -> base -> 1502/1503/1504
   fragments -> w1505.css -> repo compat.
   ============================================================ */

/* ============================================================
   VitalCV · 01-primitives.css · Wave 1500 (DG-1.1 / DG-1.3)
   RAW SCALES ONLY. No component may reference these directly —
   consume roles from 02-semantic.css.
   Sources: matcha-zen doctrine + D56 calm wave (adopted),
   vitalTokens.css Trust Blue / teal / glass / glow (DROPPED).
   ============================================================ */
.w1505 {
  /* ---- PAPER (warm surface scale) ---- */
  --paper-0:   #ffffff;   /* raised card on paper */
  --paper-50:  #f7f6f2;
  --paper-100: #f4f2ec;   /* canonical page paper */
  --paper-200: #efede7;
  --paper-300: #e4e3e0;   /* deep paper / theme bridge */

  /* ---- INK (warm near-black scale, anchored at #141414) ---- */
  --ink-950: #0d0d0b;
  --ink-900: #141414;    /* canonical ink */
  --ink-800: #1a1916;
  --ink-700: #2d2c28;
  --ink-600: #474540;
  --ink-500: #6b6860;    /* min for small text on paper (AA at 12px+) */
  --ink-400: #96938a;    /* eyebrows / disabled only — never body text */
  --ink-300: #c2bfb5;
  --ink-200: #dddbd3;    /* rule */
  --ink-100: #eceae4;    /* rule-soft */

  /* ---- MATCHA (the ONE brand accent family) ---- */
  --matcha-950: #16211a;
  --matcha-900: #1f2c22;
  --matcha-800: #2c3e2d;   /* canonical brand · meta theme-color */
  --matcha-700: #3a4f3b;
  --matcha-600: #4a634c;
  --matcha-300: #a9bfa9;
  --matcha-100: #e3eae2;
  --matcha-50:  #f0f4ef;

  /* ---- INDIGO (editorial italic accent ONLY — DG-2.4) ---- */
  --indigo-600: #4f46e5;
  --indigo-700: #4338ca;

  /* ---- TRUTH-STATE HUES (D56, contrast-checked on paper) ---- */
  --hue-ok:        #1c5c38;  --hue-ok-bg:      #f0faf5;  --hue-ok-rule:      #86c9a6;
  --hue-watch:     #7d5a1e;  --hue-watch-bg:   #fdf4e7;  --hue-watch-rule:   #c9a84c;
  --hue-p0:        #7a1414;  --hue-p0-bg:      #fef2f2;  --hue-p0-rule:      #f5a5a5;
  --hue-info:      #1a3e6b;  --hue-info-bg:    #eff6ff;  --hue-info-rule:    #bfdbfe;
  --hue-unknown:   #3f3d38;  --hue-unknown-bg: #f1efe9;  --hue-unknown-rule: #c8c4ba;
  --hue-contra:    #5b2a86;  --hue-contra-bg:  #f6f0fb;  --hue-contra-rule:  #cdb0e8;

  /* ---- TYPE ---- */
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', monospace;

  --text-2xs: 10px;  --text-xs: 11px;  --text-sm: 12.5px; --text-base: 14px;
  --text-md: 16px;   --text-lg: 19px;  --text-xl: 24px;   --text-2xl: 32px;
  --text-3xl: 44px;  --text-4xl: 60px; --text-display: clamp(38px, 5.2vw, 68px);

  /* ---- SPACE (4px base) ---- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-24: 96px; --space-32: 128px;

  /* ---- RADIUS (DG-1.9: near-sharp public; large radii = ops only) ---- */
  --radius-1: 2px;  --radius-2: 4px;  --radius-3: 6px;
  --radius-ops: 12px; /* OPS-ONLY */

  /* ---- MOTION (DG-5.2 doctrine) ---- */
  --ease-house: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 160ms;  --dur-base: 320ms;  --dur-slow: 420ms;

  /* ---- CONTAINER ---- */
  --container-max: 1200px;
  --prose-max: 68ch;
}

/* ============================================================
   VitalCV · 02-semantic.css · Wave 1500 (DG-1.1 / DG-3.2)
   ROLE TOKENS. Components consume ONLY these.

   ┌────────────────────────── TOKEN SPEC ──────────────────────────┐
   │ NAME                     ROLE                    USAGE RULE     │
   │ --vt-surface-page        page background         every public   │
   │ --vt-surface-card        raised paper card       cards, mocks   │
   │ --vt-text / -secondary   body ink                4.5:1 on paper │
   │ --vt-text-muted          captions ≥12px          NOT body text  │
   │ --vt-brand               matcha 800              Recognition    │
   │                                                  moments, brand │
   │                                                  chips, primary │
   │                                                  hover — never  │
   │                                                  body text bg   │
   │ --vt-accent-editorial    indigo                  italic Fraunces│
   │                                                  display accent │
   │                                                  ONLY, ≤1/section│
   │ --vt-state-*             9 coverage states       StateChip only │
   │ KILLED: Trust Blue oklch(.55 .2 255), teal #0a7b7f, --vt-glow-*,│
   │ glass tokens on public surfaces.                                │
   └────────────────────────────────────────────────────────────────┘
   ============================================================ */
.w1505 {
  /* Surfaces */
  --vt-surface-page: var(--paper-100);
  --vt-surface-card: var(--paper-0);
  --vt-surface-sunken: var(--paper-200);
  --vt-surface-inverse: var(--ink-900);

  /* Ink roles */
  --vt-text: var(--ink-900);
  --vt-text-secondary: var(--ink-600);
  --vt-text-muted: var(--ink-500);        /* DG-3.1: replaces 40%-alpha ink */
  --vt-text-faint: var(--ink-400);        /* eyebrows / metadata ≥10px mono only */
  --vt-text-inverse: var(--paper-50);

  /* Rules & borders (paper uses rules, not shadows — DG-1.10) */
  --vt-rule: var(--ink-200);
  --vt-rule-soft: var(--ink-100);
  --vt-rule-strong: var(--ink-900);
  --vt-degraded-border: var(--ink-400);   /* dashed = degraded (DG-9.2) */

  /* Brand */
  --vt-brand: var(--matcha-800);
  --vt-brand-strong: var(--matcha-900);
  --vt-brand-soft: var(--matcha-50);
  --vt-brand-rule: var(--matcha-300);
  --vt-accent-editorial: var(--indigo-600);
  --vt-color-brand-primary: var(--matcha-800); /* DG-1.2 re-point (was Trust Blue) */

  /* Focus (DG-3.5): 2px ink ring + 2px paper offset, everywhere */
  --vt-focus-ring: 0 0 0 2px var(--vt-surface-page), 0 0 0 4px var(--ink-900);

  /* Hover lift — the ONE allowed shadow on paper */
  --vt-lift: 0 1px 0 var(--ink-200), 0 6px 16px -8px rgba(20, 20, 20, 0.18);

  /* ---- 9 COVERAGE STATES (DG-3.2) — text / bg / rule per state ---- */
  /* checked · source-backed, fresh */
  --vt-state-checked: var(--hue-ok);
  --vt-state-checked-bg: var(--hue-ok-bg);
  --vt-state-checked-rule: var(--hue-ok-rule);
  /* stale · was checked, past freshness threshold */
  --vt-state-stale: var(--hue-watch);
  --vt-state-stale-bg: var(--hue-watch-bg);
  --vt-state-stale-rule: var(--hue-watch-rule);
  /* pending · check in flight */
  --vt-state-pending: var(--hue-unknown);
  --vt-state-pending-bg: var(--hue-unknown-bg);
  --vt-state-pending-rule: var(--hue-unknown-rule);
  /* gated · source requires enrollment/agreement */
  --vt-state-gated: var(--hue-watch);
  --vt-state-gated-bg: var(--hue-watch-bg);
  --vt-state-gated-rule: var(--hue-watch-rule);
  /* unavailable · source down or out of scope */
  --vt-state-unavailable: var(--hue-unknown);
  --vt-state-unavailable-bg: var(--hue-unknown-bg);
  --vt-state-unavailable-rule: var(--hue-unknown-rule);
  /* accessRequired · holder must grant access */
  --vt-state-access: var(--hue-watch);
  --vt-state-access-bg: var(--hue-watch-bg);
  --vt-state-access-rule: var(--hue-watch-rule);
  /* reviewRequired · human review before decision-grade */
  --vt-state-review: var(--hue-watch);
  --vt-state-review-bg: var(--paper-0);
  --vt-state-review-rule: var(--hue-watch);
  /* notDecisionGrade · informational only */
  --vt-state-ndg: var(--hue-unknown);
  --vt-state-ndg-bg: var(--paper-0);
  --vt-state-ndg-rule: var(--hue-unknown-rule);
  /* previewOnly · anonymous preview plane */
  --vt-state-preview: var(--hue-info);
  --vt-state-preview-bg: var(--hue-info-bg);
  --vt-state-preview-rule: var(--hue-info-rule);
  /* p0 blocker + contradiction (review surfaces) */
  --vt-state-p0: var(--hue-p0);
  --vt-state-p0-bg: var(--hue-p0-bg);
  --vt-state-p0-rule: var(--hue-p0-rule);
  --vt-state-contradicted: var(--hue-contra);
  --vt-state-contradicted-bg: var(--hue-contra-bg);
  --vt-state-contradicted-rule: var(--hue-contra-rule);
}

/* ---- base element styles (from wave1500/03-themes.css, scoped) ---- */
.w1505 {
  background: var(--vt-surface-page);
  color: var(--vt-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  font-optical-sizing: auto;
  min-height: 100vh;
}.w1505 h1, .w1505 h2, .w1505 h3 {
  font-family: var(--font-display);
  font-weight: 560;
  letter-spacing: -0.015em;
  color: var(--vt-text);
  text-wrap: balance;
  margin: 0;
}.w1505 .vt-accent-i { font-style: italic; color: var(--vt-accent-editorial); font-weight: 480; }.w1505 .vt-eyebrow { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.2em; color: var(--vt-text-faint); }.w1505 .vt-num { font-variant-numeric: tabular-nums; }.w1505 a { color: var(--vt-text); text-decoration: underline; text-decoration-color: var(--vt-rule);
  text-underline-offset: 3px; transition: text-decoration-color var(--dur-fast) var(--ease-house); }.w1505 a:hover { text-decoration-color: var(--vt-brand); color: var(--vt-brand-strong); }.w1505 :focus-visible { outline: none; box-shadow: var(--vt-focus-ring); }.w1505 ::selection { background: var(--matcha-100); color: var(--ink-900); }
@media (prefers-reduced-motion: no-preference) {.w1505 .vt-enter { animation: w1505-vt-enter var(--dur-base) var(--ease-house) both; }
  @keyframes w1505-vt-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
}

/* ---- hp-enter entrance (from wave1501/hp.css) ---- */
@media (prefers-reduced-motion: no-preference) {
  @keyframes w1505-hp-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
}

/* ---- wave1502 fragments: HonestyPanel + form kit ---- */
/* ---- HonestyPanel pair (DG-8.4) — signature layout ---- */
.w1505 .hn-pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); align-items: stretch; }.w1505 .hn-panel { background: var(--vt-surface-card); border: 1px solid var(--vt-rule); border-radius: var(--radius-2);
  padding: var(--space-6); display: flex; flex-direction: column; }.w1505 .hn-panel.ok { border-top: 3px solid var(--vt-state-checked-rule); }.w1505 .hn-panel.watch { border-top: 3px solid var(--vt-state-stale-rule); }.w1505 .hn-panel-head { display: flex; align-items: center; gap: 10px; padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .hn-panel-head .t { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }.w1505 .hn-panel.ok .hn-panel-head { color: var(--vt-state-checked); }.w1505 .hn-panel.watch .hn-panel-head { color: var(--vt-state-stale); }.w1505 .hn-panel-head .n { margin-left: auto; font-family: var(--font-mono); font-size: 10px; color: var(--vt-text-muted); }.w1505 .hn-items { list-style: none; margin: 0; padding: 0; }.w1505 .hn-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-3); align-items: start;
  padding: 13px 0; border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .hn-item:last-child { border-bottom: none; }.w1505 .hn-item .lab { font-size: 13.5px; font-weight: 500; color: var(--vt-text); }.w1505 .hn-item .src { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--vt-text-muted); margin-top: 3px; }.w1505 .hn-item .note { margin: 5px 0 0; font-size: 12px; line-height: 1.55; color: var(--vt-text-secondary); }.w1505 .hn-panel-foot { margin-top: auto; padding-top: var(--space-4); }
@media (max-width: 860px) {.w1505 .hn-pair { grid-template-columns: 1fr; } }

/* ---- form kit ---- */
.w1505 .fk-form { display: flex; flex-direction: column; gap: var(--space-5); }.w1505 .fk-field { display: flex; flex-direction: column; gap: 6px; }.w1505 .fk-label { font-size: 12.5px; font-weight: 600; color: var(--vt-text); }.w1505 .fk-req { color: var(--vt-state-p0); margin-left: 4px; }.w1505 .fk-input { height: 46px; padding: 0 14px; width: 100%; box-sizing: border-box; font-family: var(--font-body);
  font-size: 14px; color: var(--vt-text); background: var(--vt-surface-card);
  border: 1px solid var(--vt-rule-strong); border-radius: var(--radius-1);
  transition: border-color var(--dur-fast) var(--ease-house); }.w1505 textarea.fk-input { height: auto; min-height: 116px; padding: 12px 14px; line-height: 1.6; resize: vertical; }.w1505 .fk-input::placeholder { color: var(--vt-text-muted); }.w1505 .fk-input.err { border-color: var(--vt-state-p0); }.w1505 .fk-hint { margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--vt-text-muted); }.w1505 .fk-err { display: flex; align-items: flex-start; gap: 7px; margin: 0; font-family: var(--font-mono);
  font-size: 10.5px; letter-spacing: 0.04em; line-height: 1.5; color: var(--vt-state-p0); }.w1505 .fk-err svg { flex-shrink: 0; margin-top: 2px; }.w1505 .fk-callout { border: 1px solid var(--vt-rule-strong); background: var(--vt-surface-sunken); border-radius: var(--radius-1);
  padding: 14px 16px; font-family: var(--font-mono); font-size: 11px; line-height: 1.7; letter-spacing: 0.03em; color: var(--vt-text); }.w1505 .fk-summary { border: 1px solid var(--vt-state-p0-rule); background: var(--vt-state-p0-bg); border-radius: var(--radius-1);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }.w1505 .fk-summary .t { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 11px;
  font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vt-state-p0); }.w1505 .fk-summary ul { margin: 0; padding: 0 0 0 2px; list-style: none; display: flex; flex-direction: column; gap: 4px; }.w1505 .fk-summary button { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: var(--font-body);
  font-size: 12.5px; color: var(--vt-text); text-decoration: underline; text-underline-offset: 3px; text-align: left; }.w1505 .fk-success { background: var(--vt-surface-card); border: 1px solid var(--vt-state-checked-rule);
  border-top: 3px solid var(--vt-state-checked-rule); border-radius: var(--radius-2); padding: var(--space-8);
  display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-start; }.w1505 .fk-success h3 { font-size: var(--text-xl); }.w1505 .fk-success .receipt { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; color: var(--vt-text-secondary);
  border: 1px solid var(--vt-rule); background: var(--vt-surface-page); padding: 6px 10px; border-radius: var(--radius-1);
  overflow-wrap: anywhere; }.w1505 .fk-success p { margin: 0; font-size: 14px; line-height: 1.65; color: var(--vt-text); max-width: 56ch; }
@media (prefers-reduced-motion: no-preference) {.w1505 .fk-success, .w1505 .fk-summary { animation: w1505-hp-enter var(--dur-base) var(--ease-house) both; }
}

/* ---- reduced-motion static fallbacks ---- */
@media (prefers-reduced-motion: reduce) {.w1505 .fk-input, .w1505 .s2-tab { transition: none; }.w1505 .ab-recorded, .w1505 .fk-success, .w1505 .fk-summary { animation: none; }
}

/* ---- wave1503 fragment: Recognition row ---- */
/* ============================================================
   E · Recognition — the ONE reserved matcha moment.
   Calm, archival, permanent-feeling. Never a trophy.
   ============================================================ */
.w1505 .rec-list { display: flex; flex-direction: column; }.w1505 .rec-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--space-4); align-items: center;
  padding: 14px 0; border-bottom: 1px solid var(--vt-rule-soft); border-radius: var(--radius-1); }.w1505 .rec-row:last-child { border-bottom: none; }.w1505 .rec-seal { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--vt-brand);
  background: var(--vt-brand-soft); color: var(--vt-brand); display: grid; place-items: center; flex-shrink: 0; }.w1505 .rec-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.w1505 .rec-emp { font-size: 13.5px; font-weight: 600; color: var(--vt-text); }.w1505 .rec-line { font-size: 12.5px; line-height: 1.5; color: var(--vt-text-secondary); }.w1505 .rec-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em; color: var(--vt-text-muted); margin-top: 2px; overflow-wrap: anywhere; }.w1505 .rec-stamp { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--vt-brand); border: 1.5px solid var(--vt-brand);
  background: var(--vt-brand-soft); border-radius: var(--radius-1); padding: 5px 10px;
  transform: rotate(-1.4deg); white-space: nowrap; }.w1505 .rec-empty { font-size: 12.5px; color: var(--vt-text-secondary); }
@media (max-width: 560px) {.w1505 .rec-row { grid-template-columns: auto minmax(0, 1fr); }.w1505 .rec-stamp { grid-column: 2; justify-self: start; transform: rotate(-1.4deg) translateY(-2px); }
}
/* one-shot archival settle — background fades from matcha-soft to paper, once */
@media (prefers-reduced-motion: no-preference) {.w1505 .hp-reveal.is-in .rec-row, .w1505 .rec-row.s3-enter { animation: w1505-rec-settle var(--dur-slow) var(--ease-house) 1 both; }
  @keyframes w1505-rec-settle { from { background: var(--vt-brand-soft); } to { background: transparent; } }
}

/* ---- wave1504 fragment: copy affordance + token rows ---- */
/* ================= copy affordance ================= */
.w1505 .cp-btn { display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.12em;
  color: var(--vt-text-secondary); background: transparent; border: 1px solid var(--vt-rule);
  border-radius: var(--radius-1); padding: 3px 7px; flex-shrink: 0; white-space: nowrap;
  transition: border-color var(--dur-fast) var(--ease-house), color var(--dur-fast) var(--ease-house); }.w1505 .cp-btn:hover { color: var(--vt-text); border-color: var(--vt-rule-strong); }.w1505 .cp-btn.copied { color: var(--vt-state-checked); border-color: var(--vt-state-checked-rule); background: var(--vt-state-checked-bg); }.w1505 .tok-row { display: grid; grid-template-columns: 128px minmax(0, 1fr) auto; align-items: baseline; gap: 12px;
  padding: 9px 0; border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .tok-row:last-child { border-bottom: none; }.w1505 .tok-key { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--vt-text-faint); }.w1505 .tok-val { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.02em; color: var(--vt-text);
  overflow-wrap: anywhere; min-width: 0; }.w1505 .tok-val a { color: var(--vt-text); }
@media (max-width: 560px) {.w1505 .tok-row { grid-template-columns: minmax(0, 1fr) auto; }.w1505 .tok-key { grid-column: 1 / -1; }
}

/* ---- wave1505 surface styles ---- */
/* ============================================================
   VitalCV · Wave 1505 · System pages, quality gates & governance
   Consumes wave1500 tokens ONLY. New tokens below are the
   Z-INDEX SCALE (structural, documented in CHANGES.md) — zero
   new colors, zero new fonts, zero new radii.
   ============================================================ */
.w1505 {
  /* ---- z-index scale (DG-12.5 — canonical, promoted) ---- */
  --vt-z-base: 0;
  --vt-z-raised: 10;      /* lifted cards, dropdowns inside flow */
  --vt-z-nav: 40;         /* sticky site nav */
  --vt-z-banner: 45;      /* offline / degraded banner */
  --vt-z-widget: 50;      /* feedback affordance */
  --vt-z-overlay: 60;     /* panels above widgets */
  --vt-z-skip: 100;       /* skip-link — above everything */
}

/* ================= skip link (DG-15.2) ================= */
.w1505 .skip-link { position: fixed; left: -9999px; top: 10px; z-index: var(--vt-z-skip);
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
  background: var(--vt-surface-card); color: var(--vt-text); border: 1px solid var(--vt-rule-strong);
  border-radius: var(--radius-1); padding: 10px 16px; text-decoration: none; }.w1505 .skip-link:focus-visible { left: 12px; }

/* ================= shell ================= */
.w1505 .s5-container { max-width: var(--container-max); margin: 0 auto; padding: 0 var(--space-6); }
@media (max-width: 560px) {.w1505 .s5-container { padding: 0 var(--space-4); } }.w1505 .s5-nav { position: sticky; top: 0; z-index: var(--vt-z-nav); background: var(--vt-surface-page); border-bottom: 1px solid var(--vt-rule); }.w1505 .s5-nav-inner { display: flex; align-items: center; gap: var(--space-5); padding: 10px 0; flex-wrap: wrap; }.w1505 .s5-brand-link { text-decoration: none; display: inline-flex; }.w1505 .s5-brand-link:hover { text-decoration: none; }.w1505 .s5-tabs { display: flex; gap: 2px; margin-left: auto; flex-wrap: wrap; }.w1505 .s5-tab { font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.08em;
  text-transform: uppercase; text-decoration: none; color: var(--vt-text-secondary); white-space: nowrap;
  padding: 6px 10px; border: 1px solid transparent; border-radius: var(--radius-1); }.w1505 .s5-tab:hover { color: var(--vt-text); text-decoration: none; border-color: var(--vt-rule); }.w1505 .s5-tab[aria-current="page"] { color: var(--vt-text); border-color: var(--vt-rule-strong); background: var(--vt-surface-card); }.w1505 .s5-main { min-height: 62vh; }
@media (prefers-reduced-motion: no-preference) {.w1505 .s5-fade { animation: w1505-s5-fade var(--dur-fast) var(--ease-house) both; }
  @keyframes w1505-s5-fade { from { opacity: 0; } to { opacity: 1; } }
}.w1505 .s5-section { padding: var(--space-12) 0; border-top: 1px solid var(--vt-rule); }.w1505 .s5-section.first { border-top: none; padding-top: var(--space-10); }.w1505 .s5-sechead { display: flex; flex-direction: column; gap: 8px; margin-bottom: var(--space-8); max-width: 76ch; }.w1505 .s5-sechead h2 { font-size: var(--text-xl); }.w1505 .s5-sechead .lede { margin: 0; font-size: var(--text-base); color: var(--vt-text-secondary); max-width: 64ch; }.w1505 .s5-doctrine { padding-top: var(--space-12); padding-bottom: var(--space-10); }.w1505 .s5-doctrine h1 { font-size: var(--text-2xl); margin-top: 10px; max-width: 26ch; }.w1505 .s5-doctrine .lede { margin: 14px 0 0; color: var(--vt-text-secondary); max-width: 64ch; }.w1505 .s5-foot { border-top: 1px solid var(--vt-rule); margin-top: var(--space-16); padding: var(--space-10) 0; }.w1505 .s5-boundary { display: flex; align-items: baseline; gap: 12px; margin: 0 0 14px; font-family: var(--font-display);
  font-size: var(--text-lg); font-weight: 560; letter-spacing: -0.01em; color: var(--vt-text); max-width: 44ch; line-height: 1.35; }.w1505 .s5-boundary svg { flex-shrink: 0; transform: translateY(2px); }.w1505 .s5-foot-links { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 0 0 16px; padding: 0; list-style: none; }.w1505 .s5-foot-links a { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--vt-text-secondary); text-decoration: none; border-bottom: 1px solid var(--vt-rule); padding-bottom: 2px; white-space: nowrap; }.w1505 .s5-foot-links a:hover { color: var(--vt-text); border-bottom-color: var(--vt-rule-strong); }.w1505 .s5-foot-base { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; color: var(--vt-text-muted); }

/* prototype bar for chrome-less full-page states */
.w1505 .s5-proto { position: fixed; right: 12px; bottom: 12px; z-index: var(--vt-z-widget); display: flex; gap: 6px; align-items: center; }.w1505 .s5-proto a { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap;
  color: var(--vt-text-secondary); background: var(--vt-surface-card); border: 1px solid var(--vt-rule);
  border-radius: var(--radius-1); padding: 6px 10px; text-decoration: none; }.w1505 .s5-proto a:hover { color: var(--vt-text); border-color: var(--vt-rule-strong); }

/* ================= hub / index ================= */
.w1505 .hub-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
@media (max-width: 980px) {.w1505 .hub-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) {.w1505 .hub-grid { grid-template-columns: minmax(0, 1fr); } }.w1505 .hub-card { background: var(--vt-surface-card); border: 1px solid var(--vt-rule); border-radius: var(--radius-2);
  padding: var(--space-5); display: flex; flex-direction: column; gap: 10px; min-width: 0; }.w1505 .hub-card .hid { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em; color: var(--vt-text-faint); text-transform: uppercase; }.w1505 .hub-card h3 { font-size: var(--text-md); font-family: var(--font-display); font-weight: 560; }.w1505 .hub-card p { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--vt-text-secondary); flex: 1; }.w1505 .hub-links { display: flex; flex-wrap: wrap; gap: 4px 14px; border-top: 1px solid var(--vt-rule-soft); padding-top: 10px; }.w1505 .hub-links a { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--vt-text); text-decoration: none; border-bottom: 1px solid var(--vt-rule); padding-bottom: 1px; }.w1505 .hub-links a:hover { border-bottom-color: var(--vt-rule-strong); }.w1505 .hub-accept { display: flex; flex-direction: column; gap: 0; }.w1505 .hub-accept-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start;
  padding: 12px 0; border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .hub-accept-row:last-child { border-bottom: none; }.w1505 .hub-accept-row p { margin: 2px 0 0; font-size: 13px; line-height: 1.55; color: var(--vt-text); }.w1505 .hub-accept-row .where { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em; color: var(--vt-text-muted); }

/* ================= AUTH (Clerk themed — DG-12.1) ================= */
.w1505 .auth-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
  padding: var(--space-10) var(--space-4) var(--space-16); box-sizing: border-box; }.w1505 .auth-brand { margin-bottom: var(--space-10); }.w1505 .ck-card { width: 100%; max-width: 400px; background: var(--vt-surface-card); border: 1px solid var(--vt-rule);
  border-radius: var(--radius-2); padding: var(--space-8); box-sizing: border-box;
  display: flex; flex-direction: column; gap: var(--space-5); }.w1505 .ck-head { display: flex; flex-direction: column; gap: 6px; }.w1505 .ck-head h1 { font-size: var(--text-xl); }.w1505 .ck-head .sub { margin: 0; font-size: 13px; line-height: 1.55; color: var(--vt-text-secondary); }.w1505 .ck-social { display: flex; flex-direction: column; gap: 8px; }.w1505 .ck-social-btn { display: flex; align-items: center; justify-content: center; gap: 10px; height: 46px;
  font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--vt-text); background: transparent; border: 1px solid var(--vt-rule-strong); border-radius: var(--radius-1);
  cursor: pointer; transition: background var(--dur-fast) var(--ease-house); }.w1505 .ck-social-btn:hover { background: var(--vt-surface-page); }.w1505 .ck-social-btn svg { flex-shrink: 0; }.w1505 .ck-div { display: flex; align-items: center; gap: 12px; }.w1505 .ck-div::before, .w1505 .ck-div::after { content: ""; flex: 1; height: 1px; background: var(--vt-rule); }.w1505 .ck-div span { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.2em; color: var(--vt-text-muted); }.w1505 .ck-form { display: flex; flex-direction: column; gap: var(--space-4); }.w1505 .ck-name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
@media (max-width: 400px) {.w1505 .ck-name-grid { grid-template-columns: 1fr; } }.w1505 .ck-primary { width: 100%; height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--font-body); font-size: 13.5px; font-weight: 500; color: var(--vt-text-inverse);
  background: var(--ink-900); border: 1px solid transparent; border-radius: var(--radius-1); cursor: pointer;
  transition: background var(--dur-fast) var(--ease-house); }.w1505 .ck-primary:hover { background: var(--vt-brand-strong); }.w1505 .ck-primary:disabled { background: var(--vt-rule); color: var(--vt-text-muted); cursor: not-allowed; }.w1505 .ck-foot { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--vt-rule-soft); padding-top: var(--space-4); }.w1505 .ck-foot-line { font-size: 12.5px; color: var(--vt-text-secondary); }.w1505 .ck-foot-line a { font-weight: 500; }.w1505 .ck-badge { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--vt-text-muted); }.w1505 .auth-under { margin-top: var(--space-5); max-width: 400px; width: 100%; box-sizing: border-box; }.w1505 .auth-under p { margin: 0; font-family: var(--font-mono); font-size: 10px; line-height: 1.7; letter-spacing: 0.04em;
  color: var(--vt-text-muted); text-align: center; }

/* code cells (verification) */
.w1505 .code-cells { display: flex; gap: 8px; justify-content: flex-start; }.w1505 .code-cell { width: 46px; height: 54px; display: grid; place-items: center; background: var(--vt-surface-page);
  border: 1px solid var(--vt-rule-strong); border-radius: var(--radius-1);
  font-family: var(--font-mono); font-size: 20px; color: var(--vt-text); }.w1505 .code-cell.focus { box-shadow: var(--vt-focus-ring); }.w1505 .code-cell.empty { border-style: dashed; border-color: var(--vt-degraded-border); color: var(--vt-text-muted); }
@media (max-width: 400px) {.w1505 .code-cell { width: 40px; height: 48px; font-size: 17px; }.w1505 .code-cells { gap: 6px; } }.w1505 .code-hidden { position: absolute; opacity: 0; pointer-events: none; }.w1505 .code-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }.w1505 .code-meta .cnt { font-family: var(--font-mono); font-size: 11px; color: var(--vt-text-muted); }.w1505 .code-meta .cnt.done { color: var(--vt-state-checked); }

/* auth loading interstitial */
.w1505 .authload { min-height: 100vh; display: grid; place-items: center; padding: var(--space-6); box-sizing: border-box; }.w1505 .authload-box { display: flex; flex-direction: column; align-items: center; gap: var(--space-6); text-align: center; }.w1505 .authload-line { font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--vt-text-secondary); }.w1505 .authload-note { margin: 0; font-size: 12.5px; color: var(--vt-text-muted); max-width: 34ch; }.w1505 .authload-track { width: 220px; height: 2px; background: var(--vt-rule-soft); position: relative; overflow: hidden; }.w1505 .authload-track::after { content: ""; position: absolute; inset: 0; width: 40%; background: var(--ink-900); }
@media (prefers-reduced-motion: no-preference) {.w1505 .authload-track::after { animation: w1505-al-sweep 1.4s var(--ease-house) infinite; }
  @keyframes w1505-al-sweep { from { transform: translateX(-110%); } to { transform: translateX(560px); } }
}

/* ================= SYSTEM STATES (DG-12.2) ================= */
.w1505 .sys-page { min-height: 100vh; display: flex; flex-direction: column; box-sizing: border-box;
  padding: var(--space-8) var(--space-6) 72px; }.w1505 .sys-top { display: flex; }.w1505 .sys-mid { flex: 1; display: grid; place-items: center; padding: var(--space-12) 0; }.w1505 .sys-block { max-width: 560px; display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-5); }.w1505 .sys-echo { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.05em; line-height: 1.8;
  color: var(--vt-text-secondary); border: 1px solid var(--vt-rule); background: var(--vt-surface-card);
  border-radius: var(--radius-1); padding: 10px 14px; overflow-wrap: anywhere; align-self: stretch; }.w1505 .sys-echo .code { color: var(--vt-state-p0); font-weight: 600; }.w1505 .sys-block h1 { font-size: var(--text-3xl); line-height: 1.08; max-width: 15ch; }
@media (max-width: 560px) {.w1505 .sys-block h1 { font-size: var(--text-2xl); } }.w1505 .sys-block .body { margin: 0; font-size: 15px; line-height: 1.65; color: var(--vt-text-secondary); max-width: 46ch; }.w1505 .sys-ctas { display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap; }.w1505 .sys-ctas button { white-space: nowrap; }.w1505 .sys-foot { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; color: var(--vt-text-muted); }

/* offline / degraded banner (DG-12.2.3) */
.w1505 .off-banner { position: sticky; top: 49px; z-index: var(--vt-z-banner); background: var(--vt-state-stale-bg);
  border-top: 1px dashed var(--vt-degraded-border); border-bottom: 1px dashed var(--vt-degraded-border); }.w1505 .off-banner.inline { position: static; border-left: 1px dashed var(--vt-degraded-border);
  border-right: 1px dashed var(--vt-degraded-border); border-radius: var(--radius-1); }.w1505 .off-inner { display: flex; align-items: center; gap: 10px; padding: 9px 0; flex-wrap: wrap; }.w1505 .off-banner.inline .off-inner { padding: 9px 14px; }.w1505 .off-glyph { color: var(--vt-state-stale); display: inline-flex; flex-shrink: 0; }.w1505 .off-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--vt-state-stale); white-space: nowrap; }.w1505 .off-copy { font-size: 12.5px; color: var(--vt-text); }.w1505 .off-act { margin-left: auto; }
@media (max-width: 620px) {.w1505 .off-act { margin-left: 26px; } }

/* empty-state card (DG-12.2.4) */
.w1505 .empty-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
@media (max-width: 860px) {.w1505 .empty-grid { grid-template-columns: minmax(0, 1fr); } }.w1505 .empty-ctx { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--vt-text-faint); margin-bottom: 8px; display: block; }.w1505 .empty-card { background: var(--vt-surface-card); border: 1px solid var(--vt-rule); border-radius: var(--radius-2);
  padding: var(--space-10) var(--space-6); display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: var(--space-3); }.w1505 .empty-glyph { width: 44px; height: 44px; display: grid; place-items: center; color: var(--vt-text-muted);
  border: 1px solid var(--vt-rule); border-radius: var(--radius-1); background: var(--vt-surface-page); }.w1505 .empty-card h3 { font-family: var(--font-display); font-weight: 560; font-size: var(--text-lg); max-width: 24ch; }.w1505 .empty-card .why { margin: 0; font-size: 13px; line-height: 1.6; color: var(--vt-text-secondary); max-width: 40ch; }.w1505 .empty-card .act { margin-top: var(--space-2); }

/* skeleton loading (allowed shimmer exception) */
.w1505 .sk-stack { display: flex; flex-direction: column; gap: 10px; }.w1505 .sk-line { height: 12px; border-radius: var(--radius-1); background: var(--vt-surface-sunken);
  position: relative; overflow: hidden; }.w1505 .sk-line.w60 { width: 60%; }.w1505 .sk-line.w80 { width: 80%; }.w1505 .sk-line.w40 { width: 40%; }
@media (prefers-reduced-motion: no-preference) {.w1505 .sk-line::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, var(--paper-50), transparent);
    animation: w1505-sk-sweep 1.6s var(--ease-house) infinite; }
  @keyframes w1505-sk-sweep { to { transform: translateX(100%); } }
}

/* ================= LEGAL (DG-12.3) ================= */
.w1505 .lg-tabs { display: flex; gap: 2px; flex-wrap: wrap; margin-bottom: var(--space-8); }.w1505 .lg-tab { font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; text-decoration: none; color: var(--vt-text-secondary);
  padding: 8px 14px; border: 1px solid var(--vt-rule); border-radius: var(--radius-1); }.w1505 .lg-tab:hover { color: var(--vt-text); text-decoration: none; border-color: var(--vt-rule-strong); }.w1505 .lg-tab[aria-current="page"] { color: var(--vt-text-inverse); background: var(--ink-900); border-color: var(--ink-900); }.w1505 .lg-layout { display: grid; grid-template-columns: 224px minmax(0, 1fr); gap: var(--space-12); align-items: start; }
@media (max-width: 1023px) {.w1505 .lg-layout { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); } }.w1505 .lg-toc { position: sticky; top: 72px; display: flex; flex-direction: column; gap: 2px; }
@media (max-width: 1023px) {.w1505 .lg-toc { position: static; border: 1px solid var(--vt-rule); border-radius: var(--radius-1);
  padding: var(--space-4); background: var(--vt-surface-card); } }.w1505 .lg-toc-label { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--vt-text-faint); margin-bottom: 8px; }.w1505 .lg-toc a { display: flex; gap: 10px; align-items: baseline; font-size: 12.5px; color: var(--vt-text-secondary);
  text-decoration: none; padding: 5px 8px; border-left: 2px solid transparent; border-radius: 0; }.w1505 .lg-toc a:hover { color: var(--vt-text); border-left-color: var(--vt-rule-strong); }.w1505 .lg-toc a .n { font-family: var(--font-mono); font-size: 9.5px; color: var(--vt-text-faint); }.w1505 .lg-head { display: flex; flex-direction: column; gap: 10px; margin-bottom: var(--space-8); }.w1505 .lg-head h1 { font-size: var(--text-2xl); }.w1505 .lg-stamp { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--vt-text-muted); display: inline-flex; gap: 14px; flex-wrap: wrap; }.w1505 .lg-prose { max-width: 65ch; }.w1505 .lg-prose section { padding: var(--space-6) 0; border-top: 1px solid var(--vt-rule-soft); scroll-margin-top: 72px; }.w1505 .lg-prose section:first-child { border-top: none; padding-top: 0; }.w1505 .lg-prose h2 { font-size: var(--text-lg); display: flex; gap: 12px; align-items: baseline; }.w1505 .lg-prose h2 .n { font-family: var(--font-mono); font-size: 10px; font-weight: 500; color: var(--vt-text-faint); }.w1505 .lg-prose h2 a.anchor { color: inherit; text-decoration: none; }.w1505 .lg-prose h2 a.anchor:hover { text-decoration: underline; text-decoration-color: var(--vt-rule); }.w1505 .lg-prose p, .w1505 .lg-prose li { font-size: 14px; line-height: 1.75; color: var(--vt-text); }.w1505 .lg-prose p { margin: 12px 0 0; }.w1505 .lg-prose ul { margin: 12px 0 0; padding-left: 20px; }.w1505 .lg-prose li { margin-top: 6px; }.w1505 .lg-prose .mono-note { font-family: var(--font-mono); font-size: 11px; line-height: 1.7; letter-spacing: 0.03em;
  color: var(--vt-text-secondary); border: 1px solid var(--vt-rule); background: var(--vt-surface-card);
  border-radius: var(--radius-1); padding: 12px 14px; margin-top: 14px; }.w1505 .lg-table { width: 100%; border-collapse: collapse; margin-top: 14px; }.w1505 .lg-table th { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--vt-text-faint); text-align: left; padding: 8px 12px 8px 0;
  border-bottom: 1px solid var(--vt-rule); }.w1505 .lg-table td { font-size: 12.5px; line-height: 1.5; color: var(--vt-text); padding: 9px 12px 9px 0;
  border-bottom: 1px solid var(--vt-rule-soft); vertical-align: top; }.w1505 .lg-table td.mono { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.03em; white-space: nowrap; }

/* ================= CONTACT (DG-12.4) ================= */
.w1505 .ct-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--space-12); align-items: start; }
@media (max-width: 980px) {.w1505 .ct-grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-8); } }.w1505 .ct-aside { display: flex; flex-direction: column; gap: var(--space-5); position: sticky; top: 72px; }
@media (max-width: 980px) {.w1505 .ct-aside { position: static; } }.w1505 .ct-expect { border: 1px solid var(--vt-rule); background: var(--vt-surface-card); border-radius: var(--radius-2);
  padding: var(--space-5); display: flex; flex-direction: column; gap: 12px; }.w1505 .ct-expect .row { display: flex; gap: 10px; align-items: flex-start; }.w1505 .ct-expect .row svg { flex-shrink: 0; margin-top: 2px; color: var(--vt-text-secondary); }.w1505 .ct-expect .row p { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--vt-text); }.w1505 .ct-expect .row p strong { font-weight: 600; }.w1505 select.fk-input { appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23474540' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; cursor: pointer; }

/* ================= PRICING (DG-13.3) ================= */
.w1505 .pr-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); align-items: stretch; }
@media (max-width: 980px) {.w1505 .pr-grid { grid-template-columns: minmax(0, 1fr); } }.w1505 .pr-card { background: var(--vt-surface-card); border: 1px solid var(--vt-rule); border-radius: var(--radius-2);
  padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }.w1505 .pr-card.lead { border: 1px solid var(--vt-rule-strong); }.w1505 .pr-aud { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--vt-text-faint); }.w1505 .pr-price { display: flex; flex-direction: column; gap: 6px; }.w1505 .pr-price .amt { font-family: var(--font-display); font-weight: 560; font-size: var(--text-2xl); letter-spacing: -0.015em; line-height: 1; }.w1505 .pr-price .per { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--vt-text-muted); }.w1505 .pr-desc { margin: 0; font-size: 13px; line-height: 1.6; color: var(--vt-text-secondary); }.w1505 .pr-rows { display: flex; flex-direction: column; border-top: 1px solid var(--vt-rule-soft); }.w1505 .pr-row { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .pr-row svg { flex-shrink: 0; margin-top: 3px; }.w1505 .pr-row.inc svg { color: var(--vt-state-checked); }.w1505 .pr-row.exc svg { color: var(--vt-text-muted); }.w1505 .pr-row span { font-size: 12.5px; line-height: 1.5; color: var(--vt-text); }.w1505 .pr-row.exc span { color: var(--vt-text-muted); }.w1505 .pr-cta { margin-top: auto; padding-top: var(--space-2); display: flex; }.w1505 .pr-cta > * { width: 100%; }.w1505 .pr-never { border: 1px solid var(--vt-rule); border-radius: var(--radius-2); background: var(--vt-surface-card); padding: var(--space-6); }.w1505 .pr-never ul { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 0; }.w1505 .pr-never li { display: flex; gap: 10px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--vt-rule-soft);
  font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.03em; line-height: 1.6; color: var(--vt-text); }.w1505 .pr-never li:last-child { border-bottom: none; }.w1505 .pr-never li svg { flex-shrink: 0; transform: translateY(2px); color: var(--vt-state-p0); }.w1505 .pr-faq { max-width: 68ch; }.w1505 .pr-faq details { border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .pr-faq summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 12px;
  padding: 14px 0; font-size: 14.5px; font-weight: 500; color: var(--vt-text); }.w1505 .pr-faq summary::-webkit-details-marker { display: none; }.w1505 .pr-faq summary .m { font-family: var(--font-mono); font-size: 12px; color: var(--vt-text-muted); width: 12px; flex-shrink: 0; }.w1505 .pr-faq details[open] summary .m::before { content: "−"; }.w1505 .pr-faq details:not([open]) summary .m::before { content: "+"; }.w1505 .pr-faq details p { margin: 0 0 16px 24px; font-size: 13.5px; line-height: 1.65; color: var(--vt-text-secondary); max-width: 58ch; }

/* ================= AUDIT (DG-14/15) ================= */
.w1505 .au-sum { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); margin-bottom: var(--space-8); }
@media (max-width: 860px) {.w1505 .au-sum { grid-template-columns: repeat(2, minmax(0, 1fr)); } }.w1505 .au-sum-cell { border: 1px solid var(--vt-rule); background: var(--vt-surface-card); border-radius: var(--radius-2);
  padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: 4px; }.w1505 .au-sum-cell .k { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--vt-text-faint); }.w1505 .au-sum-cell .v { font-family: var(--font-display); font-weight: 560; font-size: var(--text-2xl); line-height: 1; }.w1505 .au-sum-cell .s { font-family: var(--font-mono); font-size: 10px; color: var(--vt-text-muted); }.w1505 .au-group { margin-bottom: var(--space-8); }.w1505 .au-group-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; padding-bottom: 10px;
  border-bottom: 2px solid var(--vt-rule-strong); }.w1505 .au-group-head h3 { font-size: var(--text-md); font-family: var(--font-display); font-weight: 560; }.w1505 .au-group-head .dg { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; color: var(--vt-text-muted); }.w1505 .au-group-head .method { margin-left: auto; font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.05em; color: var(--vt-text-faint); }.w1505 .au-row { display: grid; grid-template-columns: 84px 150px minmax(0, 1.2fr) minmax(0, 1.4fr) auto; gap: var(--space-4);
  padding: 13px 0; border-bottom: 1px solid var(--vt-rule-soft); align-items: start; }.w1505 .au-row .aid { font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: var(--vt-text-faint); }.w1505 .au-row .asurf { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.03em; color: var(--vt-text-secondary); overflow-wrap: anywhere; }.w1505 .au-row .asurf .vp { display: block; color: var(--vt-text-faint); font-size: 9.5px; margin-top: 2px; }.w1505 .au-row .afind { font-size: 12.5px; line-height: 1.55; color: var(--vt-text); }.w1505 .au-row .afix { font-size: 12.5px; line-height: 1.55; color: var(--vt-text-secondary); }.w1505 .au-row .afix code, .w1505 .au-row .afind code, .w1505 .gv-rule code, .w1505 .lg-prose code { font-family: var(--font-mono); font-size: 0.92em;
  background: var(--vt-surface-sunken); border: 1px solid var(--vt-rule-soft); border-radius: 2px; padding: 0 4px; }
@media (max-width: 980px) {.w1505 .au-row { grid-template-columns: 84px minmax(0, 1fr) auto; }.w1505 .au-row .asurf { grid-column: 2; order: -1; }.w1505 .au-row .aid { grid-row: span 2; }.w1505 .au-row .afind { grid-column: 2 / 4; }.w1505 .au-row .afix { grid-column: 2 / 4; }
}
@media (max-width: 560px) {.w1505 .au-row { grid-template-columns: minmax(0, 1fr) auto; }.w1505 .au-row .aid, .w1505 .au-row .asurf, .w1505 .au-row .afind, .w1505 .au-row .afix { grid-column: 1 / 2; }.w1505 .au-row .aid { grid-row: auto; }
}

/* ================= /dev/design style guide ================= */
.w1505 .dd-band { padding: var(--space-10) 0; border-top: 1px solid var(--vt-rule); scroll-margin-top: 64px; }.w1505 .dd-band.first { border-top: none; }.w1505 .dd-band-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: var(--space-6); }.w1505 .dd-band-head h2 { font-size: var(--text-lg); }.w1505 .dd-band-head .dg { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; color: var(--vt-text-muted); }.w1505 .dd-rule { margin: 0 0 var(--space-6); font-family: var(--font-mono); font-size: 11px; line-height: 1.7; letter-spacing: 0.03em;
  color: var(--vt-text-secondary); max-width: 88ch; border-left: 2px solid var(--vt-rule-strong); padding-left: 14px; }.w1505 .dd-jump { display: flex; flex-wrap: wrap; gap: 4px 4px; margin-top: var(--space-5); }.w1505 .dd-jump a { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--vt-text-secondary); text-decoration: none; border: 1px solid var(--vt-rule); border-radius: var(--radius-1); padding: 5px 9px; }.w1505 .dd-jump a:hover { color: var(--vt-text); border-color: var(--vt-rule-strong); }.w1505 .dd-grid { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-start; }.w1505 .dd-spec { display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--vt-rule-soft); border-radius: var(--radius-1);
  padding: var(--space-4); background: var(--vt-surface-card); min-width: 0; }.w1505 .dd-spec .lab { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--vt-text-faint); }.w1505 .dd-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: var(--space-3); }.w1505 .dd-swatch { border: 1px solid var(--vt-rule); border-radius: var(--radius-1); overflow: hidden; background: var(--vt-surface-card); }.w1505 .dd-swatch .chip { height: 52px; border-bottom: 1px solid var(--vt-rule-soft); }.w1505 .dd-swatch .meta { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }.w1505 .dd-swatch .meta .t { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.04em; color: var(--vt-text); overflow-wrap: anywhere; }.w1505 .dd-swatch .meta .h { font-family: var(--font-mono); font-size: 9px; color: var(--vt-text-muted); }.w1505 .dd-type-row { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: var(--space-4); align-items: baseline;
  padding: 12px 0; border-bottom: 1px solid var(--vt-rule-soft); }
@media (max-width: 620px) {.w1505 .dd-type-row { grid-template-columns: minmax(0, 1fr); gap: 4px; } }.w1505 .dd-type-row .m { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--vt-text-muted); }.w1505 .dd-space-row { display: flex; align-items: center; gap: 14px; padding: 5px 0; }.w1505 .dd-space-row .bar { height: 14px; background: var(--matcha-100); border: 1px solid var(--vt-brand-rule); }.w1505 .dd-space-row .m { font-family: var(--font-mono); font-size: 9.5px; color: var(--vt-text-muted); min-width: 130px; }.w1505 .dd-glyph-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); }.w1505 .dd-glyph-cell { border: 1px solid var(--vt-rule-soft); border-radius: var(--radius-1); background: var(--vt-surface-card);
  padding: var(--space-4); display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }.w1505 .dd-glyph-cell .g { color: var(--vt-text); }.w1505 .dd-glyph-cell .n { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; color: var(--vt-text-secondary); overflow-wrap: anywhere; }.w1505 .dd-motion-demo { display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap; }.w1505 .dd-motion-box { width: 56px; height: 56px; background: var(--vt-surface-card); border: 1px solid var(--vt-rule-strong); border-radius: var(--radius-1); }
@media (prefers-reduced-motion: no-preference) {.w1505 .dd-motion-box.play { animation: w1505-vt-enter var(--dur-base) var(--ease-house) both; } }.w1505 .dd-ztable { max-width: 480px; }

/* ================= GOVERNANCE ================= */
.w1505 .gv-matrix { width: 100%; border-collapse: collapse; }.w1505 .gv-matrix th { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--vt-text-faint); text-align: left; padding: 8px 10px 8px 0;
  border-bottom: 2px solid var(--vt-rule-strong); white-space: nowrap; }.w1505 .gv-matrix td { padding: 9px 10px 9px 0; border-bottom: 1px solid var(--vt-rule-soft); vertical-align: top; }.w1505 .gv-matrix td.route { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.02em; color: var(--vt-text); white-space: nowrap; }.w1505 .gv-matrix td.wave { font-family: var(--font-mono); font-size: 10px; color: var(--vt-text-muted); white-space: nowrap; }.w1505 .gv-matrix td.mask { font-family: var(--font-mono); font-size: 10px; line-height: 1.6; color: var(--vt-text-secondary); }.w1505 .gv-matrix .vp-ok { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 9.5px;
  color: var(--vt-state-checked); border: 1px solid var(--vt-state-checked-rule); background: var(--vt-state-checked-bg);
  border-radius: var(--radius-1); padding: 2px 7px; margin: 1px 4px 1px 0; white-space: nowrap; }.w1505 .gv-matrix-wrap { overflow-x: auto; }.w1505 .gv-rule { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: var(--space-4); padding: var(--space-5) 0;
  border-bottom: 1px solid var(--vt-rule-soft); }
@media (max-width: 620px) {.w1505 .gv-rule { grid-template-columns: minmax(0, 1fr); gap: 8px; } }.w1505 .gv-rule .rid { font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: var(--vt-text); }.w1505 .gv-rule .rid .sev { display: block; margin-top: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.12em; color: var(--vt-state-p0); }.w1505 .gv-rule .rid .sev.warn { color: var(--vt-state-stale); }.w1505 .gv-rule .rbody { display: flex; flex-direction: column; gap: 7px; min-width: 0; }.w1505 .gv-rule .rbody .what { font-size: 13.5px; font-weight: 500; color: var(--vt-text); }.w1505 .gv-rule .rbody .det { font-family: var(--font-mono); font-size: 10.5px; line-height: 1.7; letter-spacing: 0.02em;
  color: var(--vt-text-secondary); overflow-wrap: anywhere; }.w1505 .gv-rule .rbody .allow { font-size: 12px; color: var(--vt-text-secondary); }

/* ================= feedback widget (DG-12.5) ================= */
.w1505 .fb-tab { position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: var(--vt-z-widget);
  writing-mode: vertical-rl; text-orientation: mixed; cursor: pointer;
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--vt-text-secondary); background: var(--vt-surface-card);
  border: 1px solid var(--vt-rule); border-right: none; border-radius: var(--radius-1) 0 0 var(--radius-1);
  padding: 14px 8px; transition: color var(--dur-fast) var(--ease-house), border-color var(--dur-fast) var(--ease-house); }.w1505 .fb-tab::before { content: ""; position: absolute; inset: -4px 0 -4px -10px; }.w1505 .fb-tab:hover { color: var(--vt-text); border-color: var(--vt-rule-strong); }.w1505 .fb-panel { position: fixed; right: 12px; top: 50%; transform: translateY(-50%); z-index: var(--vt-z-overlay);
  width: min(340px, calc(100vw - 48px)); box-sizing: border-box; background: var(--vt-surface-card);
  border: 1px solid var(--vt-rule-strong); border-radius: var(--radius-2); padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4); }
@media (prefers-reduced-motion: no-preference) {.w1505 .fb-panel { animation: w1505-s5-fade var(--dur-fast) var(--ease-house) both; } }.w1505 .fb-head { display: flex; align-items: baseline; gap: 10px; }.w1505 .fb-head h2 { font-size: var(--text-md); }.w1505 .fb-close { margin-left: auto; background: none; border: 1px solid var(--vt-rule); border-radius: var(--radius-1);
  cursor: pointer; font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--vt-text-secondary); padding: 5px 9px; }.w1505 .fb-close:hover { color: var(--vt-text); border-color: var(--vt-rule-strong); }.w1505 .fb-note { margin: 0; font-family: var(--font-mono); font-size: 9.5px; line-height: 1.6; letter-spacing: 0.04em;
  color: var(--vt-text-muted); }

/* ================= misc ================= */
.w1505 .mono-list { list-style: none; margin: 0; padding: 0; }.w1505 .mono-list li { display: flex; gap: 10px; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--vt-rule-soft);
  font-family: var(--font-mono); font-size: 11px; line-height: 1.65; letter-spacing: 0.03em; color: var(--vt-text-secondary); }.w1505 .mono-list li:last-child { border-bottom: none; }.w1505 .mono-list li::before { content: "·"; color: var(--vt-text-faint); }.w1505 .s5-twocol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); align-items: start; }
@media (max-width: 980px) {.w1505 .s5-twocol { grid-template-columns: minmax(0, 1fr); } }

/* ---- repo integration compat (deviations documented in the port header) ---- */
/* Tailwind preflight strips list bullets globally; the legal prose relies on them. */
.w1505 .lg-prose ul { list-style: disc; }
/* The app's floating feedback button occupies bottom-right 24px; keep the
   prototype bar clear of it. */
.w1505 .s5-proto { bottom: 72px; }
/* Design-reference strip (mirrors the 1503 DemoStrip grammar). */
.w1505 .s5-ref { border-bottom: 1px dashed var(--vt-degraded-border); background: var(--vt-surface-page); }.w1505 .s5-ref-inner { display: flex; align-items: center; gap: 12px; padding: 6px 0; flex-wrap: wrap;
  font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--vt-text-secondary); }.w1505 .s5-ref-inner .glyph { display: inline-flex; color: var(--vt-text-muted); }

`;
