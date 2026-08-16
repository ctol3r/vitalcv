# External UX / Design / Motion audit — 2026-08-16

**Source:** founder-commissioned external audit, pasted 2026-08-16. Desktop (~1350px), 15 public
routes. Preserved here verbatim-in-substance as the canonical UX backlog so items are
claim-checkable and mapped to the surface-unification program, rather than living in chat.

**Method note (from the auditor):** live browser + computed-style extraction; no source modified.
Not covered: mobile/responsive, signed-in surfaces, `/for/payer`, `/for/staffing-exchange`.

## Claim-check against live `main` (verified 2026-08-16 after E.2 `082185a70` deployed)

The audit was run against the **pre-E.2** site. Several homepage items are already superseded:

| Audit item | Live status now | Disposition |
|---|---|---|
| #4 homepage illustration strip missing | **Superseded** — E.2 ships the clinical figure system | closed by E.2 |
| #9 `galileo` demo listings on `/` | **Fixed** — 0 galileo strings live | closed |
| #20 homepage hero is 38px sans, weakest type | **Superseded** — E.2 register (Fraunces display) | closed by E.2 |
| #1 `/verify` renders ghosted (`opacity:0`) | **STILL BROKEN** live | → fix wave `fix/p0-broken-public-surfaces` |
| #2 `/verify` buttons look disabled | **STILL LIVE** | → same fix wave |
| #3 `/sign-in` empty / Clerk widget absent | **STILL BROKEN** (14 clerk refs, 0 widget) | → same fix wave |
| #13 `theme-color` `#2C3E2D` forest green | **CONFIRMED** live | → same fix wave |
| #7 magnifier icon links to `/verify` | live | → same fix wave |
| #47/#82 sticky-header overlap + no `scroll-margin-top` | live | → same fix wave |
| #59 H2 "A job board that reads your credentials" | **STILL LIVE** — contradicts the not-a-job-board doctrine | → v4 homepage build reframes it |

## Program mapping — the audit's central finding IS the running wave

The audit's headline — *"the site currently ships three or four different design systems"* — is
exactly the **surface-unification program** already in flight:

- `/` → Direction A register (E/E.1/E.2 shipped); **Homepage v4 / amendment F** in build.
- `/directory/[npi]` → Direction A pass shipped (#1424 `df0ff184c`).
- Remaining surfaces (`/explore`, `/opportunities/[id]`, `/onboarding`, `/trust`, `/employers`,
  `/pricing`, `/verify`, `/sign-in`) → sequenced surface waves, each through the founder visual gate.
- The audit's **token codification** (§B 11–19), **type scale + serif hero** (§C 20–29),
  **color semantics** (§D 30–36), **one footer / IA** (§G 54–58), **motion program** (§E 37–47),
  and **illustration program** (§F 48–53) become the acceptance checklist for those waves and the
  `VITALCV_BRAND_EXPRESSION.md` brand doc (program wave B0).

## The full audit (backlog of record)

Grouped P0 → P2. Items already closed above are struck in the mapping table; the rest stand.

### A. Broken / unfinished — P0
1. `/verify` renders ghosted (entrance-reveal never completes; `opacity:0` shipped). 2. `/verify`
Verify/Inspect buttons pale-lavender, read disabled, fail contrast. 3. `/sign-in` effectively
empty — Clerk widget doesn't render, no fallback, dead-end. 4. Homepage illustration strip missing
(orphan caption). *[closed by E.2]* 5. `/trust` hero diagram near-empty (looks like a loading
state). 6. `/evidence-network` centre node is an empty box; odd dashed-circle legend glyph. 7. Nav
"search" magnifier actually links to `/verify` — affordance mismatch. 8. Menu icon state bug
(hamburger morphs to ">" and desyncs). 9. Homepage roles feed looks like test data (`galileo`,
dupes). *[fixed]* 10. Homepage NPI input didn't accept input in testing (verify mouse+kbd+paste).

### B. Design-system fragmentation — P1
11. Pick one design language (or two deliberately: clinician accent + employer accent). 12. Codify
tokens (one bg ramp, one ink, one muted, two semantic accents, one success green, one warning
amber; kill lavender / multiple greens / multiple indigos). 13. `theme-color` `#2C3E2D` matches no
palette. 14. Two different footers, neither a full sitemap — build one grouped footer everywhere.
15. Nav CTA styling inconsistent (filled/outlined/icon-swap) — normalize the header component.
16. Eyebrow/kicker style inconsistent — pick mono-caps+rule, one color, site-wide. 17. Icon
language mixed (red line / indigo boxed / circled arrows / text-glyph) — one weight, one container,
one accent. 18. ≥6 button styles — reduce to primary/secondary/tertiary with defined states.
19. Three arrow glyphs (↗ → ↳) used inconsistently — document and apply.

### C. Typography — P1
20. Homepage hero typographically weakest; inner pages get 60–80px serif heroes — give `/` the
serif display. *[E.2 addresses]* 21. H1 line-height 0.96 too tight (→1.05–1.1). 22. ~24 distinct
size/weight combos on the homepage — define and enforce a scale. 23. Base body line-height 1.15
leaks into small text (→1.5–1.6). 24. Serif used three ways — systematize (display heroes / italic
accents / sans elsewhere). 25. Mono overextended on employer pages (full paragraphs) — reserve for
labels/data/receipts. 26. `/trust/attribution` 10–11px gray-on-cream strains — bump to 12–13px,
darken. 27. Rotating hero word swaps with no transition + reflow — fixed-width slot + crossfade.
28. Widow/orphan control on serif headlines — `text-wrap: balance`. 29. Em-dash tic — vary.

### D. Color — P1
30. Red does two jobs (brand accent + error/blocker semantics) — split brand-red from semantic-red
(or amber for blockers). 31. Ghost placeholder text too faint (reads as failure) — raise contrast
or clear skeleton + "left blank on purpose" chip. 32. Entire site one flat cream — add background
rhythm (alternate `#FBFAF7`/`#F3F1EC`, tint trust panels). 33. Status-pill language
(green/amber/gray) is the best trust UI and never appears on `/` — surface a compact live
source-state strip on `/`. 34. Green in 3 unrelated roles — pick one job. 35. Dark surfaces
inconsistent — one dark-surface token; fix dark-on-dark logo/Sign-in in the mega-menu. 36. Verify's
lavender gradient belongs to no palette — retire.

### E. Motion & animation — P2 (biggest headroom)
37. ~30 keyframes defined, ~none used — use or drop the dead CSS weight. 38. Animate the hero
source diagram (staged, reduced-motion fallback exists). 39. Animate the match-scoring card.
40. Rotating word: fixed slot, crossfade/slide 250–300ms. 41. Section entrances: one restrained
rise+fade, staggered, no scroll-jack. 42. `/employers` review-journey carousel rough (OS scrollbar,
clipped card, no snap) — scroll-snap, hidden scrollbar, next-card peek, page-one-card arrows,
progress dots. 43. Status/trust pills should pulse (`status-pulse` exists). 44. Evidence-network
graph: animate a packet source→record→consent→opportunity. 45. Micro-interactions (rows, lens
cards, plan cards, FAQ) — 2px lift/tint 120–150ms, button pressed states. 46. Fix the one animation
that runs (the `/verify` reveal, item 1). 47. Sticky header scroll state (blur+border once scrolled)
+ `scroll-margin-top`.

### F. Illustration & imagery — P2
48. Homepage has no imagery — bring a homepage-appropriate variant of the 3D still-life language.
*[E.2 ships drawn figures instead — direction ruled: drawn clinical objects, not 3D renders]*
49. Same 3D render reused on `/employers`, `/pilot`, `/onboarding` — commission 2–3 variants.
50. Photography appears once (employer team photo) — build a small photo system or cut. 51.
Illustration captions exhaustive — compress to one line, long version in a details/tooltip. 52.
Trust diagrams need real content (5, 6). 53. Regenerate OG image once brand is unified.

### G. UX / IA / page-level — P1/P2
54. A third of the site is mega-menu-only — footer + cross-link. 55. Mega-menu 60% dead space —
use it or shrink. 56. Mega-menu lacks a visible close (✕). 57. "Jobs" / "Explore clinician
opportunities" / "The opportunity field" — three names for one surface, pick one. 58. No nav active
states on inner pages. 59. Homepage H2 "A job board that reads your credentials" hands the category
away — reframe (the doctrine says NOT a job board). *[v4 build]* 60. Employer path nearly invisible
on `/` — give employers a real section. 61. Quick answers has 3 items, no path to more — add real
objections + link `/trust`. 62. Duplicate closing CTAs stack — tighten to one dual-action block.
63. `/explore` exposes 14 filters before results — collapse to a primary row + drawer, sticky.
64. `/explore` lens cards clip, no snap. 65. `384 ROLES` buried — proper results header. 66. Role
rows scan-poor — collapse empty fields into one "Source didn't state: …" line. 67. `/employers`
repeats "Request organization access" 4+× — vary secondary CTAs. 68. `/for/*` + `/solutions` +
`/employers` overlap — add a "Who is this for?" switcher. 69. `/solutions` "REUSES: EVIDENCE ·
TRUST…" internal-architecture speak — humanize. 70. `/pricing` 2nd row leaves an empty cell —
rebalance. 71. Pricing status badges unexplained + lone yellow chip (token drift) — legend. 72.
Pricing cards read as wireframes — elevate the one actionable plan. 73. "What this page will never
claim" is the best content — promote it visually. 74. `/contact` fields no placeholders/focus/
validation; CTA color drift; email listed twice. 75. `/onboarding` FAQ rows show no expand
affordance. 76. Onboarding vs homepage NPI entry are two designs — unify the component. 77. `/trust`
+ `/status` duplicate the source-lane list — build one `SourceLaneStatus` component. 78.
`/trust/attribution` "SIGN IN TO VIEW" pills look like chips but read like buttons — disambiguate.
79. Feedback pill overlaps content — clearance/hide-on-overlap. 80. `/status` surface the "when" +
pulse the dots. 81. A11y: skip-link/lang/single-H1/sr-only/reduced-motion present; risks — ghost
contrast, 10–11px mono, lavender buttons, unverified focus-visible, mega-menu focus trap, carousel
keyboard op — run axe. 82. Anchor scroll lands under sticky header — `scroll-margin-top`. 83.
`<title>` "One career record. More ways forward." appears nowhere on the page. 84. Meta description
solid — keep. 85. `/privacy` too thin for a healthcare buyer's security review — expand retention /
subprocessors / clinician-data-ownership.

### H. Quick wins (this week)
86. Force `/verify` visible + darken buttons. 87. Fix/fallback `/sign-in`. 88. Remove orphan
"Drawn illustrations" caption or ship the strip. *[closed by E.2]* 89. Point the magnifier
somewhere honest. 90. Dedupe/label `galileo` listings. *[fixed]* 91. `theme-color` → cream/ink.
92. `text-wrap: balance` + H1 line-height. 93. Sticky-header scrolled state + `scroll-margin-top`.
94. Sticky-header eyebrow overlap on `/trust`. 95. One footer everywhere.

## Sequencing (audit's, reconciled to the program)

- **Now (P0 broken):** items 1, 2, 3, 5, 6, 7, 8, 13, 47, 82 → `fix/p0-broken-public-surfaces`
  (broken/wrong surfaces, disjoint from the homepage island). Item 59 → the v4 homepage build.
- **P1 (fragmentation → the surface waves):** 11–19, 20–29, 30–36, 54–58, 60–62 land per-surface as
  each route gets its Direction A pass, with the token/footer/type work codified in the brand doc.
- **P2 (motion + illustration + page polish):** 37–53, 63–80, 85 — the motion program is the
  register's next layer (E.2 began it on `/`); the rest are per-surface polish.

The copy discipline the audit praises (honest source states, "illustrative" labels, no banned
claims) is the truth contract holding — preserve it through every visual change.
