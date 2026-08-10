# Billion-Dollar V2 — Current Reality

**Wave:** V2-00 (Current-reality reconciliation + operational snapshot repair)
**Observed:** 2026-08-10, 09:32–09:40 UTC
**Method:** every claim below was read from `origin/main`, from a live HTTP probe, or from
the GitHub API at the time stated. Nothing is inherited from a planning document.

> **Read this before trusting it.** This file is a *timestamped observation*, not a standing
> contract. Deploy state, PR state and issue state in this repository change within hours; the
> program-of-record classifications change within days. The invariants in §7 are durable; the
> SHAs, PR tables and deploy state in §1–§3 are not. Re-probe before acting on them.

---

## 1. Canonical SHAs

| Identity | Value | How it was read |
|---|---|---|
| **Source of truth — `origin/main`** | `fa40386b726155f3d6e4cdadca797a1f44122e69` | `git rev-parse origin/main` after `git fetch origin main` |
| main's subject | `feat(ingestion): a credential-free clinical feed, and the relevance gate that was only ever a promise (#1306)` | `git log -1 origin/main` |
| main's commit time | 2026-08-10T02:32:53−07:00 (09:32:53Z) | same |
| **Deployed — web (`vitalcv.com`)** | `26cf96bc0c218a1ac9005d455382767655785b8e` | `GET https://vitalcv.com/api/version` → `.commit` |
| **Deployed — API (`api.vitalcv.com`)** | `26cf96bc0c218a1ac9005d455382767655785b8e` | `GET https://api.vitalcv.com/health` → `.git_sha` |
| Public status page render | `build 26cf96b` | `GET https://vitalcv.com/status` |

### 1.1 The main↔production gap is build lag, not drift

`26cf96b` is an **ancestor** of `origin/main` (`git merge-base --is-ancestor` → true), exactly
**one** squash-merge behind. That one commit is `fa40386b7` (#1306), which touched
**`apps/api/**` only** — 8 files, all under `apps/api/backend/src/services/ingestion/`.

Therefore:

- **Web is fully converged.** `26cf96b` is the newest commit touching any `deploy-web.yml`
  path filter. Web is not behind; it has nothing to deploy.
- **API is mid-deploy.** The `deploy-api.yml` run for `fa40386b7` was `in_progress` at
  2026-08-10T09:32:56Z, started 3 seconds after the merge.
- Web and API report **the same SHA as each other**, and `/status` agrees with `/api/version`.

This corrects a premise carried by the V2 program document (§1.3 item 1, "`main` and production
are not on the same build"). That observation was accurate **when made** — the document records
production at `ee0b541` (a real commit, 2026-08-09T08:45:56−07:00), which was **54 commits**
behind the `7e6fac82f` it recorded as main. As of this reconciliation the gap is one API-only
commit with its deploy in flight. See §3.2 for what this does to V2-02.

**Confirmed at 09:48Z — the gap closed on its own, as predicted.** Re-probing at the end of this
wave:

```
api  = fa40386b726155f3d6e4cdadca797a1f44122e69
web  = fa40386b726155f3d6e4cdadca797a1f44122e69
main = fa40386b726155f3d6e4cdadca797a1f44122e69
```

All three identities agree. This is the falsifiable version of the claim: the gap was build time,
and it resolved without intervention in roughly 15 minutes. **Do not open a convergence-repair
wave on the strength of a single stale SHA reading** — re-probe first, and check whether the
commits in the gap even touch the service you are looking at.

Note also what this shows about the deploy topology: web moved to `fa40386b7` even though that
commit touches only `apps/api/**` and therefore did **not** match `deploy-web.yml`'s path filter.
Railway rebuilds on every push to `main` regardless; the path filter gates the **verification
workflow**, not the deployment. So a web deploy can happen with no exact-SHA assertion having run
against it. That is a real, if narrow, hole in V2-02's coverage and belongs in its residual (§3.2).

---

## 2. Production platform, project and service

**Platform: Railway. Not Vercel.** `GET /api/version` reports
`{"platform":"railway","environment":"production","branch":"main","service":"web"}`.

Identities are pinned in `.github/workflows/deploy-web.yml` so a token cannot deploy or audit a
similarly named service in another project:

| Field | Value |
|---|---|
| Railway project id | `706ceff8-23ac-404c-a45b-449de5920848` |
| Web service id | `f31e461b-d617-4e7e-8a40-796a640ffc0b` |
| Production environment id | `cd700720-5c9d-472b-bf68-4b3cc65191cd` |
| Expected web domain | `vitalcv.com` |
| API domain | `api.vitalcv.com` (`secrets.RAILWAY_API_DOMAIN`, defaulted in-workflow) |

### 2.1 Deployment path — who actually deploys

- **Web:** `.github/workflows/deploy-web.yml` is the release authority. It does **not** rely on
  Railway auto-deploy. It requests the exact GitHub SHA through the Railway GraphQL mutation
  `serviceInstanceDeployV2(serviceId, environmentId, commitSha)`, then refuses success until the
  public no-store `/api/version` reports that same full SHA (`scripts/deploy-smoke.mjs`,
  cache-busted). Path-filtered to `apps/web/**`, `packages/**`, the web `railway.toml` and
  `Dockerfile`, `pnpm-lock.yaml`, `scripts/deploy-smoke.mjs`, and the workflow itself.
- **API:** Railway auto-deploys on push to `main`. `.github/workflows/deploy-api.yml` does **not**
  deploy — it waits and then proves the commit is serving, by polling `/health` for
  `git_sha == GITHUB_SHA` with a 600s budget, cache-busted.
- **Build config:** root `railway.toml` (API — `preDeployCommand` runs `prisma migrate deploy`,
  then starts `apps/api/backend/dist/.../server.js` with `SKIP_STARTUP_MIGRATION=1`);
  `apps/web/railway.toml` (web — `builder = DOCKERFILE`, `apps/web/Dockerfile`, healthcheck
  `/api/health`). The web file carries a standing warning never to set `deploy.startCommand`.

---

## 3. Open PRs and the two named in the program

### 3.1 PR #1285 and PR #1289 — both already MERGED. Classification: **SUPERSEDED**.

The V2 program document (§6) treats both as open work needing rebase and gating. Neither is open.

| PR | Title | State | Merged | Merge commit |
|---|---|---|---|---|
| [#1285](https://github.com/ctol3r/vitalcv/pull/1285) | ILL-03/04/05 — the Living Evidence Record kit and relationship scene | **MERGED** | 2026-08-10T08:55:27Z | `04b1ecb694bc069cbe4f1fd6937677ed65606dc8` |
| [#1289](https://github.com/ctol3r/vitalcv/pull/1289) | chore(home): delete the three dead home components carrying retired vocabulary (DL-009) | **MERGED** | 2026-08-10T09:20:28Z | `bd2d0e58aea3c27113baf51a8389dd782c549825` |

**Exact conflicts: none, in either case.** Both are ancestors of `origin/main`; there is no
divergent branch to rebase, no conflicting hunk, and nothing to resolve. The program's
instructions for them — "rebase against current `main`", "re-run copy/design baselines after
current-main rebase" — describe work that cannot be performed because the branches have already
landed and been squashed.

What each disposition becomes instead:

- **#1285 → the founder visual gate is still owed, and it is now owed on merged code.** The
  program's substantive condition ("finish founder visual review", "keep `/design/living-record`
  isolated until conversion experiment") survives the merge. `/design/living-record` exists on
  `origin/main` under `apps/web/app/design/`, i.e. inside the design sandbox rather than mounted
  on the homepage — so the isolation condition is currently *satisfied by placement*, and the
  founder gate is about whether it is ever promoted, not about whether to merge it. Feed it to
  V2-07 as the program directs. Do **not** treat the merge as visual approval.
- **#1289 → closed. Nothing outstanding.** The dead-component deletion landed; the vocabulary
  debt it removed is gone from `main`.

Per the program's own rule — *"a wave that discovers its premise is already shipped should close
itself as superseded, document the evidence, and name the next eligible wave — never rebuild the
feature"* — this is the documented evidence.

### 3.2 What V2-02 is actually left with

The program's V2-02 ("exact-SHA production convergence") asks for four things. Three already
exist on `main`:

| V2-02 item | State | Evidence |
|---|---|---|
| Identify the actual production deploy path, remove Railway/Vercel ambiguity | **Already done** | §2 above; `deploy-web.yml` pins project/service/environment ids |
| Deploy only an explicitly approved SHA | **Already done** | `serviceInstanceDeployV2(..., commitSha: $GITHUB_SHA)` |
| CI assertion that production reports the expected commit after deploy | **Already done, both services** | `deploy-web.yml` + `scripts/deploy-smoke.mjs`; `deploy-api.yml` `/health` SHA poll |
| `/status` and `/api/version` derive from the same release identity | **Observed consistent** (`26cf96b` on both); *derivation* not separately audited | live probe |
| Record rollback to the exact prior production SHA | **Open** | no rollback receipt found in this sweep |
| Quarantine/label legacy deployment projects | **Open** | not audited in this wave |
| Web deploys that skip the path filter get no SHA assertion | **Open** | observed in §1.1 — Railway deployed web for an `apps/api`-only commit; `deploy-web.yml` did not run |

So V2-02 is **mostly superseded**, with three genuine residuals: the documented, tested rollback
path; a same-source proof (rather than a same-value observation) for `/status` vs `/api/version`;
and closing the gap where Railway deploys web without `deploy-web.yml` having asserted the SHA.

### 3.3 Open PRs at 09:35Z — 16 total

`mergeStateStatus` is read live; it is not stable and several read `UNKNOWN` simply because
GitHub had not finished computing mergeability.

| PR | Head | State | Note |
|---|---|---|---|
| #1310 | `deps/domain-common-vitest-4` | BLOCKED | vitest 4 bump so coverage-v8 4 can load |
| #1309 | `claude/sweep-fail-on-invisible` | draft | CI: a PR running zero gates should fail, not whisper |
| #1308 | `feat/packet-absence-surface` | UNKNOWN | renders empty sections — **relevant to V2-15** |
| #1307 | `chore/track-current-agent-generation` | UNKNOWN | tracks the untracked agent fleet |
| #1303 | `claude/resume-b1-ui-hotfix-jpnwrh` | **CLEAN**, draft | sign-in destination carry-through |
| #1302 | `chore/agent-defs-experience-constitution` | UNKNOWN | repoints UI agents at the Constitution |
| #1301 | `wave/ux02-statechip-retirement` | draft | StateChip → ProvenanceChip |
| #1300, #1299, #1298, #1297, #1296, #1295, #1294, #1293, #1292 | dependabot | mixed (3 BLOCKED) | dependency bumps |

**Nine of sixteen are dependabot.** V2-01's stated objective ("stop branch entropy before new
product work") is therefore mostly a dependency-triage task, not a product-premise task — the two
product PRs it names are already merged.

---

## 4. Canonical route owners

Read from `apps/web/lib/navigation/routeManifest.ts` on `origin/main`, cross-checked against the
actual `app/` tree. Note the manifest's own scope warning: **it is presentation only. Membership
grants no access; middleware remains the sole auth gate.**

### 4.1 Section roots (`SECTION_ROOTS`)

| Section | Root |
|---|---|
| clinician | `/holder/home` |
| employer | `/employer/dashboard` |
| issuer | `/issuer` (unlinked waypoint — no page of its own) |
| admin | `/admin/platform` |
| ops | `/ops` |
| account | `/holder/settings` |

### 4.2 Clinician

Canonical home `/holder/home` (with `/holder` aliased to the same label). Children:
`/holder/readiness`, `/holder/recognition`, `/holder/timeline`, `/holder/scoreboard`,
`/holder/applications` (+`/[id]`), `/holder/opportunities` (+`/discover`, `/interested`,
`/passed`, `/[id]`), `/holder/garden` (+`/cv`, `/notes`, `/opportunities`, `/privacy`,
`/research`), `/holder/matcha` (+`/onboarding`, `/assessment`, `/opportunities`),
`/holder/blockers/[blockerId]`, `/clinician/profile`, `/holder/settings` (account section).

### 4.3 Employer

Canonical root `/employer/dashboard`. Children: `/employer/worklist`, `/employer/candidates`,
`/employer/post`, `/employer/profile` (account section), `/employer/applications`
(+`/[applicationId]`), `/employer/review-queue`, `/employer/review/[applicationId]`,
`/employer/decision/[applicationId]`.

Public employer acquisition surfaces sit outside the manifest: `/employers`,
`/employers/how-it-works`, `/employers/request-access`.

### 4.4 Share / handoff — **no single owner today**

This is the most important gap in the route picture, and it is the direct input to V2-13
("use what already exists instead of inventing a second handoff system"). At least five distinct
surfaces render a recipient-facing view of a clinician record, each with its own model:

| Surface | What it is | Auth posture |
|---|---|---|
| `/apply/[requestUri]` | apply-intent bundle (`loadApplyIntent`, `isValidBundleId`) | `force-dynamic` |
| `/review/[entityId]` | "Review a shared, source-backed clinician record" | `force-dynamic` |
| `/packet/[entityId]` | career packet for recruiter/employer review | `robots: noindex` |
| `/snapshot/[id]` | persisted readiness snapshot; immutable, `contentHash`-pinned, read-time freshness overlay, fails closed when revoked, backend writes an audit row on access | public viewer |
| `/verify/[npi]` | verifier reading mode | **public, no auth required** |

`/snapshot/[id]` is the only one of the five whose header documents revocation, immutability and
audit-on-access — i.e. it already implements much of what V2-17/V2-18 specify. **V2-13 should
start from `/snapshot/[id]`'s contract**, not from a blank sheet, and its first deliverable is
choosing which of these five is canonical.

### 4.5 Trust

`/trust`, `/trust/attribution`, `/trust/doctrine`, `/trust/technical`, `/status`,
`/status/technical`, `/verify`, `/verify/guide`, `/verify/[npi]`, `/verify/receipt/[receiptId]`,
`/receipt/[receiptId]`, `/passport`, `/passport/[id]`.

Issuer chain (all keyed by an incoming request id): `/issuer/request/[requestId]` →
`/issuer/review/[requestId]` → `/issuer/policy-review/[requestId]` →
`/issuer/psv-receipt/[requestId]`, plus `/issuer/verify`, `/issuer/psv-reuse/[receiptId]`,
`/issuer/audit-boundary`, `/issuer/backend-persistence`, `/issuer/persistence-adapter`.

### 4.6 Route-registry warning

There are **two** registries and they must both be updated for a new `app/` page:
`apps/web/lib/navigation/routeManifest.ts` (asserted by `apps/web/__tests__/navigation-contract.test.ts`) and the
page-density census (`apps/web/__tests__/page-density-system.test.tsx`). A new page that updates
only one fails the other.

---

## 5. Programs of record

### 5.1 Active

| Program | Doc of record | Status |
|---|---|---|
| **Experience Constitution** | `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` | **CANONICAL.** Founder GO on R2 layering 2026-08-08; EC-20 back-filled from the UX-01 verdict. Clauses are Class A (invariant, rejects PRs), Class B (direction-locked), Class C (guidance). |
| Experience Overhaul Program | `docs/design/VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` | Execution companion to the Constitution. **The UI PR freeze is LIFTED** (founder ruling 2026-08-09). |
| Founder visual gate | `docs/ops/FOUNDER_VISUAL_GATE.md` | Active. Public-facing visual work still needs rendered evidence, a live review URL, and an explicit `FOUNDER VISUAL DECISION`. |
| Public claims matrix | `docs/ops/vitalcv-public-claims-matrix.md` | Active, last updated 2026-08-08. Single source of truth for public copy; enforced by `scripts/check-public-claims.ts`. |
| Truth contract (issuer/PSV) | `CLAUDE.md` + `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` | Active. Literal `decisionGrade: false`; banned-string list. |
| Launch blockers | `docs/ops/launch-blockers.md` | Active but **stale-dated** — status date 2026-07-11, baseline `f7bdbe158`. 8 open items (#2, #6, #7, #8, #9, #10, #12, #13). Re-verify each before citing. |
| **Billion-Dollar V2** | `VITALCV_BILLION_DOLLAR_PRODUCT_PROGRAM_V2_2026-08-10.md` | Current program of record for sequencing. ⚠️ **Not committed to this repository** — it lives only in the founder's Dropbox. Every other doc in this table is readable by anyone with the repo; this one is not, so nobody but the founder can check a wave against it. Committing it (or a redacted equivalent) would make the sequencing citable in the way the Constitution already is. |

### 5.2 Superseded

| Program | Superseded by |
|---|---|
| `docs/design/VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20) | the Experience Constitution — explicitly named successor-of-record; where they disagree, the Constitution wins |
| Journey-rail chrome / prior visual eras | `docs/design/PARKED_VISUAL_ERAS.md` (parking is the default; only journey-rail was actually deleted, 2026-08-09) |
| `docs/ops/wave-ledger.md` | **stale** — last entries are 2026-05-28. Not a current-state source. |
| `docs/LAUNCH_GATE.md` | explicitly marked historical (2026-03-28) by `launch-blockers.md` |
| `VITALCV_MASTER_WAVE_PLAN_2026-07-06.md`, `CURRENT_STATE_2026-07.md`, `docs/audits/*` | overtaken by later audits; treat as history |
| The "keep adding waves" 64-wave model | V2's five-number gate model (activation / share / acceptance / reuse / revenue) |

### 5.3 Conditional (locked)

V2 Train H (V2-41…V2-47) is **locked until G5**. Workbench expansion is frozen pending measured
use — production Workbench usage was measured at zero.

---

## 6. Known security blockers

### 6.1 #948 — `/api/holder/applications?npi=` enumerates any clinician's application history

**OPEN.** Labels `bug`, `priority-high`. Opened 2026-07-28, **not updated since**.

*Claim-checked against `origin/main` in this wave:* the defect code is still present at
`apps/api/backend/src/routes/verifierPipeline.ts:159`, and it is still **dormant** — the file
header reads `⚠️ NOT WIRED. registerVerifierPipelineRoutes is intentionally not called`, the only
non-self reference in `apps/api` is that comment, and a guard test
`apps/api/backend/src/routes/__tests__/verifierPipelineNotWired.test.ts` asserts the route is
unreachable (it probes `/api/holder/applications?npi=0000000000`).

Required invariant (from the issue): the subject NPI **must** be derived server-side from the
verified session, never from a query parameter, path segment, body field, or client-settable
header. Fail closed to 401 when no holder identity resolves.

Severity driver: NPIs are **public NPPES identifiers**, so the history is *enumerable*, not
guessable. Currently bounded only because `applicationStore` is an in-process `Map` nothing writes
to — **that bound disappears the moment it is backed by Postgres.**

### 6.2 #949 — `POST /api/verifier/offers/respond` mutates an offer with no ownership, expiry or state check

**OPEN.** Labels `bug`, `priority-high`. Opened 2026-07-28, **not updated since**. Same file, same
dormancy, same guard test. Three distinct gaps: no ownership check (nothing compares caller to
`offer.npi`); no expiry check (`expiresAt` is written and never read; `EXPIRED` is never assigned);
no state-transition check (an `ACCEPTED` offer can be flipped repeatedly, each time rewriting the
linked application state). `offerId` is a `randomUUID` — that is **secrecy of an identifier, not
authorization**.

### 6.3 #963 — the authorization audit's uncovered surface

**OPEN**, label `documentation`. This issue exists *for its last section*: the surface the
2026-07-28 sweep did **not** examine. Treat it as a map, never as a clean bill.

The defect class it names: **a route uses a caller-supplied value as its authorization scope
instead of the org resolved from the caller's own membership.** `requireOrgRole` answers "does the
caller claim an allowed role?", never "is the caller in the org that owns this record?" — so it is
not a tenant boundary at any `VERIFIER_RBAC_MODE`, `enforce` included.

Not covered, and therefore still open risk:

1. **Services were never swept.** Only `apps/api/backend/src/routes/*.ts`. A service taking an
   `organizationId` parameter can carry the same defect, invoked from a route that looks clean.
2. **Non-org authorization was never examined.** Ownership/IDOR on resources keyed by NPI,
   application id, entity id, or packet id.
3. **The method was a grep-shaped heuristic.** A route reading the value indirectly, or naming it
   something else, is invisible to it.
4. **Only the API backend.** `apps/issuer-api`, `apps/verifier-api`, `apps/admin-api` were not
   looked at. — ⚠️ **`apps/router` is named in the issue but does not exist on `origin/main`.**
   Do not budget sweep effort for it. (`CLAUDE.md` also still lists it; that line is stale.)
5. **`x-admin-key` is fixed but the class is not swept.** No sweep for other credentials compared
   by *presence* rather than *value*.

Two traps recorded in the issue, worth carrying into V2-03:

- The tenant guard answers **401 before routing** when `x-org-id` is absent — a bare probe proves
  nothing about whether a route exists. Send the header. The same trap invalidates tests: a
  "route still exists" assertion can pass on a guard rejection and keep passing if the handler
  were deleted.
- **A green suite is not evidence.** The `activation.ts` suite was green throughout because it
  contained `it('allows an employer with an org-role header to read')` — the vulnerability,
  asserted as correct behaviour. Every fix in that audit was falsified by sabotaging the fix and
  confirming the tests went red.

### 6.4 Blocking relationship

#948 and #949 are dormant, **not fixed**. They must close **before** any wave restores
`/widget/apply` or backs the application/offer stores with Postgres. In V2 terms that means they
gate **V2-13 onward** (the entire controlled-share train), because V2-13's first act is to choose
a canonical share/application object and V2-15 persists real packet state.

---

## 7. Durable invariants (these do not expire with this observation)

1. **Railway, not Vercel.** Verify a deploy by reading `/api/version` (web) or `/health`
   (API) for the SHA — never by trusting a green workflow or an HTTP 200.
2. **"Green" is a claim about a SHA, not a PR.** Read required contexts live
   (`gh api repos/:owner/:repo/branches/main/protection`), enumerate conclusions from
   `commits/<head-sha>/check-runs`, require zero pending, zero failing, and
   `mergeStateStatus == CLEAN`. Never `gh pr merge --auto`. There are **14** required contexts
   as of this observation; that list has moved repeatedly.
3. **Green CI is not evidence the code works.** Shell scripts, GPU/WebGPU paths and dev-gated
   e2e specs run in no PR check and must be exercised by hand.
4. **Prove a guard by injecting the defect it claims to catch.** Assert the closure, not the
   mechanism.
5. **Local `main` is not `origin/main`.** A worktree fleet holds `main`; always diff against
   `origin/main`. *(This wave found the primary checkout's `.github/workflows/` missing 12
   workflows present on `origin/main`, including `deploy-web.yml`.)*
6. **Never `git checkout main && git pull`.** Cut branches with
   `git worktree add -b <branch> /tmp/vitalcv-<slug> origin/main`. Do not remove worktrees you
   did not create.
7. **The truth contract binds copy.** `ReceiptCandidate.decisionGrade` is the literal `false`;
   `proofTier` is the literal `'receipt_candidate'`. The banned-string list in `CLAUDE.md` admits
   no exceptions outside test split-join constants. No status label may be the bare word
   `Verified`.
8. **Design-only boundary.** A design wave may not change truth, authn/authz, consent semantics,
   data models, APIs, readiness calculations, source behavior, employer decisions, business logic,
   or pricing. Record a product dependency and stop.
9. **A route manifest entry is presentation, never authorization.** Middleware is the sole gate.
10. **Audits go stale within days.** Claim-check every finding against `origin/main` and a live
    probe before acting on it.

---

## 8. Next eligible implementation branch

**Branch:** `fix/v2-03-holder-authorization-closure`
**Cut from:** `origin/main` @ `fa40386b726155f3d6e4cdadca797a1f44122e69`
**Wave:** V2-03 (Authorization closure before growth) — scoped to its first, hardest slice.

**Why this and not V2-01 or V2-02.** V2-01's two named product PRs are already merged (§3.1); what
remains is nine dependabot PRs, which is dependency triage, not the branch-entropy problem the wave
was written to solve. V2-02 is three-quarters already implemented on `main` (§3.2). V2-03 is the
first wave whose premise is **confirmed intact** — #948 and #949 were claim-checked against
`origin/main` in this reconciliation and are genuinely open, genuinely unfixed, and genuinely
blocking the share train.

**Scope:**

1. Fix #948 — resolve the holder from the verified Clerk session
   (`apps/api/backend/src/middleware/verifiedIdentity.ts`); if an `npi` parameter is retained it must be **compared**
   and 403 on mismatch, never used to select rows. Fail closed to 401.
2. Fix #949 — require `offer.npi` to equal the session-derived NPI (403 otherwise), reject
   `status !== 'PENDING'` (409), reject past `expiresAt` (410) and make `EXPIRED` assignable.
3. Adversarial tests: clinician-A/B, expired, revoked, already-answered, guessed-id, replay.
4. **Sabotage each fix and confirm the tests go red** before claiming closure.
5. Leave the module **unwired**. Closing the defect is not authorization to restore
   `/widget/apply` — that is a separate, separately-gated decision.

**Explicitly out of scope for that branch** (they are the rest of V2-03, and each deserves its own):
the service-layer sweep, the non-org IDOR sweep, `apps/issuer-api` / `apps/verifier-api` /
`apps/admin-api`, and the presence-vs-value credential sweep.

**Do not start** any V2-13+ share-domain work until #948 and #949 are closed and verified.

---

## 9. Provenance of this document

Every SHA, PR state, issue state and deploy state above was read live between 09:32Z and 09:40Z on
2026-08-10. File-content claims were read from `origin/main` via `git show`/`git ls-tree`, not from
a working tree. This wave changed **no** application behavior, schema, tokens, public copy, assets,
or deployment configuration.
