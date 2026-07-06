# M8 — Clinician Wallet & Standards Conformance — Status

**Date:** 2026-07-06

## Already built on main (verified present)

| Item | Evidence |
|---|---|
| **M8-1 Web wallet** | `components/passport/PassportWallet.tsx`, `components/wallet/{WalletPassport,CredentialWallet}.tsx`, `lib/wallet/*` |
| **M8-2 Selective disclosure** | `packages/vc-formats-csdjwt`, `components/clinician/SelectiveDisclosureModal.tsx`, `services/sd-jwt`, `routes/sdJwt.ts` (+ `sdJwt.wave199` tests) |
| **M8-4 OID4VP/VCI conformance** | `.github/workflows/openid-conformance.yml` present (runs against issuer/verifier-api) |
| **M8-5 Revocation registry** | `apps/status-api/src/routes/statusList.ts` (verifier-checkable status list) + `revocationPropagation.integration` / `revocation.cascade.*` tests + `RevocationModal` |

## Shipped this wave

- **M8-6 Substrate anchoring decision (ADR).** `docs/architecture/adr-substrate-anchoring.md`
  — park substrate; rely on ES256-signed receipts + Merkle proofs; the M4-1
  zero-PHI guard already protects the anchor boundary. This resolves the open
  "promote or park" question the plan flagged.

## Follow-up

- **M8-3 Mobile wallet** — Expo skeleton exists; LocalCredentialStore /
  OfflinePresentationEngine / OID4VPHandler build is a **P2 deferred** effort
  (not an enterprise-web prerequisite).
- **M8-4 (run to green)** — execute the conformance suite and commit the report
  artifact; needs the issuer/verifier-api test harness running in CI.

## Assessment

M8's web-wallet + standards surface was already substantially built; this wave
adds the substrate ADR (the one open decision). Mobile + a committed conformance
report remain, but neither blocks enterprise-web GA.
