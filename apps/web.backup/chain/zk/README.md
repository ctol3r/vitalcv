# ZK Audit Proofs

This directory contains the assets that back Task 131 – the auditor-facing,
zero-knowledge proofs that an audit event is committed to the ledger.

## Circuit

- `circuits/event-ledger.circom` implements a Groth16-friendly Merkle inclusion
  circuit that:
  - treats the event hash as the private leaf;
  - hashes sibling pairs with a MiMC-style sponge that stays inside the BN254
    scalar field;
  - enforces a fixed depth-16 tree (unused levels are padded with zero siblings).
- Public inputs:
  - `root` – the anchored ledger commitment;
  - `pathCommitment` – linear digest of the witness so auditors can spot stale
    witnesses.
- Private inputs:
  - `leaf`, `siblings[16]`, `pathPositions[16]`.

## Building

```
pnpm dlx circom ./chain/zk/circuits/event-ledger.circom \
  --r1cs --wasm --prime bn128 --output ./chain/zk/artifacts

pnpm dlx snarkjs groth16 setup \
  ./chain/zk/artifacts/event-ledger.r1cs \
  ./chain/zk/powersOfTau28_hez_final_10.ptau \
  ./chain/zk/artifacts/event-ledger.zkey

pnpm dlx snarkjs zkey export verificationkey \
  ./chain/zk/artifacts/event-ledger.zkey \
  ./chain/zk/artifacts/event-ledger.vkey.json
```

Place the generated `event-ledger.wasm`, `event-ledger.zkey`, and
`event-ledger.vkey.json` files inside `chain/zk/artifacts/`.

> The API will gracefully fall back to deterministic mock proofs whenever the
> `.wasm`/`.zkey` files are missing so that local development does not require
> a full trusted setup.

## Default Paths

The prover service (`apps/api/src/services/zk/prover.ts`) resolves artifacts
relative to the repository root:

| Asset                 | Default path                              |
| --------------------- | ----------------------------------------- |
| Circuit wasm          | `chain/zk/artifacts/event-ledger.wasm`    |
| Groth16 key           | `chain/zk/artifacts/event-ledger.zkey`    |
| Verification key JSON | `chain/zk/artifacts/event-ledger.vkey.json` |

You can override the directory with the `ZK_ARTIFACT_DIR` environment variable.


