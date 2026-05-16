# W2-PR4A - Replay Normalization

**Wave:** W2-PR4A
**Date:** 2026-05-09
**Status:** Implemented for runtime metadata and decision replay output.

## Goal

Replay traces must classify the same mutation the same way as route handlers and audit rows. PR4A introduces a single runtime taxonomy and carries replay metadata into `DecisionReplay`.

## Replay Categories

| Category | Meaning | Current producer |
|---|---|---|
| `R-CAT-1` | Trust acceptance mutation | Employer accept audit row |
| `R-CAT-2` | Employer review steering mutation | Refresh request, route-to-review |
| `R-CAT-3` | Trust packet distribution | Packet export, share packet |
| `R-CAT-4` | Start / outcome attestation | Confirm-start |
| `R-CAT-5` | Denied mutation attempt | Runtime denial audit row |
| `R-CAT-6` | Dossier / decision replay | `replayEngine.replayDecision()` |

## Replay Engine Output

`DecisionReplay` now includes:

```ts
replayMetadata: {
  schema: 'vitalcv.runtime-trust-replay.v1',
  correlationId: string,
  mutationFingerprint: string,
  mutationClassification: 'DOSSIER_REPLAY',
  replayCategory: 'R-CAT-6',
  payloadHash: string,
}
```

The replay engine preserves upstream `correlationId`, `payloadHash`, and `mutationFingerprint` when those fields exist on capsule metadata or nested employer-review action metadata. If older capsules lack them, the engine derives deterministic fallback payload/fingerprint values and generates a replay correlation ID.

## Consistency Rules

- Route handler classification and audit metadata classification must match.
- Replay category must be assigned by action family, not by UI route name.
- Dossier replay is always `DOSSIER_REPLAY` / `R-CAT-6`.
- Correlation ID is trace metadata only. It must not be used as the replay-dedupe key.
- Payload hash and mutation fingerprint survive correlation-ID changes.

## Test Coverage

Focused replay tests assert:

- `R-CAT-6` is emitted for dossier replay.
- Upstream runtime metadata survives into replay metadata.
- Runtime helper maps all mutation families to the normalized category set.

## Known Limit

The replay engine can only preserve upstream runtime metadata when the capsule received that metadata at creation time. Older capsules still get safe fallback replay metadata, but they cannot recover a historical correlation ID that was never stored.
