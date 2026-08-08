# Workbench Baseline — CC-00 Repository Truth Check

**Wave:** CC-00 (`VITALCV_CLAUDE_CODE_ACTION_PLAN_VISUAL_WORKBENCH_2026-08-08.md`)
**Date:** 2026-08-08 · **Base:** `origin/main` @ `f68f07301`
**Status:** Baseline only — no application behavior, route, schema, copy, or visual asset was changed.

This document records what the repository *actually* contains, so CC-01/CC-04 and the
WB/VIS waves plan against facts rather than the briefs' assumptions. It is deliberately
short: paths, shapes, and boundaries. It does not restate the source briefs.

---

## 1. The note domain — there is exactly one

The Workbench brief's central premise holds: **Career Garden is a real, shipped, single
note domain.** There is no second note store to consolidate.

### Persistence (`apps/api/backend/prisma/schema.prisma`)

| Model | Table | Shape |
|---|---|---|
| `GardenNote` | `garden_notes` | `id, userId, title, body, tags[], status, promotedAt, createdAt, updatedAt` |
| `GardenCvEntry` | `garden_cv_entries` | `id, userId, section, headline, detail, provenance, origin, fromNoteId, createdAt` |

Migration: `apps/api/backend/prisma/migrations/20260728000000_career_garden_notes/migration.sql`
(additive, idempotent, no FK to users — rows scoped by internal `User.id` UUID).

`status` ∈ `unfiled | growing | grown`. `section` ∈ `experience | research | teaching |
service | publications`.

### Service (`apps/api/backend/src/services/garden/gardenService.ts`, 183 lines)

Pure persistence + validation. Every query filters on `userId`; a miss throws 404, never
403 — no existence leak. Length caps: title 200, body 4000, tags 8×40, headline 200,
detail 600.

### Routes (`apps/api/backend/src/routes/gardenNotes.ts`)

Seven endpoints under `/api/profile/garden/*`:

```
GET    /notes            POST   /notes
PATCH  /notes/:noteId    DELETE /notes/:noteId
POST   /notes/:noteId/promote
GET    /cv               DELETE /cv/:entryId
```

Mounted under `/api/profile/` deliberately: the tenant guard already skips that
clinician-personal family, and identity resolves via `requireInternalUserId` (imported
from `routes/intake.ts`), so this file never reads an identity header itself.

### Web layer (`apps/web`)

| Concern | Path |
|---|---|
| Server read (React `cache`) | `lib/career-garden/serverSource.ts` |
| Mutation proxies | `app/api/profile/garden/notes/{route.ts,[noteId]/route.ts,[noteId]/promote/route.ts}`, `app/api/profile/garden/cv/{route.ts,[entryId]/route.ts}` |
| Routes | `app/holder/garden/{page,notes,research,opportunities,cv,privacy}/page.tsx` + `layout.tsx` |
| Dev harness | `app/dev/career-garden/page.tsx` (in `scripts/route-guard-baseline.json`) |
| Components | `components/career-garden/` (10 files incl. `GardenShell`, `GardenCursor`, `GardenWorkspaceProvider`) |
| Fixture module | `lib/career-garden/demoData.ts` |
| Nav entry | `components/holder/HolderDesktopNav.tsx` → `{ name: 'Garden', href: '/holder/garden' }` |

Proxies resolve identity from Clerk `auth()` and never from a caller-supplied header.

---

## 2. Invariants that must not break (the no-go list)

These are enforced by code **and** pinned by tests. CC-05/WB-02 must preserve all of them.

1. **Ownership is server-resolved.** Identity comes from `requireInternalUserId(req)` /
   `auth()`. No endpoint accepts a caller-provided user id.
2. **Cross-user reads are 404, not 403.** Non-existence and non-ownership are
   indistinguishable to the caller.
3. **`provenance` is the literal `'self_attested'`.** Callers cannot set it. Promotion
   can never mint a source-backed claim.
4. **`origin` is server-derived** from the real note title + capture date, so a caller
   cannot write a misleading provenance sentence.
5. **`status: 'grown'` is promotion-only.** A status edit cannot fake it (400), and a
   grown note cannot be edited back (409).
6. **Audit before 2xx.** Every mutation writes an `AuditEvent`
   (`garden_note_created|updated|deleted|promoted`, `garden_cv_entry_removed`) before the
   response.
7. **Notes never leave the module** except by the clinician's explicit promote call.
8. **Fixtures are never a fallback for saved data.** `serverSource.ts` returns
   `mode: 'unavailable'` on any failure; it never substitutes `demoData`.
9. **Promotion is reversible.** Deleting a grown CV line reopens its seed to `growing`.

---

## 3. Test coverage that gates this domain — GREEN

| Suite | Result |
|---|---|
| `apps/web` — `career-garden-{views,demo-data,pages,cursor,server-source}` | **5 files / 33 tests passed** |
| `apps/api/backend` — `src/routes/__tests__/gardenNotes.test.ts` | **9 tests passed** (real ephemeral Postgres) |

Backend cases explicitly cover the invariants above, including *"reads another user's note
as not-found, never forbidden"*, *"refuses to fake growth through a status edit"*, and
*"promotes with the provenance literal, server-derived origin, and an audit row"*.

**Harness note:** `apps/web` vitest is gated by `test/require-workspace-build.ts` — run
`pnpm turbo build --filter='!@vitalcv/web'` first or every suite fails with a misleading
resolution error. Backend tests must run via `pnpm test` (provisions Postgres); invoking
`npx jest` directly fails env validation on `DATABASE_URL`.

---

## 4. Factual mismatches between the briefs and this repository

Recorded for founder decision, per CC-00's exit gate.

| # | Brief claim | Repository fact | Consequence |
|---|---|---|---|
| M1 | Experience Overhaul §1.1: `check-design-lint.ts` "exists **only** in the `.worktrees/retire-speed-claim` worktree — the CI enforcement gate never landed." | `scripts/check-design-lint.ts` is on `main` **and** `check-design-lint` is one of 14 **required** branch-protection contexts (`.github/workflows/design-lint-gate.yml`, deliberately not path-filtered). | Part 4 item 1 is **already done**. Do not re-port it. |
| M2 | Experience Overhaul §1.1: "`apps/web/app/fonts/` is **empty** … typography is whatever the visitor's OS ships." | Directory ships `Geist-Variable.woff2`, `GeistMono-Variable.woff2`, three `Fraunces` variable faces, and `LICENSES.md`. | UX-02 step 1 is partly landed. Re-scope to verification + `--font-*` wiring, not acquisition. |
| M3 | Experience Overhaul §1.1: `globals.css` imports "13+ stylesheets". | **22** `@import` statements. | UX-02's "≤4 imports" gate is a larger job than stated. De-islanding regressed since the audit. |
| M4 | UX-16 expects `scripts/copy-rules.json` as the machine-checkable copy law. | Does **not** exist. `check-public-claims` and `check-copy-source-liveness` gates exist and are required, but the consolidated banned-string list is not yet a file. | UX-16 is genuinely unbuilt; the adjacent gates are not a substitute. |
| M5 | Action Plan CC-01 decision 1: adopt "**VitalCV Workbench**" as the customer-facing name. | "Workbench" is already taken internally: `app/api/investigation/workbench/route.ts` and `components/intelligence-ops/graph-workbench-panel.tsx` (`GraphWorkbenchPanel`). | Collision is ops-facing, not clinician-facing, so the name is still usable — but CC-04 must not grep-rename blindly, and the two must never appear in one navigation. |
| M6 | Visual/UX briefs repeatedly target a "**Jobs**" surface (`/jobs`). | No `/jobs` route exists. The real surfaces are `/holder/opportunities{,/discover,/interested,/passed}`, `/holder/matcha/opportunities`, and public `/opportunities/discover`. | VIS-08 / UX-09 need a route decision before design work: rename to Jobs, or retarget the waves at `opportunities`. |
| M7 | Workbench brief assumes Career Garden is present on the working branch. | Present on `origin/main` (41 files); **absent** from the checked-out `wave/career-evidence-network-alignment`, which predates it. | All Workbench work must branch from `origin/main`. This wave did. |

---

## 5. The fixture boundary — labeled, but real

CC-04 action 3 requires isolating fixture-only code so "production routes render an honest
unavailable / empty state." Current state is **partially** compliant:

**Compliant.** `serverSource.ts` never falls back to fixtures. Notes and CV entries on
`/holder/garden` are genuine backend rows. `demoData.ts` is pinned by
`career-garden-demo-data.test.ts` against real NPIs, 10+ digit runs, realistic external
identifiers, credential numbers, fabricated readiness scores, and banned truth-contract
strings.

**Not yet compliant.** Two authenticated production surfaces render fixtures regardless of
live data:

- `app/holder/garden/research/page.tsx` → `ResearchSurface` receives **no `data` prop** and
  renders `DEMO_RESEARCH_ITEMS`, `DEMO_PUB_CANDIDATES`, `DEMO_CV_ENTRIES`.
- `app/holder/garden/opportunities/page.tsx` → `OpportunitiesSurface` renders
  `DEMO_OPPORTUNITIES`; live `data` is used only for the cover-letter composer's facts.

This is **disclosed**, not hidden: `GardenShell`'s live-mode notice reads *"Research,
connections, and postings are still samples — their waves come next."* That is a real
mitigation and materially better than the fabrication incidents in this repo's history.

The residual gap is one of **proximity, not honesty**: the disclosure sits in the page
header while fictional employers and venues render well below the fold, so a clinician who
scrolls past it sees sample content with no adjacent label. CC-04 should move the marker to
the item level (or per-section) rather than delete the surfaces.

---

## 6. Greenfield confirmed for CC-05 / WB-02

`note_revisions`, `note_links`, `NoteRevision`, and `NoteLink` do **not** exist anywhere in
`apps/` or `packages/`. The revisions/typed-links data model is genuinely new work, with no
legacy shape to migrate.

Also present and reusable: `components/vital/StateChip.tsx` (the canonical attributed state
component UX-02 builds on), and a `⌘/Ctrl+K` launcher already implemented in
`components/career-garden/GardenCursor.tsx:123` — relevant to WB-03's "do not ship two
competing launchers" constraint.

---

## 7. Program gates already satisfied (do not re-run)

| Gate | Evidence |
|---|---|
| Phase 0 freeze | Design-Only Boundary + operating rule present in `CLAUDE.md`; `docs/design/PARKED_VISUAL_ERAS.md` committed. |
| UX-00 constitution | `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` exists (26.7 KB). |
| UX-01 verdict | `design-lab/homepage-reset/DECISION.md` — **FINAL: Direction B GO WITH AMENDMENTS** (product-forward brand; dark is a register, not a mandate; no blocking hero; prototype ≠ implementation canon). |
| Wave 1078 | Merged as #1197 ("Production truth: prove the deployed SHA, smoke the NPI loop"). |

`VisualScene` does not exist — VIS-05 / CC-06 is unstarted.

---

## 8. Proposed next scope

**CC-01 / VIS-01 — Visual Narrative Constitution (design-only, docs).** Amend the existing
Experience Constitution in place (per CD-19: amend, never fork) with the Profile in Motion
grammar, the `VisualScene` contract on paper, the ten-scene inventory, and the truth review.
Blocked on founder answers to **M5** (Workbench naming) and **M6** (Jobs vs Opportunities).

**CC-04 / WB-01 — Workbench consolidation (copy + fixture isolation only).** Customer-facing
strings to "VitalCV Workbench" behind a copy flag; retain `/holder/garden` URLs, the
`career-garden` namespace, and both table names. Move the sample disclosure to item level on
the Research and Opportunities surfaces (§5). No schema change, no API change, no new note
store.

These two touch no common file and may proceed in parallel once M5/M6 are answered.
