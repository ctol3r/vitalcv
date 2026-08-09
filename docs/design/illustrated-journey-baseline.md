# Illustrated journey — reconciliation baseline (ILL-00)

**Wave:** ILL-00, executed as a single reconciliation across five overlapping programs.
**Base:** `origin/main` `232309b03` · deployed web build `c49bb10f` (read from `/api/version`).
**Source briefs:** `VITALCV_CLAUDE_CODE_EXECUTION_PLAN_ILLUSTRATED_JOURNEY_2026-08-09.md`,
`VITALCV_HOMEPAGE_ILLUSTRATION_RESEARCH_AND_STORYBOARD_2026-08-09.md` (founder Dropbox, not in repo).

This document exists because five programs delivered to Claude Code on 2026-08-08/09 each open
with an audit-only wave, and those five audits overlap by roughly seventy percent. Running them
as written costs about a week and produces five documents. Three of them are already done.

---

## 1. The five audit waves, reconciled

| Wave | Program | Deliverable | Status on `232309b03` |
|---|---|---|---|
| CC-00 | Visual System + Workbench | `docs/architecture/workbench-baseline.md` | **DONE** — tracked on main |
| D-00 | 2026 Design Implementation | `docs/design/VITALCV_2026_VISUAL_LANGUAGE.md` | **DONE** — tracked on main |
| UX-00 / UX-01 | Experience Overhaul | Constitution + `DECISION.md` + `PARKED_VISUAL_ERAS.md` | **DONE** — all three tracked on main |
| CONQ-00 | Competitive Conquest | `docs/architecture/acceptance-layer-baseline.md` | **WRITTEN, UNTRACKED** — exists only in the `wave/career-evidence-network-alignment` working tree. Not on main, therefore not citable |
| BD-01 / BD-02 | Unified Billion-Dollar | `release-map.md`, `current-product-map.md` | **ABSENT** |
| ILL-00 | Illustrated Journey | this file | **DONE** (this wave) |

**Finding.** Only `scripts/copy-rules.json` (UX-16) and the two BD architecture maps are genuinely
missing. CONQ-00's work was done but never committed, which is the exact failure the constitution
already recorded once at EC-24/W1080: *a governance document that cites a file nobody can open is a
claim about law, not law.* `apps/web/__tests__/governance-citability.test.ts` exists to prevent this
and did not catch it because the file is referenced from a founder brief outside the repo rather
than from a tracked document.

---

## 2. Stale premises in the briefs, corrected

Each of these is asserted as current fact in a 2026-08-08/09 brief and is false on `232309b03`.
They matter because three of them would have had this wave rebuild something that already exists.

| Brief claim | Measured state |
|---|---|
| Experience Overhaul §1.1: "`apps/web/app/fonts/` is **empty** … the product's typography is currently whatever the visitor's OS ships" | Six files tracked: `Geist-Variable.woff2`, `GeistMono-Variable.woff2`, three Fraunces variants, `LICENSES.md`. EC-20's `next/font/local` row is satisfied |
| Experience Overhaul §1.1: "`check-design-lint.ts` exists **only** in the `.worktrees/retire-speed-claim` worktree — the CI enforcement gate never landed on mainline" | `scripts/check-design-lint.ts` is on main, wired by `.github/workflows/design-lint-gate.yml` |
| ILL-02 / D-03 / CC-06: "create or extend the actual shared scene component … define asset manifest validation" | Already shipped: `apps/web/components/visual-scene/{VisualScene.tsx,manifest.ts,validateManifest.ts}`. It already implements static/motion/reduced selection, IntersectionObserver single-play, Replay, reserved aspect box, per-asset source/license/origin, and the EC-29 byte budgets. Its type contract already makes `kind='stateful'` require real state with no fixture path |
| ILL-03 / D-02: "build the scene primitives" | Shipped 2026-08-09 in #1233 (`c49bb10f`): `components/vital/{VitalAction,VitalGhostAction,VitalPill,VitalFrostPanel,VitalSceneFrame}` plus the `/design/vital-primitives` harness |
| BD program / W1078: "live `/status` reports build `80fca28` while GitHub `main` was at `351c2c0` … a founder can approve the right product and visitors can still receive an older one" | No drift. Production `c49bb10f` is a direct ancestor of main, exactly **2** commits behind (#1270 docs, #1224 apply choreography). The deploy chain is healthy |
| Illustration storyboard: the homepage "carries a five-beat illustration" and "is missing emotional spatial clarity" | Accurate when written, superseded within the day. `/` now carries **two** explainers — `WorkSurface` (5-beat, manifest §2) and `ProcessStory` (UX-04's deep five-chapter story, manifest §4, #1269). See §4 |

---

## 3. Source owners for every surface this program touches

| Surface | Owner | Gate |
|---|---|---|
| `/` composition | `components/home/easy/EasyHome.tsx`, island `.ezh` | `docs/design/homepage-composition-manifest.md` + `__tests__/homepage-composition-gate.test.tsx` |
| `/` explainer beats | `WorkSurface` (§2) · `ProcessStory` (§4) | same manifest; change protocol requires manifest + gate in the same PR |
| Scene runtime | `components/visual-scene/VisualScene.tsx` | EC-26 (Class A); `validateManifest.ts` |
| Scene inventory | `components/visual-scene/manifest.ts` — closed list of 10 `SCENE_IDS` | EC-28; a new scene requires an EC-22 amendment |
| Scene primitives | `components/vital/*` | EC-20 locked rows; `vital-scene-primitives.test.tsx` |
| Protagonist anatomy | `docs/design/vitalcv-cinematic-storyboard.md` (Z0, issue #1069) | EC-27 |
| Design harness | `app/design/*`, gated by `app/design/layout.tsx` (`DESIGN_PREVIEW`, `force-dynamic`) | 404 in canonical production |
| Token register | `apps/web/styles/themes/index.css` — `--vt-scene-*`, `--vt-shape-*`, `--vt-frost-*` | EC-20 as amended A-1/A-2 |
| Copy truth | `scripts/check-public-claims.ts` (required check) | EC-3, EC-23 |

---

## 4. Two governance findings that bind ILL-04 and block ILL-07

These are recorded rather than solved, per EC-0 ("record it as a product dependency and stop").

### 4.1 The protagonist conflict — the briefs and EC-27 disagree about who the story is about

The illustration briefs make the clinician the protagonist: *"The clinician is the protagonist; VitalCV
is the quiet operator"*, and ILL-03 asks for "a neutral clinician character silhouette" as a kit
primitive, with ILL-09 building a seven-panel story around "one non-identifying, inclusive clinician
character."

EC-27 says the opposite, and says it as locked narrative structure: *"One protagonist across the
product. It is the clinician's own record — not a dashboard, hospital, network graph, AI motif, **or a
person**."* Z0 opens with the same line: *"The protagonist is not a page. It is one object."*

EC-27 is Class C, so this is a design-review decision with named rationale (EC-21), not an EC-22
amendment — but it is a **founder call, not an implementation detail**, because it decides whether the
product's visual language is a record or a character. It also interacts with EC-14, under which
"isometric illustration, and decorative 3D are default-rejected at review; founder sign-off can
override" — which is the ILL program's entire master direction.

**Resolved during the wave: the figure ships, as a supporting actor.** The founder supplied the
`Illustrated Journey Prototype` design project mid-wave, which renders a clinician silhouette beside
the folio. That is design direction, and EC-27 is Class C — it departs through design review with a
named rationale (EC-21), not an EC-22 amendment. The rationale is recorded in
`components/vital/record/ClinicianFigure.tsx` and is narrow enough to argue with: the figure is a
supporting actor, not the protagonist. The record stays the largest object, the only one with faces,
and the only one that travels; the figure never carries a fact and never appears in the recipient or
review zones. What EC-27 forbids is the record's role being taken over — not a human ever appearing
in a scene about a human's career. Deleting that one component restores strict EC-27.

Two things the figure deliberately does not have: a skin tone or a white coat. The prototype rendered
a skin-toned head (`#e8c9a8`); the illustration brief behind it separately warns against "skin color
stereotypes, white-coat glamour, or a fabricated medical identity", and a single rendered skin tone in
the only human figure the product ships is exactly that signal. The figure is scene ink at low
emphasis.

### 4.2 The relationship scene is not in the approved inventory, and `/` is not authorized

ILL-04 specifies a `HolderIssuerVerifierScene`. `SCENE_IDS` is a closed list of ten and does not
contain it; the manifest header and EC-28 both say a new scene requires an EC-22 amendment.

ILL-07 then places that scene on `/` "immediately after the hero and before the ownership section."
EC-28's placement note forecloses this directly: *"the Journey Film is not authorized on `/` by this
clause … A Journey Film on the homepage requires an explicit EC-22 amendment and a founder visual
gate,"* and UX-01 amendment 5 forbids a blocking hero.

**Compounding this: the homepage already tells this story twice.** Manifest §2 (`WorkSurface`) is the
five-beat explainer whose story is *"VitalCV builds the record, the clinician approves what leaves it,
the employer reviews and decides"* — which is the holder/issuer/verifier relationship. Manifest §4
(`ProcessStory`, #1269, merged 2026-08-09) is the deep five-chapter version of the same EC-27 beats,
ending at an employer desk that never resolves. ILL-07 would make it a third telling.

**Consequently ILL-04 ships to the design harness only**, which is what ILL-04 itself specifies
("do not replace the production WorkSurface yet"). The open question for the founder is not *where does
a third explainer go* but *should the harness composition eventually replace or consolidate §2 and §4* —
a UX-04/D-05 consolidation question, not an illustration-wave question.

---

## 5. What this wave is authorized to do

Building, on branch `wave/ill-03-04-living-profile-kit`:

- **ILL-03** — a static illustration kit built strictly from the Z0 anatomy parts, colours resolved
  through `--vt-scene-*`, shapes through `--vt-shape-*` under EC-20 A-2 (an action is square; a
  word-label may be a pill; an illustration that *depicts* an action takes radius 0).
- **ILL-04** — the relationship composition, rendered on a gated `/design` route with its transcript
  adjacent in HTML, reviewed at 390 / 768 / 1440 and under reduced motion.

- **ILL-05** — step controls, replay, and a single-play sequence, added because the founder's
  prototype supplied them (see §5.1).

Not building: no new `SceneId`, no manifest entry, no homepage change, no `VisualScene` modification,
no 3D.

### 5.1 Synthesis with the `Illustrated Journey Prototype` design project

The founder's prototype (`Illustrated Journey Prototype.html` + `ill/kit.css`) arrived mid-wave and
carries more than ILL-03/04: it has ILL-05's step controls, replay, live transcript, a visible consent
gate, and distinct issuer architecture. Those are its real contribution — they turn a diagram into
something a visitor can interrogate — and all of them ported.

Five things could not port as drawn, each against a locked row rather than a matter of taste:

| Prototype | Why it could not port | What shipped |
|---|---|---|
| Green `✓` on every evidence tile (`.ill-tile .src::before`) | In an illustration no source has answered, so a confirmed mark asserts exactly the certainty EC-3 bars a treatment from implying; EC-20 pins green to "only when a named source actually returns a match" | Attribution survives as glyph + word in paper ink. No hue anywhere in the artwork |
| DM Sans + Geist via Google Fonts | EC-20 font delivery is LOCKED to self-hosted `next/font/local`, never `next/font/google`; DM Sans is not in the locked set | Geist, already self-hosted |
| `--void` / `--bone` / `--brass` / `--clay` raw hex (the Dimension palette) | EC-23 bars raw values outside token files and foreign prefixes; brass has no token behind it | `--vt-scene-*`; the brass seal became an ink circle — the shape was doing the work anyway |
| `box-shadow` on folio, tiles, packet, desk; gradient folio fill | Z0: "SHADOW: None on evidence. Ever." and "no gradient on paper" | Depth from overlap and the 2px top edge |
| Autoplay on load as the source of truth | EC-26: reduced motion is a composition, not a fallback | Server renders the complete frame; motion mounts client-side only after in-view + not-reduced + not-save-data, plays once, settles |

The prototype's three-way Static/Motion/Reduced switch was folded into the same mechanism rather than
kept as a separate control: the composition is always complete, and motion is an enhancement on top.

## 6. Not measured in this pass

ILL-00 asks for an LCP/CLS/JS-byte baseline for `/`. **Not captured here**, deliberately: this wave
touches no homepage code, so a `/` performance baseline has nothing to protect in it, and a number
measured on a local dev server would be a worse record than no number. It becomes a real obligation
at the first wave that changes `/` — which under §4.2 requires a founder gate first.

## 7. Next eligible wave

ILL-05 (relationship scene controls and low motion) is eligible only after a founder look at the
ILL-04 harness composition, because ILL-05's motion is applied to whatever ILL-04's review approves.
The two §4 findings are the blocking founder decisions.
