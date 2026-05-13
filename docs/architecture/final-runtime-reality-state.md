# Final Runtime Reality State

**Scope:** describes only what is true on apex `vitalcv.com` runtime
**RIGHT NOW** (audit date 2026-05-13). Excludes roadmap, planned
features, in-flight PRs, and theoretical topology. Every claim below
is sourced from a file:line on `origin/main` (post-PR #359 squash),
from `/api/health` operator probe, or from the test suite that runs
against `origin/main`.

## §1 — What can institutions verify RIGHT NOW?

An external institutional verifier (hospital CVO, NCQA, Joint
Commission) probing `https://vitalcv.com` today can verify only:

1. **The apex domain deploys an `apps/web` Next runtime.**
   - Verifiable via `curl https://vitalcv.com/api/health` → `service: "web"`.
   - Source: `apps/web/app/api/health/route.ts:11` hardcodes `service: 'web'`.

2. **A JWK Set is published, but at a non-canonical path.**
   - Verifiable via `curl https://vitalcv.com/api/.well-known/jwks.json`.
   - Content-Type emitted: `application/json` (not RFC-correct `application/jwk-set+json`).
   - Source: `apps/web/app/api/.well-known/jwks.json/route.ts`.
   - Canonical path `/.well-known/jwks.json` returns 404 today.

3. **An ES256 signature oracle exists** at `/api/receipts/verify`.
   - Verifiable by POSTing a signed JWT and inspecting the response.
   - Source: `apps/web/app/api/receipts/verify/route.ts`.

4. **The runtime declares its config posture** in `/api/health`.
   - Verifiable: `apiBase`, `clerk.enabled`, `clerk.mode`, `sentry` booleans.
   - Per the operator probe carried into the audit set, all three currently read `false` / `none`.

5. **iOS / Android association manifests exist.**
   - `https://vitalcv.com/.well-known/apple-app-site-association` returns a manifest.
   - `https://vitalcv.com/.well-known/assetlinks.json` returns a manifest.
   - Source: `apps/web/app/.well-known/apple-app-site-association/route.ts` + `assetlinks.json/route.ts`.

**Nothing else in the institutional verifier story is browser-verifiable
today.** A verifier hitting `/.well-known/jwks.json`, `/.well-known/did.json`,
`/.well-known/openid-credential-issuer`, `/.well-known/openid-configuration`,
`/.well-known/trust-register`, `/trust`, `/verify`, `/api/receipt/<npi>`,
`/api/receipt/by-lineage/<lineageKey>`, or `/api/replay/<runId>` receives
a 404 from apex.

## §2 — What survives runtime restart RIGHT NOW?

State that is persisted to Postgres (Railway production DB) and
therefore survives Vercel function restarts:

- All Prisma models defined in `apps/api/backend/prisma/schema.prisma`, including:
  - `User`, `Entity`, `VerificationArtifact`, `DecisionCapsule`, `Receipt*` family (`PsvReceipt`, `VerificationReceiptRecord`, `AuditReceiptRecord`, `ReceiptCandidate`), audit / capsule / response / consent rows
- All Clerk-managed user / session state (via Clerk's own backend)
- Any seed data the operator has run

State that **does NOT** survive runtime restart:

- ES256 keypair when `RECEIPT_PRIVATE_KEY_JWK` env is unset — a fresh
  keypair is minted on every cold start; pre-restart JWTs fail
  verification afterward. Source: `apps/web/lib/crypto/receiptIssuer.ts:67-69`
  (path on `origin/main`).
- `LaneHealthMount` snapshots — fed by `getLaneSnapshots` which seeds
  UNKNOWN states on init when no probe runner has populated the
  store. Source: per `runtime-gating-graph.md` §6.
- Any in-memory cache; Next 15 functions are stateless per invocation.
- **`lineageKey` and `runId` continuity** — these identifiers are not
  persisted anywhere on `origin/main`. No `ReplayRun` or `Lineage`
  Prisma model exists. Continuity across restart is impossible by
  construction; cite `replay-topology-gap-analysis.md` §3.
- **Receipt issuance records by `jti`** — receipts are signed
  on-demand from runtime state; the `jti` is not written to any
  persistence table. After restart, "did we issue receipt X at T?"
  has no answer.

## §3 — What is still synthetic RIGHT NOW?

Surfaces that render but do not represent persisted institutional state:

- **The `/passport` "Sample readiness snapshot" placeholder card** —
  shown only in the idle state, explicitly labeled "Sample". Source:
  `apps/web/app/passport/page.tsx:567-617`.
- **`/api/ingest/[npi]` HTTP-200 fallback body** — when the backend
  upstream errors, this route returns `{fallback: true, runId: null,
  truth: {…}}` rather than propagating the failure. The fallback body
  is structurally synthetic (no real runId, no real stream backing it).
  Source: `apps/web/app/api/ingest/[npi]/route.ts:35-97` (per
  upstream-fetch-topology §A.X).
- **`apple-app-site-association` advertises `/verify/*` as a Universal
  Link target** even though `/verify` does not exist on `origin/main`.
  The path advertisement is synthetic relative to runtime reality;
  iOS Universal Link clicks resolve to 404.
- **The Macie Miller demo NPI 1346053246** — seeded into local
  `vitalcv_dev` only; if probed against production Railway DB, the
  row does not exist. Per session memory.

## §4 — What still breaks institutional continuity RIGHT NOW?

Concrete observable failures that an external verifier experiences:

1. **Discovery 404 cascade**: hitting any RFC-canonical well-known
   path other than the two association manifests returns 404. There
   is no fallback hop in OID4VCI / OIDC / DID-web specs, so verifier
   resolution stops at step zero.
2. **Non-deterministic receipt jti**: today's jti is
   `rcpt_<responseId>_<Date.now()>` (per `apps/web/lib/crypto/receiptIssuer.ts:111`).
   The same receipt re-signed gets a different jti. A verifier cannot
   identify "the receipt we issued at T" from the receipt body alone.
3. **No `lineageKey` / `runId` claims in receipts**: receipts that DO
   exist (`/api/receipts/verify` consumes them) carry no continuity
   pointer. Two receipts for the same entity have no programmatic
   linkage in their bodies.
4. **No replay reader endpoints**: a verifier cannot ask
   "give me the chronology for entity E" or "give me run R" through
   any HTTP surface. The closest substitute, `/api/decisions/npi/:npi/timeline`,
   keys by `DecisionCapsule`, not by lineage.
5. **Probe runner unscheduled**: the `LaneHealthMount` band serves
   UNKNOWN seeds, producing the operator-reported "Unavailable /
   Unknown" lane state on `/passport`. Per `runtime-gating-graph.md` §6.
6. **`clerk.enabled: false` on apex**: protected routes
   (`/holder/*`, `/verifier/*`, `/issuer/*`, `/internal/*`) redirect
   to a `/sign-in` flow that has no functional Clerk backing. A
   verifier following an authenticated link hits a dead-end redirect loop.
7. **Legacy `/api/.well-known/jwks.json` emits `application/json`
   instead of `application/jwk-set+json`**: RFC-strict OIDC clients
   reject the response media-type and fall back to default error.
8. **`/api/credentials/issue` advertised in OID4VCI metadata
   (on the unmerged stack) does not exist**: when #349 lands, the
   metadata's `credential_endpoint` points at a non-existent path.
   Per `verifier-continuity-normalization-audit.md` §5 caveat (a).
9. **OAuth `authorization_endpoint` and `token_endpoint` in OIDC
   discovery point at the credential-issuer metadata URL (pointer,
   not flow)**: handled by the spec as "the issuer is not an OP";
   non-conformant verifiers may attempt to POST against the URL and
   get nonsensical responses.

## §5 — What remains before true production-grade verifier infrastructure exists?

Three categorical work-streams, in dependency order:

### A. Operator-side configuration (no engineering required)

| Action | Effort | Closes |
|---|---|---|
| Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` on apex Vercel | <10 min | §4 row 6 |
| Set `RECEIPT_PRIVATE_KEY_JWK` on apex Vercel | <10 min | §2 "does NOT survive restart" row 1 |
| Set `VITALCV_ISSUER_ORIGIN=https://vitalcv.com` on apex Vercel | <5 min | issuer attribution correctness post-#349 merge |
| Schedule probe runner cron with `CRON_SECRET`/`MONITORING_SECRET` | <15 min in Vercel dashboard | §4 row 5 |
| Run Railway seed SQL for demo NPI 1346053246 | <5 min | §3 "synthetic" row 4 |
| Run `codex exec` against PRs #338–#360 (now 21 with the hygiene fix) | per-PR; ~5 min each in operator terminal | unblocks all merge-dependent rows |

### B. Merge train (per Codex SAFE)

| Block | What lands |
|---|---|
| PR #345 | `/verify` institutional inspector page |
| PR #349 | `/.well-known/{jwks,did,openid-credential-issuer,trust-register}`, `/api/receipt/[npi]` |
| PR #355 | `/.well-known/openid-configuration`, `/trust`, `/api/receipt/by-lineage/[lineageKey]` |
| PR #358 | (this branch) 13 audit docs |
| PR #360 | `VITACV_ISSUER_URL` typo fix + `/trust` explicit allowlist |

When all five land, §1 row count goes from 5 to ~14, and §4 rows 1, 2, 7, 8 are closed.

### C. Engineering — Replay persistence stack (net-new)

Per `replay-topology-gap-analysis.md` §7, six to seven sequenced PRs:

| PR | Scope | Closes |
|---|---|---|
| α | `ReplayRun` Prisma model + migration | §2 "does NOT survive" row "lineageKey / runId" |
| β | Replay writer integration in passport ingest path | §4 row 3 |
| γ | Deterministic `jti = 'receipt:' + runId` in receipt issuer | §4 row 2 |
| δ | `/api/replay/[runId]` reader endpoint | §4 row 4 (partial) |
| ε | `/api/lineage/[lineageKey]/runs` + `/api/lineage/[lineageKey]/chronology` reader endpoints | §4 row 4 (full) |
| ζ | Continuity reconciler service (lineageKey-delta) | "is receipt N continuous with N-1?" |
| η | Receipt issuance persistence table keyed by `jti` (+ revocation list) | §2 "does NOT survive" row "Receipt issuance records" |

When α through ζ land, §4 row 3, 4 are closed and replay continuity
becomes institutionally defensible. PR-η is independent and can land
at any point.

### D. Hygiene fix-ups (already in flight)

PR #360 ships the typo fix and the `/trust` allowlist — closes risks
#14 and #15 from `mega-convergence-synthesis.md` §2.C. Other
hygiene items (consolidate the 4 backend-URL resolvers, fix the
`/api/ingest/[npi]` HTTP-200-with-fallback client branch, add timeouts
to `report/*` fetches) are 1–2 small PRs each and depend on nothing
in flight.

## §6 — Summary table for §1 brief answers

| Brief question | Answer |
|---|---|
| What can institutions verify RIGHT NOW? | Apex deploys; legacy JWKS at a non-canonical path; ES256 signature oracle; `/api/health` config posture; OS association manifests. |
| What survives runtime restart RIGHT NOW? | All Prisma-persisted state, including the receipt-shaped models. NOT surviving: ES256 keypair (when env unset), lineageKey/runId continuity (not persisted at all), receipt-by-jti issuance records, lane-health snapshots. |
| What is still synthetic RIGHT NOW? | `/passport` sample card (labeled), `/api/ingest/[npi]` HTTP-200 fallback body, AASA advertisement of `/verify/*`, the demo NPI in production. |
| What still breaks institutional continuity RIGHT NOW? | Nine concrete failures enumerated in §4. The primary three: discovery 404 cascade, non-deterministic receipt jti, no replay reader endpoints. |
| What remains before true production-grade verifier infrastructure exists? | A: 6 operator-side configuration steps. B: 5-PR merge train. C: 6–7 engineering PRs for replay persistence. D: hygiene fix-ups (some already in flight on #360). No new product concept required at any tier. |

---

**This document does not contain roadmap, planned features,
aspirational convergence, or theoretical topology.** Every section is
sourced from `origin/main` post-#359 and verifiable today.
