# W2-PR2B — Mutation Branch Map

**Wave:** Wave 2, PR 2B — runtime audit, branch decomposition · **Date:** 2026-05-08 · **Status:** audit only; **NO product code, NO runtime modification, NO merge** · **Scope:** every mutation/persistence-emitting branch of the `/api/employer-review/**` surface as observed on `9eb5cdee` · **Authority:** companion to `w2-pr2b-runtime-mutation-audit.md`

This doc decomposes each mutating branch (and audit-emitting read branch) into the 11 dimensions enumerated by the wave brief: route entry point, action literal, current RBAC dependency, current ownership assumption, workflow transition, Prisma mutations, audit writes, side effects, external calls, readonly behavior, replay risk, tenant-boundary assumptions.

It is the per-branch source of truth for the criticality table in the parent audit doc §8.

---

## Branches surveyed

10 branches total — 5 mutating POSTs to `[entityId]/[action]`, 1 mutating-via-telemetry POST (`view`, served by a different file), 1 audit-emitting GET (`packet`), 2 pure-read GETs (`status`, `acceptance-history`), and 1 sibling-route GET (`refresh-requests` keyed by NPI).

| # | Branch | Path | Method | Backend file |
|---|---|---|---|---|
| B1 | `accept` | `/api/employer-review/[entityId]/accept` | POST | `routes/employerActions.ts:163` |
| B2 | `confirm-start` | `/api/employer-review/[entityId]/confirm-start` | POST | `routes/employerActions.ts:802` |
| B3 | `request-refresh` | `/api/employer-review/[entityId]/request-refresh` | POST | `routes/employerActions.ts:301` |
| B4 | `route-to-review` | `/api/employer-review/[entityId]/route-to-review` | POST | `routes/employerActions.ts:404` |
| B5 | `share-packet` | `/api/employer-review/[entityId]/share-packet` | POST | `routes/employerActions.ts:660` |
| B6 | `view` | `/api/employer-review/[entityId]/view` | POST | `routes/pilotKpi.ts:128` |
| B7 | `packet` | `/api/employer-review/[entityId]/packet` | GET (audit-writing) | `routes/employerActions.ts:561` |
| B8 | `status` | `/api/employer-review/[entityId]/status` | GET (read + telemetry) | `routes/employerActions.ts:501` |
| B9 | `acceptance-history` | `/api/employer-review/[entityId]/acceptance-history` | GET (pure read) | `routes/employerActions.ts:537` |
| B10 | `refresh-requests` | `/api/employer-review/npi/[npi]/refresh-requests` | GET | `routes/employerActions.ts:943` |

The web `[entityId]/[action]` proxy adds web-layer Clerk auth + body validation for B1–B6 (mutating actions) and authenticated-read for B7–B9. B10's web proxy (the sibling route file, 26 LoC) skips Clerk entirely.

---

## B1 — `accept`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web: `apps/web/app/api/employer-review/[entityId]/[action]/route.ts:351` (POST handler) → forwards to backend `apps/api/backend/src/routes/employerActions.ts:163` |
| **Action literal** | `accept` (in `AUTHENTICATED_MUTATION_ACTIONS` web; `expectedAction='accept'` for response normalization) |
| **Current RBAC dependency** | Web: `auth()` → `userId` must exist (line 362). NO role check. NO org check. Backend: `requireClerkUserId` reads `x-clerk-user-id` header. NO role/org consulted on the backend |
| **Current ownership assumption** | "The Clerk user ID is the employer." `EmployerAcceptance.employerId = userId`. Resource ownership is implicit per-user, not per-org. No comparison of actor to resource at any layer |
| **Workflow transition** | None on a state machine (no model has a `state` field). Implicit: creates an `EmployerAcceptance` row with `status='ACCEPTED'`. Gate: `passport.decisionPosture.status !== 'BLOCKED'` (line 195) AND no existing ACCEPTED row for `(employerId, clinicianNpi)` (line 175) |
| **Prisma mutations** | INSERT `employerAcceptance` (in tx); INSERT outbox event via `writeEmployerReviewOutboxEvent` (in tx); INSERT `auditEvent` via `writeEmployerReviewAuditEvent` (in tx) |
| **Audit writes** | One `AuditEvent` row, type `EMPLOYER_REVIEW_ACCEPTED`, paired with the acceptance row inside `prisma.$transaction` (employerReviewActions.ts:738) |
| **Side effects** | `void captureEmployerDecision({...})` SEAL signal (line 237 — outside tx); `void captureDecisionSignal({...})` learning capture (line 271 — outside tx); `void recomputeMatchBoosts().catch(...)` (line 289 — outside tx); `log('info', 'employer_review_accepted', ...)` (line 227) |
| **External calls** | None synchronous. SEAL captures are intra-process Promise dispatches; no HTTP calls during the mutation |
| **Readonly behavior** | NOT enforced — no role gate. A `readonly` JWT today reaches this handler if the web layer's `auth()` returns a `userId`. The web-layer Clerk session check is the only gate |
| **Replay risk** | MEDIUM — TOCTOU on duplicate-check (line 175 read OUTSIDE tx; line 738 insert INSIDE tx). No idempotency key. No UNIQUE constraint on `(employerId, clinicianNpi, status='ACCEPTED')` partial index |
| **Tenant-boundary assumptions** | Per-actor (Clerk userId), not per-org. Cross-actor in same org cannot see each other's acceptances. Cross-actor in different orgs probing same `entityId` succeeds (no actor-side ownership check beyond "did the actor authenticate"). The `organization String` column is descriptive, not enforcement |

**Branch-specific risk:** `EmployerAcceptance` is one of 5 canonical non-repudiation events. Forging accept by leaking an `entityId` UUID + spoofing `x-clerk-user-id` on the backend endpoint (if reachable) writes a permanent attribution. Today the web proxy forces Clerk auth; if backend is reachable directly (deployment topology dependent), the auth boundary is the proxy alone.

---

## B2 — `confirm-start`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:351` → backend `employerActions.ts:802` |
| **Action literal** | `confirm-start` (mutating action; explicit response shape in web normalizer line 421) |
| **Current RBAC dependency** | Same as B1 — `auth()` userId only; no role/org |
| **Current ownership assumption** | "The Clerk user ID is the employer; the most recent ACCEPTED row for this employer/clinician pair is the one being started." Falls back to most-recent if `acceptanceId` not in body (line 833). Per-actor scope, not per-org |
| **Workflow transition** | Implicit: a `StartAttestation` row references an `EmployerAcceptance` row. Gate: a matching ACCEPTED acceptance must exist for `(employerId, clinicianNpi)`. Body validation (line 820): `startedAt`, `role`, `facility` required |
| **Prisma mutations** | INSERT `startAttestation` (in tx); INSERT `auditEvent` (in tx) — `prisma.$transaction` inline at line 863 |
| **Audit writes** | One `AuditEvent`, type `START_ATTESTED`, paired with the attestation. Hash includes `attestationId, acceptanceId, entityId, employerId, clinicianNpi, startedAt, role, facility` |
| **Side effects** | `void captureStartOutcome({...}).catch(...)` (line 908 — outside tx); `log('info', 'employer_start_attested', ...)` |
| **External calls** | None synchronous |
| **Readonly behavior** | NOT enforced — same as B1 |
| **Replay risk** | HIGH — fallback to most-recent ACCEPTED means duplicate confirm-start calls can attach two `StartAttestation` rows to the same acceptance. No UNIQUE on `StartAttestation.acceptanceId` (schema line 3661 is `@@index`, not `@@unique`) |
| **Tenant-boundary assumptions** | Per-actor (Clerk userId). The acceptance lookup is scoped to `(employerId, clinicianNpi)` so cross-actor confirm-start fails (acceptance not visible) — this is real protection at the per-Clerk-user level. Cross-org probing where two users in different orgs accept the same NPI under separate `employerId`s would produce isolated state |

**Branch-specific risk:** `START_ATTESTED` is THE canonical non-repudiation event closing the wedge proof loop. Duplicate attestations or wrong-actor attestations corrupt the trust chain. The fallback-to-most-recent path is the worst replay risk in the surface.

---

## B3 — `request-refresh`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:351` → backend `employerActions.ts:301` |
| **Action literal** | `request-refresh` (web `expectedAction='refresh'` for response normalization) |
| **Current RBAC dependency** | Same as B1 |
| **Current ownership assumption** | Per-actor; the refresh request is attributed to the Clerk userId. No actor-resource ownership comparison |
| **Workflow transition** | None. Audit-only persistence (no separate row beyond outbox + audit). Optional fields: `staleSources[]`, `missingDomains[]`, `message` |
| **Prisma mutations** | INSERT outbox event (in tx); INSERT `auditEvent` (in tx) — `prisma.$transaction` at `employerReviewActions.ts:846` |
| **Audit writes** | One `AuditEvent`, type `EMPLOYER_REVIEW_REFRESH_REQUESTED`, paired with outbox |
| **Side effects** | `void captureEmployerDecision({...})` (line 341 — outside tx); `void captureDecisionSignal({...})` (line 376 — outside tx); `log('info', 'employer_review_refresh_requested', ...)` |
| **External calls** | None synchronous. Future: clinician notification dispatcher reads outbox |
| **Readonly behavior** | NOT enforced |
| **Replay risk** | MEDIUM — no idempotency. Each retry inserts a new audit row (and a new outbox event). The sibling refresh-requests GET (B10) counts these by `(npi, lookback=30d)` so duplicates inflate the count |
| **Tenant-boundary assumptions** | Per-actor. The audit metadata records `employerId, entityId, clinicianNpi` plus optional `organizationContextId` and `bundleId` (untrusted inputs from the body). A forged `organizationContextId` lands in the audit row unchanged |

**Branch-specific risk:** audit-row bloat from retry storms is the dominant operational risk. The forensic value of `EMPLOYER_REVIEW_REFRESH_REQUESTED` rows degrades as duplicates accumulate.

---

## B4 — `route-to-review`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:351` → backend `employerActions.ts:404` |
| **Action literal** | `route-to-review` (web `expectedAction='review'`) |
| **Current RBAC dependency** | Same as B1 |
| **Current ownership assumption** | Per-actor; routing is attributed to Clerk userId |
| **Workflow transition** | Optional: creates a `HITLReviewItem` with `status='PENDING'`, `priority`, `reason`. If model unavailable, silently degrades to outbox-only |
| **Prisma mutations** | (Optional) INSERT `hITLReviewItem` (in tx, wrapped in try/catch, silent degrade); INSERT outbox event (in tx); INSERT `auditEvent` (in tx) — `prisma.$transaction` at `employerReviewActions.ts:927` |
| **Audit writes** | One `AuditEvent`, type `EMPLOYER_REVIEW_ROUTED_TO_REVIEW`. Audit metadata records `reviewItemCreated: boolean` for forensics — a SOC analyst can detect silent HITL degradation by querying audit rows where `reviewItemCreated=false` |
| **Side effects** | `void captureEmployerDecision({...})` (line 442 — outside tx); `void captureDecisionSignal({decision: 'reject'})` (line 477 — outside tx); `void recomputeMatchBoosts().catch(...)` (line 495 — outside tx); `log('info', 'employer_review_routed_to_review', ...)` |
| **External calls** | None synchronous |
| **Readonly behavior** | NOT enforced |
| **Replay risk** | MEDIUM — no idempotency. Each retry creates a duplicate HITL item (different UUIDs) and a duplicate audit row |
| **Tenant-boundary assumptions** | Per-actor. The HITL item carries `employerId` (Clerk userId), not org_id |

**Branch-specific risk:** silent HITL degradation (try/catch at line 945) creates "ghost routings" that exist in the outbox but not in the manual-review queue. Operationally invisible unless monitored on `audit.metadata.reviewItemCreated=false`.

---

## B5 — `share-packet`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:351` → backend `employerActions.ts:660` |
| **Action literal** | `share-packet` (mutating action; explicit response shape in web normalizer line 427) |
| **Current RBAC dependency** | Same as B1 |
| **Current ownership assumption** | Per-actor. Body's optional `npi` field is validated against the resolved subject's NPI (line 677). Cross-actor share-packet for resources outside the actor's `(employerId, clinicianNpi)` scope is NOT prevented at the backend handler — the only check is "does the body NPI match the resolved subject" |
| **Workflow transition** | None on a state machine. Issues a 128-bit-ish share token bound to `(entityId, clinicianNpi, employerId)`, valid for `SHARE_TOKEN_TTL_MS` |
| **Prisma mutations** | INSERT `auditEvent` standalone (line 699) — NOT in `$transaction`. The audit IS the persistent share record. Token resolution (B's sibling `share-token/:token` GET) queries audit metadata for `shareTokenHash` |
| **Audit writes** | One `AuditEvent`, type `EMPLOYER_PACKET_SHARED`. Metadata: `shareTokenHash` (NOT the secret), `expiresAt`, `employerId`, `entityId`, `clinicianNpi`, optional attribution |
| **Side effects** | `log('info', 'employer_packet_shared', ...)`. The share URL is emitted in the response body |
| **External calls** | `resolveAppOrigin()` for URL construction; no HTTP calls during the mutation |
| **Readonly behavior** | NOT enforced |
| **Replay risk** | MEDIUM — each retry mints a fresh token. Old tokens remain valid until expiry. No "supersedes prior token" semantics |
| **Tenant-boundary assumptions** | Per-actor. The token grants downstream public-read access bound to (entityId, clinicianNpi). A cross-actor probe that issues a token for another actor's `entityId` would succeed today (no resource-ownership check). The downstream public-read flow then resolves the token to anyone holding it |

**Branch-specific risk:** the audit-as-persistence pattern means audit retention/GC policy directly affects share-token validity. Tokens are unconditionally bound to whoever issued them but NOT cross-validated against the actor's `entityId` ownership. Issuing a packet share for an `entityId` an attacker doesn't own is the highest-leverage cross-tenant escape in this surface.

---

## B6 — `view`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:351` (in `PUBLIC_MUTATION_ACTIONS`) → backend `pilotKpi.ts:128` (NOT `employerActions.ts`) |
| **Action literal** | `view` (mutating action per web allowlist; semantically a telemetry POST) |
| **Current RBAC dependency** | Web: NO Clerk session required (`requiresAuth = false` for PUBLIC_MUTATION_ACTIONS). Backend: NO `requireClerkUserId` call. Reads `x-clerk-user-id` header for metadata only (line 174) |
| **Current ownership assumption** | None — explicitly public. `entityId` validated as UUID format only |
| **Workflow transition** | None. Returns 202 immediately |
| **Prisma mutations** | NONE — fire-and-forget telemetry to `captureAdvisoryEvent` |
| **Audit writes** | NONE — no `AuditEvent` row written |
| **Side effects** | `void captureAdvisoryEvent({type: 'EMPLOYER_REVIEW', ...}).catch(...)` (line 156); `resolveEmployerReviewAttribution(...)` lookup (read-only, line 143) |
| **External calls** | None |
| **Readonly behavior** | n/a — anonymous |
| **Replay risk** | LOW — duplicate telemetry events; downstream consumers expected to dedupe |
| **Tenant-boundary assumptions** | None enforced. The advisory event metadata includes whatever `organizationContextId`, `bundleId`, `sharedBy`, `reviewerClerkId` the body/headers provide — all untrusted |

**Branch-specific risk:** mis-classification by the web allowlist as `PUBLIC_MUTATION_ACTIONS` is the dominant concern. Per the lock §3, reclassifying to `AUTHENTICATED_READ_ACTIONS` (a) changes the wire (authenticated-only), (b) breaks anonymous review-link telemetry capture, (c) requires a deprecation window. Today's behavior is "anonymous POST returns 202 always."

---

## B7 — `packet` (audit-writing GET)

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:437` (GET handler, in `AUTHENTICATED_READ_ACTIONS`) → backend `employerActions.ts:561` |
| **Action literal** | `packet` |
| **Current RBAC dependency** | Web: Clerk session required. Backend: `requireClerkUserId(req)` (line 564). No role/org gate |
| **Current ownership assumption** | "The Clerk user ID is the employer." `entityId`-keyed lookup; passport must exist; vcvEntity must have NPI. No actor-resource ownership comparison |
| **Workflow transition** | None |
| **Prisma mutations** | INSERT `auditEvent` standalone (line 611) — NOT in `$transaction`. Audit IS the export record |
| **Audit writes** | One `AuditEvent`, type `ARTIFACT_EXPORTED`. Metadata: full export shape (manifestHash, sourceIds, staleSources, reviewRequiredSources, freshness, trust container audit, etc.) |
| **Side effects** | `log('info', 'employer_packet_exported', ...)`; `issueTrustContainerManifestEntry({passport})` lookup (read); response either streams a ZIP or returns JSON |
| **External calls** | None synchronous; trust container manifest entry is intra-process |
| **Readonly behavior** | NOT enforced — readonly JWT today reaches this handler |
| **Replay risk** | MEDIUM — duplicate exports inflate audit volume but each export is a fresh evidence snapshot (intentional) |
| **Tenant-boundary assumptions** | None enforced. Knowing an `entityId` is sufficient to export the packet today |

**Branch-specific risk:** evidence packet bytes leave the perimeter on every successful export. Cross-tenant export by `entityId` leak is the highest-data-volume escape.

---

## B8 — `status`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:437` (GET) → backend `employerActions.ts:501` |
| **Action literal** | `status` |
| **Current RBAC dependency** | Web: Clerk session required. Backend: `requireClerkUserId(req)` (line 504) |
| **Current ownership assumption** | Per-actor — `loadEmployerReviewStatus` is called with `employerId` so the read is scoped to the actor's acceptances |
| **Workflow transition** | None — read |
| **Prisma mutations** | NONE |
| **Audit writes** | NONE |
| **Side effects** | `emitLearningEvent({type: 'EMPLOYER_VIEWED', providerId, employerId})` (line 525) — fire-and-forget telemetry |
| **External calls** | None |
| **Readonly behavior** | Permitted (read) |
| **Replay risk** | NONE |
| **Tenant-boundary assumptions** | Per-actor scope on the read; cross-actor probing returns "no acceptance" rather than another actor's data |

**Branch-specific risk:** the EMPLOYER_VIEWED telemetry leaks "which actor viewed which provider" downstream — confirming actor presence to learning consumers without explicit consent. Operationally minor.

---

## B9 — `acceptance-history`

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `[action]/route.ts:437` (GET, in `PUBLIC_READ_ACTIONS`) → backend `employerActions.ts:537` |
| **Action literal** | `acceptance-history` |
| **Current RBAC dependency** | Web: NO Clerk session required (`PUBLIC_READ_ACTIONS`). Backend: NO `requireClerkUserId` call (line 539 — only `entityId` validation) |
| **Current ownership assumption** | None — explicitly public. `loadEmployerAcceptanceHistory({entityId, clinicianNpi})` returns ALL acceptances for that subject across all employers |
| **Workflow transition** | None — read |
| **Prisma mutations** | NONE |
| **Audit writes** | NONE |
| **Side effects** | None |
| **External calls** | None |
| **Readonly behavior** | n/a — anonymous |
| **Replay risk** | NONE |
| **Tenant-boundary assumptions** | NONE — explicitly cross-tenant; the response includes acceptances from any employer for this subject NPI |

**Branch-specific risk:** by design, this surfaces every employer that accepted the clinician. If reclassified to `AUTHENTICATED_READ_ACTIONS` per the lock §3, the wire changes (auth-required) AND the response semantics change (only the actor's own acceptances visible — which is a different feature, not a hardening). The lock's reclassification is a behavior change, not a security tightening.

---

## B10 — `refresh-requests` (sibling NPI-keyed GET)

| Dimension | Observed |
|---|---|
| **Route entry point** | Web `npi/[npi]/refresh-requests/route.ts:7` → backend `employerActions.ts:943` |
| **Action literal** | n/a — the path itself is the verb |
| **Current RBAC dependency** | Web: NO Clerk session required (web file imports no `auth()` — line 1 has only NextRequest/NextResponse + BACKEND_URL). Backend: NO `requireClerkUserId` call. NPI format-checked (`/^\d{10}$/`) on both sides |
| **Current ownership assumption** | NONE by design — comment at backend line 941 states "NPI is already public; the response contains no PII beyond count" |
| **Workflow transition** | None — read |
| **Prisma mutations** | NONE |
| **Audit writes** | NONE |
| **Side effects** | None |
| **External calls** | None |
| **Readonly behavior** | n/a — anonymous |
| **Replay risk** | NONE |
| **Tenant-boundary assumptions** | None — explicitly cross-tenant. Returns count of `EMPLOYER_REVIEW_REFRESH_REQUESTED` audit rows for the NPI within 30 days |

**Branch-specific risk:** an attacker with a list of NPIs can map "which providers have pending refresh requests" without authentication. The trade-off was made deliberately for the clinician-facing UX. Reclassification would break the unauthenticated UX path.

---

## Cross-branch comparison matrix

| | B1 accept | B2 confirm-start | B3 request-refresh | B4 route-to-review | B5 share-packet | B6 view | B7 packet | B8 status | B9 acceptance-history | B10 refresh-requests |
|---|---|---|---|---|---|---|---|---|---|---|
| Web auth required? | Y | Y | Y | Y | Y | N | Y | Y | N | N |
| Backend `requireClerkUserId`? | Y | Y | Y | Y | Y | N | Y | Y | N | N |
| Role gate on backend? | N | N | N | N | N | N | N | N | N | N |
| Ownership compare actor↔resource? | N | scoped via lookup | N | N | N | N | N | scoped via lookup | N | N |
| `prisma.$transaction` (mutation+audit)? | Y | Y | Y | Y | n/a (audit-only) | n/a (no DB) | n/a (audit-only) | n/a (no DB) | n/a (no DB) | n/a (no DB) |
| Audit row written? | Y | Y | Y | Y | Y | N | Y | N | N | N |
| Side effects fire-and-forget? | Y | Y | Y | Y | N | Y | N | Y | N | N |
| Readonly role would mutate? | Y (today) | Y | Y | Y | Y | n/a | Y (audit-write) | Y (telemetry) | n/a | n/a |
| Replay produces duplicates? | Y (race) | Y (HIGH) | Y | Y | Y (token) | Y (telemetry) | Y (audit) | n/a | n/a | n/a |
| Cross-tenant probe possible? | Y | partial (per-actor) | Y | Y | Y | Y | Y | partial | Y (by design) | Y (by design) |

**Key observations:**

- All five mutating handlers (B1–B5) share the identical authorization shape — there is NO per-action differentiation today. Per `w2-pr2b-runtime-mutation-audit.md` §7, the lock's per-action role threshold is a NEW behavior.
- Three branches — B6, B9, B10 — are explicitly anonymous by design. Reclassifying them changes UX, not just security.
- Only B2 and B8 have per-actor scoping in their lookup queries (`loadEmployerReviewStatus({employerId, ...})` and the acceptance lookup in confirm-start). Every other mutating branch performs the mutation without comparing actor to resource.
- Atomic mutation+audit holds for B1, B2, B3, B4. B5 and B7 are audit-only by design (no mutation row to be atomic with). B6, B8, B9, B10 emit no audit row.

---

## Closing principle

The branch map establishes per-branch ground truth. It is the contract every subsequent ownership-enforcement wave inherits. A wave that proposes to enforce ownership on B5 (share-packet) without first hardening the audit-as-persistence pattern is treating the persistence shape as if it were B1's — that mismatch is exactly what the audit surfaces and what the lock must absorb before code lands.

**Per-branch reality, not per-branch idealization, is the substrate of W2-PR2B.**
