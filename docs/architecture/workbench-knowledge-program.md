# Workbench Knowledge Program

**Status:** Program of record. No application behavior changed by this document.
**Base:** `origin/main` @ `7e6f1347a` · **Date:** 2026-08-09
**Extends:** `workbench-baseline.md` (CC-00) and `workbench-data-policy.md` (CC-05 / WB-02) —
both remain authoritative for what shipped. Not design-only: this program changes schema,
API surface, and agent policy, so it is not an Experience Overhaul wave.

---

## 1. Thesis

**The knowledge graph is the private face of the trust graph.**

Notes and links stay self-attested and private. AI is the ferry that spots what is
claimable. PSV verifies it. Signed receipts come back as first-class, linkable nodes
(`source_pointer` — already in the shipped link allowlist) in the clinician's own graph.
Trust flows one way across that membrane, and no other product can build the middle of it:
Roam, Obsidian, Notion, and LinkedIn have no verification pipeline; CVOs have no workspace.

Corollary (recorded 2026-08-09): **no chain.** The anchoring layer's credibility gap was
operator non-repudiation, and it is closed by witnessing — publishing each 5-minute Merkle
root to external append-only observers (Rekor + RFC 3161 TSA), shipped as the anchor-witness
wave. A ledger write would add nothing the witness does not, at prices the witness does not
charge. A witnessed root proves *what was recorded when*, never that the recording was true;
the truth organ remains PSV, and the copy contract stays "signed"/"witnessed", never
"blockchain-anchored".

## 2. Usage gate — measured 2026-08-09

Production `garden_notes`: **0 notes, 0 users, 0 links, 0 revisions, 0 CV entries.**

The note domain shipped complete (store, revisions, `[[ ]]` picker, typed links, backlinks,
editor, promotion) and has never been touched by a production user. The cause is measured in
§3.1: the tool is reachable through one door. Consequence: the freeze-safe waves below are
infrastructure hardening ahead of demand, and the post-UX-03 waves — capture-everywhere and
default-destination journaling — are where the product outcome actually lives. **Discovery,
not features, is the binding constraint.**

## 3. The measured gaps

1. **"Throughout" is one wing.** `WorkbenchDock` mounts in exactly one layout
   (`app/holder/layout.tsx`); 25 of 227 routes can reach it; exactly one capture affordance
   exists in the app (opportunity detail).
2. **No journaling.** No date-keyed daily note — in Roam-likes, the *default* capture
   surface.
3. **No graph over notes.** `noteNeighborhood()` (owner-scoped, 60-node cap) shipped with no
   UI; `components/career-graph/` renders a labeled illustrative fixture.
4. **No retrieval layer.** `listGardenNotes` was an unbounded full-body `findMany` — no
   search, no filter, no pagination (WB-06 closes this).

## 4. Program of record

### Now (freeze-safe: schema, policy, API only)

| Wave | Scope | Status |
|---|---|---|
| **Anchor witness** | Persist every guard-passed Merkle root; publish to Rekor + RFC 3161 TSA (env-gated, fail-open per leg, 10-attempt cap); public hash-only proof routes (`/api/ledger/anchors/:root`, `/api/ledger/events/:id/proof`). | PR #1248 |
| **Dead-code purge** | Delete `src/blockchain/` (30 files, zero importers) + its orphaned tests. | PR #1250 |
| **WB-06 retrieval** | Search, tag filter, keyset pagination on the note list; bound the workspace read path. | building |
| **WB-11 consent-gated agent read** | Per-note, revocable opt-in to agent visibility on `lib/agent/consent/`; amends `workbench-data-policy.md` in place. Required properties in §6. | queued |
| **WB-10 export** | Privacy-safe export of notes/links/revisions/CV entries (policy-owed). Account-closure walkthrough UI deferred to post-UX-03. | queued |

### After UX-03 (UI freeze lifts)

| Wave | Scope |
|---|---|
| **WB-08 capture everywhere** | Dock beyond `/holder`; capture affordances on every clinician research surface. GardenCursor keeps sole ownership of ⌘K; the dock never mounts on employer or ops surfaces. Given §2, this is the highest-stakes wave in the program. |
| **WB-09 daily notes + unlinked references** | Date-keyed daily entry as default capture destination; unlinked-references pass. Promotion invariants untouched. |
| **WB-07 connections map** | Wire `noteNeighborhood()` to the existing dep-free canvas; **signed receipts enter as `source_pointer` nodes from day one** — the graph shows both classes of truth, visibly distinct. Replaces or unmistakably separates from the illustrative fixture. |

### After WB-11

| Wave | Scope |
|---|---|
| **AI link-suggestion + unlinked references** | The graph builds itself from ordinary writing — the fix for Roam-like retention failure. Opted-in notes only. |
| **AI claim-spotting → PSV** | "This note mentions an ACLS renewal — verify it?" AI as claim-spotter, never claim-maker; output is self-attested until PSV says otherwise. |

### Cut (recorded founder decisions, 2026-08-09)

- **On-chain anchoring** — parked (ADR stands); witness closes the real gap. Reopen only on
  paying-customer demand for trustless verification.
- **Block-level atoms / transclusion** — the note stays the atom; stable heading anchors are
  the escape hatch. Block refs would force a rich-text editor dependency and trade away the
  no-HTML-parsing posture of `lib/workbench/markdown.tsx`.
- **WB-12 destination "research assistant" surface** — the assists above ship; the chat
  destination does not. Revisit only if opted-in note volume justifies it.
- **Notes near any anchor** — `assertHashOnlyAnchor` bans it; stays banned.

## 5. Invariants that carry forward

The CC-00 no-go list applies unchanged (ownership server-resolved; cross-user reads 404
never 403; `provenance` literal `'self_attested'`; `origin` server-derived; `grown` is
promotion-only and read-only; audit before 2xx with ids/types never note text; notes leave
the module only by explicit clinician action; fixtures never substitute for saved data;
promotion reversible). Adding:

10. **Opt-in is not disclosure.** Agent visibility never widens any other audience — employer
    surfaces, matching, ranking, eligibility, dossiers, and analytics stay excluded by
    construction.
11. **The graph is not evidence.** No link, backlink, or AI assist output may appear in any
    employer-facing decision surface or elevate provenance.
12. **Witness ≠ truth.** A witnessed root proves record integrity, not record accuracy. No
    copy may imply the witness verifies content.

## 6. WB-11 required properties

Default excluded; opt-in explicit, per-note, revocable; every agent read audit-logged before
use (ids and types, never note text); revocation effective on next read with no residual
copy; a test proves a non-opted note is unreachable from every agent path.

## 7. Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Tag-level agent opt-in in WB-11 v1, or note-level only? | WB-11 | Founder |
| Q2 | WB-07: replace the illustrative fixture or keep both surfaces? | WB-07 | Design |
