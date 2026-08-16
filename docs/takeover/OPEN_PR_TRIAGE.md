# Open PR triage — 2026-08-15

All 8 open PRs, classified per the takeover directive §2.3. Read against
`origin/main` @ `a8db9734c`. All are drafts authored in the Codex cycle.

**Every merge-state value below was read live.** `CLEAN` here means GitHub can
merge it — it does **not** mean gated, because `main` currently has no required
checks (see the return report).

| PR | Title | Base | State | Size | Classification |
|---|---|---|---|---|---|
| #1388 | remove rejected documentary image | main | CLEAN | +120/−121, 15f | `UNIQUE` → **BLOCKED_ON_FOUNDER** |
| #1386 | PTC Wave 00 architecture | main | DIRTY | +1912/−1, 8f | `UNIQUE` → **TAKE OVER, LAND AS DOCS** |
| #1384 | atomic confirmed starts | #1381 | CLEAN | +1130/−529, 23f | `BLOCKED_ON_ARCHITECTURE` |
| #1382 | credential operations core | main | DIRTY | +1925/−1, 14f | `BLOCKED_ON_ARCHITECTURE` |
| #1381 | vendor-neutral integration contract | #1380 | UNSTABLE | +1413/−19, 22f | **DEFER** |
| #1380 | authorized joined case | #1378 | UNSTABLE | +1286/−37, 20f | `UNIQUE`, blocked on parent |
| #1378 | bind acceptance to sealed packets | main | CLEAN | +916/−50, 9f | `UNIQUE` → **strongest salvage candidate** |
| #1377 | hire-to-start category strategy | main | DIRTY | +453/−145, 31f | **BLOCKED_ON_FOUNDER** |

~8,300 added lines of undelivered draft work. Nothing here is landed. Nothing
here is worthless.

---

## The stack shape matters

```
main ──┬── #1377  (strategy, 31 files, DIRTY)
       ├── #1378  (acceptance → sealed packet)   CLEAN
       │     └── #1380  (joined case)            UNSTABLE
       │           └── #1381  (integrations)     UNSTABLE
       │                 └── #1384  (atomic start)  CLEAN
       ├── #1382  (credential ops)  DIRTY
       ├── #1386  (PTC docs)        DIRTY
       └── #1388  (visual removal)  CLEAN
```

#1378 → #1380 → #1381 → #1384 is a **four-deep stacked chain**, each PR based on
its predecessor's branch. Squash-merging any parent rewrites history and orphans
every child; this repository has already been bitten by that trap. If any of this
lands, children must be **rebased**, never merged-into, and the result must be
diffed against **both** parents afterward.

---

## PR #1388 — remove rejected documentary image

`fix(explore): remove rejected documentary image` · `CLEAN` · +120/−121 across 15 files

Removes an atmospheric image the founder rejected. No product, schema, API, or
authorization change. Visual evidence attached by Codex.

**Verdict: `UNIQUE`, ready, awaiting only a founder visual decision.**

This is the cheapest item on the board and the only one that can move today.
Per directive C2.1 the decision is `MERGE` / `REWORK` / `CLOSE`, and per the
founder visual gate it needs an explicit `FOUNDER VISUAL DECISION`. Do not invent
a replacement image inside this PR.

**Recommendation: MERGE**, if the 2026-08-14 rejection still stands. It is a
removal, its blast radius is one public surface, and leaving a founder-rejected
asset live is the worse state.

---

## PR #1386 — PTC Wave 00 architecture

`chore(trust-computing): map PTC Wave 00 architecture` · `DIRTY` · +1912/−1 across 8 files

Documentation-only Professional Trust Computing archaeology:
`docs/trust-computing/PTC_ARCHITECTURE_MAP.md`, `PTC_DEMO1_EXECUTION_PLAN.md`,
`PTC_LEGACY_EQUIVALENCE_MAP.md`, `PTC_RESEARCH_REGISTER.md`,
`plans/TRUST_COMPILER_EXECUTION_PLAN.md`, plus a 618-line
`docs/architecture/CURRENT_SYSTEM_MAP.md`.

**I read it rather than judging it by its title, and it is better than the
directive's default stance assumes.** It does not read as elegant architecture
looking for a problem. Specifically, it:

- **Names its own collision with #1382 and rates it Critical:** *"Versioned,
  reviewed workflow persistence directly overlaps policy authoring. If it lands,
  write a reviewed adapter from an active template version; do not add a
  parallel TrustSpec table in Demo 1."*
- **Forbids scope creep explicitly:** *"Do not create a new package, graph,
  packet type, acceptance table, readiness engine, or agent runtime."*
- **Marks LLM policy ingestion `DO_NOT_BUILD`** for Demo 1 — human-reviewed
  typed fixtures only.
- **Is honest about existing engines** rather than flattering them:
  `orgPolicyEngine.ts` rated High risk, *"Stub/default policy with auto-approval
  concepts. Do not use as TrustSpec storage or activation."* Backend
  `trust-state` readiness: *"its default matrices and substring parsing cannot
  define TrustSpec semantics."*
- **Holds the truth line:** *"`SATISFIED` … never means credentialed,
  privileged, approved, employed, or accepted by an employer."*
- Correctly records that **no open or merged PR implements TrustSpec, TrustIR,
  or the Trust Compiler**, which I independently confirmed.

**Why it is DIRTY:** one stray line. It edits `apps/web/app/sitemap.ts` to change
`/employers` `lastModified` from `2026-08-09` to `2026-08-14` — a sitemap
freshness-guard artifact. **That exact change already landed on `main`** via
#1383, so the hunk is now a conflict against an identical edit.

**Verdict: `UNIQUE` → TAKE OVER AND LAND AS DOCS.** Drop the `sitemap.ts` hunk,
rebase onto `a8db9734c`, and it becomes a clean docs-only PR. Landing it costs
nothing (no code, no schema, no runtime) and buys a written architecture contract
that the #1382 decision can be made *against* rather than in a vacuum.

Landing the map is **not** authorization to build TrustSpec. Phase V still gates
on P0's nine decisions.

---

## PR #1382 — credential operations core

`Credential operations core for CVO, licensing, enrollment, and privileging` · `DIRTY` · +1925/−1 across 14 files

Adds a full persisted credentialing workflow model:

```
model CredentialOpsWorkflowTemplate      enum CredentialOpsCaseType
model CredentialOpsTemplateRequirement   enum CredentialOpsTargetKind
model CredentialOperationsCase           enum CredentialOpsTemplateStatus
model CredentialOpsCaseTask              enum CredentialOpsCaseState
                                         enum CredentialOpsTaskCategory
                                         enum CredentialOpsTaskOwner
                                         enum CredentialOpsTaskNecessity
                                         enum CredentialOpsTaskState
                                         enum CredentialOpsDataHandling
```

Plus `credentialOpsService.ts` (580 lines), an authorization module, a restricted-data
module, a route, a 187-line migration, and four test files.

**This is the highest-collision item on the board.** `CredentialOpsWorkflowTemplate`
+ `CredentialOpsTemplateRequirement` is a versioned, reviewed, persisted model of
institutional requirements — which is precisely what TrustSpec claims to own.
Land both without a decision and VitalCV has **two policy models**, which is the
"another readiness score / another provider model" failure the directive's
anti-scope rules exist to prevent.

Two further mechanical problems:

1. **Migration timestamp collision.** `20260814180000_credential_ops_core` shares
   its timestamp with #1378's `20260814180000_hire_to_start_activation_states`.
   Prisma orders lexicographically, so application order is deterministic — but a
   shared timestamp destroys human-readable migration ordering and both PRs edit
   `schema.prisma`, guaranteeing a textual conflict.
2. It also touches `app.ts` and `auditEventTypes.ts`, both of which #1381 edits.

**Verdict: `BLOCKED_ON_ARCHITECTURE` — do not land.**

Per directive C2.4 the options are `LAND` / `SALVAGE_SUBSET` / `DEFER` / `CLOSE`.
**Recommendation: `SALVAGE_SUBSET`, deferred.** Against the anti-scope rule
("do not build a full CVO suite until one real clinician + employer completes the
loop"), a credentialing suite is premature by a wide margin — VitalCV has zero
integrated roles. But the *task execution primitives* and *tenant-safe operational
case semantics* are reusable for the hire-to-start requirement ledger (C11.2),
and `restrictedData.ts` is worth reading before anyone rebuilds that boundary.

Hold the branch. Do not close it — closing loses the subset. Revisit after the
policy-ownership decision.

---

## PR #1377 — hire-to-start category strategy

`feat(strategy): establish clinician hire-to-start category` · `DIRTY` · +453/−145 across 31 files

Reframes the employer/category story: employed physicians + APPs, actual first
day as the outcome, ATS/credentialing systems retain authority.

**Verdict: `BLOCKED_ON_FOUNDER`.** 31 files of doctrine touching customer-facing
terminology is squarely inside the Strategy Contract, whose canonical documents
were founder-approved on 2026-08-04. No agent should land it.

**Recommendation matches the directive's own default, and the evidence supports
it:** keep "portable professional identity and employment network" as the company
direction; adopt hire-to-start as the **employer-facing value proposition and GTM
wedge**, not the master category.

The reason is commercial, not aesthetic. Two memory-recorded market facts bear
directly: CAQH already occupies free universal clinician-maintained reuse, and
Medallion's CredAlliance occupies verify-once-syndicate-many on the payer side.
Both failed or are fighting on the **demand** side — employer acceptance is the
scarce good. "Hire-to-start" describes exactly that scarce good, which makes it a
strong employer pitch. Shrinking the whole company to a workflow label would
simultaneously narrow the clinician-owned thesis that is the actual differentiator
and walk toward the credentialing-infrastructure lane the 2026-08 market read
says not to enter.

One more fact belongs in the founder's hands for this decision: **the homepage
already ships a category claim.** The live eyebrow is the EC-20-locked
"The Provider Career Evidence Network." (`VITALCV_EXPERIENCE_CONSTITUTION.md:251`)
— a framing earlier strategy work retired, now standing as a third claimant
beside the canonical "portable professional identity and employment network" and
#1377's "Clinician Hire-to-Start Platform." Deciding #1377 without also ruling on
the locked eyebrow leaves two different categories live on the two most public
surfaces. See the return report's vocabulary-law section.

---

## The hire-to-start stack: #1378 → #1380 → #1381 → #1384

Reviewed in dependency order per directive C2.2.

### #1378 — bind acceptance to sealed packets · `CLEAN` · +916/−50, 9 files

Binds employer acceptance to the exact packet reviewed, in `employerWorkflowService.ts`
(+379) with a 336-line database-backed acceptance test and a tenancy test.

**Verdict: `UNIQUE`, and the strongest salvage candidate in the stack.**

It answers a real, recorded defect: acceptance previously had no packet linkage,
which is why `/api/hiring/accept` was closed. Binding acceptance to a sealed
packet hash is the correct shape, it is application-scoped (the recommended
spine), it is `CLEAN`, and it is the smallest PR in the stack. Audit it properly,
then land it **first and alone**, rebased onto current `main`.

### #1380 — authorized joined case · `UNSTABLE` · +1286/−37, 20 files

Employer and clinician read the same authorized case: `hireToStartReadService.ts`
(+355), `HireToStartCasePanel.tsx` (+177), `EmployerDecisionControls.tsx` (+111),
a web route, and a 242-line service test.

**Verdict: `UNIQUE`, blocked on its parent.** Likely the product spine the
directive expects. Two things must be verified before it lands: that it creates
no second application/readiness source of truth, and that its authorization
genuinely derives org scope server-side rather than accepting it. `UNSTABLE`
means checks are failing or pending on the head — diagnose before judging the
design.

### #1381 — vendor-neutral integration contract · `UNSTABLE` · +1413/−19, 22 files

External refs, inbox receipts, signed org-scoped inbound events, operational
requirement sync, an outbox, a role-import service, plus a schema change and
migration.

**Verdict: `DEFER`.** The directive is explicit that integrations must not
precede the canonical local loop, and the evidence agrees emphatically: with
**zero integrated roles in production**, there is no local loop for an
integration to sync *with*. Building the vendor boundary now optimizes a
transaction that has never occurred once.

Hold the branch. Revisit at C12, after C9–C11 are stable and a real integration
partner exists.

### #1384 — atomic confirmed starts · `CLEAN` · +1130/−529, 23 files

Canonical start command (`applicationStartCommandService.ts`, +357), start-ready
and start web routes, `HireToStartEmployerControls.tsx` (+165), employer/activation
route changes, and a migration.

**Verdict: `BLOCKED_ON_ARCHITECTURE`, and it carries the sharpest single risk in
this triage.**

The file list shows `apps/api/backend/src/services/hiring/startWriter.ts` at
**0 additions**, inside a PR with 529 deletions. **#1384 deletes the one start
writer.**

That writer landed in #1352 — *"one start writer, so a start cannot exist without
its audit row"* — as the fix for a specific recorded defect. #1384 substitutes a
different canonical writer, which may well be the better design: a start command
bound to an application is more coherent than one bound to hiring, and the
directive's C11.5 asks for exactly `StartActivation + StartAttestation + audit +
outbox` atomicity.

But this is a **canonical-writer replacement of an invariant this repository has
already had to fix once.** It cannot be judged from a file list. Before it lands,
someone must prove — by injecting the defect, not by reading the code — that the
new path cannot produce a start without its audit row, and that the old writer
has no remaining callers.

Strategically this is the most important PR in the stack, because a confirmed
first day is the economic outcome. It is also the last one that should move.

---

## Collision map — no two branches may own the same fact

| Business fact | Contested by | Resolution |
|---|---|---|
| Versioned institutional requirements | #1382 (`CredentialOpsTemplateRequirement`) vs #1386 (TrustSpec) | **Founder/architect decision.** #1386's own prescription — one owner, adapter from the other — is sound. |
| The start writer | `main` (`startWriter.ts`, #1352) vs #1384 (`applicationStartCommandService.ts`) | Prove the new writer's atomicity by injection, then delete the old one in the same PR. |
| Acceptance record | `workflow-action` (application id) vs `employer-review/accept` (entity id) vs #1378 (packet-bound) | #1378 is the best answer; land it, then retire one of the two live writers. |
| `schema.prisma` + `app.ts` + `auditEventTypes.ts` | #1381 and #1382 both edit all three | Sequencing, not design — whichever lands second rebases. |
| Migration slot `20260814180000` | #1378 and #1382 | Renumber one before either lands. |

---

## Recommended order

1. **#1388** — founder visual decision, then merge. Clears the board.
2. **#1386** — drop the sitemap hunk, rebase, land as docs. Gives the next decision a written contract.
3. **Decide policy ownership** (#1382 vs #1386's TrustSpec). Nothing in credential-ops or PTC moves until this is settled.
4. **#1377** — founder category ruling.
5. **#1378** — audit, rebase onto `main`, land alone.
6. **#1380** — diagnose `UNSTABLE`, verify the single-source-of-truth and authorization claims, rebase onto post-#1378 `main`.
7. **#1384** — only after the start-writer atomicity is proven by injection.
8. **#1381** — defer to C12.
9. **#1382** — salvage subset later; hold the branch, do not close it.

**Nothing in this list should merge while `main` is unprotected.** Restore the
gate first.
