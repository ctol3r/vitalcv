# Chai VC Platform

End-to-end healthcare credentialing and hiring verification.

<<<<<<< HEAD
This repository contains a minimal scaffold for the Chai VC platform. The
backend includes a stubbed `ChainlinkAdapter` for retrieving cross-chain data
feeds such as license status and risk signals. These adapters are exposed
through the `BlockchainIntegration` class.
=======
<<<<<<< HEAD
## SDKs

SDKs are provided for integrating with external blockchains.

- `sdks/solana-sdk` &ndash; helper functions for Solana based projects.
- `sdks/avalanche-sdk` &ndash; helper functions for Avalanche projects.

These packages expose a `validate<Chain>Credential(apiUrl, payload)` function
that posts credential data to the CHAI validation API.
=======
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
>>>>>>> origin/main
>>>>>>> origin/main
