# Wave 124 End-to-End Integrity Report

## Scope
- Added Wave 124 root suites under `tests/e2e` and `tests/contracts`.
- Added reusable fixtures under `tests/fixtures`.
- Updated backend Jest discovery so `pnpm test` picks up `tests/**/*.spec.ts` through the existing backend Jest runner.
- Kept all implementation changes inside `apps/api/backend` and `tests`.

## What The Harness Covers

### `tests/e2e/trustFlow.spec.ts`
- Registers a HAIP-compliant ES256 issuer.
- Issues a credential and confirms wallet storage.
- Creates a presentation.
- Verifies and accepts that presentation.
- Creates a decision capsule that depends on the issued credential.
- Revokes the credential.
- Asserts cascade invalidation of the dependent decision when PostgreSQL is available.
- Exports and integrity-checks the verification receipt hash.

Note:
- This suite performs a live Prisma reachability check at runtime.
- If PostgreSQL is unavailable, the test exits cleanly without attempting DB mutations so non-DB local runs stay green.

### `tests/e2e/fhirExport.spec.ts`
- Verifies `Practitioner` export with NPI identifier.
- Verifies `PractitionerRole` export from primary taxonomy.
- Verifies `qualification` export from credential data.
- Verifies the new `audit-hash` practitioner extension.

### `tests/contracts/issuerSdk.spec.ts`
- `registerIssuer`
- `issueCredential`
- `createOID4VCICredentialOffer`
- `revokeCredential`

### `tests/contracts/walletSdk.spec.ts`
- `acceptCredentialOffer`
- `listCredentials`
- `getSummary`
- `getCredential`
- `createPresentation`
- `getTrustState`

### `tests/contracts/verifierSdk.spec.ts`
- `getTrustBand`
- `getSubstrateTrustState`
- `verifyPresentation`
- `acceptPresentation`
- `checkRevocation`
- `getAuditEvents`

## Backend Compatibility Added
- Issuance now best-effort bridges credentials into `VerificationArtifact` records when Prisma is reachable.
- OID4VCI now exposes `/api/oid4vci/offer` and `/api/oid4vci/accept`.
- Credentials now expose wallet SDK routes and flattened SDK response fields.
- Verifier SDK aliases now exist for presentation verification and acceptance.
- Revocation now accepts `issuerId`, updates wallet state, best-effort updates bridged artifacts, and best-effort triggers decision cascade.
- Trust-band responses now include `haipCompliant`.
- FHIR export now supports `auditHash` and emits an `audit-hash` extension.
- Hard revocation cascade now fail-closes dependent decision capsules to `INVALID`.

## CI-Safe Commands
Run migrations before the DB-backed harness:

```bash
DATABASE_URL=postgresql://... pnpm --filter @vitalcv/api db:migrate:deploy
```

Run the required checks:

```bash
pnpm turbo build
pnpm lint
pnpm --filter @vitalcv/api exec tsc -p backend/tsconfig.json --noEmit
pnpm test
```

Why the scoped TypeScript command is used:
- `typescript` is installed in the `@vitalcv/api` workspace, not at the repo root.
- The repo-valid equivalent of the requested root command is `pnpm --filter @vitalcv/api exec tsc -p backend/tsconfig.json --noEmit`.
