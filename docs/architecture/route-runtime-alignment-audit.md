# Route / Runtime / Doc Alignment Audit

**Branch:** `wave/canonical-route-map`
**HEAD at audit:** `d7202754` (canonical-trust-route-map truth-contract correction)
**`origin/main` HEAD at audit:** `5d530f13`
**Inputs:** `deployed-route-registration-audit.md`, `runtime-gating-graph.md`,
`upstream-fetch-topology.md`, `replay-topology-gap-analysis.md`,
`canonical-trust-route-map.md`, `verifier-continuity-normalization-audit.md`.

## Purpose

Cross-check every public claim VitalCV documentation makes about institutional
verifier infrastructure against (a) the actual route table on `origin/main`,
(b) the runtime payload shapes those routes emit, and (c) the continuity
semantics those payloads imply. Surface every claim that does not map to
runtime reality, every deployed surface that no document describes, and every
continuity assertion that the persistence layer cannot support.

The audit is restricted to **what an institutional verifier would experience
hitting apex `vitalcv.com` today**. It does not score work-in-progress on
unmerged PRs; those are flagged as targets, not as live claims.

## Method

1. Enumerate every claim sourced from in-repo documentation:
   `canonical-trust-route-map.md` (corrected), prior session-summary claims
   carried in `MEMORY.md`, the in-flight agent artifacts, and the runtime
   payloads themselves.
2. For each claim, locate the asserted artifact (handler file, env var,
   payload field) and verify it on `origin/main` HEAD.
3. Classify each claim as: ALIGNED (claim matches runtime), TARGET
   (claim corresponds to an unmerged PR — not a runtime claim, only a
   roadmap claim), DRIFT (claim partially matches), or ORPHAN (claim has
   no runtime artifact).
4. Sweep the route tree for surfaces that exist but no document describes
   (reverse-orphan check).
5. Sweep the continuity claims for semantics the persistence layer cannot
   produce (impossible-claim check).

---

## §1 — Claim-by-claim alignment matrix

Each row cites the claim source (file + line where available) and the
verification verdict against `origin/main`.

| # | Claim | Source | Verdict | Evidence |
|---|---|---|---|---|
| 1 | Apex `vitalcv.com` deploys `apps/web` | `MEMORY.md` carry, `apex-deployment-forensics.md` (on unmerged PR) | ALIGNED | `apps/web/app/api/health/route.ts:11` hardcodes `service: 'web'`; operator probe of `https://vitalcv.com/api/health` returned this literal |
| 2 | `apiBase=false` in `/api/health` means backend is unreachable | implied by health-probe operator interpretation | DRIFT | `apps/web/lib/backend-url.ts:22-24` falls back to `https://api.vitalcv.com` when `VERCEL` is set regardless; `apiBase=false` only reports that `NEXT_PUBLIC_API_BASE` is empty. Backend is still reachable through the Railway fallback |
| 3 | Clerk env is unset on apex (`clerk.enabled: false`) | operator probe | ALIGNED | `apps/web/app/api/health/route.ts:7,17` proves the signal source; operator-side env-var configuration is required |
| 4 | `/.well-known/jwks.json` is mounted | `canonical-trust-route-map.md` row 1 (corrected to "lives on #349, not on main") | TARGET | `git ls-tree -r origin/main` shows only `apps/web/app/api/.well-known/jwks.json/route.ts` (legacy); no `apps/web/app/.well-known/jwks.json/route.ts` |
| 5 | `/.well-known/did.json` is mounted | `canonical-trust-route-map.md` row 2 (corrected) | TARGET | Same — no handler on `origin/main` |
| 6 | `/.well-known/openid-credential-issuer` is mounted | `canonical-trust-route-map.md` row 3 (corrected) | TARGET | Same |
| 7 | `/.well-known/openid-configuration` is mounted | `canonical-trust-route-map.md` row 4 (corrected) | TARGET | Same |
| 8 | `/.well-known/trust-register` is mounted | `canonical-trust-route-map.md` row 5 (corrected) | TARGET | Same |
| 9 | `/trust` server component is mounted | `canonical-trust-route-map.md` row 6 (corrected) | TARGET | `apps/web/app/trust/` does not exist on `origin/main` |
| 10 | `/verify` institutional inspector is mounted | `canonical-trust-route-map.md` row 7 (corrected) | TARGET | `apps/web/app/verify/` does not exist on `origin/main`; the marketing app's `/verify/[shareId]` is a different domain |
| 11 | `/api/receipt/[npi]` issues ES256 receipts | `canonical-trust-route-map.md` row 8 (corrected) | TARGET | No handler on `origin/main` |
| 12 | `/api/receipt/by-lineage/[lineageKey]` resolves receipts by lineage key | `canonical-trust-route-map.md` row 9 (corrected) | TARGET | No handler on `origin/main` |
| 13 | Receipt `jti` is `'receipt:' + runId` (deterministic) | `MEMORY.md` carry, prior session summary | DRIFT | `replay-topology-gap-analysis.md` finds the only on-main signing path uses `jti = rcpt_<responseId>_<Date.now()>` — non-deterministic. Deterministic-jti receipts ship on unmerged #349. |
| 14 | Canonical replay identity scheme v1 (lineageKey + runId) is implemented | `MEMORY.md` carry | DRIFT | No `apps/api/backend/src/services/replay/replayIdentity.ts` on `origin/main`; no `apps/web/lib/replay/clientReplayIdentity.ts`. Identity scheme lives on an unmerged stack. |
| 15 | Replay Prisma model persists lineage records | implied by continuity claims | ORPHAN | `replay-topology-gap-analysis.md` §3: no `ReplayRun`, `Lineage`, or `LineageRun` model in `apps/api/backend/prisma/schema.prisma`; no `lineage_key` column anywhere |
| 16 | Receipt persistence layer exists | implied by continuity claims | DRIFT | Four receipt-shaped models exist (`PsvReceipt`, `VerificationReceiptRecord`, `AuditReceiptRecord`, `ReceiptCandidate`); none is keyed by `lineageKey`/`runId`; only `ReceiptCandidate.signedReceiptJwt` stores a JWT body |
| 17 | Chronology of runs per entity is queryable | implied by `RecentNpis` / `ReplayLineage` UI claims | DRIFT | Only `/api/decisions/npi/:npi/timeline` provides per-NPI ordering, keyed by `DecisionCapsule` not by lineage |
| 18 | Continuity reconciler answers "is receipt N continuous with N-1?" | implied by "lineage continuity" framing in prior session | ORPHAN | No reconciler exists. `replayEngine.ts:332-348` only performs single-capsule tamper checks |
| 19 | Public allowlist exposes `/trust` | `canonical-trust-route-map.md` "Operator promotion checklist" implies allowlist correctness | DRIFT | `apps/web/lib/auth/roles.ts:78-104` `PUBLIC_ROUTE_PATTERNS` does not include `/^\/trust(\/.*)?$/`. Middleware fall-through still passes `/trust` because no `PROTECTED_ROUTES` pattern catches it, but it is not explicitly allowlisted. The fix lives on an unmerged PR. |
| 20 | Legacy `/api/.well-known/jwks.json` is RFC-compliant | implied by "back-compat mirror" framing | DRIFT | The legacy handler emits `application/json` rather than `application/jwk-set+json` (IANA RFC 7517 §8.5.1). Strict OIDC clients may reject; the corrected media type ships on #349. |
| 21 | "Unavailable / Unknown" lane statuses on apex `/passport` are caused by missing demo seed in production DB | `MEMORY.md` carry from prior session | DRIFT | `runtime-gating-graph.md` §6 attributes the operator-reported state to the `LaneHealthMount` band, which is fed by `getLaneSnapshots.ts:42-66` returning four UNKNOWN seeds because **no probe runner is scheduled on apex** (requires `CRON_SECRET`/`MONITORING_SECRET`). The demo-seed issue is separate and affects in-stream `SourceRow` status, not the lane-health band. |
| 22 | The "20 PRs in flight" merge train will land institutional verifier on apex | prior session narrative | TARGET-CONDITIONAL | Conditional on (a) Codex SAFE verdicts visible in PR transcripts (operator-side), (b) the apex Vercel project gaining `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITALCV_ISSUER_ORIGIN`, `RECEIPT_PRIVATE_KEY_JWK`, `CRON_SECRET`/`MONITORING_SECRET` (operator-side), (c) production Railway DB receiving the demo seed (operator-side). None of these are product changes. |

**Summary:** of 22 enumerated claims, 2 ALIGNED, 12 TARGET (correctly framed as
unmerged in the corrected map), 7 DRIFT (claim is true in part but
overstated), 2 ORPHAN (claim has no runtime artifact at all).

---

## §2 — Orphan routes (deployed but undocumented)

Routes that exist on `origin/main` but no document in this branch describes:

| Route | File | Why it's an orphan |
|---|---|---|
| `/.well-known/apple-app-site-association` | `apps/web/app/.well-known/apple-app-site-association/route.ts` | Used by iOS for Universal Links. Not in `canonical-trust-route-map.md`. The handler advertises `/verify/*` as a deep-link target even though `/verify` does not exist on `origin/main` — when `/verify` ships on #345, iOS will resolve the Universal Link correctly; until then, deep-link clicks resolve to a 404. |
| `/.well-known/assetlinks.json` | `apps/web/app/.well-known/assetlinks.json/route.ts` | Android equivalent. Same orphan status. |
| `/api/receipts/verify` | `apps/web/app/api/receipts/verify/route.ts` | A verification endpoint (plural "receipts") distinct from the planned canonical singular `/api/receipt/[npi]` issuance endpoint. Not in any map. Naming-collision risk when #349 lands `/api/receipt/[npi]`. |
| `/api/.well-known/jwks.json` | `apps/web/app/api/.well-known/jwks.json/route.ts` | Legacy mirror. Map mentions it as "kept for back-compat" but does not document its current Content-Type non-compliance or the fact that, today, it is the only JWK Set surface on apex. |

**Fix recommendation:** extend `canonical-trust-route-map.md` to include a
"Mobile association manifests" subsection (AASA + assetlinks) and a
"Pre-existing receipt verification" subsection (`/api/receipts/verify`),
both with the caveat that they are pre-canonical surfaces.

---

## §3 — Orphan claims (documented but no handler)

Claims that documentation describes but `origin/main` has no artifact for.
This is the inverse of §2 and overlaps with the §1 TARGET / ORPHAN
classifications. Distinct from TARGET because TARGET claims have a clear
unmerged PR that will resolve them; ORPHAN claims have no plan.

| Claim | Source | What's missing | Plan to close |
|---|---|---|---|
| Replay Prisma model | `MEMORY.md`, prior summary | `ReplayRun` / `Lineage` model + migration | None on `origin/main`. `replay-topology-gap-analysis.md` §7 outlines a 6–7-PR plan starting with PR-α (schema + migration). |
| Continuity reconciler | implied by "lineage continuity" framing | `continuityReconciler` service that diffs two lineageKeys and reports artifact-delta | None on `origin/main`. Terminal node of the gap plan (PR-ζ in `replay-topology-gap-analysis.md`). |
| `/api/replay/[runId]` reader | implied by `replay-topology-gap-analysis.md` §2 | Handler + Prisma read path | None on `origin/main`; depends on Prisma model first. |
| `/api/lineage/[lineageKey]/runs` chronology reader | implied by `RecentNpis` UI primitive | Handler + ordered query | None on `origin/main`; depends on Prisma model first. |

---

## §4 — Impossible / unsupportable continuity claims

Claims whose semantics the persistence layer cannot answer today.

| Claim | Why it's impossible today | What would make it possible |
|---|---|---|
| "A verifier holding two receipts for the same entity can determine continuity from the receipts alone" | Receipts (even on unmerged #349) do not carry a `priorJti` / `priorLineageKey` claim. The lineageKey IS content-addressed over the artifact set, so two consecutive runs with the same artifact set produce the same key — but if any artifact churns, the key changes silently with no backward pointer. | (a) add `priorReceipt` claim to receipt payload, or (b) ship a server-side continuity reconciler endpoint that answers "given lineageKey A and B for entity E, what changed?" |
| "The chronology of runs for an entity is deterministic" | Only `/api/decisions/npi/:npi/timeline` provides ordering today, keyed by `DecisionCapsule` not by lineage. The artifact-set chronology inside `replayEngine.replayDecision` is reconstructed from `VerificationArtifact.createdAt` without an explicit tiebreaker — two artifacts with the same millisecond timestamp have undefined order. | Add an explicit `ORDER BY createdAt ASC, id ASC` tiebreaker in the replay engine, and expose a `/api/lineage/[lineageKey]/chronology` endpoint keyed by lineage rather than by decision. |
| "lineageKey is stable across deploys with the same artifact set" | Content-addressed identity is stable in principle, BUT if any backend canonicalization detail (whitespace, sort order, key encoding) drifts between releases, lineageKeys silently diverge. There is no versioned canonicalization contract on `origin/main`. | Pin the canonicalization to a versioned doc + parity test (the `docs/contracts/replay-identity-contract.md` referenced in `MEMORY.md` lives on an unmerged PR; that PR closes this gap). |
| "Receipts can be revoked or audited after issuance" | Receipts are signed on-demand from runtime state. They are not persisted by `jti`. There is no revocation list and no `Receipt` table keyed by issued `jti`. | Add a `ReceiptIssuance` Prisma model that records every issued `jti`, with a separate revocation list. Until then, "we issued receipt X at T" is unanswerable. |

---

## §5 — DRIFT consolidation

The 7 DRIFT classifications cluster into three families. Each family is a
truth-contract fix opportunity, not a code fix opportunity.

### Family A — "Mounted" claims that are TARGET-not-LIVE

Claims 4–12 in §1. Already corrected in the `canonical-trust-route-map.md`
truth-contract patch (commit `d7202754`); no further action needed unless
upstream docs in other branches repeat the same overclaim.

### Family B — "Implemented" claims for which only the contract exists

Claims 13, 14, 16. The receipt-jti, replay-identity, and receipt-persistence
claims are real on unmerged PRs but `MEMORY.md` and the prior session
narrative present them as `origin/main` reality. Fix: update `MEMORY.md`
entries to use "designed" / "scheduled" / "shipping on PR #N" language
rather than past-tense "implemented".

### Family C — Symptom misattribution

Claim 21 (apex "Unavailable" lanes). The operator's interpretation was a
missing demo seed in production; agent #1 §6 shows the actual cause is the
unscheduled probe runner. Fix: update operator runbook / `MEMORY.md` to name
both causes and note that the lane-health band is independent of the
in-stream `SourceRow` status.

---

## §6 — Recommended truth-contract corrections beyond #358

Already applied in `d7202754`:
- Reframed canonical route map as target topology with explicit "lives on
  PR #N (not yet on main)" annotations.

Still recommended (not yet applied):

1. **Extend the canonical map** with a "pre-canonical surfaces" subsection
   documenting AASA, assetlinks, and `/api/receipts/verify`. Cite their
   current behavior so they are not silent orphans.
2. **Update `MEMORY.md`** to flip past-tense implementation claims for the
   replay-identity, receipt-persistence, and signed-receipt-shape items to
   PR-target language, naming the specific PR for each.
3. **Open a one-line PR** that adds `/^\/trust(\/.*)?$/` to
   `PUBLIC_ROUTE_PATTERNS` in `apps/web/lib/auth/roles.ts` (currently
   missing per agent #5 finding; fix-up lives on unmerged #355 but the
   tree on `origin/main` is exposed to the gap until #355 lands).
4. **Document the `/api/receipts/verify` ↔ `/api/receipt/[npi]` naming
   collision** before #349 lands. A redirect or rename is cleaner than
   leaving two adjacent paths whose only differentiator is singular vs
   plural.

---

## §7 — What this audit does NOT cover

- **Payload field-level alignment** (whether each runtime payload carries
  every field the spec or UI consumer expects). That is the scope of the
  in-flight `replay-payload-schema-audit.md` (agent #6).
- **Per-fetch error-propagation traces**. Covered in
  `upstream-fetch-topology.md` §E.
- **Operator-side env / DB state verification**. Out of scope for an
  in-repo audit; flagged where it intersects (apex Vercel env vars,
  Railway demo seed, scheduled cron secrets).

---

## §8 — Single-page verdict

**Institutional claims do NOT fully align with `origin/main` runtime today.**
The misalignment is concentrated in three areas:

1. The 9 canonical verifier paths the in-repo map describes have no
   handlers on `origin/main`; they live on unmerged PRs #345 / #349 / #355.
   The route map is now (post-`d7202754`) honest about this.
2. Replay continuity claims (lineageKey, runId, receipt-by-lineage) have
   no persistence layer on `origin/main`; the persistence gap is mapped
   in `replay-topology-gap-analysis.md` §7 and requires 6–7 PRs.
3. The apex "Unavailable" lane symptom is misattributed in prior session
   memory; the real cause is the unscheduled probe runner, not the
   missing demo seed.

The fix path is doc-correction (Families A & C) plus the unmerged-PR
merge train (Family B). No new product code is required for claims to
align — the product code already exists on the unmerged stack; it just
hasn't shipped.
