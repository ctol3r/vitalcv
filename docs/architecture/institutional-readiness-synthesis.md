# Institutional Readiness Synthesis

**Branch:** `wave/canonical-route-map`
**Inputs synthesized:** `runtime-gating-graph.md`, `upstream-fetch-topology.md`,
`replay-topology-gap-analysis.md`, `deployed-route-registration-audit.md`,
`verifier-continuity-normalization-audit.md`, `route-runtime-alignment-audit.md`,
`canonical-trust-route-map.md` (post-correction).

## Purpose

Single ranked-blocker view across all six in-flight institutional-readiness
audits. Each blocker is ranked by **operational severity** (impact on apex
runtime), **institutional severity** (impact on external verifier usability),
and **convergence severity** (whether closing it unblocks other blockers).

Each blocker carries an **owner** classification:

- **OPS** — operator-side (Vercel env, Railway DB, cron secrets, scheduled
  jobs). Cannot be done from a code PR.
- **MERGE** — product change exists on an unmerged PR; gated by Codex SAFE +
  the merge train.
- **CODE** — no implementation exists; requires net-new product change.
- **DOC** — truth-contract / framing fix; no runtime impact, but corrects
  what the next reader will believe.

---

## §1 — Severity matrix

| # | Blocker | Op-sev | Inst-sev | Conv-sev | Owner | Source |
|---|---|---|---|---|---|---|
| 1 | Apex Vercel missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` | HIGH | HIGH | HIGH | OPS | gating-graph §2, alignment §1 row 3 |
| 2 | Apex Vercel missing `RECEIPT_PRIVATE_KEY_JWK` | HIGH | HIGH | HIGH | OPS | gating-graph §6 (cold-start fresh keypair) |
| 3 | Apex Vercel missing `VITALCV_ISSUER_ORIGIN` | MED | HIGH | MED | OPS | normalization-audit §5, gating-graph §6 |
| 4 | Apex probe runner unscheduled (no `CRON_SECRET`/`MONITORING_SECRET`) — LaneHealthMount renders UNKNOWN | HIGH | HIGH | MED | OPS | gating-graph §6 (this is the operator's "Unavailable" symptom — NOT the demo-seed gap) |
| 5 | Production Railway DB missing demo NPI seed (1346053246 = Macie Miller, PA-C) | HIGH | MED | LOW | OPS | MEMORY.md carry, gating-graph §3 |
| 6 | 20+ unmerged PRs (#338–#358) blocking apex from gaining any canonical verifier surface | CRITICAL | CRITICAL | CRITICAL | MERGE | alignment-audit §1 rows 4–12 + 13–14 |
| 7 | Codex SAFE verdicts required on each PR before merge hook fires | CRITICAL | — | CRITICAL | OPS (operator runs `codex exec`) | MEMORY.md, wave-execution skill |
| 8 | Replay Prisma model (`ReplayRun` / `Lineage`) does not exist | HIGH | HIGH | CRITICAL | CODE | replay-topology §3 |
| 9 | Replay reader endpoints (`/api/replay/[runId]`, `/api/lineage/[lineageKey]/runs`, `/api/lineage/[lineageKey]/chronology`) do not exist | HIGH | HIGH | HIGH | CODE | replay-topology §2 |
| 10 | Continuity reconciler (lineageKey-delta service) does not exist | MED | HIGH | MED | CODE | replay-topology §6 |
| 11 | Receipt issuance is not persisted by `jti` (no revocation, no audit query) | MED | HIGH | MED | CODE | alignment §4, replay-topology §4 |
| 12 | OID4VCI `credential_endpoint` points at non-existent `/api/credentials/issue` (real receipts are at `/api/receipt/[npi]`) | LOW | MED | LOW | CODE / DOC | normalization-audit §5 caveat (a) |
| 13 | Receipt `iss` (DID) vs OID4VCI `credential_issuer` (origin URL) mismatch — verifier must understand `did:web:` resolution | LOW | LOW | LOW | DOC | normalization-audit §5 caveat (b) |
| 14 | `signIssuerReceipt` reads typo'd env var `VITACV_ISSUER_URL` (should be `VITALCV_ISSUER_URL`) | LOW | LOW | LOW | CODE | normalization-audit §5 caveat (c) |
| 15 | `/api/receipts/verify` (plural) ↔ `/api/receipt/[npi]` (singular) naming collision when #349 lands | MED | LOW | LOW | CODE | deployed-route-registration §, alignment §2 |
| 16 | `/trust` not in `PUBLIC_ROUTE_PATTERNS` (passes through middleware only because no PROTECTED pattern catches it) | MED | LOW | LOW | MERGE (#355 fixes it) | deployed-route-registration §, alignment §1 row 19 |
| 17 | Legacy `/api/.well-known/jwks.json` emits `application/json` instead of `application/jwk-set+json` | LOW | MED | LOW | MERGE (#349 corrects via canonical handler) | deployed-route-registration §, alignment §1 row 20 |
| 18 | 4 different backend-URL resolvers in active use (one falls back to `localhost:4000` when env unset) | MED | LOW | LOW | CODE | upstream-fetch §A (resolver inventory) |
| 19 | `middleware.ts:69` resolve-role fetch has no timeout, swallows errors to `/auth/error` redirect | MED | LOW | LOW | CODE | upstream-fetch §D, gating-graph §2 |
| 20 | `/api/ingest/[npi]` masks failures as HTTP 200 + `fallback:true`; client throws because it doesn't branch on the fallback flag | MED | MED | LOW | CODE | upstream-fetch §A.X (degradation pattern), gating-graph §4 |
| 21 | `report/*` cluster fetches use 20s/30s timeouts that exceed Vercel hobby 10s execution cap | LOW | LOW | LOW | CODE | upstream-fetch §A |
| 22 | `MEMORY.md` past-tense claims for replay-identity / receipt-persistence / canonical routes do not match `origin/main` | — | — | MED | DOC | alignment §5 family B |

---

## §2 — Ranked by operational severity (apex runtime impact)

1. **#6 / #7** — Merge train. Until PRs land, no canonical verifier surface
   exists on apex. Codex SAFE is the binding gate; operator-side.
2. **#1 / #2 / #4** — Apex env vars. Even if every PR merges, apex remains
   degraded without Clerk, ES256 signing key, and the probe-runner cron.
3. **#3 / #5** — `VITALCV_ISSUER_ORIGIN` + Railway demo seed. Required for
   correct issuer attribution and for the institutional demo flow to render
   a populated provider.
4. **#8** — Replay Prisma model. Until this exists, lineageKey persistence
   is impossible regardless of merge state; receipt-by-lineage cannot
   actually retrieve.
5. **#15 / #16 / #17 / #19 / #20** — Routing / middleware fix-ups. Each is
   low-individual-impact but contributes to verifier-side confusion.

---

## §3 — Ranked by institutional severity (verifier usability impact)

1. **#6** — No canonical verifier paths on `origin/main`. An external
   verifier hitting `https://vitalcv.com/.well-known/openid-credential-issuer`
   today gets a 404, breaking OID4VCI discovery flow at step zero.
2. **#1 / #4** — Even with the routes mounted, Clerk-related public-route
   guards and probe-fed lane status are blocking institutional demo
   readability.
3. **#8 / #9 / #10 / #11** — Replay continuity claims (the institutional
   differentiator) have zero persistence layer. Verifiers can fetch a
   receipt today (post-merge) but cannot answer "give me the chronology
   for this entity" or "is this receipt continuous with the prior one".
4. **#12 / #13** — OID4VCI discovery internal inconsistencies. Workable
   for a verifier that reads the cross-surface coherence test or the
   documentation but a sharp edge for naive clients.

---

## §4 — Ranked by convergence severity (does closing it unblock others?)

1. **#7 (Codex SAFE)** — every MERGE-owner blocker depends on this. One
   bottleneck unblocking 12 other rows.
2. **#8 (Replay Prisma model)** — blocks #9, #10, #11; the entire replay
   reader / chronology / continuity stack converges on this single
   schema addition.
3. **#6 (merge train)** — directly resolves 9 alignment-audit TARGET rows
   (the canonical paths) and 2 DRIFT rows (legacy Content-Type, allowlist
   gap).
4. **#1 / #2 / #4 (apex env vars)** — none individually unblocks more than
   itself, but together they convert "code shipped" into "verifier-visible
   reality".

---

## §5 — Finite convergence list (the closure path)

In dependency order:

1. **Operator: configure apex Vercel env vars** (blockers #1, #2, #3, #4).
   This is doable today without any code change. Effort: ~30 min in Vercel
   dashboard.
2. **Operator: seed Railway production DB** (blocker #5). One SQL execution.
3. **Operator: run `codex exec` against PRs #338–#358** (blocker #7). Per
   the wave-execution skill, three audits per PR (implementation / diff /
   copy) → SAFE verdict in transcript → merge.
4. **Engineering: ship Replay Prisma model + migration** (blocker #8). Per
   `replay-topology-gap-analysis.md` §7 PR-α. Estimate: 1 PR, doc-light.
5. **Engineering: ship reader endpoints + chronology** (blockers #9). Per
   `replay-topology-gap-analysis.md` §7 PR-δ/ε. Estimate: 2 PRs, stacked
   on the model PR.
6. **Engineering: ship continuity reconciler** (blocker #10). Per
   `replay-topology-gap-analysis.md` §7 PR-ζ. Estimate: 1 PR, depends on
   reader endpoints.
7. **Engineering: ship receipt issuance persistence** (blocker #11). Per
   `replay-topology-gap-analysis.md` §7 PR-η. Estimate: 1 PR.
8. **Engineering: fix-up cluster** (blockers #12, #13, #14, #15, #18, #19,
   #20, #21). Estimate: 1–2 small PRs grouped by surface.
9. **Documentation: truth-contract pass on `MEMORY.md`** (blocker #22) and
   on any prior-session doc that asserted past-tense implementation.
   Already partially applied in commit `d7202754`. Estimate: under 30 min.

Total finite convergence work: **3 operator tasks + 6–7 engineering PRs +
1 documentation pass** to move from current state to fully institutionally
defensible runtime.

---

## §6 — What is NOT a blocker (despite appearing in prior framings)

- **`apiBase=false` in `/api/health`** — naming-only artifact. Backend
  reachability falls back to `https://api.vitalcv.com` on Vercel
  regardless. Cite: gating-graph §1.
- **The `/api/.well-known/jwks.json` legacy mirror** — it works, it's just
  emitting the wrong Content-Type. Not blocking; only suboptimal.
- **The two `/verify` paths on web vs marketing** — on separate Vercel
  projects at different domains; no apex collision. Cite: prior
  ROUTE_OWNERSHIP_MAP carry.
- **The replay-identity scheme not being on `origin/main` directly** — it
  is on unmerged stack and lands together with the routes that consume
  it. Not an independent blocker.

---

## §7 — Single-sentence headline

The institutional readiness gap is **two-thirds operator-side** (env vars,
seed, codex-exec) and **one-third engineering** (replay persistence layer
+ small fix-ups); zero net-new feature work is required to make every
existing claim defensible.
