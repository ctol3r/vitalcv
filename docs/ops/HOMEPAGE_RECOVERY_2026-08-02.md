# Homepage recovery — 2026-08-02

## Objective

Recover VitalCV’s public experience from fragmented agent output and establish one founder-approved homepage that is visually ambitious, operationally truthful, and maintainable.

This is a recovery program, not permission for another parallel redesign.

## Confirmed current-state problems

1. `apps/web/app/page.tsx` mounts only `HorizontalCareerFilm`.
2. The homepage composition was replaced wholesale without a founder visual-approval gate.
3. The repository contains two `ExpandingEyebrow` implementations:
   - `apps/web/components/home/ExpandingEyebrow.tsx`
   - `apps/web/design-system/components/ExpandingEyebrow.tsx`
4. The experience-component library was described as an improvement while its own merge receipt stated that none of the new components were mounted on a live route.
5. The homepage relies on a route-scoped `compete-film.css` system rather than consistently consuming the canonical experience library.
6. Claude and Codex independently built overlapping homepage and product work because intent was not claimed through visible draft PRs.
7. A runtime-image packaging defect froze web deployment while `main` continued to advance, so repository progress and production reality diverged.
8. Automated gates strongly protect truth, accessibility, and doctrine but do not judge visual quality, emotional clarity, or founder confidence.

## Recovery rules

- One homepage branch at a time.
- One named creative owner.
- One canonical component per intent.
- No design-system-only milestone presented as visible progress.
- No public visual merge without founder screenshot and motion review.
- No large rewrite before an approved static composition exists.
- No loss of NPI-first usability, source truth, reduced-motion behavior, keyboard access, or exact-SHA deployment proof.

## Phase 0 — stop the bleeding

Deliverables:

- [x] Founder visual gate document.
- [x] Claude and Codex repository contracts point to that gate.
- [ ] Open all homepage-affecting PRs as draft or close them as superseded.
- [ ] Identify every branch touching `apps/web/app/page.tsx`, `components/home`, `styles/compete-film.css`, shared navigation, and public typography.
- [ ] No new homepage PR begins until the inventory is published.

## Phase 1 — visual and component inventory

Create `docs/audits/HOMEPAGE_VISUAL_INVENTORY_2026-08.md` containing:

- current production screenshots at 390 × 844, 768 × 1024, 1440 × 900, and 1728 × 1117;
- current motion recording;
- reduced-motion recording;
- first-five-second comprehension notes;
- hierarchy map;
- dead-space measurements;
- text-width measurements;
- every homepage component and stylesheet;
- every duplicate intent;
- every unmounted design-system component;
- every open PR and branch that touches the same surface;
- recommendation for keep, migrate, rewrite, or delete.

Required duplicate decisions:

- Which `ExpandingEyebrow` is canonical?
- Does `ProductAction` replace the bespoke film submit and route buttons?
- Does `EvidenceCapsule` replace the bespoke `FilmRecord` panel language?
- Which motion tokens govern the film?
- Which source-state projection feeds the homepage?

## Phase 2 — founder-approved composition

Before another major code rewrite, produce three static homepage directions using the same product truth and content:

### Direction A — Evidence cinema

High motion ambition:

- native scroll-controlled chapters;
- sliding product artifacts;
- expanding chapter eyebrow;
- strong media-scale evidence object;
- Zoox-like choreography;
- Palantir-like enterprise scale;
- VitalCV typography and source semantics.

### Direction B — Editorial evidence object

Lower motion, stronger print/editorial composition:

- one oversized evidence artifact;
- bolder typography and spatial rhythm;
- source detail revealed progressively;
- fewer scenes;
- clearer conversion hierarchy.

### Direction C — Product-first demonstration

Immediate NPI action plus live product close-up:

- input and real lookup dominate;
- product detail becomes the visual subject;
- fewer abstract marketing phrases;
- employer handoff preview grounded in real or clearly illustrative state.

Each direction must include desktop and mobile static frames. The founder selects one direction before implementation proceeds.

## Phase 3 — canonical component convergence

After founder selection:

1. Choose the canonical eyebrow implementation.
2. Migrate every active consumer.
3. Delete the duplicate.
4. Choose canonical action/button behavior.
5. Replace bespoke film controls where appropriate.
6. Choose canonical evidence artifact primitives.
7. Delete dead route-scoped styles after verified migration.
8. Add duplicate-intent guards where recurrence is likely.

No third wrapper may be added to avoid migration.

## Phase 4 — one implementation PR

The implementation PR must:

- change the live homepage;
- use one named creative owner;
- attach before/after screenshots;
- attach desktop and mobile recordings;
- preserve immediate NPI usability;
- preserve real `LiveNpiResult` behavior;
- preserve source cadence and limitations;
- preserve a complete reduced-motion and no-JavaScript composition;
- avoid copied external code or assets;
- receive `FOUNDER VISUAL DECISION: GO` before merge.

## Phase 5 — production proof and cleanup

After merge:

- verify exact web SHA;
- verify `/api/version`;
- verify `/api/health/auth` and `/api/health/db`;
- verify homepage marker and cache bounds;
- verify real NPI lookup behavior;
- capture production screenshots and recordings;
- close superseded PRs;
- delete superseded branches after confirmation;
- delete stale doctrine and comments that describe retired compositions;
- publish the release receipt.

## Immediate next implementation issue

The next code task after this governance PR is:

> **Audit and converge the live homepage component system without changing the visual composition.**

Its output is an inventory and a deletion/migration plan, not another redesign.

Only after that inventory and founder-approved static direction should a visual implementation begin.