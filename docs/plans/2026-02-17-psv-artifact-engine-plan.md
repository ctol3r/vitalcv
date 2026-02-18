# PSV Artifact Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a cryptographically signed PSV Artifact Engine with ES256 signing, JWKS endpoint, delta monitoring, download bundles, and a public Trust-State UI page.

**Architecture:** Evolve existing services (nursysAdapter, credentialMonitoringEngine, artifactService) in-place. New files for types, signing service, artifact builder. Routes added to app.ts. Public Next.js page at /verify/[npi].

**Tech Stack:** TypeScript, Express, Prisma/PostgreSQL, jose (ES256), archiver (zip), Next.js 15, shadcn/ui, Tailwind CSS.

---

## Task 1: PSV Type Schema

**Files:**
- Create: `apps/api/backend/src/types/psv.ts`

**Step 1: Create the PSV type definitions**

```typescript
// apps/api/backend/src/types/psv.ts

export type Provider = {
  npi: string;
  firstName: string;
  lastName: string;
  credentialType: string;
};

export type CredentialStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';

export type Credential = {
  type: string;
  status: CredentialStatus;
  jurisdiction: string;
  expirationDate: string | null;
  identifier: string | null;
  issuingBody: string;
};

export type PrimarySource = {
  authority: string;
  method: string;
  sourceUrl: string;
};

export type RetrievalEvent = {
  retrievedAt: string;
  rawPayloadHash: string;
  ttlSeconds: number;
};

export type EvidenceIntegrity = {
  artifactHash: string;
  signature: string;
  kid: string;
  jwksUrl: string;
};

export type DecisionWindow = {
  windowStart: string;
  windowDeadline: string;
  compliant: boolean | null;
  daysRemaining: number;
  mode: 'ncqa' | 'expedited';
};

export type Monitoring = {
  enabled: boolean;
  lastCheckedAt: string;
  nextCheckDue: string;
};

export type DeltaLogEntry = {
  field: string;
  previousValue: string;
  newValue: string;
  detectedAt: string;
  deltaHash: string;
};

export type EnrollmentContext = {
  pecosEnrolled: boolean | null;
  enrollmentType: string | null;
};

export type PsvArtifact = {
  artifactId: string;
  schemaVersion: '1.0';
  provider: Provider;
  credential: Credential;
  primarySource: PrimarySource;
  retrievalEvent: RetrievalEvent;
  evidenceIntegrity: EvidenceIntegrity;
  decisionWindow: DecisionWindow;
  monitoring: Monitoring;
  deltaLog: DeltaLogEntry[];
  enrollmentContext: EnrollmentContext;
};

export type NormalizedCredentialPayload = {
  npi: string;
  provider: {
    firstName: string;
    lastName: string;
    credentialType: string;
  };
  credential: {
    type: string;
    status: CredentialStatus;
    jurisdiction: string;
    expirationDate: string | null;
    identifier: string | null;
  };
  source: {
    authority: string;
    method: string;
    sourceUrl: string;
  };
  retrievedAt: string;
  rawPayload: unknown;
};
```

**Step 2: Verify the file compiles**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit src/types/psv.ts`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/api/backend/src/types/psv.ts
git commit -m "feat(psv): add Universal PSV Artifact type schema v1.0"
```

---

## Task 2: Prisma Schema Migration

**Files:**
- Modify: `apps/api/backend/prisma/schema.prisma` (lines 382-426, VerificationArtifact model)

**Step 1: Add new columns to VerificationArtifact**

Add these fields after the `forecastRiskLevel` field (line 406) and before `createdAt`:

```prisma
  // PSV Artifact Engine
  artifactJson   Json?    @db.JsonB   // Full signed PsvArtifact document
  artifactHash   String?              // SHA-256 of canonicalized artifact (pre-signature)
  signature      String?              // ES256 JWS compact serialization
  signingKeyId   String?              // kid used for signing
  deltaLog       Json?    @db.JsonB   // Array of DeltaLogEntry objects
```

**Step 2: Create migration**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx prisma migrate dev --name psv_artifact_engine_columns`
Expected: Migration created and applied.

**Step 3: Generate Prisma client**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx prisma generate`
Expected: Prisma Client generated successfully.

**Step 4: Commit**

```bash
git add apps/api/backend/prisma/schema.prisma apps/api/backend/prisma/migrations/
git commit -m "feat(psv): add artifact signing and delta columns to VerificationArtifact"
```

---

## Task 3: Canonicalization Tests

**Files:**
- Create: `apps/api/backend/__tests__/canonicalize.test.ts`
- Reference: `apps/api/backend/src/utils/canonicalizeJson.ts`
- Reference: `apps/api/backend/src/utils/deterministic.ts`

**Step 1: Write tests confirming stable output**

```typescript
// apps/api/backend/__tests__/canonicalize.test.ts
import { canonicalizeJson } from '../src/utils/canonicalizeJson';
import { sha256ForPayload } from '../src/utils/deterministic';

describe('canonicalizeJson', () => {
  it('sorts object keys alphabetically', () => {
    const result = canonicalizeJson({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts nested object keys recursively', () => {
    const result = canonicalizeJson({ b: { z: 1, a: 2 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it('preserves array order', () => {
    const result = canonicalizeJson({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it('handles null values', () => {
    const result = canonicalizeJson({ a: null, b: 1 });
    expect(result).toBe('{"a":null,"b":1}');
  });

  it('converts Date to ISO string', () => {
    const date = new Date('2026-01-15T00:00:00.000Z');
    const result = canonicalizeJson({ ts: date });
    expect(result).toBe('{"ts":"2026-01-15T00:00:00.000Z"}');
  });

  it('produces identical output for same input across calls', () => {
    const input = {
      npi: '1234567890',
      status: 'ACTIVE',
      nested: { jurisdiction: 'CA', type: 'RN' },
      tags: ['psv', 'nursys'],
    };
    const first = canonicalizeJson(input);
    const second = canonicalizeJson(input);
    const third = canonicalizeJson(input);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});

describe('sha256ForPayload', () => {
  it('produces stable hash for same payload', () => {
    const payload = { npi: '1234567890', status: 'ACTIVE' };
    const hash1 = sha256ForPayload(payload);
    const hash2 = sha256ForPayload(payload);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hash for different key order object', () => {
    // canonicalize should make these identical
    const hash1 = sha256ForPayload({ a: 1, b: 2 });
    const hash2 = sha256ForPayload({ b: 2, a: 1 });
    expect(hash1).toBe(hash2);
  });

  it('produces different hash for different values', () => {
    const hash1 = sha256ForPayload({ status: 'ACTIVE' });
    const hash2 = sha256ForPayload({ status: 'REVOKED' });
    expect(hash1).not.toBe(hash2);
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx jest __tests__/canonicalize.test.ts --verbose`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add apps/api/backend/__tests__/canonicalize.test.ts
git commit -m "test(psv): add canonicalization stability tests"
```

---

## Task 4: ES256 Signing Service

**Files:**
- Create: `apps/api/backend/src/services/signingService.ts`

**Step 1: Write the signing service**

```typescript
// apps/api/backend/src/services/signingService.ts
import { importPKCS8, exportJWK, SignJWT, generateKeyPair, calculateJwkThumbprint } from 'jose';
import type { KeyLike, JWK } from 'jose';
import { log } from '../obs/logger';

const ALG = 'ES256';

let privateKey: KeyLike | null = null;
let publicKeyJwk: JWK | null = null;
let keyId: string | null = null;

export async function initSigningKeys(): Promise<void> {
  const pkcs8Base64 = process.env.PSV_SIGNING_KEY;

  if (pkcs8Base64) {
    const pem = Buffer.from(pkcs8Base64, 'base64').toString('utf-8');
    privateKey = await importPKCS8(pem, ALG);
    const jwk = await exportJWK(privateKey);
    // For EC keys, public key is crv + x + y
    publicKeyJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
    keyId = await calculateJwkThumbprint(publicKeyJwk, 'sha256');
    publicKeyJwk.kid = keyId;
    publicKeyJwk.alg = ALG;
    publicKeyJwk.use = 'sig';
    log('info', 'psv_signing_key_loaded', { event: 'psv_signing_key_loaded', kid: keyId });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PSV_SIGNING_KEY must be set in production');
  }

  // Dev: generate ephemeral keypair
  const { privateKey: ephPriv, publicKey: ephPub } = await generateKeyPair(ALG);
  privateKey = ephPriv;
  const jwk = await exportJWK(ephPub);
  publicKeyJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  keyId = await calculateJwkThumbprint(publicKeyJwk, 'sha256');
  publicKeyJwk.kid = keyId;
  publicKeyJwk.alg = ALG;
  publicKeyJwk.use = 'sig';

  log('warn', 'psv_ephemeral_signing_key', {
    event: 'psv_ephemeral_signing_key',
    kid: keyId,
    message: 'Using ephemeral signing key. Set PSV_SIGNING_KEY for production.',
  });
}

export async function signArtifact(canonicalPayload: string): Promise<string> {
  if (!privateKey || !keyId) {
    throw new Error('Signing keys not initialized. Call initSigningKeys() first.');
  }

  const jwt = await new SignJWT({ hash: canonicalPayload })
    .setProtectedHeader({ alg: ALG, kid: keyId })
    .setIssuedAt()
    .setIssuer('vitalcv:psv-engine')
    .sign(privateKey);

  return jwt;
}

export async function getPublicKeyJwk(): Promise<JWK> {
  if (!publicKeyJwk) {
    throw new Error('Signing keys not initialized. Call initSigningKeys() first.');
  }
  return { ...publicKeyJwk };
}

export async function getKeyId(): Promise<string> {
  if (!keyId) {
    throw new Error('Signing keys not initialized. Call initSigningKeys() first.');
  }
  return keyId;
}
```

**Step 2: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit src/services/signingService.ts`
Expected: No errors (jose types already available).

**Step 3: Commit**

```bash
git add apps/api/backend/src/services/signingService.ts
git commit -m "feat(psv): add ES256 signing service with JWKS support"
```

---

## Task 5: JWKS Endpoint

**Files:**
- Modify: `apps/api/backend/src/app.ts`

**Step 1: Add JWKS route and signing initialization**

At the top of `app.ts`, add import (after existing imports around line 72):

```typescript
import { initSigningKeys, getPublicKeyJwk } from './services/signingService';
```

Before the error handler (around line 3344, before `app.use('/api-docs', ...)`), add:

```typescript
// PSV Artifact Engine: JWKS endpoint
app.get('/.well-known/jwks.json', async (_req: Request, res: Response) => {
  try {
    const publicKey = await getPublicKeyJwk();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ keys: [publicKey] });
  } catch (error) {
    return res.status(500).json({ error: 'JWKS not available' });
  }
});
```

In the app initialization section (find where middleware is set up, near the top after `const app = express()`), add signing key initialization. Look for where other async initialization happens — if there's no init block, add after middleware setup:

```typescript
// Initialize PSV signing keys (async, must complete before serving)
initSigningKeys().catch((err) => {
  log('error', 'psv_signing_init_failed', {
    event: 'psv_signing_init_failed',
    error: err instanceof Error ? err.message : 'unknown',
  });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});
```

**Step 2: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/api/backend/src/app.ts
git commit -m "feat(psv): add JWKS endpoint and signing key initialization"
```

---

## Task 6: Nursys Adapter Evolution

**Files:**
- Modify: `apps/api/backend/src/services/nursysAdapter.ts`

**Step 1: Add NPPES fetch and normalization**

Add to `nursysAdapter.ts` after the existing code:

```typescript
import type { NormalizedCredentialPayload } from '../types/psv';

type NppesResult = {
  firstName: string;
  lastName: string;
  credentialType: string;
};

async function fetchNppesProvider(npi: string): Promise<NppesResult> {
  const url = `https://npiregistry.cms.hhs.gov/api/?number=${encodeURIComponent(npi)}&version=2.1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NPPES API returned ${response.status}`);
    }

    const data = await response.json();
    const results = data?.results;

    if (!Array.isArray(results) || results.length === 0) {
      return { firstName: 'Unknown', lastName: 'Unknown', credentialType: 'Unknown' };
    }

    const provider = results[0];
    const basic = provider.basic ?? {};

    // Individual provider (Entity Type 1)
    if (provider.enumeration_type === 'NPI-1') {
      return {
        firstName: basic.first_name ?? 'Unknown',
        lastName: basic.last_name ?? 'Unknown',
        credentialType: basic.credential ?? 'Unknown',
      };
    }

    // Organization (Entity Type 2)
    return {
      firstName: basic.organization_name ?? 'Unknown',
      lastName: '',
      credentialType: 'Organization',
    };
  } catch {
    // Fallback: return placeholder if NPPES is unreachable
    return { firstName: 'Unknown', lastName: 'Unknown', credentialType: 'Unknown' };
  }
}

export async function normalizeToPayload(npi: string): Promise<NormalizedCredentialPayload> {
  const [licenseResult, nppesResult] = await Promise.all([
    queryNursysLicense(npi),
    fetchNppesProvider(npi),
  ]);

  return {
    npi,
    provider: {
      firstName: nppesResult.firstName,
      lastName: nppesResult.lastName,
      credentialType: nppesResult.credentialType,
    },
    credential: {
      type: 'LICENSE',
      status: licenseResult.licenseStatus,
      jurisdiction: licenseResult.jurisdiction,
      expirationDate: licenseResult.expirationDate,
      identifier: null,
    },
    source: {
      authority: 'NURSYS',
      method: 'API',
      sourceUrl: licenseResult.sourceUrl,
    },
    retrievedAt: licenseResult.sourceQueriedAt,
    rawPayload: licenseResult,
  };
}
```

**Step 2: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/api/backend/src/services/nursysAdapter.ts
git commit -m "feat(psv): add NPPES integration and NormalizedCredentialPayload to nursysAdapter"
```

---

## Task 7: PSV Artifact Builder

**Files:**
- Create: `apps/api/backend/src/services/psvArtifactBuilder.ts`
- Reference: `apps/api/backend/src/types/psv.ts`
- Reference: `apps/api/backend/src/services/signingService.ts`
- Reference: `apps/api/backend/src/utils/deterministic.ts`
- Reference: `apps/api/backend/src/services/psvWindowEngine.ts`

**Step 1: Create the builder**

```typescript
// apps/api/backend/src/services/psvArtifactBuilder.ts
import crypto from 'node:crypto';
import type { PsvArtifact, NormalizedCredentialPayload } from '../types/psv';
import { canonicalizeJson } from '../utils/canonicalizeJson';
import { sha256Hex } from '../utils/deterministic';
import { signArtifact, getKeyId } from './signingService';
import { computePSVDeadline } from './psvWindowEngine';

const SCHEMA_VERSION = '1.0' as const;
const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const MONITORING_CHECK_INTERVAL_HOURS = 24;
const JWKS_URL = process.env.PSV_JWKS_URL ?? '/.well-known/jwks.json';

export async function buildPsvArtifact(
  payload: NormalizedCredentialPayload,
): Promise<PsvArtifact> {
  // 1. Canonicalize + hash raw payload
  const rawPayloadHash = sha256Hex(canonicalizeJson(payload.rawPayload as object));

  // 2. Generate artifactId
  const artifactId = crypto.randomUUID();

  // 3. Calculate DecisionWindow (120-day NCQA default)
  const now = new Date();
  const deadline = computePSVDeadline(now, 'ncqa');
  const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);

  // 4. Construct artifact WITHOUT evidenceIntegrity
  const partialArtifact = {
    artifactId,
    schemaVersion: SCHEMA_VERSION,
    provider: {
      npi: payload.npi,
      firstName: payload.provider.firstName,
      lastName: payload.provider.lastName,
      credentialType: payload.provider.credentialType,
    },
    credential: {
      type: payload.credential.type,
      status: payload.credential.status,
      jurisdiction: payload.credential.jurisdiction,
      expirationDate: payload.credential.expirationDate,
      identifier: payload.credential.identifier,
      issuingBody: payload.source.authority,
    },
    primarySource: {
      authority: payload.source.authority,
      method: payload.source.method,
      sourceUrl: payload.source.sourceUrl,
    },
    retrievalEvent: {
      retrievedAt: payload.retrievedAt,
      rawPayloadHash,
      ttlSeconds: DEFAULT_TTL_SECONDS,
    },
    decisionWindow: {
      windowStart: now.toISOString(),
      windowDeadline: deadline.toISOString(),
      compliant: null,
      daysRemaining,
      mode: 'ncqa' as const,
    },
    monitoring: {
      enabled: true,
      lastCheckedAt: now.toISOString(),
      nextCheckDue: new Date(now.getTime() + MONITORING_CHECK_INTERVAL_HOURS * 3600000).toISOString(),
    },
    deltaLog: [],
    enrollmentContext: {
      pecosEnrolled: null,
      enrollmentType: null,
    },
  };

  // 5. Canonicalize + hash the artifact → artifactHash
  const artifactHash = sha256Hex(canonicalizeJson(partialArtifact));

  // 6. Sign the artifact hash via ES256
  const kid = await getKeyId();
  const signature = await signArtifact(artifactHash);

  // 7. Attach EvidenceIntegrity block
  const artifact: PsvArtifact = {
    ...partialArtifact,
    evidenceIntegrity: {
      artifactHash,
      signature,
      kid,
      jwksUrl: JWKS_URL,
    },
  };

  return artifact;
}
```

**Step 2: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/api/backend/src/services/psvArtifactBuilder.ts
git commit -m "feat(psv): add PSV artifact builder with canonicalization and ES256 signing"
```

---

## Task 8: Delta Monitoring Engine

**Files:**
- Modify: `apps/api/backend/src/services/credentialMonitoringEngine.ts`
- Reference: `apps/api/backend/src/types/psv.ts`

**Step 1: Add delta detection and monitoring check functions**

Add at the bottom of `credentialMonitoringEngine.ts`:

```typescript
import type { Credential, DeltaLogEntry, PsvArtifact, NormalizedCredentialPayload } from '../types/psv';
import { canonicalizeJson } from '../utils/canonicalizeJson';
import { sha256Hex } from '../utils/deterministic';
import { buildPsvArtifact } from './psvArtifactBuilder';

export function detectMaterialChange(
  oldCredential: Credential,
  newCredential: Credential,
): DeltaLogEntry[] {
  const deltas: DeltaLogEntry[] = [];
  const now = new Date().toISOString();

  const fields: (keyof Credential)[] = [
    'status',
    'expirationDate',
    'jurisdiction',
    'identifier',
    'issuingBody',
  ];

  for (const field of fields) {
    const oldVal = String(oldCredential[field] ?? '');
    const newVal = String(newCredential[field] ?? '');

    if (oldVal !== newVal) {
      const deltaPayload = { field, previousValue: oldVal, newValue: newVal, detectedAt: now };
      deltas.push({
        ...deltaPayload,
        deltaHash: sha256Hex(canonicalizeJson(deltaPayload)),
      });
    }
  }

  return deltas;
}

export async function runMonitoringCheck(
  existingArtifact: PsvArtifact,
  newPayload: NormalizedCredentialPayload,
): Promise<PsvArtifact> {
  const newCredential: Credential = {
    type: newPayload.credential.type,
    status: newPayload.credential.status,
    jurisdiction: newPayload.credential.jurisdiction,
    expirationDate: newPayload.credential.expirationDate,
    identifier: newPayload.credential.identifier,
    issuingBody: newPayload.source.authority,
  };

  const deltas = detectMaterialChange(existingArtifact.credential, newCredential);

  if (deltas.length === 0) {
    // No material change — just update monitoring timestamps
    const now = new Date().toISOString();
    return {
      ...existingArtifact,
      monitoring: {
        ...existingArtifact.monitoring,
        lastCheckedAt: now,
        nextCheckDue: new Date(Date.now() + 24 * 3600000).toISOString(),
      },
    };
  }

  // Material change detected — rebuild artifact with new data and append deltas
  const updatedArtifact = await buildPsvArtifact(newPayload);

  return {
    ...updatedArtifact,
    artifactId: existingArtifact.artifactId, // Preserve original artifact ID
    deltaLog: [...existingArtifact.deltaLog, ...deltas],
  };
}
```

**Step 2: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/api/backend/src/services/credentialMonitoringEngine.ts
git commit -m "feat(psv): add delta detection and monitoring check to credential monitoring engine"
```

---

## Task 9: Verify Endpoint

**Files:**
- Modify: `apps/api/backend/src/app.ts`

**Step 1: Add imports and verify route**

Add imports at top of `app.ts` (after existing imports):

```typescript
import { normalizeToPayload } from './services/nursysAdapter';
import { buildPsvArtifact } from './services/psvArtifactBuilder';
import { runMonitoringCheck } from './services/credentialMonitoringEngine';
import type { PsvArtifact } from './types/psv';
```

Add route before the JWKS endpoint (before `app.get('/.well-known/jwks.json', ...)`):

```typescript
// PSV Artifact Engine: Verify endpoint
app.post('/verify', publicApiRateLimit, express.json(), async (req: Request, res: Response) => {
  try {
    const { npi } = req.body;

    if (!npi || typeof npi !== 'string' || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI. Must be exactly 10 digits.' });
    }

    // Check for existing artifact
    const existingDbArtifact = await prisma.verificationArtifact.findFirst({
      where: { npi },
      orderBy: { createdAt: 'desc' },
    });

    let artifact: PsvArtifact;
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (
      existingDbArtifact?.artifactJson &&
      Date.now() - existingDbArtifact.createdAt.getTime() < STALE_THRESHOLD_MS
    ) {
      // Recent artifact exists — run monitoring check
      const existingPsvArtifact = existingDbArtifact.artifactJson as unknown as PsvArtifact;
      const freshPayload = await normalizeToPayload(npi);
      artifact = await runMonitoringCheck(existingPsvArtifact, freshPayload);

      // Update the existing record with monitoring results
      await prisma.verificationArtifact.update({
        where: { id: existingDbArtifact.id },
        data: {
          artifactJson: artifact as unknown as Prisma.InputJsonValue,
          artifactHash: artifact.evidenceIntegrity.artifactHash,
          signature: artifact.evidenceIntegrity.signature,
          signingKeyId: artifact.evidenceIntegrity.kid,
          deltaLog: artifact.deltaLog as unknown as Prisma.InputJsonValue,
          statusLastChecked: new Date(),
        },
      });
    } else {
      // No recent artifact — build fresh
      const payload = await normalizeToPayload(npi);
      artifact = await buildPsvArtifact(payload);

      // Persist new artifact
      const verifiedAt = new Date();
      const expiresAt = payload.credential.expirationDate
        ? new Date(payload.credential.expirationDate)
        : null;

      await prisma.verificationArtifact.create({
        data: {
          npi,
          source: 'NURSYS',
          status: payload.credential.status,
          rawPayload: payload.rawPayload as Prisma.InputJsonValue,
          checksum: artifact.retrievalEvent.rawPayloadHash,
          verifiedAt,
          expiresAt,
          monitoring: true,
          trustState: payload.credential.status === 'ACTIVE' ? 'verified' : 'needs_review',
          statusLastChecked: verifiedAt,
          artifactJson: artifact as unknown as Prisma.InputJsonValue,
          artifactHash: artifact.evidenceIntegrity.artifactHash,
          signature: artifact.evidenceIntegrity.signature,
          signingKeyId: artifact.evidenceIntegrity.kid,
          deltaLog: [] as unknown as Prisma.InputJsonValue,
          psvWindowStart: new Date(artifact.decisionWindow.windowStart),
          psvWindowDeadline: new Date(artifact.decisionWindow.windowDeadline),
        },
      });
    }

    return res.status(200).json(artifact);
  } catch (error) {
    log('error', 'psv_verify_error', {
      event: 'psv_verify_error',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return res.status(500).json({ error: 'Verification failed' });
  }
});
```

**Step 2: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/api/backend/src/app.ts
git commit -m "feat(psv): add POST /verify endpoint for PSV artifact generation"
```

---

## Task 10: Download Bundle Endpoint

**Files:**
- Modify: `apps/api/backend/package.json` (add archiver)
- Modify: `apps/api/backend/src/app.ts`

**Step 1: Install archiver**

Run: `cd /Users/christoler/vitalcv && pnpm add archiver @types/archiver --filter chai-vc-platform-backend`

**Step 2: Add download route to app.ts**

Add import at top:

```typescript
import archiver from 'archiver';
```

Add route after the POST /verify route:

```typescript
// PSV Artifact Engine: Download bundle
app.get('/api/download/:artifactId', publicApiRateLimit, async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;

    const dbArtifact = await prisma.verificationArtifact.findUnique({
      where: { id: artifactId },
    });

    if (!dbArtifact?.artifactJson) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const artifact = dbArtifact.artifactJson as unknown as PsvArtifact;
    const canonicalized = canonicalizeJson(artifact as unknown as object);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="psv-artifact-${artifact.artifactId}.zip"`,
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    archive.append(canonicalized, { name: 'artifact.json' });

    archive.append(
      canonicalizeJson(dbArtifact.rawPayload as object),
      { name: 'raw_payload.json' },
    );

    const integrityText = [
      `PSV Artifact Integrity Record`,
      `==============================`,
      `Artifact ID:    ${artifact.artifactId}`,
      `Artifact Hash:  ${artifact.evidenceIntegrity.artifactHash}`,
      `Signature:      ${artifact.evidenceIntegrity.signature}`,
      `Key ID (kid):   ${artifact.evidenceIntegrity.kid}`,
      `JWKS URL:       ${artifact.evidenceIntegrity.jwksUrl}`,
      `Algorithm:      ES256`,
      `Schema Version: ${artifact.schemaVersion}`,
      `Generated At:   ${new Date().toISOString()}`,
    ].join('\n');
    archive.append(integrityText, { name: 'integrity.txt' });

    const readmeText = [
      `PSV Artifact Bundle`,
      `====================`,
      ``,
      `This bundle contains Primary Source Verification evidence for NPI ${artifact.provider.npi}.`,
      ``,
      `Contents:`,
      `- artifact.json     Canonicalized PSV artifact with cryptographic signature`,
      `- raw_payload.json  Original response from the primary source`,
      `- integrity.txt     Hash, signature, and verification metadata`,
      `- README.txt        This file`,
      ``,
      `Verification:`,
      `1. Fetch the public key from the JWKS endpoint: ${artifact.evidenceIntegrity.jwksUrl}`,
      `2. Verify the ES256 signature using the kid: ${artifact.evidenceIntegrity.kid}`,
      `3. Confirm the artifact hash matches SHA-256 of artifact.json contents`,
      ``,
      `Schema Version: ${artifact.schemaVersion}`,
      `Generated by VitalCV PSV Artifact Engine`,
    ].join('\n');
    archive.append(readmeText, { name: 'README.txt' });

    await archive.finalize();
  } catch (error) {
    log('error', 'psv_download_error', {
      event: 'psv_download_error',
      error: error instanceof Error ? error.message : 'unknown',
    });
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Download failed' });
    }
  }
});
```

**Step 3: Add canonicalizeJson import** (if not already present):

```typescript
import { canonicalizeJson } from './utils/canonicalizeJson';
```

**Step 4: Verify compilation**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add apps/api/backend/package.json apps/api/backend/src/app.ts pnpm-lock.yaml
git commit -m "feat(psv): add download bundle endpoint with zip generation"
```

---

## Task 11: Trust-State UI Page

**Files:**
- Create: `apps/web/app/verify/[npi]/page.tsx`
- Create: `apps/web/app/verify/[npi]/components/TrustStateCard.tsx`
- Create: `apps/web/app/verify/[npi]/components/CredentialPanel.tsx`
- Create: `apps/web/app/verify/[npi]/components/MonitoringPanel.tsx`
- Create: `apps/web/app/verify/[npi]/components/DecisionWindowPanel.tsx`
- Create: `apps/web/app/verify/[npi]/components/IntegrityPanel.tsx`
- Create: `apps/web/app/verify/[npi]/components/DownloadBundleButton.tsx`
- Create: `apps/web/app/verify/[npi]/components/RoiPanel.tsx`

**Step 1: Create the page**

Create `apps/web/app/verify/[npi]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { TrustStateCard } from './components/TrustStateCard';
import { CredentialPanel } from './components/CredentialPanel';
import { MonitoringPanel } from './components/MonitoringPanel';
import { DecisionWindowPanel } from './components/DecisionWindowPanel';
import { IntegrityPanel } from './components/IntegrityPanel';
import { DownloadBundleButton } from './components/DownloadBundleButton';
import { RoiPanel } from './components/RoiPanel';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type PsvArtifact = {
  artifactId: string;
  schemaVersion: string;
  provider: { npi: string; firstName: string; lastName: string; credentialType: string };
  credential: { type: string; status: string; jurisdiction: string; expirationDate: string | null; identifier: string | null; issuingBody: string };
  primarySource: { authority: string; method: string; sourceUrl: string };
  retrievalEvent: { retrievedAt: string; rawPayloadHash: string; ttlSeconds: number };
  evidenceIntegrity: { artifactHash: string; signature: string; kid: string; jwksUrl: string };
  decisionWindow: { windowStart: string; windowDeadline: string; compliant: boolean | null; daysRemaining: number; mode: string };
  monitoring: { enabled: boolean; lastCheckedAt: string; nextCheckDue: string };
  deltaLog: { field: string; previousValue: string; newValue: string; detectedAt: string; deltaHash: string }[];
  enrollmentContext: { pecosEnrolled: boolean | null; enrollmentType: string | null };
};

async function fetchArtifact(npi: string): Promise<PsvArtifact | null> {
  try {
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function VerifyPage({ params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  const artifact = await fetchArtifact(npi);

  if (!artifact) {
    return (
      <main className="min-h-screen bg-white px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-gray-900">Verification Failed</h1>
          <p className="mt-2 text-gray-600">Unable to verify NPI {npi}. Please try again.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <TrustStateCard artifact={artifact} />
        <CredentialPanel credential={artifact.credential} />
        <DecisionWindowPanel window={artifact.decisionWindow} />
        <MonitoringPanel monitoring={artifact.monitoring} deltaLog={artifact.deltaLog} />
        <IntegrityPanel integrity={artifact.evidenceIntegrity} />
        <RoiPanel />
        <DownloadBundleButton artifactId={artifact.artifactId} />
      </div>
    </main>
  );
}
```

**Step 2: Create TrustStateCard component**

Create `apps/web/app/verify/[npi]/components/TrustStateCard.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  artifact: {
    provider: { npi: string; firstName: string; lastName: string; credentialType: string };
    credential: { status: string };
    schemaVersion: string;
    artifactId: string;
  };
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
    case 'EXPIRED': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'SUSPENDED': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'REVOKED': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getTrustLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Verified';
    case 'EXPIRED': return 'Expired';
    case 'SUSPENDED': return 'Suspended';
    case 'REVOKED': return 'Revoked';
    default: return 'Needs Review';
  }
}

export function TrustStateCard({ artifact }: Props) {
  const { provider, credential, artifactId } = artifact;
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">Trust State</CardTitle>
          <Badge className={getStatusColor(credential.status)}>{getTrustLabel(credential.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Provider</span>
            <p className="font-medium text-gray-900">{provider.firstName} {provider.lastName}</p>
          </div>
          <div>
            <span className="text-gray-500">NPI</span>
            <p className="font-mono font-medium text-gray-900">{provider.npi}</p>
          </div>
          <div>
            <span className="text-gray-500">Credential Type</span>
            <p className="font-medium text-gray-900">{provider.credentialType}</p>
          </div>
          <div>
            <span className="text-gray-500">Artifact ID</span>
            <p className="font-mono text-xs text-gray-600 truncate">{artifactId}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create CredentialPanel**

Create `apps/web/app/verify/[npi]/components/CredentialPanel.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  credential: {
    type: string;
    status: string;
    jurisdiction: string;
    expirationDate: string | null;
    identifier: string | null;
    issuingBody: string;
  };
};

export function CredentialPanel({ credential }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900">Credential</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type</span>
            <p className="font-medium text-gray-900">{credential.type}</p>
          </div>
          <div>
            <span className="text-gray-500">Status</span>
            <p className="font-medium text-gray-900">{credential.status}</p>
          </div>
          <div>
            <span className="text-gray-500">Jurisdiction</span>
            <p className="font-medium text-gray-900">{credential.jurisdiction}</p>
          </div>
          <div>
            <span className="text-gray-500">Issuing Body</span>
            <p className="font-medium text-gray-900">{credential.issuingBody}</p>
          </div>
          <div>
            <span className="text-gray-500">Expiration</span>
            <p className="font-medium text-gray-900">
              {credential.expirationDate ? new Date(credential.expirationDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          {credential.identifier && (
            <div>
              <span className="text-gray-500">Identifier</span>
              <p className="font-mono text-sm text-gray-900">{credential.identifier}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create MonitoringPanel**

Create `apps/web/app/verify/[npi]/components/MonitoringPanel.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DeltaEntry = {
  field: string;
  previousValue: string;
  newValue: string;
  detectedAt: string;
  deltaHash: string;
};

type Props = {
  monitoring: { enabled: boolean; lastCheckedAt: string; nextCheckDue: string };
  deltaLog: DeltaEntry[];
};

export function MonitoringPanel({ monitoring, deltaLog }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Monitoring</CardTitle>
          <Badge variant={monitoring.enabled ? 'default' : 'secondary'}>
            {monitoring.enabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Last Checked</span>
            <p className="font-medium text-gray-900">{new Date(monitoring.lastCheckedAt).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Next Check</span>
            <p className="font-medium text-gray-900">{new Date(monitoring.nextCheckDue).toLocaleString()}</p>
          </div>
        </div>

        {deltaLog.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Change Log ({deltaLog.length})</h4>
            <div className="space-y-2">
              {deltaLog.map((entry, i) => (
                <div key={i} className="rounded border border-gray-200 p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{entry.field}</span>
                    <span className="text-gray-500">{new Date(entry.detectedAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-gray-600">
                    <span className="line-through text-red-600">{entry.previousValue}</span>
                    {' → '}
                    <span className="text-green-700">{entry.newValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create DecisionWindowPanel**

Create `apps/web/app/verify/[npi]/components/DecisionWindowPanel.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  window: {
    windowStart: string;
    windowDeadline: string;
    compliant: boolean | null;
    daysRemaining: number;
    mode: string;
  };
};

export function DecisionWindowPanel({ window: w }: Props) {
  const complianceLabel = w.compliant === null ? 'Pending' : w.compliant ? 'Compliant' : 'Non-Compliant';
  const complianceColor = w.compliant === null
    ? 'bg-gray-100 text-gray-800'
    : w.compliant
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">PSV Decision Window</CardTitle>
          <Badge className={complianceColor}>{complianceLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Window Start</span>
            <p className="font-medium text-gray-900">{new Date(w.windowStart).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Deadline</span>
            <p className="font-medium text-gray-900">{new Date(w.windowDeadline).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Days Remaining</span>
            <p className="font-medium text-gray-900">{w.daysRemaining}</p>
          </div>
          <div>
            <span className="text-gray-500">Mode</span>
            <p className="font-medium text-gray-900 uppercase">{w.mode}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 6: Create IntegrityPanel**

Create `apps/web/app/verify/[npi]/components/IntegrityPanel.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  integrity: {
    artifactHash: string;
    signature: string;
    kid: string;
    jwksUrl: string;
  };
};

export function IntegrityPanel({ integrity }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900">Evidence Integrity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <span className="text-gray-500">Artifact Hash (SHA-256)</span>
          <p className="font-mono text-xs text-gray-900 break-all mt-0.5">{integrity.artifactHash}</p>
        </div>
        <div className="text-sm">
          <span className="text-gray-500">Signature (ES256)</span>
          <p className="font-mono text-xs text-gray-600 break-all mt-0.5 truncate">{integrity.signature.slice(0, 80)}...</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Key ID</span>
            <p className="font-mono text-xs text-gray-900 break-all mt-0.5">{integrity.kid}</p>
          </div>
          <div>
            <span className="text-gray-500">JWKS URL</span>
            <p className="font-mono text-xs text-gray-900 mt-0.5">{integrity.jwksUrl}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 7: Create DownloadBundleButton**

Create `apps/web/app/verify/[npi]/components/DownloadBundleButton.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';

type Props = {
  artifactId: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export function DownloadBundleButton({ artifactId }: Props) {
  return (
    <div className="flex justify-center">
      <Button asChild variant="outline" className="w-full max-w-sm">
        <a href={`${API_BASE}/api/download/${artifactId}`} download>
          Download Verification Bundle (.zip)
        </a>
      </Button>
    </div>
  );
}
```

**Step 8: Create RoiPanel**

Create `apps/web/app/verify/[npi]/components/RoiPanel.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RoiPanel() {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900">ROI: PSV Window Acceleration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-2xl font-bold text-gray-900">120</p>
            <p className="text-gray-500">Day PSV Window</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">&lt;5s</p>
            <p className="text-gray-500">Verification Time</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">$0</p>
            <p className="text-gray-500">Per Verification</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500 text-center">
          Manual PSV typically costs $15-45 per credential and takes 5-15 business days.
          VitalCV reduces this to seconds with cryptographic proof.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 9: Verify web app compiles**

Run: `cd /Users/christoler/vitalcv/apps/web && npx next lint --dir app/verify`
Expected: No errors (or only warnings).

**Step 10: Commit**

```bash
git add apps/web/app/verify/
git commit -m "feat(psv): add Trust-State UI page with verification panels"
```

---

## Task 12: Integration Test

**Files:**
- Create: `apps/api/backend/__tests__/psv_artifact.test.ts`

**Step 1: Write integration test**

```typescript
// apps/api/backend/__tests__/psv_artifact.test.ts
import { canonicalizeJson } from '../src/utils/canonicalizeJson';
import { sha256Hex } from '../src/utils/deterministic';

describe('PSV Artifact Hashing Stability', () => {
  const sampleArtifact = {
    artifactId: '00000000-0000-0000-0000-000000000001',
    schemaVersion: '1.0',
    provider: { npi: '1234567890', firstName: 'Jane', lastName: 'Doe', credentialType: 'RN' },
    credential: {
      type: 'LICENSE',
      status: 'ACTIVE',
      jurisdiction: 'CA',
      expirationDate: '2028-01-15T00:00:00.000Z',
      identifier: null,
      issuingBody: 'NURSYS',
    },
    primarySource: { authority: 'NURSYS', method: 'API', sourceUrl: 'https://nursys.com' },
    retrievalEvent: {
      retrievedAt: '2026-02-17T00:00:00.000Z',
      rawPayloadHash: 'abc123',
      ttlSeconds: 86400,
    },
    decisionWindow: {
      windowStart: '2026-02-17T00:00:00.000Z',
      windowDeadline: '2026-06-17T00:00:00.000Z',
      compliant: null,
      daysRemaining: 120,
      mode: 'ncqa',
    },
    monitoring: {
      enabled: true,
      lastCheckedAt: '2026-02-17T00:00:00.000Z',
      nextCheckDue: '2026-02-18T00:00:00.000Z',
    },
    deltaLog: [],
    enrollmentContext: { pecosEnrolled: null, enrollmentType: null },
  };

  it('produces deterministic canonical JSON', () => {
    const canon1 = canonicalizeJson(sampleArtifact);
    const canon2 = canonicalizeJson(sampleArtifact);
    expect(canon1).toBe(canon2);
  });

  it('produces stable hash across calls', () => {
    const hash1 = sha256Hex(canonicalizeJson(sampleArtifact));
    const hash2 = sha256Hex(canonicalizeJson(sampleArtifact));
    expect(hash1).toBe(hash2);
  });

  it('detects any field change', () => {
    const modified = { ...sampleArtifact, credential: { ...sampleArtifact.credential, status: 'REVOKED' } };
    const hash1 = sha256Hex(canonicalizeJson(sampleArtifact));
    const hash2 = sha256Hex(canonicalizeJson(modified));
    expect(hash1).not.toBe(hash2);
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx jest __tests__/psv_artifact.test.ts --verbose`
Expected: All 3 tests PASS.

**Step 3: Commit**

```bash
git add apps/api/backend/__tests__/psv_artifact.test.ts
git commit -m "test(psv): add PSV artifact hashing stability tests"
```

---

## Task 13: Build Verification

**Step 1: Run full TypeScript check**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx tsc --noEmit`
Expected: No errors.

**Step 2: Run all backend tests**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx jest --verbose`
Expected: All tests pass.

**Step 3: Verify Prisma is up to date**

Run: `cd /Users/christoler/vitalcv/apps/api/backend && npx prisma validate`
Expected: "The schema is valid."

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore(psv): fix any build issues from PSV artifact engine integration"
```
