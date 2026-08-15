# Wave C1 — Restore the Gate + Remove Product Theater

**Status: EXECUTION PLAN ONLY — nothing here is implemented.** Authored 2026-08-15 against
`origin/main` @ `a8db9734c` (production serves the same SHA). Every file:line below was read
this session; every live measurement is dated. Founder rulings of 2026-08-15 are binding
throughout: hire-to-start is the employer wedge, not the company category; "Provider Career
Evidence Network" is retired as a public category; "Your VitalCV profile" is the primary
clinician object with "Build my free profile" preferred for acquisition; CV Wallet may remain a
secondary concept but is never required to enter the product; PTC stays out of acquisition copy;
#1382 and #1381 are deferred; #1378's intent is preserved as the highest-priority draft; #1384
may proceed only by *proving* the one-authoritative-start-command invariant.

Companion evidence: `docs/takeover/` (Wave C0, PR #1389).

---

## Bundle C1.0 — Preconditions (founder console, not code)

Blocking every merge in this wave, verified live 2026-08-15 22:25Z:

1. **GitHub Actions billing.** Every check run since ~20:45Z fails in 1–3s with zero steps;
   the check-run annotation names failed payments / spending limit verbatim. A re-run probe at
   22:23Z failed identically. Until fixed, **no CI executes at all**.
2. **Branch protection / rulesets on `main`.** Still absent (protection endpoint 404s,
   `rulesets` = `[]`, `branches/main.protected` = `false`). Restore with the 14-check list in
   `scripts/check-workflow-path-filters.js:106-133` (the authoritative `REQUIRED_CHECKS`
   array; `docs/ops/release-required-checks.md` lists only 6 and is stale — bundle C1.1 fixes
   the doc).

Nothing in C1.1–C1.6 merges until both hold and PR #1389 has landed through executed, passing
checks.

---

## Bundle C1.1 — Harden the protection verifier so absent protection cannot pass silently

**Current files/functions.**
- `scripts/check-workflow-path-filters.js` — `verifyAgainstProtection()` at `:685-727`
  (gh call `:690-693`, catch `:695-700`, exit `:701`); `REQUIRED_CHECKS` `:106-133`;
  `main()` `:917-946` (flag parsed last, `:945`); self-test harness `SELF_TEST_CASES`
  `:735-893` + `selfTest()` `:895-912`.
- `.github/workflows/workflow-contract-gate.yml:77-79` — runs `--self-test` and `--report`
  only. `package.json:36` — the manual `--verify-protection` script.
- `docs/ops/release-required-checks.md` (stale 6-check list) and
  `docs/ops/github-security-controls-2026-08-02.md:24-40` (the 14).

**Observed defect (corrected from the C0 first pass).** The script *does* exit 1 on an
unreadable protection read — the silence is threefold: (a) the catch misattributes a 404 to
token scope (`:695-700`) without parsing the HTTP status that is present in the stderr text
(`gh: Branch not protected (HTTP 404)` vs 403 phrasing); (b) the contract-lint success line
prints before the failure (`:938-942`); (c) `--verify-protection` is wired into **no
workflow**, so no CI job ever observes the exit code. The opt-out rationale (default
`GITHUB_TOKEN` cannot read protection) is now false for the *existence* question:
`repos/:owner/:repo/branches/main` exposes `.protected` and `rules/branches/main` returns
rules, both readable with the default token (probed live: `protected: false`, `[]`).

**Proposed implementation.**
1. Extract the `gh` invocation behind an injectable runner (`verifyAgainstProtection({run})`),
   matching the file's no-framework style.
2. In the catch, parse `/\(HTTP (\d{3})\)/` from stderr: 404 → distinct hard failure
   ("no protection object exists — this is the absent-protection state, not a scope problem");
   403 → keep the scope wording. On 404, issue one confirming default-token read of
   `branches/main` `.protected` + `rules/branches/main` so "unreadable" is disproven in the
   same output.
3. Add an always-on **existence assertion** to the CI-run path (the `--report`/default mode):
   `.protected == true` OR non-empty `rules/branches/main`, else fail. The full context-list
   comparison stays behind `--verify-protection` (admin token).
4. Success path asserts **containment** (`REQUIRED_CHECKS ⊆ live`), a distinct failure from
   set-inequality, so a shrunk protection list fails even with no unknown check present.
5. Print protection-verification failures *before* any success line; replace the hardcoded
   `ctol3r/vitalcv` (`:691`) with `:owner/:repo`.
6. Refresh `docs/ops/release-required-checks.md` to the 14-check list and note the
   existence assertion.

**Collision check.** No open PR touches `scripts/check-workflow-path-filters.js`,
`workflow-contract-gate.yml`, or the two ops docs. Clean.

**Tests (fail before → pass after).** New self-test fixtures via the injectable runner, wired
into the existing `--self-test` step (`workflow-contract-gate.yml:77`, no token needed):
(1) runner throws `stderr: 'gh: Branch not protected (HTTP 404)'` → must classify as
absent-protection failure — **fails today** (classified as scope); (2) `(HTTP 403)` → scope
message — passes today, pins the distinction; (3) returns all 14 contexts → pass;
(4) returns 13 of 14 → containment failure — **fails today** (no containment check).
The existence assertion is proven by injection: point the runner at a stub returning
`protected: false` and assert the gate goes red.

**Migration impact.** None. **Rollback.** Revert the commit; the script is self-contained.

---

## Bundle C1.2 — `/directory/[npi]` latency: finish the diagnosis before choosing a fix

**Current files/functions.** `apps/web/app/directory/[npi]/page.tsx` (`revalidate = 3600`;
two sequential upstream calls at `:115` NPPES and `:121` CMS), `lib/directory/nppes.ts:24` and
`cmsClinicians.ts:38` (both `TIMEOUT_MS = 8_000`),
`lib/reference/nucc-taxonomy.generated.ts` (492KB), per-record `generateMetadata`
(`page.tsx:88-105`).

**Observed defect (measured 2026-08-15, five seed NPIs).** Cold render 8.22–8.30s; immediate
re-hit on another replica 4.5–8.1s; ISR-warm 0.15–0.53s; every other public surface
0.12–0.23s. **Disproven causes:** the upstreams (NPPES 0.20s; the exact filtered CMS query
0.26–0.47s measured directly) and the 8s timeout (the CMS block renders real data — a
timed-out fetch fails closed and would render nothing). A crawler sweeping the 4,955-NPI
sitemap seed pays cold on essentially every request; this is the acquisition wedge.

**Proposed implementation — diagnosis first, fix second (explicitly two mergeable steps).**
- *Step 1 (mergeable): instrumentation.* Add `Server-Timing` spans around the two upstream
  fetches, the record-assembly transform, and `generateMetadata` in the directory page only;
  plus one structured log line (route, npi hashed, per-span ms) behind an env flag. Then
  reproduce on a local **production** build (`pnpm turbo run build --filter @vitalcv/web`,
  `next start` — memory: `next start` serves the boot build, e2e local serves dev) and read
  Railway logs for the same spans. Candidate hypotheses to kill or confirm, in order: render
  cost of the record component tree; per-request cost touching the 492KB generated taxonomy
  module; metadata/OG generation; upstream retry behavior under production env.
- *Step 2 (mergeable, evidence-gated):* choose the fix the waterfall names — e.g. hoist/
  memoize the taxonomy lookup, parallelize the two upstream calls (`page.tsx:115,:121` are
  sequential — worth ~0.5s but cannot explain 8s alone), or cache the assembled record.
  **No fix is authorized by this plan until the waterfall shows its target ≥70% of the cold
  render.**

**Collision check.** No open PR touches the directory page or its libs. Clean.

**Tests (fail before → pass after).** Step 1: a unit test asserting the Server-Timing header
is present on the directory route in dev/prod builds (fails before — header absent). Step 2:
a timed assertion in the existing e2e lane is flake-prone; instead the acceptance evidence is
the measured before/after waterfall on the local prod build plus a live re-measurement of the
five seed NPIs (target: cold < 2s), recorded in the PR body per the C0 measurement format.

**Migration impact.** None. **Rollback.** Instrumentation and fix are separate commits;
revert independently.

---

## Bundle C1.3 — Delete the orphaned decision-console pair (and adjacent dead writes)

**Current files/functions.**
- `apps/web/app/review/[entityId]/ConsoleWrapper.tsx` (212 lines) — **imported by nothing**
  (`page.tsx:22` renders `ReviewPageClient`); POSTs to nonexistent `/api/employer-action` and
  `/api/isv-events`, reads nonexistent `/api/manifest`, hardcodes
  `employerId: 'pilot-employer-1'`.
- `apps/web/components/review/EmployerDecisionConsole.tsx` — only importer is the orphan.
- `apps/api/backend/src/routes/employer-action.ts` (148 lines) — exported router, never
  mounted (`src/app.ts:51` imports `./routes/employerActions`, a different file; the hyphen is
  the trap). **No auth**, trusts body-supplied `employerId` (`:33`), writes
  `employerAcceptance.create` with a random UUID as `entityId` (`:71`) and an `AuditEvent`
  with a fabricated `hash: randomUUID()` (`:81-94`).
- `apps/api/backend/src/services/validation/driftPropagation.ts:49-58` — dead
  `employerAcceptance.updateMany` against field names (`npi`, `action`) that do not exist on
  the model; compiles only under `@ts-nocheck`; zero callers.
- `docs/product/evidence-network/canonical-transaction-baseline.md:102` — stale line calling
  `Start` a writerless dead model (the wedge lane writes it: `routes/wedge.ts:444` behind
  `apiKeyAuth`, mounted at `src/app.ts:3608`).

**Observed defect.** Not a live user-facing failure (the live `/review/[entityId]` surface
acts through the real authenticated `/api/employer-review/[entityId]/[action]` proxy with
failure classification, `ReviewClient.tsx:802`) — but a standing re-wiring hazard: one
accidental `import { employerActionRouter }` opens an **unauthenticated acceptance write with
forged audit hashes**. Both halves shipped unmounted the same morning (#140 at 03:51, #148 at
08:30, 2026-04-17) and no commit ever wired them.

**Proposed implementation.** Delete `ConsoleWrapper.tsx`, `EmployerDecisionConsole.tsx`, and
`routes/employer-action.ts` outright (no tombstone routes — they were never mounted; a short
note goes in the PR body, and `canonical-transaction-baseline.md:102` is corrected in the same
PR to name the wedge lane as the actual `Acceptance`/`Start` writer). The wedge lane itself is
**not** touched in this bundle: its disposition (retire vs document as the machine lane) is a
product decision that belongs with the acceptance-convergence ADR (C1.5), and it is
API-key-gated today.

**Collision check.** #1380 touches `apps/web/components/employer/*` and
`apps/web/app/employer/applications/*` — **not** `apps/web/app/review/[entityId]` or
`components/review/EmployerDecisionConsole.tsx`. No open PR touches the three deleted files or
`driftPropagation.ts`. Clean.

**Tests (fail before → pass after).** Proof is structural: `git grep` zero importers before
deletion (recorded in the PR body); typecheck + full web/backend suites green after.
Additionally add one guard to the existing route-inventory/qa surface asserting
`/api/employer-action` resolves to no handler in web (`qa/routeInventory.ts` pattern), so a
future re-introduction is a deliberate act. `driftPropagation` deletion also removes a
`@ts-nocheck` file — typecheck coverage strictly widens.

**Migration impact.** None (code only; no schema change — the `VerifierAcceptance` and wedge
models are explicitly out of scope here). **Rollback.** Revert; files return unmounted, as
they were.

---

## Bundle C1.4 — Vocabulary reconciliation (EC-9 / EC-20 / strategy) under the founder rulings

**Current files/functions.**
- Constitution: `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` — EC-20 locked rows for `/`:
  eyebrow "The Provider Career Evidence Network." (`:251`), H1 (`:252`), lede (`:253`),
  primary action "Start my CV Wallet." (`:254`); EC-9 never-customer-facing list (`:97`,
  includes `wallet` and `evidence networks`) and the "must not feel like" list (`:39`);
  EC-22 amendment rule; `/pilot` + `/onboarding` CV Wallet locks (`:386,:395-396,:420`).
- Strategy: `docs/strategy/vitalcv-strategy-operating-brief.md:13,:36,:51` — records the H1 as
  "Enter your NPI. VitalCV does the rest." (displaced from production) and keeps the promise
  line "Your clinician profile. Ready for every move."
- Live copy: `apps/web/components/home/easy/EasyHome.tsx:131` (CTA), `:290` (eyebrow), `:291`
  (H1); JSON-LD org description `apps/web/app/page.tsx:36`; `apps/web/app/demo/page.tsx:6,:57`;
  dormant variant `components/home/w1501/` (unmounted — leave, note only).
- Pinning tests: `apps/web/__tests__/home-easy-cutover.test.tsx:65,:67`;
  `apps/web/tests/e2e/home-easy.spec.ts:102,:108`;
  `apps/web/__tests__/homepage-truth-pass.test.tsx:4` (comment only).

**Observed defect.** The constitution mandates and bans the same nouns at Class-A level
(C0 report, "The vocabulary law now contradicts itself"), and the founder has now ruled:
CEN retired as public category; "Build my free profile" preferred over "Start my CV Wallet";
CV Wallet allowed as secondary only.

**Proposed implementation (one PR, doctrine and copy together so no state is
self-contradictory in between).**
1. **EC-20 amendment (dated, founder-attributed per EC-22, citing the 2026-08-15 rulings):**
   row `:251` public promise → **"Your VitalCV profile. Ready for every move."** (the
   operating brief's retained promise line — proposed, needs the founder's GO on exact copy);
   row `:254` primary action → **"Build my free profile."** H1 and lede rows unchanged (not
   ruled on; "One career record. More ways forward." stays).
2. **EC-9 clarifying note (same amendment):** wallet/evidence-networks stay in the
   never-customer-facing list for **acquisition-critical copy** (homepage hero, primary CTAs,
   onboarding headings); "CV Wallet" is recorded as a permitted *secondary* product noun on
   already-locked interior surfaces (`/pilot`, `/onboarding` EC-20 rows stand) — never
   required to understand or enter the product.
3. **Strategy brief amendment:** record the current locked H1 lineage (Wave 1078 H1 →
   Titan H1, with the 2026-08-15 ruling note), restoring doc/production agreement.
4. **Copy changes:** `EasyHome.tsx:131,:290` (CTA + eyebrow), `page.tsx:36` JSON-LD
   description rewritten to the canonical positioning ("portable professional identity and
   employment network" vocabulary, no CEN), `demo/page.tsx:6,:57` CEN wording replaced.
5. **Regression pins:** update the three pinning tests to the new strings and add an absence
   assertion for "Provider Career Evidence Network" on `/` (the `trust-center.test.tsx:77`
   pattern), so the retired category cannot silently return.

**Collision check.** #1377 (31 files) touches strategy docs and employer surfaces — it is
DIRTY, will not land as-is under the founder ruling, and **must be rebased/reworked after
this bundle**; no other open PR touches `EasyHome.tsx`, the constitution, or the brief
(#1388 is `/explore` only). The homepage is a single-ownership zone — this is the only
homepage PR open at its time, per the one-homepage-PR rule.

**Tests (fail before → pass after).** `home-easy-cutover.test.tsx:65,:67` and
`home-easy.spec.ts:102,:108` fail against the new copy until updated in the same PR (that is
the before-state proof); the new CEN-absence assertion fails on today's `main` and passes
after. `pnpm check:claims` + copy gates rerun. Founder visual gate applies (public homepage
copy): evidence set at 390/768/1440/1728 + explicit `FOUNDER VISUAL DECISION: GO` before
merge — the 2026-08-15 rulings authorize the direction, not the rendered result.

**Migration impact.** None. **Rollback.** Revert restores Titan copy *and* its EC-20 rows
together (doctrine and copy stay consistent in both directions).

---

## Bundle C1.5 — Acceptance convergence: the exact path to one canonical employer decision service

**Current files/functions (re-audited this session).**
- **Door A** (application-scoped): `apps/api/backend/src/routes/applications.ts:241-272` —
  `requireOrgRole(VERIFIER_MUTATION_ROLES)` (env-gated no-op by default,
  `middleware/orgRoleGuard.ts:44,88-95`) + file-local **raw-header**
  `requireClerkUserId` (`:47-51`; a verified variant exists unused at `:53-60`); service
  `employerWorkflowService.ts:521,:664-766` — org derived server-side via
  `getOrgForVerifier`/`opportunity.organizationId`, one transaction: `Application.status →
  ACCEPTED` with a `notIn` concurrency predicate, audit `APPLICATION_DECISION_RECORDED`,
  outbox `APPLICATION_DECISION_CAPSULE_REQUESTED`. **Writes no `EmployerAcceptance` row.**
- **Door B** (entity-scoped): `routes/employerActions.ts:315-548` — raw-header
  `requireClerkUserId` (`:69-73`), `enforceEmployerMutationRbac` is a **global user-role**
  check (shadow unless enforced), org scope is *not* derived — attribution is caller-supplied;
  write `employerReviewActions.ts:843,:925-1005` — `employerAcceptance.create` with
  **`employerId` = Clerk user id**, `applicationId` null on every live UI path (no web
  component sends `packetHash`), plus outbox/audit `EMPLOYER_REVIEW_ACCEPTED`, duplicate-409
  on `(employerId, clinicianNpi)`, passport-BLOCKED 422 gate.
- **Machine lane:** `routes/wedge.ts:257,:336,:444` (`apiKeyAuth`,
  Recognition→Acceptance→Start into the separate `Acceptance`/`Start` tables); live callers:
  none (only `_archive` pages and tests).
- **Semantic landmine:** `EmployerAcceptance.employerId` holds a **Clerk user id** when door B
  writes it, while `applicationService.ts:783-800` (employer-dashboard "already accepted")
  queries it as an **organization id**, and #1378 writes it as an organization id. Readers are
  split across two meanings of one column today.

**Observed defect.** Two signed-in doors with different auth postures, different scope keys,
different writes (door A records no acceptance row; door B records one that door A's readers
can't reliably see), plus a parallel machine lane — and a column whose meaning depends on the
writer.

**Proposed convergence path (ADR + two bounded code steps in C1; the rest rides #1378).**
1. **ADR (mergeable now):** `docs/adr/` — *One employer decision service.* Spine =
   `runEmployerWorkflowAction` (door A), per #1378's own architecture: verified identity +
   org-role guard, server-derived org scope, atomic transaction owning
   `Application.status` + `EmployerAcceptance` + activation/requirement instantiation +
   audit + outbox. Door B becomes an **adapter**: entity/NPI-scoped callers must resolve an
   explicit application (UI selection step — there is no entity→application join;
   `resolveEmployerReviewSubject` maps entity→NPI only) and then call the spine; its unique
   obligations transfer with it (duplicate-409 on `(org, npi)`, passport-BLOCKED gate,
   accept-time source snapshot in metadata, `EMPLOYER_REVIEW_ACCEPTED` audit+outbox names the
   history UI reads, denial-audit trail, attribution keys). `employerId` is redefined as
   **organization id, always**, with `acceptedBy` carrying the reviewer's Clerk id (as #1378
   already does); door B's legacy rows are backfillable via `User.organizationId`. The wedge
   lane is **retired** (routes removed, models dropped in a later schema-hygiene migration)
   unless the founder names a machine-integration need — nothing live calls it.
2. **Code step 1 (mergeable now, no #1378 dependency):** switch door B's identity to
   `requireVerifiedClerkUserId` (`middleware/verifiedActor.ts:64-79`) — safe in every
   verification mode, closes a raw-header trust hole, and matches the change #1378 makes to
   door A. `#1378 does not touch employerActions.ts`, so no conflict.
3. **Code step 2 (mergeable now):** stop door B writing the Clerk user id into `employerId`
   when the reviewer's `User.organizationId` resolves — write the org id and keep the Clerk id
   in `acceptedBy`/metadata. Readers split by meaning today; this converges new rows on the
   #1378 meaning before #1378 lands.
4. **The rest lands as #1378** (rebased onto main post-C1, migration renumbered off the
   `20260814180000` collision with #1382), then door B's adapter conversion and wedge
   retirement as follow-ups.

**Collision check.** Step 2's file (`employerReviewActions.ts`) and step 1's
(`employerActions.ts`) are touched by **no open PR** (verified against #1378/#1380/#1381/#1384
file lists). The ADR constrains #1378/#1384 rather than colliding. #1384's deletion of
`startWriter.ts` is judged against the ADR's invariant: it may proceed **only** with an
injection-proof that no start can exist without its audit row through the new command — per
the founder ruling.

**Tests (fail before → pass after).** Step 1: a request to door B carrying only the raw
`x-clerk-user-id` header (no verified auth) currently succeeds → asserts 401 after (the #1378
test pattern for door A). Step 2: a new service test asserting `employerAcceptance.employerId`
equals the reviewer's `organizationId` (fails today — equals the Clerk id), plus a
characterization test pinning that `applicationService.ts:783`'s org-scoped read now sees
door-B rows (fails today). ADR: n/a.

**Migration impact.** None in C1 (column meaning converges by writer change; backfill and
wedge-model drops are explicitly deferred to a later migration wave). **Rollback.** Each step
reverts independently; the ADR records the decision either way.

---

## Bundle C1.6 — The smallest real-employer role path to one reachable Apply-with-VitalCV

**Current files/functions.** Role creation UI **exists**: `apps/web/app/employer/post/page.tsx`
(689 lines; create `:181-203`, edit `:208-219`, close `:221-236`, inline org fallback
`:283-330`), linked from `employer/dashboard/page.tsx:74`. API:
`apps/web/app/api/employer/opportunities/route.ts` → backend `routes/opportunities.ts:152-192`
→ `opportunityService.ts:451-488` (`createOpportunity`, org via `getOrgProfileIdForUser`,
writes `Opportunity` with `listingSource ≠ 'public_feed'`). `applicationMode` is computed
server-side: `opportunityTruth.ts:1615` — `isFeedListing ? 'external' : 'vitalcv'` — so any
employer-created role renders "Apply with VitalCV"
(`components/explore/PublicOpportunityDetail.tsx:95-101`) with requirements built from the
org-level envelope or level-based fallback (`opportunityTruth.ts:1486,:726-750,:645-704`).
Apply path: `app/api/opportunities/[id]/apply/route.ts` (Clerk + `apply_flow` surface control)
→ backend `routes/applications.ts:76-101` (user row + identity tier `work_email_confirmed`) →
`applyToOpportunity` (`applicationService.ts:351-500`) creating `Application` **and** a sealed
`ApplicationPacket` idempotently. Employer review: `/employer/applications` →
`listAllOrgApplications` via `User.organizationId` — real orgs, zero demo slugs in the path.

**Observed defect — two missing links, both small.**
- **(A) The `VERIFIER` role is never granted to a self-serve employer.** Role inference flips
  on `NpiOwnership` — the *clinician* claim table (`routes/role.ts:63-87`,
  `roleInferenceService.ts:55`); `upsertOrgProfile` (`opportunityService.ts:122-376`) grants
  the org, the ADMIN membership, and `User.organizationId` (`:352-369`, the #1364 fix) but
  never `user.role`. A granted employer keeps role `CLINICIAN` and `middleware.ts:127`
  bounces them off `/employer/*` to `/holder`. The only other `'VERIFIER'` write in the repo
  is `prisma/seed-demo-accounts.ts:43`.
- **(B) `/employer/post`'s inline org fallback omits `website`** (`post/page.tsx:307-313`),
  so `resolveOrganizationAuthority` (`employerIntegrity.ts:194-212` — requires work-email
  domain == org website domain) returns `no_org_domain` → guaranteed 403. The working setup
  path is `/employers` (`EmployerGetStartedClient.tsx:103-112`, which sends `website`).

**Proposed implementation.**
1. **(A)** Grant `role: 'VERIFIER'` inside `upsertOrgProfile`'s existing grant transaction
   (`opportunityService.ts` ~`:352-369`), same place `organizationId` is set, only on
   `GRANTED` authority — never on `PENDING_REVIEW`. Deliberately **not** in
   `routes/role.ts`/`applications.ts` (collision with #1378/#1380, and role.ts's
   NpiOwnership inference is clinician semantics that shouldn't learn employer cases).
2. **(B)** Remove the inline fallback from `/employer/post` and redirect un-orged users to
   `/employers` (the path that works), rather than duplicating the setup form — the
   duplicate-intent rule; one setup surface.
3. Per-role structured credential requirements (**C**) are explicitly **deferred**: the
   org-level requirements envelope plus the level-based fallback is sufficient for the first
   transaction, and a per-opportunity requirements model belongs to the C7/C9 waves (and
   would collide with #1384's migration).
4. Resulting path, no seeds and no flags: employer signs in with a work email → `/employers`
   (Type-2 NPI + website) → org granted & bound → `/employer/dashboard` → Post a job →
   live `vitalcv`-mode role → clinician (claimed profile + `work_email_confirmed`) sees
   **Apply with VitalCV** → sealed packet → `/employer/applications`. Preconditions to state
   honestly in the runbook: the clinician-side identity tier, and `apply_flow` surface
   control enabled.

**Collision check.** `opportunityService.ts` and `employer/post/page.tsx` are touched by no
open PR. Avoids `routes/applications.ts` (#1378/#1380) and the schema (#1384) entirely.
`EmployerWorkflowDashboard.tsx` (#1378) is read-only in this bundle.

**Tests (fail before → pass after).** (A) service test: after `upsertOrgProfile` with granted
authority, `user.role === 'VERIFIER'` — fails today (`CLINICIAN`); middleware/role test that a
granted employer is not redirected off `/employer/post` — fails today. Negative: a
`PENDING_REVIEW` outcome must NOT change the role — passes today, pins the gate. (B) test that
`/employer/post` without an org renders the redirect, and that no POST to `/api/employer/setup`
can originate from that page without `website` — the old fallback's 403 path becomes
unreachable. End-to-end proof at merge: exercise the full path §4 on a production build with
the repo's real-Postgres harness (per the Titan release rules) and record the transcript.

**Migration impact.** None (role is an existing enum value; no schema change). **Rollback.**
Revert; employers return to the current bounced state — no data cleanup needed (role grants
persist harmlessly, or are reverted by a one-line update if the founder prefers).

---

## Dependency order

```
C1.0  founder console: fix Actions billing + restore protection   ← blocks all merges
  └─ land PR #1389 (Wave C0 docs) through executed, passing checks
C1.1  protection verifier hardening          — independent; FIRST code merge (guards the rest)
C1.3  delete the orphaned console pair       — independent
C1.5  step 1+2 (verified identity on door B; employerId semantics) + ADR — independent
C1.4  vocabulary reconciliation              — independent; needs founder GO on exact copy + visual evidence
C1.6  employer role path (A+B)               — independent; enables the first real transaction
C1.2  directory latency: instrumentation → evidence → fix          — instrumentation any time;
                                                                     fix only after the waterfall
then: rebase/renumber #1378 and land it per the C1.5 ADR; #1380 after; #1384 only with the
injection proof; #1381/#1382 stay deferred per the founder rulings.
```

Every bundle is independently mergeable and independently revertible. None changes the schema.
The only founder inputs required inside C1: the C1.0 console actions, the exact replacement
eyebrow copy in C1.4, and the visual-gate GO on the rendered result.
