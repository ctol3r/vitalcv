# apps/status-api — VC revocation status service (W3C VC 2.0 Bitstring Status List)

**Status:** real, minimal, **not deployed**. Workspace member `@vitalcv/status-api` (Express).

Purpose: serves the revocation registry for verifiable credentials using the
W3C **Bitstring Status List v1.0** data model on VC 2.0
(<https://www.w3.org/TR/vc-bitstring-status-list/>). Ported from the
StatusList2021 predecessor as launch blocker #11 (`docs/ops/launch-blockers.md`);
the predecessor's `/status-list/2021*` routes were removed with the port — the
service was never deployed and the repo has no live consumer of them.

Surface:

- `GET  /status-list/bitstring` — the `BitstringStatusListCredential`
  (`application/vc+ld+json`; `encodedList` = base64url, no padding, of the
  GZIP-compressed 131,072-bit list).
- `GET  /status-list/entry/:credential_id` — a `BitstringStatusListEntry` for
  embedding as `credentialStatus` in an issued VC.
- `GET  /status-list/status/:credential_id` — registry view of one credential.
- `GET  /status-list/summary` — entry/revocation counts.
- `POST /status-list/revoke` / `POST /status-list/restore` — flip a
  credential's bit.

Verifier side: `src/lib/verifyStatus.ts` implements the **fail-closed** check —
an unfetchable, malformed, wrong-format (including StatusList2021), purpose-
mismatched, out-of-range, or expired status list always yields `unverifiable`
(`acceptable: false`), never silently not-revoked. `src/__tests__/` proves each
failure mode.

Storage is in-memory (unchanged from the predecessor). The durable,
database-backed Bitstring implementation lives in
`apps/api/backend/src/services/ledger/statusListManager.ts` and is served at
`GET /api/credentials/status-list`.

Run locally: `pnpm --filter @vitalcv/status-api dev`
Tests: `pnpm --filter @vitalcv/status-api test`
