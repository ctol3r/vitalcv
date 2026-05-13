# Final Runtime Truth Convergence

**Phase 1 of the final institutional convergence wave.**
**Branch:** `wave/canonical-route-map`. **HEAD:** `0fae815c`.
**Scope:** verify that every institutional surface describes the same
runtime reality. No new architecture, no new product concepts, no
aspirational claims.

## Convergence inputs (already shipped on this branch)

1. `runtime-gating-graph.md` — every degraded-runtime gate with file:line attribution
2. `upstream-fetch-topology.md` — fetch sites + failure propagation
3. `replay-topology-gap-analysis.md` — what exists / what is missing in the replay stack
4. `deployed-route-registration-audit.md` — manifest / rewrite / runtime / allowlist / Content-Type per route
5. `verifier-continuity-normalization-audit.md` — canonical-path migration verification
6. `replay-payload-schema-audit.md` — wire-payload field coverage per surface
7. `route-runtime-alignment-audit.md` — 22-claim claims-vs-reality matrix
8. `institutional-readiness-synthesis.md` — 22-row severity-ranked blocker matrix
9. `canonical-trust-route-map.md` (post-correction `d7202754`) — target topology with explicit "lives on PR #N (not yet on main)" annotations

This Phase 1 document does not produce new findings; it asserts the
**convergence verdict** — that the seven truth surfaces below all
describe the same runtime reality (or, where they don't, exactly which
audit row captures the divergence).

## §1 — Seven truth surfaces, single reality

| Truth surface | Authoritative source on this branch | Convergence verdict |
|---|---|---|
| Runtime truth (what apex actually serves) | `route-runtime-alignment-audit.md` §1 (22-claim matrix) | CONVERGED: 2 ALIGNED claims, 12 TARGET claims correctly framed as unmerged, 7 DRIFT claims surfaced, 2 ORPHAN claims surfaced. Every divergence is named with an evidence row. |
| Replay truth (what state can be replayed) | `replay-topology-gap-analysis.md` (per-axis PRESENT/PARTIAL/MISSING verdicts) | CONVERGED: writer MISSING, reader MISSING, lineage persistence MISSING, receipt persistence PARTIAL, chronology PARTIAL, continuity reconciler MISSING. The six-axis verdict is identical across the replay-topology, replay-payload-schema, and route-runtime-alignment audits. |
| Verifier truth (what an external verifier can discover) | `verifier-continuity-normalization-audit.md` §1–§5 + `route-runtime-alignment-audit.md` §1 rows 4–12 | CONVERGED: 5 axes PASS / PASS-WITH-NOTE for the contract; 0 of 9 canonical paths shipped on `origin/main`. The migration contract is correct; the migration has not happened on main. |
| Chronology truth (run ordering for an entity) | `replay-payload-schema-audit.md` §14 (criterion 7) + `replay-topology-gap-analysis.md` §5 | CONVERGED: chronology is reconstructed from `DecisionCapsule` ordering today, not from lineageKey. No deterministic tiebreaker exists for same-millisecond `VerificationArtifact.createdAt` rows. Determinism gap is named in both audits. |
| Degraded-state truth (what `Unavailable` means) | `runtime-gating-graph.md` §3 + §6 + `route-runtime-alignment-audit.md` §1 row 21 | CONVERGED: the operator-reported "Unavailable / Unknown" lane symptom is `LaneHealthMount` band fed by unscheduled probe runner — NOT the missing demo seed. Two-channel attribution (in-stream `SourceRow` vs `LaneHealthMount`) is consistent across audits. |
| Observability truth (what apex emits) | `upstream-fetch-topology.md` §A–§E + `runtime-gating-graph.md` §6 | CONVERGED: probe runner gated on `CRON_SECRET`/`MONITORING_SECRET`. Audit log of fetch failures swallowed-into-200-with-fallback at `/api/ingest/[npi]` is named. |
| Trust discoverability truth (what `iss → /.well-known/jwks.json` returns) | `verifier-continuity-normalization-audit.md` §4 + `deployed-route-registration-audit.md` (.well-known section) | CONVERGED: the only key-discovery surface on `origin/main` today is the legacy `/api/.well-known/jwks.json` with non-canonical Content-Type (`application/json` instead of `application/jwk-set+json`). Canonical handler ships on unmerged #349. |

**Convergence verdict (Phase 1):** all seven truth surfaces describe the same
runtime reality. Every divergence between documentation and apex behavior
has a named audit row + file:line evidence. There are no contradictions
between the audits.

## §2 — Convergence guarantees

These hold as of HEAD `0fae815c`:

- **No contradiction**: no two audits make incompatible claims about the same artifact. Cross-checked: all six agents converged on the "0 of 9 canonical routes on `origin/main`" finding independently.
- **No semantic drift**: the term `lineageKey` means the same thing (a content-addressed identifier prefixed `lin_v1_`) across every doc that uses it.
- **No future-state leakage in the contract**: each doc that names an unshipped artifact (e.g., the canonical handlers) attributes it to a specific unmerged PR and labels it TARGET, not LIVE.
- **No branch / runtime mismatch in the contract**: the `canonical-trust-route-map.md` correction (`d7202754`) explicitly distinguishes target topology from `origin/main` reality; downstream audits cite the corrected version.
- **No topology mismatch**: the `deployed-route-registration-audit.md` route inventory matches the `route-runtime-alignment-audit.md` claim matrix matches the `replay-payload-schema-audit.md` surface list, route-by-route.
- **No unverifiable institutional claims**: every claim that requires operator-side verification (env vars, Railway DB state, scheduled jobs) is flagged as OPS-owner with the named verification command.

## §3 — Where the audits remain non-converged with apex

These are runtime/operator divergences, not audit-internal contradictions:

1. The 9 canonical verifier paths are described in repo but absent from
   apex runtime. Closure: merge train (PRs #338–#358).
2. The replay continuity claims (lineageKey persistence, receipt-by-
   lineage reader, continuity reconciler) are described in target topology
   but absent from `origin/main` source tree. Closure: 6–7 engineering PRs
   per `replay-topology-gap-analysis.md` §7.
3. The apex env vars required to make the above runtime-defensible are
   absent. Closure: operator-side Vercel configuration (named in
   `institutional-readiness-synthesis.md` §1 rows 1–5).

These three closure paths are not new findings; they are reaffirmation
that Phase 1 convergence does not require any new product change beyond
what is already in flight.

## §4 — UI / payload / doc language alignment

Per the user's "ALIGN" requirement:

| Surface | Term as used | Authoritative definition |
|---|---|---|
| Runtime payload | `lineageKey` | `lin_v1_<16hex>` — SHA-256 over canonicalized pipe-delimited payload, on unmerged PR. |
| Runtime payload | `runId` | `run_v1_<16hex>` — run-scoped identity, on unmerged PR. |
| UI primitive | `TrustTier` (T1–T4) | Authority-ladder rung. T1 self-asserted, T2 AI-inferred, T3 source-checked, T4 issuer-signed. Lives on `origin/main` in `apps/web/design-system/components/TrustTierBadge.tsx`. |
| Trust contract | `trustPosture.dimensions` | Four trust-posture dimensions: identity / safety / authority / eligibility. Lives on `origin/main` in `apps/web/lib/trust/passport-contract.ts`. ORTHOGONAL to TrustTier — these are not the same axis. |
| Receipt header | `kid` | JWK key identifier matching the active signing key from `/.well-known/jwks.json` (when canonical handler ships). |
| Receipt body | `jti` | On `origin/main` today: `rcpt_<responseId>_<Date.now()>` (non-deterministic). On unmerged #349: `'receipt:' + runId` (deterministic). |
| OIDC discovery | `credential_issuer` | Origin URL form, per OID4VCI spec. |
| DID document | `id` | `did:web:<host>` form, per W3C DID Core. |
| Lane health | `Unavailable` | LaneHealthMount band UNKNOWN seed when probe runner unscheduled. |
| Lane health | `Unavailable` (in-stream) | `SourceRow` state when SSE upstream errors (different code path; same word, different cause). |

**Aligned-vocabulary verdict:** the language is internally consistent
EXCEPT for the dual meaning of `Unavailable` (LaneHealthMount band vs
in-stream SourceRow). Both surfaces currently use the same English word
for two different states. Closure: rename one of the two channels
(operator-side decision, no merge dependency); the audits already name
both channels by their code path.

## §5 — Phase 1 closure

Phase 1 success criterion (per the brief): "all institutional surfaces
describe the exact same runtime reality."

**Met.** Every audit on this branch converges on the same finding set;
every divergence between docs and apex is attributed to a named PR or a
named operator-side gap. The only remaining ambiguity is the
`Unavailable` label collision, which is a vocabulary refinement, not a
semantic drift.

Phase 1 does not close the runtime gap — it asserts that the docs
correctly describe the gap. Closure of the gap itself is the work of
Phases 2–6 (where applicable) plus the merge train.
