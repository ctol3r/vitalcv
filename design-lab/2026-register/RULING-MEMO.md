# D′-00 Ruling Memo — 2026 register

**Date:** 2026-08-09 · **Board:** `design-lab/2026-register/index.html` · **Program:** `docs/design/VITALCV_2026_DESIGN_WAVES_RECONCILED_2026-08-09.md`
**Mechanism:** each adopted challenge lands as a dated EC-22 amendment at D′-09; nothing ships against a locked EC-20 row before its amendment exists. Until ruled, every knob holds the locked value (`--vt-frost-filter: none`, `--vt-atmos-display: none`, radii 2–3px, chips 2px).

## Ruled 2026-08-09 — primary CTA (recorded, not open)

**Ruling:** primary actions become warm-paper inverse; green is evidence only.

**Drafted EC-22 amendment (for the D′-09 commit, CTA portion effective now):**

> **EC-20 · Interaction/accent treatment — amended 2026-08-09.** The 2026-08-08 accent-work merge is partially reversed: work-green (`#4ADE97` reference, `--vt-evidence`) remains the single *work* color — source-confirmed facts, completed work, moving work — and is **retired as the primary action**. Primary actions are the paper-inverse instrument: warm paper fill (`#F6F5F1` reference, `--vt-action-primary-bg`) with near-black ink (`#151412`, `--vt-action-primary-fg`), square-cornered per the radius row. Needs-you amber and waiting neutral are unchanged. Nothing glows. Rationale: on the shipped homepage the identical green carried both "act now" and "work done"; a truth-grammar color that also begs for clicks stops being a truth color. The four asymmetries (EC-11) are unaffected — the product still demonstrates rather than asserts.

**Where it lands:** token values in D′-01 (`semantic.css`); visible flip in D′-04 (homepage + eyebrow), behind its own founder visual gate.

## R-a — Filter/tag silhouette (pills)

Challenges EC-20 "pills retired (verdict-locked)". Proposal is scoped: pills for **filters and tags only**; buttons, state markers, and stamps stay square under either ruling (state markers are additionally pinned by the existing lint).

**Recommendation: DECLINE.** The pill is the single most identifiable Dimension/Vercel-family silhouette; adopting it re-imports the "floating SaaS" register the eyebrow work deliberately rejected. The 2px stamp row on the board reads just as scannable. If adopted anyway: `--vt-radius-chip: 9999px` is the entire change (D′-09), plus the amendment text.

## R-b — Frost on chrome/Workbench sidecar

Challenges EC-20 "Glass: None. Solid surfaces everywhere". Proposal scoped to **chrome and the private Workbench sidecar only**; evidence and record surfaces stay solid under every ruling (EC-13 "glass on chrome, solid on evidence" was the pre-verdict form of this rule).

**Recommendation: DECLINE for now, revisit at D′-07a with the real Workbench shell.** Frost's honest job is signaling "this floats above your work, it is not the record." The Workbench dock is the one surface where that meaning is true. But blur costs paint time on low-end clinician hardware, complicates AA contrast proofs, and the solid raised panel on the board communicates privacy adequately via the hairline + label. If adopted: `--vt-frost-filter: blur(8px)` + `--vt-frost-bg` (D′-09), scope-limited by lint to chrome/workbench selectors.

## R-c — One indigo atmosphere per viewport

Challenges EC-20 "Gradient: None" + no-glow. Proposal: at most ONE quiet radial indigo wash per viewport, behind a key visual moment only, never on a button/text/status/input, using the repo's own editorial indigo (`#4338CA` family) — not the reference palette's violet.

**Recommendation: ADOPT, narrowly.** This is the one challenged treatment that buys real distinction: it gives the profile object a stage without touching the truth grammar (indigo has no state meaning in the system — the CD-era accent law already reserved it as editorial). The board's Sheet D shows it at 0.28 alpha; it disappears entirely under `prefers-contrast: more` and prints as nothing. Guard: `--vt-atmos-display` + a lint rule that the wash class may appear at most once per route composition and never inside an interactive or state-bearing element.

## R-d — Radius scale

Challenges EC-20 "near-sharp 0–3px". Proposal: 8–10px product controls, 20–24px marketing cards; operational tables/proof rows crisp regardless.

**Recommendation: DECLINE for instruments and records; no objection to a marketing-card exception if the founder wants warmth on acquisition surfaces.** The near-sharp stamp is by now VitalCV's own signature ("archival record, not floating SaaS card"); rounding the record panes erases it. A scoped `--vt-radius-card-marketing: 20px` consumed only by acquisition-surface cards would be an honest middle if desired.

## Freeze / UX-03 disposition (needed before D′-02+ PRs open)

EC-0 freezes visual PRs "until UX-03 ships." UX-03 never ran as its own wave; UX-V1 (#1190) shipped the 64px eyebrow instrument with an explicit founder visual GO and it is live in production. **Recommendation:** record in EC-24 that UX-V1 discharged UX-03's deliverable (the eyebrow exists, was founder-gated, and froze as chrome), so the freeze clause is satisfied and lifts; D′ waves additionally run *inside* the Experience Overhaul lineage, which the freeze text already exempts. If the founder instead wants the formal UX-03 gate re-run against the shipped eyebrow, that review happens before D′-04 (the only D′ wave that touches the eyebrow).

## PR #1165 (UX-02 census) disposition

**Recommendation:** keep #1165 as evidence, lift the hold only after D′-01 merges, and rebase its mapping so census targets are the D′-01 names (`--vt-action-*`, `--vt-evidence`, `--vt-radius-*`, `--vt-paper-*`, `--vt-space-*`) — one dialect, no fork. UX-02 execution then becomes strictly subtractive: map legacy props onto bridge names, delete imports. Nobody pushes to the founder-held branch; the rebase is the census lane's own scoped work.

## Evidence

`capture.mjs` in this directory renders the board at 1440×900, 390×844, and 1440 reduced-motion into `evidence/` (untracked, regenerable — same convention as `design-lab/homepage-reset/`).
