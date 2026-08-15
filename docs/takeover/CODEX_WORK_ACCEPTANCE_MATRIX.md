# Codex work acceptance matrix — 2026-08-15

Per takeover directive §4: *"Do not treat these as sacred. Do treat them as
evidence-bearing current product work that must be measured before replacement."*

Measured against `origin/main` @ `a8db9734c` and live production, which serve the
same SHA.

---

## Headline

**Codex closed every P0 the 2026-08-11 audit named.** I re-probed each one
independently rather than accepting the ledger's word.

The correct posture toward this cycle is **preserve and extend**, not replace.
The gaps that remain are not defects in what Codex built — they are capabilities
nobody has built yet, plus a small number of bounded mistakes listed at the
bottom.

---

## PRESERVE UNCHANGED

Work that is correct, load-bearing, and should not be touched by a subsequent
wave without a specific reason.

### Truth and security closures

| Change | Why it stays |
|---|---|
| **#1372** `/trust` correction-claim removal | Removed a live false claim about a user capability, on the one page whose entire value is that its claims are true. Held down by `trust-center.test.tsx:77` asserting `not.toContain('flag it and attach supporting evidence')`. **Verified: absent from live `/trust`.** |
| **#1353** retire `POST /api/pilot/acceptance` | Was unauthenticated (`walletRateLimit` only) and fed a global, org-unfiltered count displayed as an acceptance metric. **Verified: `app.ts:2736` is a tombstone; `verifierAcceptance.count()` gone from `loadYcMetrics`.** |
| **#1356** close `POST /api/hiring/accept` | Recorded acceptance with no packet linkage, no entity, no application. **Verified: tombstoned at `routes/hiring.ts:121` with its reasoning preserved in place.** |
| **#1369 / #1370** ADR 0006 public disclosure boundary + deployed probe | Broadened the boundary across the evidence chain *and* added a probe against the deployed API. Enforcement plus external verification is the right pair. |
| **#1364** self-serve employer org binding | Unblocks employer onboarding entirely. |
| **#1362** delete `verifyProduction.ts` | Asserted 11 statuses the API never returns — a verifier that could only produce false results. Deleting it was correct. |
| **#1350** withhold reproduction detail from public security docs | Correct while the repo was public; still correct now that it is private. |
| **#1354** workflow-contract gate asserts the closure, not the paths key | Fixes a gate that watched the wrong thing. |
| **#1361** Sentry region-scoped ingest host in CSP | Real browser-error visibility restored. |

**The tombstone pattern is worth institutionalizing.** #1353, #1356 and #1352 all
close a route by leaving a comment at the exact registration site explaining what
was there and why it went. That is why I could reconstruct the acceptance-emitter
history in minutes instead of hours. Keep doing it.

### Opportunity truth discipline

**#1374, #1375, #1376, #1379** — the `/explore` and `/opportunities/[id]` stack.

I sampled all 498 live opportunities through the public API and found **zero
fabricated facts**. Every uncertain value is labelled rather than guessed:
`compensationProvenance.state: "not_supplied"`, `startUrgency: "unknown"`,
`schedule: "not_stated"`, `freshness.isUncertain: true`, and an explicit
`availability.limitation` string on every open role — *"The source was observed
recently; the employer can still change or close the role."* Real Greenhouse URLs,
real `observedAt` timestamps.

This directly satisfies directive C7.2 ("eliminate synthetic truth") and it is
the strongest evidence in this audit that Codex internalized the truth contract
rather than working around it. **Preserve the discipline, not just the code.**

Equally: external listings say "View original listing" and only integrated ones
may say "Apply with VitalCV." Codex held that boundary even though holding it is
what makes the product look emptier — which is the correct trade.

### Distribution

**#1358** public `/directory/[npi]` made findable, claimable, measurable and
refusable, with sitemap support behind a founder-controlled runtime flag and
funnel instrumentation on record view / claim click / NPI binding.

Preserve. The consent-aware design — refusable, flag-gated — is exactly the shape
the growth phase (G0) requires, and it was built before anyone asked.

### The handoff ledger itself

`docs/ops/CODEX_HANDOFF_LEDGER.md` is the best handoff artifact this repository
has produced. Each entry carries a claim-check against open PRs and remote
branches, a named creative owner, an explicit truth/authority boundary, an
evidence directory path, and real test counts rather than "tests pass."

Preserve the format. Fix only the status-staleness mechanism (below).

---

## IMPROVE

Correct work with a specific, bounded defect.

| Item | Defect | Fix |
|---|---|---|
| **Ledger status headings** | Nine work orders read `— OPEN` whose PRs are merged and deployed. The "Next gate" is written pre-merge and nothing rewrites the heading post-merge. | Make status a derived line appended at merge (`Landed in #NNNN @ <sha>`), not a heading edited later. Apply inside the next related implementation PR — not a standalone docs-churn PR. |
| **`/directory/[npi]` latency** | **8.31s** vs 0.12–0.23s for every other public surface. This is the acquisition wedge. | Diagnose (likely a synchronous NPPES read on the request path); cache or move off the critical path. Independently provable, no strategy dependency. Good Wave C1 candidate. |
| **`explanation.whyThisMayFit`** | Identical boilerplate on all 498 roles: *"This employer profile includes source-backed requirement and freshness data."* Not false; explains nothing. | Real per-role explanation needs `credentialRequirements`, which feed listings do not carry. Blocked on integrated roles — but do not let the placeholder harden into the MATCHA 1.0 baseline. |
| **#1386 stray `sitemap.ts` hunk** | A docs-only PR edits `apps/web/app/sitemap.ts` (+1). The identical edit already landed via #1383, which is why #1386 is `DIRTY`. | Drop the hunk, rebase. |
| **#1382 / #1378 migration timestamp** | Both ship `20260814180000_*`. Deterministic under Prisma's lexicographic ordering, but it destroys human-readable migration order. | Renumber one before either lands. |
| **Employer supply concentration** | 8 employers; onemedical is 130 of the first 200. | Ingestion breadth, not a code defect. |

---

## SUPERSEDE OR REVERT

**Nothing.**

I looked for work to revert and did not find any. No merged change in this cycle
introduced a truth defect, weakened an authorization boundary, or regressed a
closed finding. The one recorded correction inside the cycle — the founder's
2026-08-14 call to unmount the documentary poster — Codex handled by *removing*
the asset (#1387 replaced the hero; #1388 removes the remaining `/explore` image)
rather than defending it.

Two items need **verification** rather than reversal:

1. **WO-4 disclosure-boundary remediation** is recorded in the ledger as
   *"IMPLEMENTED LOCALLY, UNPUSHED."* Unpushed work reads as landed in a ledger
   and does not exist in a repository. Confirm whether it was subsumed by #1369
   or is genuinely lost.
2. **`propagateDriftResponse`** (`services/validation/driftPropagation.ts`)
   queries `action` and `npi` on `EmployerAcceptance`; the columns are `status`
   and `clinicianNpi`. It compiles only under `@ts-nocheck` and has zero callers,
   so the OIG-drift revocation cascade is unreachable code that throws the moment
   anyone wires it. **Not re-verified this wave** — flagged as
   `UNKNOWN_REQUIRES_TEST`.

And one piece of **dead weight**, not a defect: the `VerifierAcceptance` model
survives at `schema.prisma:889` with its route retired and no remaining writer.
Drop it in a schema-hygiene pass, not urgently.

---

## The judgement the directive asked for

> *"whether recent visual work is clearer or merely more elaborate."*

**Clearer, with one reservation.**

The evidence for clearer: the homepage now leads with the real record instead of
an abstraction; `/explore` exposes current roles *before* sign-up; role facts
carry visible provenance; the employer page is organized around what an employer
actually receives. Each merged surface ships production-build captures at
390/768/1440/1728 with computed contrast, overflow, and controlled LCP/CLS/INP —
measurement, not assertion. Shipped motion payload is zero on the audited
surfaces, and no canvas, WebGL, or new animation engine was introduced. Craft
discipline held.

The reservation is the one the directive predicted in C3.2: the public site now
tells the record-to-reuse story in several places — hero journey, five-chapter
sequence, ownership, attribution, roles, employer section. At 80KB for `/`,
127KB for `/employers` and 175KB for `/explore`, there is a real risk the same
idea is explained more than once in different registers. That is a consolidation
question (Wave C3), not a defect, and it should be answered by cutting rather
than adding.

The larger point stands: this cycle moved VitalCV from *a product that
overclaimed on its trust page* to *a product that is scrupulously honest and has
one missing transaction*. That is the more valuable direction, and it is why the
correct posture toward Codex's work is to build on it.
