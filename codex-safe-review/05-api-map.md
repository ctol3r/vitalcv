# W228-C4 — API Map

**Date:** 2026-06-21 · All routes: `runtime = 'nodejs'`, read-only `GET`, `Cache-Control: no-store`, try/catch → 500, versioned envelope.

---

## 1. Routes

| Method · Path | Schema | Composition | Auth |
|---|---|---|---|
| `GET /api/evidence/[entityId]` | `vitalcv.evidence-collection.v1` | passport → `passportToEvidenceCollection` | none (public passport runtime) |
| `GET /api/graph/[entityId]` | `vitalcv.evidence-graph.v1` | … → `projectEvidenceToGraph` | none |
| `GET /api/graph/[entityId]/trust` | `vitalcv.evidence-graph-trust.v1` | … → `propagateTrust` | none |
| `GET /api/timeline/[entityId]` | `vitalcv.timeline.v1` | … → `projectTimeline` | none |

`entityId` accepts a `VcvEntity.canonicalId` (UUID) or a 10-digit NPI — both resolve through `resolvePassportRuntimePassport` (existing).

## 2. Namespace coupling (reviewed-safe)

The graph routes live under the existing `/api/graph/*` namespace, which already has static siblings: `network/`, `live/[npi]/`, `node/[nodeId]/expand/`. The new `[entityId]` is the only **dynamic** segment at the `graph/` level. Next.js resolves static segments before dynamic, so:
- `/api/graph/network`, `/api/graph/live/X`, `/api/graph/node/X/expand` → unchanged (static win).
- `/api/graph/<uuid-or-npi>` → new evidence-graph route.

No param-name conflict (the existing dynamics `[npi]`/`[nodeId]` are at deeper paths, not siblings of `[entityId]`). **Confirmed at typecheck + build; no route shadowed.**

## 3. Response envelope (uniform)

```jsonc
{ "schema": "vitalcv.<name>.v1", ...projection }
// error:
{ "error": "<code>", "error_description": "<detail>" }   // HTTP 500
```

## 4. Auth posture (flag for reviewer)

These routes are **unauthenticated**, matching the public passport runtime (`/api/passport/entity/[id]` is also unauthenticated). They expose source-backed, non-PHI credential evidence — the same data already public via the passport. **If** the reviewer's policy requires evidence/graph/timeline to be gated more tightly than the passport, that is a one-line `auth()` addition per route (parallel to `/api/export/packet`, which IS Clerk-gated). Flagged as a policy decision, not a defect — current posture is consistent with the existing passport surface.

## 5. Not changed

`/api/passport/*`, `/api/employer-review/*`, `/api/export/packet`, `/packet/[entityId]`, and the existing `/api/graph/{network,live,node}` are untouched. The recruiter pipeline is unaffected.
