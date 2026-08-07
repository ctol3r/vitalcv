# R5–R13 — Approved-direction implementation plan

**Founder decision:** GO — CONCEPT C (Cinematic Ask + Evidence OS), recorded on
PR #1062. Grafts: Concept B's claim-inspector ledger as the expanded state of a
resolved capsule row; Concept A's sliding chapter rail as the chapter menu.

Concept artifacts: `docs/design/home-recovery/concepts.md`,
`artifacts/home-recovery/concepts/concept-c.html`.
Current-state evidence: `docs/design/home-recovery/current-state-inventory.md`.

## What this branch changes

`/` becomes one composition in five chapters, carried by **one persistent
document object** — the evidence capsule — which forms, resolves, decides,
travels, and seals:

| Chapter | Capsule state | Product surface |
| --- | --- | --- |
| YOUR NUMBER | forming (six source strips gathering under the ask) | NPI control on the record itself |
| SOURCE RESPONSES | resolved | claim rows + inspector ledger (source / retrieval / receipt / signature / limitation) |
| YOUR PERMISSION | deciding | travels/held ledger + consent seal |
| HUMAN REVIEW | traveling subset | packet + reviewer checkpoint + truth boundary |
| (closing) | sealed | conversion |

The live lookup renders **in the same capsule**, in place, in chapter one.

## Ownership decisions (R6 — made before anything is added)

| Intent | Decision |
| --- | --- |
| Eyebrow | **Canonical = `design-system/components/ExpandingEyebrow`** with the home version's Escape-to-close and `data-hydrated` guard ported in. `components/home/ExpandingEyebrow.tsx` and `styles/glass-eyebrow.css` are deleted. Reason: the design-system version already meets the 44px floor the home version misses by 24px, its detail is a block rather than a `nowrap` clip, and it is token-driven. |
| Primary action | **Canonical = `design-system/components/ProductAction`** for every homepage CTA, extended with a finite arrow exchange. Reason: it is the only implementation that enforces 44px as a height rather than a floor a caller can undercut, and its pending state changes the word instead of spinning. `.film-npi-submit` / `.film-route*` are deleted. |
| Evidence artifact | **Canonical = `components/home/evidence/EvidenceCapsule`**, rebuilt as the five-face persistent object. `evidenceCapsuleModel` is unchanged — it stays the truth owner. `FilmRecord`, `FilmFit`, `FilmSignature` collapse into the one capsule grammar. |
| Style owner | **One route stylesheet: `styles/home.css`.** It owns the composition AND the capsule, which is what closes the P0. `compete-film.css`, `glass-eyebrow.css`, and the six orphaned homepage sheets are deleted. |
| Motion | One vocabulary — RESOLVE / SEAL / HANDOFF / RECOGNIZE — one token set, one page-level scroll owner (`useFilmProgress`, unchanged contract). |
| Source state | Unchanged truth boundary: the homepage consumes `SOURCE_LANE_OPS` and the live lookup APIs. National licensure stays access-gated and is rendered as exactly that. |

## Defects this branch fixes

1. **P0 — the live NPI result rendered unstyled in production.** `EvidenceCapsule`
   emitted 23 `.evidence-capsule*` classes whose only two stylesheets have been
   orphaned since `bdbfbca1e`. The capsule now has one owned stylesheet that the
   route imports, and a test asserts the route actually imports it (the previous
   tests read the CSS off disk with `readFileSync`, which is why CI stayed green).
2. **A kill-list term shipped on the acquisition path.** The resolved capsule's
   next-step copy said "Claim your free CV Wallet" / "Claim your Wallet". CD-13
   retires wallet vocabulary anywhere in the acquisition path, and it is in the
   shipped `BUYER_BANNED_STRINGS` list. Replaced with the real next step.
3. **A count contradiction.** `CHOICE_FACTS` said "Three federal source lanes"
   while the record rendered six rows from the same registry.
4. **44px floor.** `.film-route*` declared no minimum height.

## Deletions (R12)

Orphaned compositions: `app/HomePageClient.tsx`, `components/home/ask/**`,
`components/home/cinematic/**`, `components/home/spine/**`,
`components/home/WorkflowStoryTabs.tsx`, and the retired film pieces.
Stylesheets: `compete-film.css`, `glass-eyebrow.css`, `ask-home.css`,
`cinematic-home.css`, `evidence-input.css`, `evidence-capsule.css`,
`home-surfaces.css`, `spine-tabs.css`, `home-vitals.css`, `homepage-motion.css`,
`story-rail.css`, `scene.css`, plus the `typography.css` double import.

## What is NOT changed

`evidenceCapsuleModel.ts` (truth owner), `lib/trust/sourceLanes.ts`,
`useFilmProgress`'s contract, `/api/*` behavior, the `data-home-hero` deploy
marker, and every truth-boundary sentence.
