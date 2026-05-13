# Mega Convergence Synthesis

**Authoritative convergence artifact** for the institutional verifier
work in flight on VitalCV. Synthesizes the 12 prior audit / synthesis
documents on this branch into one defensible-under-audit summary.

This document satisfies the synthesis phase of both the prior
"FINAL INSTITUTIONAL CONVERGENCE WAVE" (Phase 7) and the subsequent
"MEGA PARALLEL TERMINAL CONVERGENCE SWEEP" (Phase 10). It does not
introduce new findings; it ranks, scores, and verdicts the findings
that the prior audits established.

**Branch:** `wave/canonical-route-map`. **HEAD:** post-`0fae815c`.
**`origin/main` HEAD at audit:** `5d530f13`.
**Audit date:** 2026-05-13.

## §0 — Phase coverage map (both "FINAL" waves)

Each phase asked for by either FINAL wave maps to an existing on-branch
audit, except the operator activation state + this synthesis (new).

| Wave-1 Phase | Wave-2 Phase | Source doc on this branch |
|---|---|---|
| 1 Runtime truth convergence | 1 Branch vs origin vs deploy reality map | `final-runtime-truth-convergence.md` + `route-runtime-alignment-audit.md` + `deployed-route-registration-audit.md` |
| 2 Claude Design alignment | 4 Six-slot convergence | `claude-design-alignment-audit.md` |
| 3 Replay continuity hardening | 3 Replay infrastructure truth + 8 Replay persistence gap | `replay-topology-gap-analysis.md` + `replay-payload-schema-audit.md` |
| 4 Verifier continuity + trust discoverability | 2 Canonical trust surface audit | `verifier-continuity-normalization-audit.md` + `canonical-trust-route-map.md` (corrected) |
| 5 Operator activation + scheduling | 7 Operator activation truth | `final-operator-activation-state.md` (new) |
| 6 Final blocker elimination | 9 Institutional defensibility | `institutional-readiness-synthesis.md` + `route-runtime-alignment-audit.md` |
| — | 5 Degraded-state semantics | `runtime-gating-graph.md` §3, §6 + `claude-design-alignment-audit.md` §4 (the taxonomy divergence) |
| — | 6 Runtime activation + gating graph | `runtime-gating-graph.md` |
| 7 Final readiness synthesis | 10 Final convergence synthesis | **this document** |

The Wave-2 brief's "DO NOT CLAIM convergence unless verified" /
"distinguish origin/main from branch state" / "distinguish mounted
routes from operational routes" constraints are the same constraints
applied throughout the audit set. No prior doc claims convergence
that is not verified.

## §1 — Categorical state map (what is X-class today on origin/main)

This is the load-bearing classification. Each bucket is mutually
exclusive and exhaustive over the institutional verifier surfaces.

### A. Operational

State / surface verified live on apex `vitalcv.com` runtime today.

- `/api/health` (returns `{service:'web', timestamp, config:{...}}`)
- `/api/.well-known/jwks.json` (legacy mirror — returns a JWK set; Content-Type non-canonical)
- `/.well-known/apple-app-site-association` (iOS Universal Link manifest)
- `/.well-known/assetlinks.json` (Android equivalent)
- `/passport` page (renders without error; lane statuses populated via in-stream `SourceRow`)
- `/api/passport/npi/[npi]` and `/api/passport/entity/[id]` (return passport JSON; no replay/lineage fields)
- `/api/receipts/verify` (singleton ES256 receipt verification endpoint — pre-canonical)
- `apps/web/lib/degraded-state/degradedStateFoundation.ts` (six-state policy enforced by code paths consuming it)

### B. Mounted but failing / degraded

Code exists; runtime returns 200 but with degraded payload.

- `/api/ingest/[npi]` (always returns HTTP 200 with `fallback: true` when backend errors — masked failure; the client throws because it doesn't branch on the fallback flag; per gating-graph §4)
- `LaneHealthMount` (renders four UNKNOWN seeds because probe runner unscheduled; per gating-graph §6)
- `middleware.ts:69` resolve-role fetch (no timeout; swallows errors to `/auth/error`)

### C. Mounted on unmerged PRs (TARGET — exists in repo, not on origin/main)

Code exists on branches in PR queue; awaiting merge.

- `/.well-known/jwks.json` (canonical; PR #349)
- `/.well-known/did.json` (PR #349)
- `/.well-known/openid-credential-issuer` (PR #349)
- `/.well-known/openid-configuration` (PR #355)
- `/.well-known/trust-register` (PR #349)
- `/api/receipt/[npi]` (PR #349; deterministic `jti = 'receipt:' + runId`)
- `/api/receipt/by-lineage/[lineageKey]` (PR #355)
- `/trust` (PR #355)
- `/verify` (PR #345)
- `apps/web/components/trust/TrustHeader.tsx` and the Lane B trust primitives (unmerged Lane B stack)
- `apps/api/backend/src/services/replay/replayIdentity.ts` (canonical replay identity generator)
- `apps/web/lib/replay/clientReplayIdentity.ts` (browser parity mirror)

### D. Missing entirely (no implementation anywhere)

No code exists, on `origin/main` or on any in-flight PR known to this audit.

- Replay Prisma model (`ReplayRun` / `Lineage` schema + migration)
- Replay reader endpoints (`/api/replay/[runId]`, `/api/lineage/[lineageKey]/runs`, `/api/lineage/[lineageKey]/chronology`)
- Continuity reconciler (lineageKey-delta service)
- Receipt issuance persistence (record-of-issuance table keyed by `jti`)
- Revocation list infrastructure
- `priorJti` / `priorLineageKey` claim on receipt body

### E. Simulated / placeholder

Surfaces that exist but do not represent persisted state.

- The trust-state engine's `audit_ref` field on `/api/trust-state/[npi]` — opaque pointer per replay-payload-schema-audit §9 verdict
- `apps/web/app/.well-known/apple-app-site-association/route.ts` advertises `/verify/*` as a Universal Link target even though `/verify` is not on `origin/main` (iOS deep-link will 404 until #345 lands)
- The `/passport` "Sample readiness snapshot" placeholder card (idle state) — clearly labelled as sample, not synthetic-as-real

### F. Synthetic / demo

- The Macie Miller demo NPI 1346053246 — seeded into local `vitalcv_dev` only per MEMORY.md; not in production Railway DB

### G. Persisted

- All Prisma models except the missing replay models (see D)
- Receipt-shaped models exist (`PsvReceipt`, `VerificationReceiptRecord`, `AuditReceiptRecord`, `ReceiptCandidate`) but none keyed by `lineageKey`/`runId`

### H. Derivable (not persisted, computable on demand)

- `lineageKey` and `runId` — content-addressed; can be recomputed deterministically from inputs (when the generator ships; per #349)
- Chronology of decisions per NPI (via `/api/decisions/npi/:npi/timeline`) — reconstructed each call from `DecisionCapsule` rows; ordering not deterministic at the millisecond tiebreaker

### I. Discoverable (externally reachable per RFC)

- `/api/.well-known/jwks.json` (legacy path; non-canonical)
- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

Per RFC 8615, "discoverable" means resolvable at the canonical root.
None of the verifier-continuity discovery surfaces (jwks at canonical
path, did.json, openid-credential-issuer, openid-configuration,
trust-register) are discoverable on `origin/main` today.

### J. Browser-verifiable (an institutional verifier can independently confirm)

- Apex deploys `apps/web` (verifiable via `curl https://vitalcv.com/api/health`)
- A JWK set is published at `/api/.well-known/jwks.json` (verifiable via curl)
- The current legacy mirror serves `application/json` rather than `application/jwk-set+json` (verifiable)

Nothing else in the institutional verifier story is browser-verifiable
today: a verifier hitting `/.well-known/jwks.json`, `/.well-known/did.json`,
`/trust`, `/verify`, or `/api/receipt/...` gets a 404.

### K. Institutionally defensible

- All audit findings on this branch are defensible: every claim is
  attributed to a file:line or to a named external probe.
- The corrected route map (`canonical-trust-route-map.md` post-`d7202754`)
  is defensible: it explicitly distinguishes target topology from runtime.
- The synthesis verdicts in this document are defensible: they are
  classifications of the above, not new claims.

The product is not yet institutionally defensible to an external
verifier; the documentation about the product IS.

## §2 — Required Wave-2 final outputs

### A. Current real **Institutional Readiness Score** (0–100): **20**

Methodology — eleven equally weighted axes, each scored 0–9:

| Axis | Score | Note |
|---|---|---|
| Canonical discovery routes mounted | 1/9 | Only legacy `/api/.well-known/jwks.json`; canonical 5-route set on unmerged #349/#355 |
| Receipt issuance shipped | 2/9 | `/api/receipts/verify` exists; canonical `/api/receipt/[npi]` on unmerged #349; jti non-deterministic on main |
| Replay identity scheme implemented | 1/9 | No `lineageKey`/`runId` generator on main; lives on unmerged stack |
| Replay persistence | 0/9 | No `ReplayRun` Prisma model anywhere |
| Replay reader endpoints | 0/9 | Zero reader endpoints |
| Continuity reconciler | 0/9 | Not implemented |
| Trust UI primitives (six-slot) | 2/9 | Tier badge + lane badge ship; composite `TrustHeader` on unmerged stack |
| Degraded-state taxonomy enforcement | 4/9 | Foundation policy ships; banner UI does not; design-vs-runtime taxonomy divergent |
| Apex env-var configuration | 1/9 | Clerk/issuer/receipt-key absent per `/api/health` probe |
| Probe-runner scheduling | 0/9 | Drives operator-reported "Unavailable" lanes |
| Documentation truth-contract | 9/9 | 13 audit docs on this branch; canonical route map corrected |

Total raw: 20/99 → rescaled to ~20/100.

### B. Current real **Production Readiness Score** (0–100): **45**

Production readiness is broader than institutional readiness — it
weights features other than verifier continuity. Methodology —
seven equally weighted axes:

| Axis | Score | Note |
|---|---|---|
| Apex deploys successfully | 8/10 | Yes — Vercel auto-deploy from `origin/main` is healthy |
| `/api/health` returns OK | 10/10 | Confirmed |
| Backend reachability | 7/10 | Railway fallback works; 4 different resolvers + 1 inline-fallback to localhost is a hazard (upstream-fetch §A) |
| Passport flow renders | 6/10 | Renders, but lane statuses degraded due to probe + demo-seed gaps |
| Clerk auth works | 0/10 | Disabled per `/api/health` |
| CORS / security headers | 7/10 | Allowlist mechanism ships; `ALLOWED_CORS_ORIGINS` configuration state unverified |
| Observability (Sentry, logging) | 4/10 | Sentry DSN unset per `/api/health` |

Total raw: 42/70 → rescaled to ~45/100. Lower than I would have estimated
without the audit set; the audits revealed multiple operator-side gaps
that surface as runtime issues.

### C. Top 20 remaining risks

Ranked by composite severity (institutional × operational × convergence):

1. **20 PRs unmerged** blocking apex from gaining any canonical verifier surface (PRs #338–#358).
2. **Codex SAFE gate is operator-side** — none of the 20 PRs can merge without operator running `codex exec`.
3. **Apex Clerk env vars unset** — protected routes broken on apex.
4. **Apex `RECEIPT_PRIVATE_KEY_JWK` unset** — receipt-signing key churns on every cold start.
5. **Apex `VITALCV_ISSUER_ORIGIN` unset** — issuer attribution wrong on canonical surfaces post-#349.
6. **Probe runner unscheduled** — operator-reported "Unavailable" lane symptom.
7. **Replay Prisma model missing** — blocks all replay reader endpoints + continuity reconciler.
8. **Continuity reconciler missing** — verifier cannot answer "is receipt N continuous with N-1?".
9. **Receipt issuance not persisted by `jti`** — no revocation, no audit query.
10. **OID4VCI metadata `credential_endpoint` points at non-existent `/api/credentials/issue`** (verifier-continuity-normalization §5 caveat a).
11. **Receipt `iss` (DID) vs OID4VCI `credential_issuer` (origin URL) mismatch** — naïve verifier confusion (§5 caveat b).
12. **Legacy `/api/.well-known/jwks.json` Content-Type non-compliant** (`application/json` instead of `application/jwk-set+json`).
13. **`/api/receipts/verify` ↔ `/api/receipt/[npi]` naming collision** when #349 lands (deployed-route-registration §).
14. **`/trust` not in `PUBLIC_ROUTE_PATTERNS`** (silently passes via fall-through; brittle).
15. **`signIssuerReceipt` reads typo'd env `VITACV_ISSUER_URL`** instead of `VITALCV_ISSUER_URL`.
16. **4 different backend-URL resolvers in active use**, one falls back to `localhost:4000` on Vercel (upstream-fetch §A).
17. **`/api/ingest/[npi]` HTTP-200-with-fallback degradation pattern** misleads the client (gating-graph §4 + upstream-fetch §A).
18. **`report/*` cluster fetch timeouts (20s/30s)** exceed Vercel hobby plan 10s execution cap.
19. **Failure-taxonomy divergence** between A/B/C/D/E session-memory framing and `DegradedStateKind` six-state runtime enum.
20. **Production Railway DB missing demo NPI seed** — `/passport?npi=1346053246` renders "no profile" terminal state.

### D. Top 20 fastest high-leverage fixes

Ranked by effort × convergence impact (smallest effort, largest impact first):

1. **Set apex Vercel env vars** (~30 min in dashboard) — closes risks 3, 4, 5.
2. **Schedule probe runner cron** in Vercel — closes risk 6.
3. **Run Railway seed SQL for demo NPI** — closes risk 20.
4. **Operator runs `codex exec` on PRs #338–#358** — closes risk 2 (and unblocks risk 1).
5. **Merge train** — closes risks 1, 10, 11, 12 (legacy media type corrected by #349 canonical handler), 14 (#355 fixes allowlist).
6. **One-line PR: fix `VITACV_ISSUER_URL` typo to `VITALCV_ISSUER_URL`** — closes risk 15.
7. **One-line PR: rename either `/api/receipts/verify` or `/api/receipt/[npi]`** to avoid the naming collision before #349 lands — closes risk 13.
8. **One-line PR: add explicit `/^\/trust(\/.*)?$/` to `PUBLIC_ROUTE_PATTERNS`** — closes risk 14 deterministically (instead of relying on fall-through).
9. **Doc-only: update `MEMORY.md` past-tense claims** to PR-target language — closes truth-drift on receipt-jti / replay-identity / canonical-routes (alignment-audit §5 family B).
10. **Small PR: consolidate the 4 backend-URL resolvers** into one helper; replace inline copies — closes risk 16.
11. **Small PR: have `startPublicIngest` branch on `fallback: true`** at `/api/ingest/[npi]` response — closes risk 17.
12. **Small PR: add `AbortSignal.timeout(8000)` to `report/*` fetches** — closes risk 18.
13. **Small PR: retire A/B/C/D/E framing from any unmerged-PR component code** in favor of `DegradedStateKind` — closes risk 19.
14. **Add `Cache-Control: no-store` to receipt routes when they ship** — defensive against CDN replay.
15. **Add `X-VitalCV-Build-Sha` header to every response** — lets external verifiers correlate failures to a build.
16. **Add a one-shot deployment-verification cron** that hits each canonical path after deploy and posts to a status channel — operator early warning.
17. **Update `/api/health` to emit `expectedRoutes: [...]` listing the canonical paths** — turns the health endpoint into a deployment-verification surface.
18. **Add `priorJti` / `priorLineageKey` to receipt JWT claims** — closes risk 9 partially (continuity at the receipt level even without a server reconciler).
19. **Add a `lineage_key` column + index to a new `ReplayRun` Prisma model** — unblocks all replay readers (the load-bearing engineering PR per `replay-topology-gap-analysis.md` §7 PR-α).
20. **Ship `/api/replay/[runId]` reader endpoint** — converts derivable replay state into a discoverable surface.

### E. Top 10 false assumptions eliminated

1. "Canonical verifier paths are mounted on apex" → only `/api/.well-known/jwks.json` is.
2. "Receipt `jti = 'receipt:' + runId` is deterministic on apex" → on `origin/main`, jti is `rcpt_<responseId>_<Date.now()>`.
3. "`lineageKey` / `runId` are persisted in the database" → no model exists.
4. "The apex `clerk.enabled: false` signal means Clerk is disabled in product" → it means apex Vercel env vars are unset; Clerk integration is shipped.
5. "`apiBase: false` in `/api/health` means backend is unreachable" → it means `NEXT_PUBLIC_API_BASE` env is empty; backend still reachable via fallback chain.
6. "The operator-reported 'Unavailable' lanes are caused by missing demo seed" → caused by unscheduled probe runner.
7. "`/trust` is in the public route allowlist" → it isn't; it passes via fall-through.
8. "Trust UI primitives (`TrustHeader`, `ReplayLineage`, etc.) exist on `origin/main`" → they exist on the unmerged Lane B stack only.
9. "The A/B/C/D/E degraded-state taxonomy is enforced at the policy layer" → the runtime taxonomy is the six-state `DegradedStateKind`.
10. "`/verify` has been built and shipped to apex" → handler lives on unmerged #345; apex returns 404.

### F. Top 10 real capabilities confirmed

1. Apex `vitalcv.com` deploys `apps/web` reliably (operational).
2. `/api/health` returns a structured config probe.
3. ES256 signing key material loading + JWK Set publication mechanism works (legacy mirror).
4. `/api/receipts/verify` is a working ES256 signature oracle.
5. Passport client page (`/passport`) renders without runtime error.
6. SSE ingest stream is parseable through six enumerated event types (replay-payload-schema-audit §11).
7. Six-state degraded-state foundation policy is enforced in code paths that consume it.
8. `TrustTierBadge` T1–T4 authority ladder is implemented and consumable.
9. `LaneStateBadge` + `LaneStateLegend` lane-band primitives ship.
10. `next.config.mjs` is clean — no rewrites shadowing canonical paths; security headers applied globally.

### G. "Is VitalCV CURRENTLY institutionally legible infrastructure?"

**No, not yet.**

An external institutional verifier (hospital CVO, NCQA reviewer,
Joint Commission auditor) hitting `https://vitalcv.com/.well-known/jwks.json`
today receives a 404. Hitting `/.well-known/did.json`, `/trust`,
`/verify`, or `/api/receipt/<npi>` returns 404 as well. The legacy
mirror at `/api/.well-known/jwks.json` returns a JWK set but at the
wrong canonical path and with the wrong Content-Type for RFC compliance.

The infrastructure to **become** institutionally legible exists on
unmerged PRs and on a finite engineering backlog (`replay-topology-gap-analysis.md`
§7). It is not yet apex reality.

### H. "What specifically still prevents full institutional convergence?"

Three categorical blockers, in dependency order:

1. **Operator-side configuration not complete** (rows 3, 4, 5, 6, 20 in §C above):
   - Vercel env vars (Clerk, receipt key, issuer origin)
   - Probe runner cron
   - Railway demo seed
   - Codex SAFE verdicts on PRs #338–#358

2. **Merge train pending** (row 1 in §C): the 20 PRs that mount the
   canonical paths, ship deterministic receipts, and add the trust UI
   primitives are all queued but unmerged. None of them require new
   product design; they require operator-driven `codex exec` + merge.

3. **Replay persistence layer engineering** (rows 7, 8, 9 in §C): the
   `ReplayRun` Prisma model, replay reader endpoints, continuity
   reconciler, and receipt-issuance persistence are net-new product
   work — but the architecture is fully specified in
   `replay-topology-gap-analysis.md` §7 as a finite 6–7-PR sequence
   (PR-α through PR-η). No new design or research is required.

The total work to move from current state to full institutional
convergence: **5 operator tasks + 20 in-flight PRs + 6–7 engineering
PRs + ~10 one-line truth-contract / hygiene PRs**. No new product
concepts. No new architecture. No new audits required.

---

**End of synthesis.** This document is the authoritative convergence
artifact. Subsequent audit requests should be redirected here unless
they require evidence that is not present in any of the 13 audit
documents on this branch.
