# Tech Debt Triage

**WAVE 5 deliverable.** Classifies known technical debt into four
buckets so the founder stops drowning in infinite cleanup.

Methodology: each item is sourced from a prior audit doc on PRs
#358 / #363 OR observed during this audit. Each item has a fixed
classification + an explicit "what unblocks this" note.

## §1 — Bucket 1: DANGEROUS (launch-blocking; data, security, or trust risk)

These cannot ship without resolution.

| # | Item | Source | Risk |
|---|---|---|---|
| 1 | Apex Vercel project unknown / paused (HTTP 402) | `pause-root-cause-report.md` | No live runtime → no launch |
| 2 | Apex env vars not set: `RECEIPT_PRIVATE_KEY_JWK`, `RECEIPT_KID`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `production-env-requirements.md` §1 | Signing routes 500 (fail-closed); auth broken |
| 3 | Demo NPI not seeded on Railway production DB | `final-deployment-sequence.md` §3 | Demo flow renders "no profile" terminal state; institutional reviewer first-impression broken |

**Total**: 3 items. All operator-side. Estimated <2 hours combined.

## §2 — Bucket 2: LAUNCH-BLOCKING (small engineering work; visible to first 100 users)

| # | Item | Source | Effort |
|---|---|---|---|
| 4 | `/api/ingest/[npi]` masked-200 with `fallback: true` — client throws because `startPublicIngest` doesn't branch on the flag | `degraded-runtime-behavior-audit.md` §1, `upstream-fetch-topology.md` §A.X | 1 small PR; <1 hour |
| 5 | Empty `apps/web/app/verifier/` directory — any inbound link 404s | `repo-coherence-launch-readiness.md` §2 | Either populate or audit-and-suppress nav links; <30 min |
| 6 | `/sign-up` vs `/signup` duplicate paths | `ship-readiness-state.md` §3 | 1-line redirect in `next.config.mjs`; <10 min |
| 7 | `/compliance` archived; any marketing link to it 404s | `ship-readiness-state.md` §3 | Link audit + suppress; <30 min |
| 8 | `LaneHealthMount` band displays "Unavailable" because probe runner unscheduled | `runtime-gating-graph.md` §6 | Operator schedules cron OR ship a "Probe pending" copy fallback when seeds are UNKNOWN; ~1 hour either way |
| 9 | `/api/.well-known/jwks.json` Content-Type emits `application/json` instead of `application/jwk-set+json` | `signing-identity-trace.md` | 1-line fix to legacy mirror handler; <10 min. (Or accept that the unmerged canonical handler on #349 corrects this when shipped.) |

**Total**: 6 items. All small. Combined effort: ~3 hours of engineering + ~1 hour operator coordination.

## §3 — Bucket 3: POST-LAUNCH (ship later, no first-impression risk)

| # | Item | Source | Why deferred |
|---|---|---|---|
| 10 | Canonical RFC `/.well-known/*` paths (jwks, did, openid-credential-issuer, openid-configuration, trust-register) | `canonical-trust-route-map.md` (PR #358) | Institutional verifier discovery; launchable without it; legacy `/api/.well-known/jwks.json` works as fallback |
| 11 | Lane B trust UI primitives (`TrustHeader`, `ReplayLineage`, `RecentNpis`, `ReplayIntegrityPanel`, `RunIdentity`, etc.) | `claude-design-alignment-audit.md` §1 | Replay readers ship as JSON; UI consumption is incremental |
| 12 | Continuity reconciler endpoint (`/api/lineage/[lineageKey]/diff/[other]`) | `replay-topology-gap-analysis.md` §7 PR-ζ | Derivable client-side from chain endpoint |
| 13 | Receipt-issuance persistence by `jti` (audit trail of issued receipts) | `replay-topology-gap-analysis.md` §7 PR-η | Receipts signed on demand; revocation is v2 concern |
| 14 | `priorJti` / `priorLineageKey` claims on signed receipts | `replay-topology-gap-analysis.md` §7 PR-γ extension | Continuity derivable from chain endpoint without in-receipt pointers |
| 15 | Writer expansion to non-orchestrator ingest sites (`/api/passport/[npi]/refresh`) | `replay-topology-gap-analysis.md` §7 | Existing wiring on `ingestOrchestrator` covers the primary ingest path |
| 16 | Backend-URL resolver consolidation (4 different resolvers in active use; one falls back to localhost) | `upstream-fetch-topology.md` §A | Medium PR; can land any time without breaking flows |
| 17 | `report/*` cluster fetch timeouts (20s/30s, exceeds Vercel Hobby 10s cap) | `upstream-fetch-topology.md` §A | Affects internal-only routes; not first-impression |
| 18 | UI compression / activation continuity pass | B17-CODE-04 mission | Requires rendered review; not auditable from build session |

**Total**: 9 items. Ship after the first 100 users land. Multi-week cumulative effort.

## §4 — Bucket 4: IGNORABLE (don't fix; not actually debt)

These look like debt but aren't worth addressing:

| # | Item | Why ignorable |
|---|---|---|
| 19 | `_archive/wave119/` and `_archive/demo/` and `_archive/verifier/` directories | Walled off by Next App Router (paths starting with `_`); unreachable; only history value. Removing them shrinks the repo but provides no operational benefit. |
| 20 | `vcv-es256-dev` literal references inside `if (isDev())` blocks | Correctly gated; never reachable in production. PR-362 fail-closed guard makes leakage impossible. |
| 21 | `'vcv-es256-1'` literal as UI default in `TrustStateRegister.tsx` and `verify/[npi]/page.tsx` | Matches operator-expected env value; converges when env is set correctly. Not a defect. |
| 22 | Multiple internal-ish routes (`/calibration`, `/autopilot`, `/roi`, `/pilot`, `/ops`) | Internal surfaces; not publicly linked. Hide from nav before launch (small audit) but don't refactor. |
| 23 | Inline backend-URL resolvers in ~40 files (vs the canonical `BACKEND_URL` import) | Each works correctly when env is set; consolidation is a refactor preference, not a bug. Ship as Bucket 3 item if/when convenient. |
| 24 | 191 routes declaring `runtime = 'nodejs'` | Correct for Vercel Node deployment; "edge migration" is in `survival/cloudflare-migration` branch as Path A/B/C decision tree. Path C (CDN proxy) needs no migration. |
| 25 | `_keypairPromise` module-level state in `receiptIssuer.ts` | Intentional singleton pattern; not actually debt. |
| 26 | `apps/marketing` exists as a separate Next app | Distinct domain; not interfering with apex. Don't touch. |
| 27 | 213 API route files in `apps/web/app/api/` | Large but legitimately partitioned. Refactoring is risky and provides little operational benefit. |
| 28 | Multiple Prisma models in backend schema (~80 models) | Reflects feature evolution; per-model removal needs case-by-case audit. Not a Bucket 4 in aggregate; individual models may move to Bucket 3 if confirmed dead. |

**Total**: 10 items the founder should stop worrying about.

## §5 — Triage summary table

| Bucket | Count | Effort | Owner |
|---|---|---|---|
| 1 DANGEROUS (launch-blocking; data/security/trust) | 3 | <2 hrs | OPERATOR |
| 2 LAUNCH-BLOCKING (engineering; visible to users) | 6 | ~3 hrs ENG + ~1 hr OPS | ENG + OPERATOR |
| 3 POST-LAUNCH | 9 | weeks total | ENG (sequential) |
| 4 IGNORABLE | 10 | 0 | none |

**Action that closes "launch-blocking" buckets**: ~6 hours total
(<2 operator + ~4 engineering small PRs). After that, VitalCV is
operationally launchable.

## §6 — Prioritization decision flow

```
DO I NEED TO FIX THIS BEFORE LAUNCH?

  Is it in Bucket 1 or 2?     → YES, fix it (in operator/eng order)
  Is it in Bucket 3?           → NO, fix it after launch when users justify
  Is it in Bucket 4?           → NO, leave it alone

DO I NEED TO PLAN FOR THIS POST-LAUNCH?

  Is it in Bucket 3?           → YES, but in dependency order (see source doc)
  Is it in Bucket 4?           → NO

DOES THIS BLOCK A SPECIFIC USER FLOW?

  /api/ingest fallback (Bucket 2 #4)  → Blocks the homepage NPI flow when backend is slow
  Empty /verifier (Bucket 2 #5)       → Blocks any institutional review link
  Probe runner (Bucket 2 #8)          → Blocks the "polished passport" demo first-impression

  All other Bucket 2 items are small / cosmetic.
```

## §7 — What to STOP working on right now

Per the founder's constraint ("stop drowning in infinite cleanup"):

- **STOP** generating more architecture audits. The audit set is exhaustive.
- **STOP** triaging Bucket 4 items as if they were debt. They're not.
- **STOP** opening new infrastructure PRs until Bucket 1 + 2 close.
- **STOP** waiting for "the right time" to clear Bucket 1. It's <2 operator hours and unblocks everything downstream.

## §8 — Single-line founder answer

**Six hours of focused work clears every launch-blocker. The
remaining debt is either operationally invisible (Bucket 4) or
appropriately scheduled (Bucket 3). The blocker is not technical;
it's the operator-side activation sequence.**
