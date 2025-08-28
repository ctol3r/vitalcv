# Chai VC Platform

End-to-end healthcare credentialing and hiring verification.

## Backend Development

The backend now includes a small Express setup with middleware for request
validation and centralized error handling. To run the server locally:

```bash
cd backend
npm install
npm start
```

The `/credentials` endpoint expects `name` and `issuer` fields in the request
body. Invalid input results in a structured error response.

## ACA-Py Agent

The platform includes an Aries Cloud Agent Python (ACA-Py) microservice that issues and verifies healthcare credentials. The agent is configured to support both Hyperledger AnonCreds and W3C Verifiable Credentials so that clinicians can selectively disclose information during onboarding.

See `aca_py_agent/README.md` for usage.

## Onboarding Wizard

The front-end includes a simple onboarding wizard with contextual GPT hints.
Open `/frontend/pages/onboarding.tsx` to start the flow and generate a local
API key.

## Bug Bounty Program

We have launched an internal bug bounty program to improve platform security.

### How to submit a report

1. Install dependencies for the reporting interface:
   ```bash
   pip install -r bug-bounty/requirements.txt
   ```
2. Run the Flask application:
   ```bash
   python bug-bounty/app.py
   ```
3. Open `http://localhost:5000` in your browser and fill out the bug report form.

Submitted reports are stored in `bug-bounty/bug_reports.txt` on the server.

## GDPR/CCPA Right-to-Erasure

The backend includes a stubbed workflow for processing data erasure requests.
Sensitive user data is hashed and the resulting digest is stored on-chain using
`PolkadotService` for auditability.

## Explainability Logs

The backend includes utilities to hash GPT rationale and anchor it on-chain using `PolkadotService`.  Call `verifyCredential` with an identifier and a textual rationale to store a hash of the explanation on the blockchain.

## Security

Issuer keys **must** be stored on hardware-backed devices such as YubiKey or
Ledger. The backend exposes helper functions in
`backend/src/blockchain/blockchain_integration.ts` that require a hardware
wallet to be initialized before any signing operations can occur.

All service-to-service communication now uses **mTLS**. Certificates are mounted
from Kubernetes secrets and referenced by the applications. An **OPA** sidecar
is injected into each deployment to enforce policies defined in `opa/policy.rego`.

## Disaster Recovery

See [docs/disaster_recovery.md](docs/disaster_recovery.md) for instructions on running scripted multi-region failover drills.

## PII Vault

The `frontend/vault` folder contains a small example of client-side encryption helpers. These functions can be used to encrypt sensitive data in the browser before sending it anywhere else, providing the foundation for a privacy-by-design vault for user PII.

## Compliance Dashboard

SOC 2 compliance artifacts are published from the `compliance/` directory. A GitHub Actions workflow (`publish_soc2_dashboard.yml`) deploys the contents of this folder to GitHub Pages whenever updates are pushed to `main`.

## Trust Registry Smart Contract

The `backend/src/blockchain/TrustRegistry.sol` contract implements a simple on-chain registry for credential issuers. Each issuer can be registered and receive weighted endorsement votes from other accounts. Endorsements accumulate as reputation for the issuer while preventing duplicate votes from the same endorser.

## Identity Governance Prototype

The `identity_governance_upgrade.ts` module under `backend/src/blockchain`
provides a lightweight example of how new identity features might be proposed
and applied through a governance process. It is a starting point for exploring
consensus-layer upgrades within the platform.

## Cross-chain DID Resolution

The backend now includes a simple resolver capable of fetching
DID documents from external networks. It bridges to any resolver
service compatible with the Universal Resolver API, enabling
cross-chain lookups of identities.

## Key Rotation

The backend contains a simple `KeyRotationPolicy` that supports scheduling
future signing keys with a time lock. Once the specified transition time has
passed, the policy automatically activates the new key. See
`backend/src/blockchain/key_rotation_policy.ts` for implementation details.

## Trusted Node Deployment Kit

The repository includes a `trusted-node` directory with a Dockerfile and Helm chart
that demonstrate how institutional validators can deploy a placeholder trusted node.
See `trusted-node/README.md` for usage instructions.

This repository now includes the W3C Verifiable Credentials Data Model v1.0
context inside the credential registry pallet under `backend/src/credential_registry`.
This integration provides a foundation for validating credentials against the
standard VC schema.

This demo now includes immutable audit scrapbooks recorded on-chain for every
major identity action. The `AuditScrapbook` class writes an audit record through
the `PolkadotService` which would normally commit a transaction containing a hash
of the activity.

## Blockchain Integration

This repository includes a simple `PolkadotService` that wraps
`@polkadot/api` for interacting with a Substrate-based chain. It now
supports batching credential issuance using `utility.batch` so that
multiple credentials can be issued in a single extrinsic.

## Blockchain upgrade paths

The backend now exposes helper utilities to create chain-agnostic upgrade paths.
These allow the platform to bridge existing credentials to smart contracts on
both EVM and WASM based chains. See `backend/src/blockchain/upgrade_paths.ts`
for the implementation.

## Blockchain Governance

This repository now includes a Substrate pallet for managing on-chain
identity policy changes via community voting. The pallet lives in
`identity-governance-pallet` and provides basic functionality to propose
policies, cast votes and finalize proposals.

## Staking Contract

Verifiers are required to lock tokens in the `VerifierStaking` smart contract. If a
verifier provides incorrect verification, the contract owner can slash the
verifier's stake. The contract and a simple TypeScript wrapper live under
`backend/contracts` and `backend/src/blockchain`.

## Bonding Curve Prototype

This repository now includes a simple bonding curve model used to prototype token pricing for the credential verification service. The implementation can be found in `pricing/bonding_curve.py` with accompanying unit tests in `pricing/tests`.

## Governance Token

The `GovernanceToken` smart contract located under `backend/src/blockchain/contracts`
implements an ERC20-compatible token with weighted voting and linear vesting
schedules. Token holders can delegate their votes to another address, and
vesting schedules allow timed release of allocated tokens.

## Blockchain

This repository contains a basic Substrate pallet implementation to manage
utilitarian, governance, and reputation tokens. The pallet can be found in
`backend/src/blockchain/multi_token_pallet.rs` and is intended as a starting
point for future on-chain logic.

## Challenge Rewards Contract
The `backend/contracts/ChallengeRewards.sol` contract contains basic logic for distributing rewards for challenge-based gamification events. It allows new challenges to be added and emits a `RewardDistributed` event when a participant completes a challenge.

## Micropayment Channels

This repository includes a lightweight implementation of a micropayment channel
used for off-chain API calls with on-chain settlement. The implementation lives
in `backend/src/payments/micropayment_channel.ts` and provides utilities to
create vouchers that can later be settled on-chain.

## Yield Farming Module

The backend includes a simple yield farming service in
`backend/src/blockchain/yield_farming.ts`. Stakers can deposit tokens and earn
fees collected from credential transactions. Rewards are distributed
proportionally to each participant's stake.

## Deflationary Token Mechanism

A simple token implementation is provided in `backend/src/blockchain/deflationary_token.ts`.
Each transfer burns a portion of the tokens, reducing the total supply over time.
This burn also occurs when tokens are consumed for utility actions via `useUtility`.

## Governance

The platform now includes a simple DAO governance module located in
`backend/src/blockchain/governance.ts`. This allows community members to
propose changes to key economic parameters (such as `interestRate` and
`inflationRate`) and vote on them. Proposals that receive more `votesFor`
than `votesAgainst` will update the current economic configuration when
finalized.

## NFT Badge Minting

The platform now includes a basic service for minting NFT badges. Badges can represent career milestones or course completions. The `nft_badge_service` provides a `mintBadgeNFT` function that simulates minting on the Polkadot blockchain and returns a placeholder token ID.

## Smart Contracts

The repository now includes Solidity contracts that implement basic escrow
functionality:

- `JobOfferEscrow.sol` handles deposits from employers for job offers. Funds are
  released to the candidate once they accept the offer, or refunded if the
  employer cancels before acceptance.
- `MilestoneEscrow.sol` supports milestone based payments. A payer deposits
  funds for a payee and can release them when a milestone is completed.

Both contracts can be found in the `contracts/` directory and are provided under
the MIT license.

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
