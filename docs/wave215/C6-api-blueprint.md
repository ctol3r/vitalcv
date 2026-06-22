# W215-C6 — API Blueprint

**Wave:** 215 · **Depends on:** [C2](./C2-evidence-migration-map.md)–[C5](./C5-graph-implementation-plan.md)
**Date:** 2026-06-20

Future read contracts. All are **additive, read-only, versioned** (`vitalcv.*.v1`), composed from existing services. None mutates; none changes an existing route.

---

## 0. Conventions (match the repo)

- Versioned envelopes: every payload carries `schema: 'vitalcv.<name>.v1'` (matches 15+ existing contracts).
- `entityId` accepts `VcvEntity.canonicalId` **or** 10-digit NPI (matches `fetchPassportEntity` behavior).
- Read-only, `Cache-Control: no-store`, honest empty states. No bare `Verified`; passes `pnpm check:claims`.
- Auth: public read where the passport is already public; Clerk-gated where employer-review is gated (match existing surfaces).

---

## 1. `GET /evidence/:entityId`

Returns the `EvidenceCollection` (C3).

```jsonc
{
  "schema": "vitalcv.evidence-collection.v1",
  "subjectKey": "…canonicalId…",
  "generatedFor": { "displayName": "Ada Lovelace", "npi": "1234567890" },
  "objects": [
    { "evidenceId": "claim_…", "evidenceClass": "licensure", "label": "California RN License",
      "status": "checked", "decisionGrade": true, "source": { "sourceId": "STATE_BOARD", "governance": "gated" },
      "observedAt": "…", "checkedAt": "…", "expiresAt": "…", "integrityHash": "…",
      "provenance": { "artifactIds": ["…"], "receiptIds": ["…"] }, "lifecycle": "active" }
  ],
  "relationships": [ { "from": "claim_…", "to": "STATE_BOARD", "type": "verified_by", "confidence": 0.99 } ],
  "coverageSummary": { "checked": ["NPPES_API"], "gated": ["STATE_BOARD"], "stale": [], "...": [] }
}
```
**Composes:** `ClaimRecord` + `VerificationArtifact` + `VcvCredential` + receipts via C3 normalizers. **Status:** new route, no new storage.

## 2. `GET /timeline/:entityId`

Returns the `CareerTimeline` (C4).

```jsonc
{
  "schema": "vitalcv.career-timeline.v1",
  "subjectKey": "…",
  "firstAt": "…", "lastAt": "…",
  "entries": [
    { "entryKey": "…hash…", "category": "verification", "occurredAt": "…",
      "title": "OIG/LEIE checked — clear", "detail": "…", "evidenceRefs": ["receipt_…"],
      "sourceEventType": "PSV_RECEIPT", "immutable": true }
  ]
}
```
**Composes:** `AuditEvent` + `EntityChangeEvent` + `WatchtowerEvent` + `StorylineTimeline` + recognition tables via C4 merge. Supports `?since=&limit=`. **Status:** new route, projection only.

## 3. `GET /recognition/:entityId`

Returns the canonical Recognition→Acceptance→Start chain as read-only evidence.

```jsonc
{
  "schema": "vitalcv.recognition-history.v1",
  "subjectKey": "…",
  "events": [
    { "type": "recognition", "recognitionId": "…", "employerKey": "…", "recognizedAt": "…",
      "hashAnchor": "…", "verification": { "verifiedAt": "…", "verificationRef": "…" } },
    { "type": "acceptance", "acceptanceId": "…", "recognitionId": "…", "acceptedAt": "…", "psvReportId": "…" },
    { "type": "start", "startId": "…", "acceptanceId": "…", "actualStartDate": "…", "attestedAt": "…" }
  ]
}
```
**Composes:** Prisma `Recognition`/`Acceptance`/`Start` (read). **Honors** `VerifiedCanonicalPath` immutability — exposes, never constructs. **Status:** new read route over existing tables.

## 4. `GET /mobility/:entityId`

Per-clinician mobility readiness (today's `/api/intelligence/mobility` is *aggregate analytics*; this is *per-entity*).

```jsonc
{
  "schema": "vitalcv.mobility-readiness.v1",
  "subjectKey": "…",
  "licensure": { "states": ["CA","NV"], "compactEligible": true, "compactType": "NLC" },
  "readinessByState": [
    { "state": "NV", "status": "needs_review", "missing": ["State board check gated"], "estimatedStartDays": 14 }
  ],
  "reusableEvidence": ["claim_npi_identity", "receipt_oig_leie"]
}
```
**Composes:** `VcvCredential` (multi-state/compact) + readiness engine + EvidenceCollection. **Note:** this is the **one route needing genuinely new logic** — per-state readiness projection (a thin reuse of the readiness engine per target state). Flag as **CREATE** in C7. Defer opportunity-matching (`/api/opportunities` already exists) to W260.

## 5. `GET /graph/:entityId`

Evidence-centric subgraph (C5).

```jsonc
{
  "schema": "vitalcv.evidence-graph.v1",
  "subjectKey": "…",
  "nodes": [ { "id": "…", "type": "license", "label": "CA RN", "trustBand": "L2", "layer": "trust" } ],
  "edges": [ { "id": "…", "source": "clinician_…", "target": "license_…", "type": "verified_by",
              "confidence": 0.99, "evidenceRefs": ["receipt_…"] } ],
  "stats": { "nodeCount": 12, "edgeCount": 18 }
}
```
**Composes:** `evidenceCollectionToGraph` (C5) + existing `/api/graph/:npi`. **Status:** new composed route; reuses graph schema + render.

## 6. Contract summary

| Route | Schema | Reuse vs. create | New logic |
|---|---|---|---|
| `GET /evidence/:entityId` | `evidence-collection.v1` | compose | normalizers (C3) |
| `GET /timeline/:entityId` | `career-timeline.v1` | compose | merge/sort (C4) |
| `GET /recognition/:entityId` | `recognition-history.v1` | reuse | read-only projection |
| `GET /mobility/:entityId` | `mobility-readiness.v1` | **partial create** | per-state readiness |
| `GET /graph/:entityId` | `evidence-graph.v1` | compose | evidence→graph map (C5) |

**Five new read routes; four are pure composition; one (`/mobility`) needs per-state readiness logic.** All additive, none touches `/packet`, `/passport`, or `/employer-review`.

**Deliverable status:** complete. Proceed to C7.
