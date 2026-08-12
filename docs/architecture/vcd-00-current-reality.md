# VCD-00 — Current Reality

**Wave:** VCD-00 (Canonical transaction baseline — current-reality half)
**Program:** the Provider Career Evidence Network program (VCD-00…VCD-34), which supersedes
Billion-Dollar V2 as the sequencing program of record (2026-08-10). The first draft of this
document was produced as V2-00; this revision re-verifies every volatile claim.
**Observed:** 2026-08-10 (first pass 09:32–09:40 UTC; this revision ~05:00 UTC 2026-08-11)
**Method:** every claim below was read from `origin/main`, from a live HTTP probe, or from
the GitHub API at the time stated. Nothing is inherited from a planning document.
**Companion:** `docs/product/evidence-network/canonical-transaction-baseline.md` — the
transaction map, duplicate-emitter inventory, and gap register (the other half of VCD-00).

> **Read this before trusting it.** This file is a *timestamped observation*, not a standing
> contract. Deploy state, PR state and issue state in this repository change within hours; the
> program-of-record classifications change within days. The invariants in §7 are durable; the
> SHAs, PR tables and deploy state in §1–§3 are not. Re-probe before acting on them.

---

## 1. Canonical SHAs

| Identity | Value | How it was read |
|---|---|---|
| **Source of truth — `origin/main`** | `b10e681c2b2de1be2c90e1e1acdd7bc4bb89479b` | `git rev-parse origin/main` after `git fetch origin main` |
| main's subject | `feat(home): give the hero stage to the real record, and make the CTA visible (#1334)` | `git log -1 origin/main` |
| **Deployed — web (`vitalcv.com`)** | `b10e681c2b2de1be2c90e1e1acdd7bc4bb89479b` | `GET https://vitalcv.com/api/version` → `.commit` (cache-busted) |
| **Deployed — API (`api.vitalcv.com`)** | `b10e681c2b2de1be2c90e1e1acdd7bc4bb89479b` | `GET https://api.vitalcv.com/health` → `.git_sha` (cache-busted) |

**All three identities agree.** Web, API and `origin/main` are on the same commit at
observation time. There is no convergence problem to solve.

### 1.1 The durable lesson from the first pass: gaps are usually build lag, not drift

The V2 program document opened with "`main` and production are not on the same build" as an
audit priority. The first pass of this reconciliation found the gap was **one commit of build
lag** that closed on its own in ~15 minutes; this revision finds no gap at all. Both
observations were accurate when made — which is the lesson:

- **Do not open a convergence-repair wave on the strength of a single stale SHA reading.**
  Re-probe, check `git merge-base --is-ancestor`, and check whether the commits in the gap
  even touch the service you are looking at.
- The first pass also caught a real topology fact: **Railway rebuilds web on every push to
  `main` regardless of `deploy-web.yml`'s path filter** — the filter gates the *verification
  workflow*, not the deployment. So a web deploy can occur with no exact-SHA assertion having
  run against it. That remains an open residual (§3.2).

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

## 3. Open PRs

### 3.1 Open at this revision — 4 total

| PR | Title | State | Note |
|---|---|---|---|
| [#1337](https://github.com/ctol3r/vitalcv/pull/1337) | fix(verifier): close #948 and #949 — holder-authorization closure in the unwired pipeline module | open, CI in flight | The V2-03 work, rebased onto `b10e681c2` and pushed as part of this wave. Gates the share train (§6). |
| [#1336](https://github.com/ctol3r/vitalcv/pull/1336) | fix(fixtures): stop a real physician's NPI executing against production | open, BLOCKED | Truth/fixture hygiene |
| [#1335](https://github.com/ctol3r/vitalcv/pull/1335) | feat(home): attribution + questions sections, ported from Homepage v2 | open, BLOCKED | The Homepage v2 design-handoff port lane; #1334 (hero) already merged |
| [#1327](https://github.com/ctol3r/vitalcv/pull/1327) | fix(security): S1 — server-derived proxy identity, RS256 pinning, verified platform-admin binding | **draft**, CLEAN | Security lane |

### 3.2 Deploy-convergence residuals (carried from V2-02, still open)

Most of what V2-02 asked for already exists on `main` (exact-SHA deploy mutation, post-deploy
SHA assertion for both services, pinned Railway identities). Three residuals remain:

| Residual | State |
|---|---|
| A documented, *tested* rollback to the exact prior production SHA | Open — no rollback receipt found |
| Same-*source* proof (not same-value observation) that `/status` and `/api/version` derive from one release identity | Open |
| Web deploys that skip `deploy-web.yml`'s path filter get no SHA assertion (§1.1) | Open |

### 3.3 Historical note: PR #1285 and #1289

Both merged 2026-08-10 (`04b1ecb69`, `bd2d0e58a`) while the V2 program document still treated
them as open work — the canonical example of audit staleness here. What survives:
**#1285's founder visual gate is owed on merged code.** `/design/living-record` sits in the
design sandbox (isolation satisfied by placement); the gate governs *promotion*, and the merge
is not visual approval.

---

## 4. Canonical route owners

Read from `apps/web/lib/navigation/routeManifest.ts` on `origin/main` (verified unchanged
between the first pass and this revision), cross-checked against the actual `app/` tree. Note
the manifest's own scope warning: **it is presentation only. Membership grants no access;
middleware remains the sole auth gate.**

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

This is the most important gap in the route picture. At least five distinct surfaces render a
recipient-facing view of a clinician record, each with its own model:

| Surface | What it is | Auth posture |
|---|---|---|
| `/apply/[requestUri]` | apply-intent bundle (`loadApplyIntent`, `isValidBundleId`) | `force-dynamic` |
| `/review/[entityId]` | "Review a shared, source-backed clinician record" | `force-dynamic` |
| `/packet/[entityId]` | career packet for recruiter/employer review | `robots: noindex` |
| `/snapshot/[id]` | persisted readiness snapshot; immutable, `contentHash`-pinned, read-time freshness overlay, fails closed when revoked, backend writes an audit row on access | public viewer |
| `/verify/[npi]` | verifier reading mode | public |

`/snapshot/[id]` is the only one of the five whose header documents revocation, immutability and
audit-on-access. **Any future canonical-share wave should start from `/snapshot/[id]`'s
contract**, not from a blank sheet. The backend half of this picture — which API paths and
models emit share/accept/start success — is inventoried in the companion transaction baseline.

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
| Design D′ series | `docs/design/VITALCV_2026_DESIGN_WAVES_RECONCILED_2026-08-09.md` | Active design-lane sequencing; supersedes the raw D-00…D-11 brief; founder rulings 1–3 recorded in-doc. |
| Founder visual gate | `docs/ops/FOUNDER_VISUAL_GATE.md` | Active. Public-facing visual work still needs rendered evidence, a live review URL, and an explicit `FOUNDER VISUAL DECISION`. |
| Public claims matrix | `docs/ops/vitalcv-public-claims-matrix.md` | Active, last updated 2026-08-08. Single source of truth for public copy; enforced by `scripts/check-public-claims.ts`. |
| Truth contract (issuer/PSV) | `CLAUDE.md` + `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` | Active. Literal `decisionGrade: false`; banned-string list. |
| Launch blockers | `docs/ops/launch-blockers.md` | Active but **stale-dated** — status date 2026-07-11, baseline `f7bdbe158`. Re-verify each item before citing. |
| **Provider Career Evidence Network (VCD-00…VCD-34)** | `VITALCV_COMPETITIVE_DOMINATION_BLUEPRINT_2026-08-10.md` + `VITALCV_MEGA_CLAUDE_CODE_EXECUTION_PLAN_2026-08-10.md` | **Current program of record for sequencing** (founder ruling 2026-08-10). ⚠️ **Not committed to this repository** — both documents live only in the founder's Dropbox, so a wave cannot be claim-checked against them without founder access. Committing a redacted equivalent would make the sequencing citable the way the Constitution already is. |

### 5.2 Superseded

| Program | Superseded by |
|---|---|
| **Billion-Dollar V2 (V2-00…V2-47)** | the VCD program (founder ruling 2026-08-10). V2's executed work carries forward: V2-00 became this document; V2-03 became PR #1337. |
| The 2026-08-09 planning generation (Unified BD-01…64, CONQ-00…09, ILL-00…14, raw D-00…D-11) | folded into the VCD program and the D′ series; ILL-02…05 shipped (`apps/web/components/visual-scene/`, PR #1285); do not execute from the raw briefs. |
| `docs/design/VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20) | the Experience Constitution — explicitly named successor-of-record |
| Journey-rail chrome / prior visual eras | `docs/design/PARKED_VISUAL_ERAS.md` (parking is the default) |
| `docs/ops/wave-ledger.md` | **stale** — last entries 2026-05-28. Not a current-state source. |
| `docs/LAUNCH_GATE.md` | explicitly marked historical (2026-03-28) by `launch-blockers.md` |
| The "keep adding waves" 64-wave model | gate-driven sequencing (activation / share / acceptance / reuse / revenue) |

---

## 6. Known security blockers

### 6.1 #948 and #949 — fix in flight

Both defects sat **dormant** in the intentionally-unwired verifier pipeline module
(`registerVerifierPipelineRoutes` is not called; a guard test asserts unreachability).
**PR #1337** closes both — holder scope derived from the verified session, ownership checked
before state, expiry made real — with a 16-case adversarial suite whose guards were each
sabotage-verified. Until that PR merges, the blocking relationship stands: **no wave may
restore `/widget/apply` or back the application/offer stores with Postgres**, and the
controlled-share train stays gated.

### 6.2 #963 — the authorization audit's uncovered surface

**OPEN**, label `documentation`. This issue exists *for its last section*: the surface the
2026-07-28 sweep did **not** examine. Treat it as a map, never as a clean bill. The unswept
surface (service layer, non-org ownership, the sibling API apps, presence-vs-value credential
checks) is enumerated in the issue itself.

⚠️ **`apps/router` is named in the issue but does not exist on `origin/main`.** `CLAUDE.md`
also still lists it; that line is stale. Do not budget sweep effort for it.

Two traps recorded in the issue, worth carrying into every authorization wave:

- The tenant guard answers **401 before routing** when `x-org-id` is absent — a bare probe proves
  nothing about whether a route exists. Send the header. The same trap invalidates tests: a
  "route still exists" assertion can pass on a guard rejection and keep passing if the handler
  were deleted.
- **A green suite is not evidence.** A suite here once asserted the vulnerability as correct
  behaviour. Every fix must be falsified by sabotaging it and confirming the tests go red.

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
   `origin/main`.
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

## 8. Next eligible work

1. **Merge PR #1337** (the #948/#949 closure) on named-context green at its head SHA.
2. **Land this VCD-00 branch** (`strategy/vcd-00-canonical-baseline`) — this document, the
   `.ai/snapshot.md` refresh, and the companion transaction baseline.
3. **VCD-01 (network event taxonomy) is BLOCKED** by VCD-00's own exit gate: the companion
   baseline finds multiple wired paths that can emit share, acceptance, and start success.
   Per the program, VCD-01 stays blocked until a founder-approved consolidation plan exists.
   The consolidation decision memo is therefore the next founder gate.
4. **VCD-V01 (illustration-system delta audit)** is eligible in parallel — as a *delta* against
   the shipped `visual-scene` runtime and Living Evidence Record kit, not a rebuild.

---

## 9. Provenance of this document

First pass read live 09:32–09:40Z 2026-08-10 as V2-00; this revision re-read every volatile
claim (SHAs, deploy identities, PR states, required-context count, route manifest) at
~05:00Z 2026-08-11. File-content claims were read from `origin/main` via `git show`/`git
ls-tree`, not from a working tree. This wave changed **no** application behavior, schema,
tokens, public copy, assets, or deployment configuration.
