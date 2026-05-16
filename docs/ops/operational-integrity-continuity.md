# Operational Integrity Continuity — W2-PR12B Track C

**Date:** 2026-05-08
**Reviewer role:** operational-integrity continuity reviewer
**Scope:** Across runtime, replay, export, forensic, and dashboard surfaces, do they remain *operationally coherent, survivable, understandable, and runtime-honest* — or do they drift apart under load, time, or partial degradation?

---

## Method

For each of five integrity surfaces I ask four questions:

1. **Coherent** — does the surface tell the same story as its peers?
2. **Survivable** — does it stay honest when an upstream is degraded?
3. **Understandable** — can a non-author operator read it correctly?
4. **Runtime-honest** — does what it shows match what the system *just did*?

Each gets 🟢 / 🟡 / 🟠 / 🔴.

---

## C.1 Runtime integrity (mutation path)

**Surface:** [`runtimeTrustCohesion.ts`](apps/api/backend/src/services/runtimeTrustCohesion.ts) → [`employerReviewActions.ts`](apps/api/backend/src/services/entity/employerReviewActions.ts) → [`employerActions.ts`](apps/api/backend/src/routes/employerActions.ts) → audit row.

| Question | Answer |
|---|---|
| Coherent | 🟢 — single helper produces correlationId, mutationFingerprint, payloadHash for all 8 RuntimeMutationActions; tests pin the path. |
| Survivable | 🟢 — `recordEmployerReviewAcceptance` returns minimal snapshot on audit-layer failure so the user-facing action is never blocked by audit unavailability. |
| Understandable | 🟡 — three structural denial reasons collapse into one event type at the operator's most natural metric; surface-side, this looks finer than it is. |
| Runtime-honest | 🟢 — every 2xx mutation writes the audit event before the response; payload sensitive fields are explicitly redacted (NPI, notes, shareToken) at [`runtimeTrustCohesion.ts:65-74`](apps/api/backend/src/services/runtimeTrustCohesion.ts:65). |

**Verdict:** 🟢 OPERATIONALLY COHERENT (with one 🟡 spot at metric-shape).

---

## C.2 Replay integrity

**Surface:** [`replayEngine.ts`](apps/api/backend/src/services/audit/replayEngine.ts) → `DecisionReplay` envelope → (no UI today).

| Question | Answer |
|---|---|
| Coherent | 🟡 — recorded vs. computed are both present, but the outer envelope is unconditionally `R-CAT-6 dossier-replay` so inner classification is masked. |
| Survivable | 🟢 — replay is a pure recompute over the capsule; no live source dependency, so it works during full source outage. |
| Understandable | 🟠 — no operator-facing replay panel today; engineers can call `/api/decision/:id/replay` and read JSON. The `tamperEvidence` array is flat, not severity-ordered. |
| Runtime-honest | 🟢 — replay does what it says: hash compare, evidence-spine compare, authority-chain compare; mismatches surface as named tamper locations. |

**Verdict:** 🟡 PARTIAL. The math is honest; the operator's window onto it is missing. When the replay panel ships, the R-CAT-6 masking and unordered tamper list will become visible UX flaws.

---

## C.3 Export integrity

**Surface:** [`buildAuditBundle()`](apps/api/backend/src/services/audit/replayEngine.ts) → `AuditBundle` schema `https://vitalcv.com/audit-bundle/v1` → JSON or ZIP via `/api/employer-review/:entityId/packet`.

| Question | Answer |
|---|---|
| Coherent | 🟡 — bundle is content-addressed and schema-versioned, but does not carry "ledger-as-of T0" so a downstream reader cannot tell if the live ledger has moved since. |
| Survivable | 🟢 — bundles are produced offline from stored capsules; no live source needed. |
| Understandable | 🟠 — operators receive a JSON or ZIP and may not know that re-exporting after new audit rows would produce a different (also valid) bundle. The provenance of *why* this bundle and not a later one is undocumented in the bundle envelope. |
| Runtime-honest | 🟢 — `ARTIFACT_EXPORTED` audit event is written before the bundle is returned; bundle content is exactly what the ledger held at that moment. |

**Verdict:** 🟠 CONFUSING. The export is honest about *what it contains*; it is silent about *what it does not contain*. Survivability of the bundle as a forensic artifact depends on someone, somewhere, knowing the export timestamp — that knowledge is not in the bundle.

---

## C.4 Forensic integrity (capsule/ledger durability)

**Surface:** [`replayEngine.ts`](apps/api/backend/src/services/audit/replayEngine.ts) tamper detection → audit event ledger → `decisionTrustSnapshot` on each mutation.

| Question | Answer |
|---|---|
| Coherent | 🟢 — capsule schema, audit-event union, and decision-trust-snapshot all hang off a small set of canonical types (`AuditEventType`, `DecisionTrustSnapshot`, `RuntimeTrustMetadata`). |
| Survivable | 🟡 — TRUST-PERSIST-1 is mid-rollout (PR #221 scaffold; #255-#258 wired writers via feature flag). Persistence target states (`pending_not_written`, `simulated`, `persisted`, `failed`, `unavailable`) are honest but mixed across the platform. An operator looking at `pending_not_written` may not realise that's the durable-flag-off path, not a failure. |
| Understandable | 🟡 — five persistence states are correct but not all named in operator-visible text; the operator who sees `pending_not_written` in an event payload has no in-app explanation. |
| Runtime-honest | 🟢 — capsule integrity is hash-checked at replay; tamper evidence is precise; six-link authority chain is enforced. |

**Verdict:** 🟡 PARTIAL. The forensic primitives are sound (truth contract). The mid-rollout of durable persistence creates a 5-state surface that operators read with default-on assumptions, which the platform does not satisfy yet.

---

## C.5 Dashboard integrity

**Surface:** `LaneHealthMount` (3 routes), `TrustStatusBadge`, readiness composed badge, `/status`, `/passport`, `/employer/dashboard`, audit-timeline UI.

| Question | Answer |
|---|---|
| Coherent | 🟠 — `statusCopy.ts` ensures copy is identical across surfaces (good). But the *composite readiness badge* (color from status + score) can show yellow when status is BLOCKED — a render that contradicts the canonical field. |
| Survivable | 🟢 — LaneHealth surfaces explicitly handle UNAVAILABLE / RATE_LIMITED / UNKNOWN states and render the failure mode rather than hiding it. |
| Understandable | 🟠 — the most ambiguous color (yellow) is used for both "almost ready" and "blocked-but-with-high-score." Same render, different meaning. |
| Runtime-honest | 🟡 — surfaces show what the most recent score said; they do not show what the most recent issuer-verification gate said. The two can disagree (W2-PR7B issuer↔employer seam). |

**Verdict:** 🟠 CONFUSING. Dashboard cohesion is the weakest surface. The truth contract holds at the data layer; the render layer mixes meanings.

---

## Cross-surface continuity matrix

| | Runtime | Replay | Export | Forensic | Dashboard |
|---|---|---|---|---|---|
| **Runtime** | — | snapshot→capsule: 🟢 | mutation→audit→bundle: 🟢 | mutation→capsule→hash: 🟢 | mutation→badge: 🟠 |
| **Replay** | | — | replay→bundle inclusion: 🟡 | replay→tamperEvidence: 🟢 | no replay UI: 🟠 |
| **Export** | | | — | bundle→audit-of-export: 🟢 | bundle→viewer: 🟠 |
| **Forensic** | | | | — | capsule→passport render: 🟡 |
| **Dashboard** | | | | | — |

**Patterns:**
- Runtime → all data-layer surfaces is 🟢. The mutation path is the most coherent stretch.
- Anything that touches the dashboard render is 🟠.
- Replay is 🟢 internally but disconnected from any operator window.
- Export is 🟢 internally but silent about its own freezing.

---

## Coherence-failure modes (the things that would actually break operator trust)

1. **Composite badge yellow over BLOCKED status** — operator proceeds when canonical state says stop. Already noted in W2-PR7B; still present.
2. **Bundle-as-of unmarked** — auditor reads a bundle weeks later, ledger has moved, bundle reader has no way to know.
3. **R-CAT-6 envelope masking** — when the replay panel ships, every replay will look like "a replay of a dossier-replay"; the inner action class will be invisible unless the renderer extracts it from the inner record.
4. **Persistence-state language** — `pending_not_written` is literally correct but reads as "in flight," not "feature flag off."
5. **Issuer↔employer seam** — passport can show simultaneously contradictory states from the two halves; today no surface reconciles them.

---

## Track C summary

| Surface | Coherent | Survivable | Understandable | Runtime-honest | Composite |
|---|---|---|---|---|---|
| Runtime integrity | 🟢 | 🟢 | 🟡 | 🟢 | **🟢** |
| Replay integrity | 🟡 | 🟢 | 🟠 | 🟢 | **🟡** |
| Export integrity | 🟡 | 🟢 | 🟠 | 🟢 | **🟠** |
| Forensic integrity | 🟢 | 🟡 | 🟡 | 🟢 | **🟡** |
| Dashboard integrity | 🟠 | 🟢 | 🟠 | 🟡 | **🟠** |

**Strongest stretch:** Runtime integrity — every mutation produces a coherent, hash-stable, redaction-honest audit record before responding.

**Weakest stretch:** Dashboard integrity — the rendered meaning of composite badges does not always match the canonical field.

**Most fragile transition:** Replay → operator. The recompute is honest but the operator's window onto it is absent (no panel) or masked (R-CAT-6 envelope) when it appears.

The platform is **operationally coherent** in its data layer and **runtime-honest** in its mutation path, but **understandability** drops sharply at every UI render that touches a composite or a default. The single best place to invest is converting at least one render — the readiness badge — from composite to canonical-faithful.
