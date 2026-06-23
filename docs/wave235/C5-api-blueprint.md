# W235-C5 — Reputation API Blueprint

**Wave:** 235 · **Depends on:** [C2](./C2-reputation-projection-model.md)–[C4](./C4-reputation-history.md)
**Date:** 2026-06-21

Read-only, versioned (`vitalcv.reputation.*.v1`) contracts. Compose the shipped evidence/trust/timeline pipeline; no persistence; recruiter surfaces untouched. Same pattern as the evidence/graph/trust/timeline routes.

---

## 1. `GET /reputation/:entityId`

The full `ReputationProjection`.

```jsonc
{
  "schema": "vitalcv.reputation.v1",
  "subjectKey": "…",
  "overall": { "standing": "emerging", "overallTrust": 0.6, "decisionGradeEvidence": 4,
               "totalEvidence": 6, "trend": "growing" },
  "dimensions": [
    { "dimension": "authority", "score": 0.8, "standing": "established", "breadth": 3,
      "distinctSources": ["STATE_BOARD", "ABMS"], "lastReinforcedAt": "2026-03-03T…",
      "recognitionCount": 0, "basis": ["cred:lic-ca", "cred:lic-nv", "cred:abms"] },
    { "dimension": "leadership", "score": null, "standing": "unknown", "breadth": 0,
      "distinctSources": [], "lastReinforcedAt": null, "recognitionCount": 0, "basis": [] }
  ],
  "history": { "growth": 4, "decay": 1, "recovery": 1, "milestones": 3, "trend": "growing", "entries": [ … ] },
  "basis": { "totalEvidence": 6, "decisionGradeEvidence": 4,
             "distinctSources": ["NPPES_API", "STATE_BOARD", "ABMS", "ORCID"], "distinctJurisdictions": ["CA", "NV"] }
}
```

## 2. `GET /reputation/:entityId/history`

The `ReputationHistory` only (growth/decay/recovery/milestones + entries). Supports `?dimension=authority&since=&limit=`.

```jsonc
{ "schema": "vitalcv.reputation-history.v1", "subjectKey": "…",
  "growth": 4, "decay": 1, "recovery": 1, "milestones": 3, "trend": "growing",
  "entries": [ { "occurredAt": "…", "type": "recovery", "dimension": "authority",
                 "detail": "CA license re-verified after expiry", "evidenceId": "cred:lic-ca", "scoreDelta": 1 } ] }
```

## 3. `GET /reputation/:entityId/dimensions`

The five `ReputationDimension`s only — for a domain-by-domain view.

```jsonc
{ "schema": "vitalcv.reputation-dimensions.v1", "subjectKey": "…",
  "dimensions": [ /* ReputationDimension[] */ ] }
```

## 4. Contract summary

| Route | Schema | Composes |
|---|---|---|
| `GET /reputation/:entityId` | `reputation.v1` | `projectReputation(evidence, trust, timeline)` |
| `GET /reputation/:entityId/history` | `reputation-history.v1` | `.history` slice |
| `GET /reputation/:entityId/dimensions` | `reputation-dimensions.v1` | `.dimensions` slice |

Pipeline: `passport → EvidenceCollection → GraphProjection → TrustProjection → TimelineProjection → ReputationProjection`. The first four stages already ship; only `projectReputation` is new.

## 5. Honesty / API rules

1. Every score carries its `basis` (evidenceIds) — the API is self-auditing (objectivity proof in the payload).
2. `null` score + `unknown` standing render honestly for empty domains.
3. No bare `Verified`; passes `pnpm check:claims`.
4. Read-only, `Cache-Control: no-store`, ETag on `lastCheckedAt` (caching designed).
5. Auth posture matches the passport surface (flag for policy, as with the other evidence routes).

## 6. Success-criteria answer

- **How do we connect reputation to mobility?** Reputation dimensions (esp. `authority`) and mobility readiness read the same licensure/registration evidence; a reputation growth/recovery in those classes is the same `CareerEvent` that expands mobility (C4 §5). No separate connector needed.

**Deliverable status:** complete. → C6.
