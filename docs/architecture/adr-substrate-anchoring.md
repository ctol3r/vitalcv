# ADR — Substrate Anchoring: Park it; rely on signed receipts + Merkle proofs

**Status:** Accepted (M8-6) · **Date:** 2026-07-06 · **Updated:** 2026-07-25

> **2026-07-25 — the parked pallet skeletons were deleted.** This decision is
> unchanged; only the dead code backing it is gone. `blockchain/`,
> `apps/api/substrate/`, `apps/api/pallets/`, `apps/api/identity-governance-pallet/`,
> `backend/src/blockchain/multi_token_pallet.rs`, and `k8s/substrate/` were
> removed (~30k lines) after the new [Rust SCA gate](../security/dependency-remediation.md#rust--cargo-sca)
> showed they carried 171 unaudited advisories — one of them a CVSS 9.9
> unfixable critical — while nothing built, deployed, or imported them.
>
> **The revisit path below is unaffected.** It never depended on these
> skeletons: it rests on `assertHashOnlyAnchor`, `merkleBatcher.ts`, and
> `anchorWorker.ts`, all of which remain. Wiring a real anchor was already "a
> wiring task, not a redesign", and it still is — against whatever ledger is
> chosen at that point, rather than against 2022-era Substrate skeletons that
> would have needed a full rewrite anyway.

## Context

The audit ledger batches events into a Merkle tree (`merkleBatcher.ts`) and an
`anchorWorker.ts` produces a Merkle root every 5 minutes. The actual on-chain
write is **simulated** (a log line) — no substrate extrinsic is submitted in
production. Public copy says evidence is "cryptographically signed" (receipts are
ES256-signed), not "blockchain-anchored" (that phrase is a banned claim).

## Decision

**Do not promote `blockchain/substrate` to production now.** Rely on:
1. **ES256-signed receipts** (already the truth source; HS256 is banned).
2. **Merkle inclusion proofs** over the batched audit tree for tamper-evidence.
3. The **zero-PHI-on-chain guard** (`assertHashOnlyAnchor`, M4-1) already gates the
   anchor boundary, so if/when a real ledger write is wired, it is hash-only by
   construction.

## Rationale

- No public claim depends on an on-chain anchor — copy is "signed", not "anchored".
- A live substrate deployment adds ops burden (node ops, key custody, chain
  liveness) with no current product or compliance requirement.
- Merkle proofs + signed receipts already deliver tamper-evidence and external
  verifiability without a chain.

## Consequences

- The `anchorWorker` simulated write stays as-is, guarded by `assertHashOnlyAnchor`.
- Revocation status (M8-5) is served via the verifier-checkable status list
  (`apps/status-api/src/routes/statusList.ts`), not a chain.
- Revisit only if a buyer/regulator requires an independent public anchor; the
  guard + Merkle root make that a wiring task, not a redesign.
