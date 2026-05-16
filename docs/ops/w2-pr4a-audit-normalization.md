# W2-PR4A - Audit Normalization

**Wave:** W2-PR4A
**Date:** 2026-05-09
**Status:** Implemented for the employer-review runtime mutation seam.

## Goal

Normalize audit metadata so runtime events can be joined across route handlers, audit rows, outbox payloads, replay traces, and dossier exports without guessing from event type strings.

## Normalized Audit Fields

The following fields are written on the touched mutation audit metadata:

| Field | Required in touched seam | Notes |
|---|---:|---|
| `correlationId` | Yes | Forwarded from request header or generated server-side. |
| `mutationFingerprint` | Yes | Stable across identical redacted payloads even when correlation ID changes. |
| `actor` | Yes | Clerk user attribution for employer-review actions. |
| `mutationClassification` | Yes | Canonical classification string. |
| `replayCategory` | Yes | One of `R-CAT-1` through `R-CAT-5`; replay engine uses `R-CAT-6`. |
| `payloadHash` | Yes | Redacted payload hash. |
| `runtimeTrust` | Yes | Full envelope for consumers that need one field. |

## Audit Rows Covered

| Audit event type | Runtime classification | Replay category |
|---|---|---|
| `EMPLOYER_REVIEW_ACCEPTED` | `TRUST_ACCEPTANCE` | `R-CAT-1` |
| `EMPLOYER_REVIEW_REFRESH_REQUESTED` | `TRUST_REFRESH_REQUEST` | `R-CAT-2` |
| `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` | `TRUST_REVIEW_ROUTING` | `R-CAT-2` |
| `ARTIFACT_EXPORTED` | `TRUST_PACKET_EXPORT` | `R-CAT-3` |
| `EMPLOYER_PACKET_SHARED` | `TRUST_PACKET_SHARE` | `R-CAT-3` |
| `START_ATTESTED` | `TRUST_START_ATTESTATION` | `R-CAT-4` |
| `EMPLOYER_REVIEW_MUTATION_DENIED` | `DENIED_MUTATION` | `R-CAT-5` |

## Redaction Rule

`payloadHash` is derived from a redacted payload envelope. The helper redacts small-domain or sensitive fields before hashing:

- `npi`
- `clinicianNpi`
- `subjectNpi`
- `notes`
- `message`
- `shareToken`
- `shareUrl`
- `token`

The raw share token and raw share URL are still never written into share-packet audit metadata.

## Backward Compatibility

Legacy employer-review audit metadata can still be read. When older rows lack runtime fields, `readMetadata()` derives fallback runtime metadata from the old action, employer, entity, clinician NPI, and request ID. That keeps status/history reads stable while new writes carry the normalized contract.

## Known Limit

Because this PR intentionally avoids schema migration, `payloadHash`, `actor`, and `correlationId` are JSON metadata fields, not first-class indexed columns. The schema-level replay-protection constraint remains outside PR4A.
