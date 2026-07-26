# M4-1 — Data Classification & Flow Map

**Date:** 2026-07-06
**Purpose:** enumerate where identity / PII / PHI-adjacent data lives, and prove
the doctrine invariant **Zero PHI on-chain** is enforced, not just intended.

## Data classes

| Class | Examples | Where it lives | On-chain? |
|---|---|---|---|
| **Public provider identity** | NPI, name, taxonomy, practice address (all from public NPPES) | Postgres (`vcv_entities`, profiles) | No (only hashes) |
| **Source-check results** | license status, OIG exclusion flag, PECOS enrollment, coverage state + timestamp | Postgres (source runs, receipts) | No |
| **PSV receipts / trust state** | receipt snapshots, `revoked`, `expiresAt`, claim digests | Postgres (`psv` tables, trust-state) | Only the **hash** (Merkle leaf) |
| **Audit events** | mutation type, referenceId, actor, `hash`, metadata | Postgres (`audit_events`), batched into a Merkle tree | Only the **Merkle root hash** |
| **Auth identity** | Clerk user id/email, org membership, persona | Clerk (managed) + Postgres (`workspace` tables) | No |
| **Self-attested profile** | clinician-entered bio/sections (`selfAttested Json?`) | Postgres | No |

There is **no clinical/treatment PHI** in the wedge product — the data is
credentialing evidence (public + self-attested + source-check results). The
"PHI-adjacent" concern is identity linkage, handled by keeping only hashes on any
public ledger.

## On-chain boundary (the anchor path)

```
mutations → audit_events (Postgres) → merkleBatcher.anchorPendingEvents()
          → Merkle ROOT (sha256 hex) → anchorWorker → [ledger write]
```

- Only the **Merkle root hash** ever reaches the anchor boundary. Individual
  events, payloads, and any identity fields stay in Postgres.
- **Enforced (M4-1):** `assertHashOnlyAnchor()` (`packages/poe-engine/zeroPhiGuard.ts`)
  runs in `anchorWorker.ts` **before** any ledger write. It fails closed unless
  the value is a hex hash / array of hashes / object of hashes+numeric metadata,
  and additionally denylists email / SSN / phone / DOB / bare-10-digit-NPI
  patterns. A non-hash payload is **blocked and logged**, never anchored.
- Proven by `packages/poe-engine/zeroPhiGuard.test.ts` (15 cases: accepts sha256/
  sha512/0x/arrays/canonical anchor objects; rejects names, emails, NPIs, SSNs,
  non-hash fields, free-form keys, non-numeric metadata).
- Note: the production ledger write is currently **simulated** (a log line); the
  guard hardens the boundary ahead of any real substrate anchoring (M8-6 decision).

## Residual actions

- Field-level encryption for the most sensitive receipt payloads at rest — M4-2.
- Data-subject export/delete honoring append-only audit (tombstone) — M4-5.
