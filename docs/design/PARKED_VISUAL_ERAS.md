# Parked Visual Eras

**Status:** Binding freeze record · Phase 0 of the Experience Overhaul Program
**Date:** 2026-08-08
**Authority:** `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (Phase 0) · `VITALCV_EXPERIENCE_CONSTITUTION.md`

## The freeze

A **UI PR freeze is in effect until UX-03 (eyebrow + navigation) ships.** No visual PRs land
outside the Experience Overhaul Program. Bug fixes that happen to touch UI files are permitted
only when they change no visual treatment.

Every visual treatment below is **parked, not deleted**. Parked means: it stays in the tree, it
keeps rendering wherever it currently renders, and it confers no authority. No new surface may
adopt a parked treatment, and no wave inherits one merely because it exists. Physical removal is
UX-02's de-islanding work (mechanical, many small PRs) — not something to do opportunistically.

## The eras and their residue (audited 2026-08-08 on `wave/career-evidence-network-alignment`)

| # | Era | Physical residue in `apps/web` | Parked status |
|---|---|---|---|
| 1 | **Stark black/white YC MVP** (early 2026) | Residual utility classes and layouts in older routes; `styles/utilities.css`, parts of `styles/typography.css` | Parked. No authority. |
| 2 | **Warm Minimalism / Liquid Glass blueprint** | `styles/blueprint-overrides.css`; glass/backdrop treatments on assorted chrome | Parked. Glass-on-chrome survives only as constitution law (EC-12), not via these files. |
| 3 | **Antigravity** (particles, glass, magnetic buttons) | `antigravity.css` loaded via layout; `--ag-*` tokens; particle/magnetic interaction code | Parked. On the kill list for acquisition surfaces. |
| 4 | **Calm Wave paper+ink** (waves 1500–1505) | `.mz` / `.w14` / `.w1505` scoped islands; `styles/vitalTokens.css`, `styles/tokens.css`; wave-1505 handoff under `design-handoff/claude-design-2026-07-12-wave1505/` | Parked as a *visual treatment*. Its **token/component architecture** (semantic `--vt-*` layer, StateChip contract, lint rules) carries forward as UX-02's skeleton, re-skinned to the UX-01 verdict. |
| 5 | **Creative Direction "record, not dashboard"** (July 2026) | `docs/design/VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20); partial implementation across public routes | Doctrine largely carries forward into the Experience Constitution (see its Part II). CD's palette and type sections are **subject to the UX-01 verdict**. CD is amended per CD-19, never forked. |
| 6 | **Homepage reset directions A/B/C** (2026-08-07/08) | `design-lab/homepage-reset/` — three isolated prototypes, critiques, Playwright evidence | Not an era yet. Awaiting founder verdict (UX-01). The winner's values back-fill the constitution and become global. |

## Shared entropy (belongs to no era, removed by UX-02)

- `apps/web/app/globals.css` imports **13 stylesheets** (14 `@import` lines incl. normalize +
  tailwind): `themes/index.css`, `vds.css`, `design-tokens.css`, `utilities.css`,
  `typography.css`, `tokens.css`, `vitalTokens.css`, `blueprint-overrides.css`, `matcha.css`,
  `matcha-zen.css`, `graph.css`, `intelligence.css` — plus `antigravity.css` via layout.
- Competing token prefixes: `--vt-`, `--ag-`, `--palette-`, `--vital-`, `--gf-`, `--trust-`,
  `--infra-`, `--glue-`, `--ops-`, `--mz-`, and more.
- A **global `*` transition rule** (~280ms on color properties) — forbidden by the wave-1505
  motion doctrine it coexists with.
- `apps/web/app/fonts/` **does not exist** — body and mono text resolve to system stacks.
- Two parallel component systems (`design-system/` vs `components/ui/`); a `Badge` import
  resolves differently by path; **≥30 status/badge components** express the same truth states.
- `check-design-lint.ts` exists only in the `.worktrees/retire-speed-claim` worktree — the CI
  enforcement gate never landed on mainline. Porting it is Part 4 of the program.

## What "unparking" would take

A parked treatment returns only via a constitution amendment (dated rationale, founder-approved)
— the same bar as any other visual law change. There is no other path.
