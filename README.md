# Chai VC Platform

End-to-end healthcare credentialing and hiring verification.

## DID Resolution

The backend now exposes a simple universal DID resolver that supports `did:web`, `did:ethr` and `did:key` methods. The resolver is implemented in `backend/src/did/universal_did_resolver.ts` using the `did-resolver` package and companion method resolvers. This utility can be imported and used anywhere within the backend:

```ts
import { defaultResolver } from './src/did/universal_did_resolver';

const doc = await defaultResolver.resolve('did:key:z6Mkw...');
```

## Premium API Tiers

Enterprise partners can unlock additional API capabilities by staking tokens on-chain. The available tiers are:

- **Gold** – requires 1,000 tokens staked
- **Platinum** – requires 5,000 tokens staked

See `backend/src/controllers/premium_api_controller.ts` for the stub implementation handling stake verification and tier checks.

## Ocean Protocol Marketplace

This prototype integrates [Ocean Protocol](https://oceanprotocol.com/) to mint and trade anonymized analytics as datatokens. See `backend/src/blockchain/ocean_marketplace.ts` for a minimal example using `@oceanprotocol/lib`.

## Ethereum Bridge

Smart contracts on Ethereum can validate hashed CHAI credentials using the
`ChaiCredentialBridge` contract found in the `contracts/` directory. An off-chain
or cross-chain process is expected to call `setCredentialValid` when a CHAI
credential has been confirmed on the source chain. Other contracts may query the
`validate` function to check if a given credential hash is recognised by the
bridge.

## zk-Rollup Prototype

The `backend/src/blockchain` directory contains a simple rollup prototype. It batches credential operations and anchors a SHA-256 proof on-chain via a stub Polkadot service.

## SDKs

SDKs are provided for integrating with external blockchains.

- `sdks/solana-sdk` &ndash; helper functions for Solana based projects.
- `sdks/avalanche-sdk` &ndash; helper functions for Avalanche projects.

These packages expose a `validate<Chain>Credential(apiUrl, payload)` function
that posts credential data to the CHAI validation API.

## Blockchain Support

The `backend/src/blockchain/evm_erc721_wrapper.ts` file provides a simple
ERC-721 wrapper for CHAI soulbound tokens. It can be used to mint and query
non-transferable tokens on any EVM-compatible chain.

## Blockchain Modules

- **credibc**: a skeleton Cosmos IBC module located at
  `backend/src/blockchain/credibc` for transferring credential evidence between
  chains.

## Chainlink Functions Oracle

This repository includes a stub integration with Chainlink Functions to
demonstrate how off-chain AI logic could provide on-chain risk scores. See
`backend/src/blockchain/chainlink_oracle.ts` for details.

## Provisional Attestations

For issuers that are not yet integrated with the platform, you can issue a provisional attestation. The backend exposes a helper function `offerProvisionalAttestation` which returns a temporary attestation object valid for a configurable number of days.

```typescript
import { offerProvisionalAttestation } from './backend/src/provisional_attestation';

const attestation = offerProvisionalAttestation('issuer-123');
```

This allows the platform to acknowledge an issuer while full integration is pending.

## Wallet UX

The demonstration wallet now includes a **Share only status** toggle on the
credential details page. Enabling this option shares a simple proof that the
credential exists and is valid instead of exposing the entire verifiable
credential payload. The proof generation is stubbed in the frontend but serves
as a placeholder for future cryptographic implementations.

## Deployment

The `k8s/backend-rollout.yaml` file demonstrates how to deploy the backend using
[Argo Rollouts](https://argo-rollouts.readthedocs.io). It defines a canary
strategy with automated analysis. The analysis succeeds only when the backend's
Prometheus metrics report a success rate of **95%** or higher and **no** HTTP
errors.

## Substrate Network Deployment

See [docs/substrate_eks_poa_setup.md](docs/substrate_eks_poa_setup.md) for instructions on deploying a permissioned Substrate network with Proof-of-Authority consensus on AWS EKS.
