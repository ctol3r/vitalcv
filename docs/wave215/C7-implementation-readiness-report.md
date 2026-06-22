# W215-C7 — Implementation Readiness Report

**Wave:** 215 · **Synthesizes:** [C1](./C1-implementation-analysis.md)–[C6](./C6-api-blueprint.md)
**Date:** 2026-06-20

The executable roadmap for Waves 220–270. Outcome: not code — an implementation-ready plan.

---

## 0. Six success-criteria answers (one line each)

1. **Evidence Objects** → a typed facade (`packages/domain-evidence`) + pure normalizers over `ClaimRecord`/`VerificationArtifact`/`VcvCredential`/receipts. No new storage. (C3)
2. **Professional Memory** → a deterministic merge/sort projection over `AuditEvent` + `EntityChangeEvent` + `WatchtowerEvent` + `StorylineTimeline` + recognition tables. No new event store. (C4)
3. **Career Timelines** → `CareerTimeline` read model + `GET /timeline/:entityId`, rendered via existing `AnimatedTimeline`/`LiveStateLog`. (C4)
4. **Mobility Readiness** → per-state projection of the readiness engine over `VcvCredential` + EvidenceCollection; `GET /mobility/:entityId`. The one genuinely new compute. (C6)
5. **Career Evidence Graph** → `evidenceCollectionToGraph` projector onto the existing `graph-system/types.ts` schema + `/api/graph/*`; ontology conformance test. (C5)
6. **Passport → Career Evidence without breaking recruiter value** → everything additive + read-only; `/packet/[entityId]`, `career-packet.ts`, `/api/passport/*`, `/api/employer-review/*` untouched; EvidenceObject is a view, not a rewrite. (C2)

## 1. Impacted packages

| Package | Change | Risk |
|---|---|---|
| `packages/domain-evidence` (**new**) | EvidenceObject types + normalizers + collection assembler | Low — pure, additive, no deps on apps |
| `packages/trust-state` | none (consumed) | None |
| `packages/domain-common` | none (consumed) | None |
| `packages/source-adapters` | none (consumed) | None |
| `packages/audit`, `core/watchtower`, `core/storylines` | none (read for timeline) | None |
| `apps/web` | new read routes + UI mounts; existing surfaces unchanged | Low |
| `apps/api/backend` | new aggregator services; existing routes unchanged | Low–Med (query fan-out) |

## 2. Impacted routes

**New (additive, read-only):** `GET /evidence/:entityId`, `/timeline/:entityId`, `/recognition/:entityId`, `/mobility/:entityId`, `/graph/:entityId` (+ W220 sub-routes `/graph/:entityId/{nodes,relationships,trust,timeline}`).
**Unchanged (protected):** `/packet/[entityId]`, `/api/passport/*`, `/api/employer-review/*`, `/api/graph/*` (existing), `/api/export/packet`.

## 3. Impacted schemas

- **No Prisma migration required for W220.** EvidenceObject/Timeline/Graph are read projections over existing tables (`ClaimRecord`, `VerificationArtifact`, `VerificationReceiptRecord`, `PsvReceipt`, `VcvCredential`, `VcvEntityRelationship`, `Recognition/Acceptance/Start`, `AuditEvent`-backed, `EntityChangeEvent`, `IngestEvent`).
- **New versioned API contracts only:** `evidence-collection.v1`, `career-timeline.v1`, `recognition-history.v1`, `mobility-readiness.v1`, `evidence-graph.v1`.
- A materialized evidence index is **explicitly deferred** (gated decision, parallels `defer_until_contract_aligned`).

## 4. Migration risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Six evidence representations drift during normalization | Med | Single normalizer module + golden-fixture tests per source type; `decisionGrade ⇔ checked` invariant test |
| Status upgrade leaks (gated→checked) | **High (doctrine)** | `status.ts` is an identity map; gated-fixture test; reuse `assertNonGatedIfPositive` |
| Timeline divergence from immutable audit log | Med | Projection only — never writes; entries carry `sourceEventType` provenance |
| Ontology JSON vs runtime taxonomy mismatch | Med | Conformance test (every runtime NodeType ∈ ontology); do not rewrite the JSON |
| Recruiter surface regression | **High (business)** | Additive only; snapshot/contract tests on `/packet` + `career-packet` stay green |
| Banned strings / bare `Verified` in new copy | Med | `pnpm check:claims` + `banned-verified-label.test.ts` in CI for every new surface |

## 5. Performance risks

- `/evidence`, `/timeline`, `/graph` fan out across several tables per entity. Mitigate: per-entity queries keyed on indexed columns (`npi`, `subjectNpi`, `subjectId`, `entityId` all indexed); `Cache-Control` + ETag keyed on `lastCheckedAt`/`lastAt`; cap node/edge counts with honest "truncated" flags (no silent caps — `log`/annotate).
- Timeline merge is O(n log n) on event count per entity — bounded; cache behind ETag.
- Graph `live/:npi` streaming already exists; the evidence view reuses it.

## 6. Test strategy

1. **Unit (pure):** normalizers, status map, timeline merge (ordering/dedupe/empty), evidence→graph projector, mobility per-state. Vitest 4.x, `renderToStaticMarkup` for any RSC.
2. **Invariant:** `decisionGrade ⇔ checked`; no status upgrade; no bare `Verified`; recognition normalizer never constructs `VerifiedCanonicalPath`.
3. **Contract:** each new route returns its `vitalcv.*.v1` schema; honest empty states; 404 semantics.
4. **Regression:** `/packet`, `career-packet`, `employer-proof-packet`, `export-packet-route`, `banned-verified-label` stay green.
5. **Guardrails in CI:** `pnpm check:claims`, `pnpm typecheck`, `pnpm turbo run build --filter @vitalcv/web`.
6. **Codex SAFE** before any merge (doctrine).

## 7. Effort estimates (relative; 1 unit ≈ a focused PR with tests)

| Wave item | Scope | Effort |
|---|---|---|
| W220 `domain-evidence` types + normalizers + tests | C3 | 2 |
| W220 `buildEvidenceCollection` + `GET /evidence/:entityId` | C3/C6 | 1.5 |
| W220 evidence→graph projector + `GET /graph/:entityId(/nodes,/relationships,/trust)` + ontology test | C5 | 2.5 |
| W250 timeline merge + `GET /timeline/:entityId` + UI | C4 | 2.5 |
| W250 `GET /recognition/:entityId` | C6 | 1 |
| W260 `GET /mobility/:entityId` (per-state readiness) | C6 | 2 |
| Hardening: caching/ETags, truncation flags, perf | C7 | 1.5 |

**Total ≈ 13.5 units across W220–270.** The expensive items are graph projection and timeline merge; everything else is thin composition. **~85% is reuse**; the only genuinely new compute is per-state mobility readiness.

## 8. Recommended execution order

1. **W220:** `domain-evidence` (types → normalizers → `buildEvidenceCollection` → `/evidence/:entityId`), then evidence→graph projector + `/graph/:entityId` family. *(This is exactly what the incoming W220 brief asks — see `docs/wave220/`.)*
2. **W250:** timeline projection + `/timeline/:entityId` + `/recognition/:entityId`.
3. **W260:** mobility readiness.
4. **W270:** graph/ontology hardening + vision synthesis.

Recruiter value (`/packet`) rides untouched the entire way.

**Deliverable status:** W215 complete — C1–C7 delivered in `docs/wave215/`.
