# VitalCV SDK Reference

Three TypeScript SDKs for integrating with the VitalCV Trust Protocol.

## Packages

| Package | Version | Role |
|---------|---------|------|
| `@vitalcv/verifier-sdk` | 1.0.0 | Verify clinician credentials |
| `@vitalcv/issuer-sdk` | 1.0.0 | Issue and revoke credentials |
| `@vitalcv/wallet-sdk` | 1.0.0 | Manage clinician credential wallet |

All packages require Node.js ≥ 18 and are compatible with API v1.0.0+.

---

## Installation

```bash
# Verifier (hospitals, payers, health systems)
pnpm add @vitalcv/verifier-sdk

# Issuer (medical boards, credentialing bodies)
pnpm add @vitalcv/issuer-sdk

# Wallet (clinician-facing apps)
pnpm add @vitalcv/wallet-sdk
```

---

## Verifier SDK

```ts
import { VitalCVVerifier } from '@vitalcv/verifier-sdk';

const verifier = new VitalCVVerifier({
  baseUrl: 'https://api.vitalcv.com',
  apiKey: process.env.VITALCV_API_KEY,
});

// Verify a clinician by NPI
const trust = await verifier.getTrustBand('1234567890');
// → { subject: '1234567890', band: 'L3', label: 'Authoritative', ... }

// Accept a credential presentation
const result = await verifier.acceptPresentation({ presentationId: 'pres_abc' });
```

---

## Issuer SDK

```ts
import { VitalCVIssuer } from '@vitalcv/issuer-sdk';

const issuer = new VitalCVIssuer({
  baseUrl: 'https://api.vitalcv.com',
  apiKey: process.env.VITALCV_ISSUER_KEY,
  issuerDid: 'did:vitalcv:issuer:ca-medical-board',
});

// Issue a credential
const cred = await issuer.issue({
  holderNpi: '1234567890',
  credentialType: 'MedicalLicense',
  claims: { state: 'CA', licenseNumber: 'A123456' },
  expiresInDays: 365,
});

// Revoke
await issuer.revoke({ credentialId: cred.credentialId, reason: 'License expired' });
```

---

## Wallet SDK

```ts
import { VitalCVWallet } from '@vitalcv/wallet-sdk';

const wallet = new VitalCVWallet({
  baseUrl: 'https://api.vitalcv.com',
  holderNpi: '1234567890',
  apiKey: process.env.VITALCV_HOLDER_KEY,
});

// List credentials with expiry warnings
const { credentials, summary } = await wallet.listCredentials();

// Present with selective disclosure
const presentation = await wallet.present({
  credentialId: 'vc_abc',
  revealClaims: ['specialty', 'licenseNumber'],
});
```

---

## Version Compatibility

```ts
import { checkVersionCompatibility, SDK_VERSION } from '@vitalcv/verifier-sdk';

const compat = checkVersionCompatibility('1.0.0'); // your API version
// → { compatible: true }

console.log(SDK_VERSION); // '1.0.0'
```

---

## Diagnostics

Each SDK exports `runDiagnostics()` for health checking:

```ts
import { runDiagnostics } from '@vitalcv/verifier-sdk';

const report = runDiagnostics();
// → { sdkName, version, checks: [...], overallHealth: 'healthy' }
```

Aggregate diagnostics via the API: `GET /api/mission-ops/sdk-diagnostics`

---

## Full API Docs

See [/docs/sdk](/docs/sdk) in the developer portal.
