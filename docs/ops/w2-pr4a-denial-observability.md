# W2-PR4A - Denial Observability

**Wave:** W2-PR4A
**Date:** 2026-05-09
**Status:** Implemented for employer-review denied mutation paths with known subject context.

## Goal

Denied mutations should be observable and replay-classified. A denied attempt is still operationally important: it can indicate duplicate submissions, blocked source posture, stale/cross-context data, or a readonly actor attempting a write.

## Denial Event

PR4A adds `EMPLOYER_REVIEW_MUTATION_DENIED` to the backend audit event type union and writes a denial audit row for the touched employer-review mutation failures.

Each denial row carries:

- `correlationId`
- `mutationFingerprint`
- `actor`
- `mutationClassification: DENIED_MUTATION`
- `replayCategory: R-CAT-5`
- `payloadHash`
- `runtimeTrust.outcome: denied`
- `runtimeTrust.denialReason`
- `runtimeTrust.readonly`

## Denial Paths Covered

| Route | Denial reason | Notes |
|---|---|---|
| `POST /accept` | `already_accepted` | Duplicate active acceptance. |
| `POST /accept` | `passport_unavailable` | Passport could not be built for the reviewed entity. |
| `POST /accept` | `acceptance_blocked` | Passport decision posture is blocked. |
| `POST /share-packet` | `npi_mismatch` | Body NPI does not match the reviewed entity NPI. |
| `POST /confirm-start` | `missing_acceptance` | Start attempted before an accepted employer acceptance exists. |
| `POST /confirm-start` | `acceptance_npi_mismatch` | Referenced acceptance does not bind to the reviewed clinician NPI. |

## Readonly Indicator

The backend reads `x-verifier-team-role`. If the value is `readonly`, denied runtime metadata records:

```json
{
  "attemptedByReadonly": true,
  "source": "x-verifier-team-role"
}
```

Otherwise the row records:

```json
{
  "attemptedByReadonly": false,
  "source": null
}
```

## Telemetry Normalization

Denied mutations also emit a structured warning log with:

- `entityId`
- `actorId`
- `denialReason`
- `correlationId`
- `mutationFingerprint`
- `mutationClassification`
- `replayCategory`
- `readonly`

This gives operators a normalized denial trace even before indexed schema columns exist.

## Known Limits

- Authentication failures are still returned before a subject is resolved, so PR4A does not fabricate clinician/entity audit attribution for unauthenticated callers.
- Malformed path/body validation failures that occur before subject resolution are not forced into the denial audit stream.
- The denial audit row is not a substitute for W2-PR2 ownership enforcement; it makes denied paths observable, but it does not add new tenant authorization logic.
