import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';

import { canonicalizeJson } from '../src/utils/canonicalizeJson';
import {
  buildAuditBundleVc,
  computeAuditBundleVcHash,
} from '../src/services/auditBundleVc';
import {
  signAuditBundleHash,
  verifyAuditBundleSignature,
  resetAuditBundleSigningCache,
} from '../src/services/auditBundleSigning';

const RAW_AUDIT_KEYS = {
  signing: process.env.AUDIT_BUNDLE_SIGNING_KEY,
  public: process.env.AUDIT_BUNDLE_PUBLIC_KEY,
  fallbackSigning: process.env.PSV_SIGNING_KEY,
  fallbackPublic: process.env.PSV_PUBLIC_KEY,
  fallbackPrivate: process.env.VCV_PRIVATE_KEY,
  fallbackPublicLegacy: process.env.VCV_PUBLIC_KEY,
};

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });

  process.env.AUDIT_BUNDLE_SIGNING_KEY = Buffer.from(await exportPKCS8(privateKey)).toString(
    'base64',
  );
  process.env.AUDIT_BUNDLE_PUBLIC_KEY = Buffer.from(await exportSPKI(publicKey)).toString(
    'base64',
  );
  process.env.PSV_SIGNING_KEY = process.env.AUDIT_BUNDLE_SIGNING_KEY;
  process.env.PSV_PUBLIC_KEY = process.env.AUDIT_BUNDLE_PUBLIC_KEY;
  process.env.VCV_PRIVATE_KEY = process.env.AUDIT_BUNDLE_SIGNING_KEY;
  process.env.VCV_PUBLIC_KEY = process.env.AUDIT_BUNDLE_PUBLIC_KEY;
  resetAuditBundleSigningCache();
});

afterAll(() => {
  process.env.AUDIT_BUNDLE_SIGNING_KEY = RAW_AUDIT_KEYS.signing;
  process.env.AUDIT_BUNDLE_PUBLIC_KEY = RAW_AUDIT_KEYS.public;
  process.env.PSV_SIGNING_KEY = RAW_AUDIT_KEYS.fallbackSigning;
  process.env.PSV_PUBLIC_KEY = RAW_AUDIT_KEYS.fallbackPublic;
  process.env.VCV_PRIVATE_KEY = RAW_AUDIT_KEYS.fallbackPrivate;
  process.env.VCV_PUBLIC_KEY = RAW_AUDIT_KEYS.fallbackPublicLegacy;
  resetAuditBundleSigningCache();
});

type RawBundleFixture = Parameters<typeof buildAuditBundleVc>[0]['bundle'];

function makeBundle(): RawBundleFixture {
  return {
    npi: '1234567890',
    artifact: {
      source: 'NURSYS',
      status: 'Active',
      checksum: 'bundle-checksum-001',
      verifiedAt: '2026-01-10T10:00:00.000Z',
      expiresAt: '2028-01-01T00:00:00.000Z',
      monitoring: false,
    },
    auditMetadata: {
      source: 'NURSYS',
      timestamp: '2026-01-10T10:00:00.000Z',
      verifierIdentity: 'VitalCV Cross-Check Engine v1',
      checksum: 'audit-checksum-001',
      methodology: 'Primary source verification via Nursys E-Notify simulation',
      monitoringStatus: 'STANDARD',
    },
  };
}

function makeShuffledBundle(): RawBundleFixture {
  return {
    artifact: {
      status: 'Active',
      source: 'NURSYS',
      checksum: 'bundle-checksum-001',
      verifiedAt: '2026-01-10T10:00:00.000Z',
      monitoring: false,
      expiresAt: '2028-01-01T00:00:00.000Z',
    },
    auditMetadata: {
      methodology: 'Primary source verification via Nursys E-Notify simulation',
      source: 'NURSYS',
      monitoringStatus: 'STANDARD',
      timestamp: '2026-01-10T10:00:00.000Z',
      verifierIdentity: 'VitalCV Cross-Check Engine v1',
      checksum: 'audit-checksum-001',
    },
    npi: '1234567890',
  };
}

function makeArtifactPayloadA(): object {
  return {
    npi: '1234567890',
    status: 'Active',
    source: 'NURSYS',
    sourceUrl: 'https://registry.example/npi/1234567890',
    extra: {
      a: 1,
      b: 2,
      nested: {
        y: 'yes',
        z: 'zulu',
      },
    },
  };
}

function makeArtifactPayloadB(): object {
  return {
    source: 'NURSYS',
    sourceUrl: 'https://registry.example/npi/1234567890',
    status: 'Active',
    npi: '1234567890',
    extra: {
      nested: {
        z: 'zulu',
        y: 'yes',
      },
      b: 2,
      a: 1,
    },
  };
}

describe('Wave 2 — deterministic hashing', () => {
  it('produces the same VC hash for equivalent audit bundles with different key order', () => {
    const canonicalA = buildAuditBundleVc({
      bundle: makeBundle(),
      artifactId: 'artifact-001',
      artifactRawPayload: makeArtifactPayloadA(),
      snapshotId: 'snapshot-001',
      merkleRoot: 'root-001',
      issuedAt: '2026-01-10T10:00:00.000Z',
    });

    const canonicalB = buildAuditBundleVc({
      bundle: makeShuffledBundle(),
      artifactId: 'artifact-001',
      artifactRawPayload: makeArtifactPayloadB(),
      snapshotId: 'snapshot-001',
      merkleRoot: 'root-001',
      issuedAt: '2026-01-10T10:00:00.000Z',
    });

    expect(computeAuditBundleVcHash(canonicalA)).toBe(computeAuditBundleVcHash(canonicalB));
    expect(canonicalizeJson(canonicalA)).toBe(canonicalizeJson(canonicalB));
  });
});

describe('Wave 2 — signature verification', () => {
  it('signs and verifies the audit bundle hash using ES256', async () => {
    const bundle = buildAuditBundleVc({
      bundle: makeBundle(),
      artifactId: 'artifact-002',
      artifactRawPayload: makeArtifactPayloadA(),
      snapshotId: 'snapshot-002',
      merkleRoot: 'root-002',
      issuedAt: '2026-01-11T10:00:00.000Z',
    });

    const bundleHash = computeAuditBundleVcHash(bundle);
    const signature = await signAuditBundleHash({
      bundleHash,
      bundleId: 'snapshot-002',
      artifactId: 'artifact-002',
      issuedAt: '2026-01-11T10:00:00.000Z',
    });

    const verified = await verifyAuditBundleSignature(signature);

    expect(verified.bundle_hash).toBe(bundleHash);
    expect(verified.bundle_id).toBe('snapshot-002');
    expect(verified.artifact_id).toBe('artifact-002');
    expect(verified.hash_algorithm).toBe('SHA-256');
    expect(verified.iss).toBe('vitalcv');
  });
});

describe('Wave 2 — bundle reproducibility', () => {
  it('keeps claim digest and selective-disclosure claims stable', () => {
    const vcA = buildAuditBundleVc({
      bundle: makeBundle(),
      artifactId: 'artifact-003',
      artifactRawPayload: makeArtifactPayloadA(),
      snapshotId: 'snapshot-003',
      merkleRoot: 'root-003',
      issuedAt: '2026-01-12T10:00:00.000Z',
    });

    const vcB = buildAuditBundleVc({
      bundle: makeShuffledBundle(),
      artifactId: 'artifact-003',
      artifactRawPayload: makeArtifactPayloadB(),
      snapshotId: 'snapshot-003',
      merkleRoot: 'root-003',
      issuedAt: '2026-01-12T10:00:00.000Z',
    });

    expect(vcA.selectiveDisclosure._sd).toEqual(vcB.selectiveDisclosure._sd);
    expect(vcA.credentialSubject.claimHashes).toEqual(vcB.credentialSubject.claimHashes);
    expect(vcA.credentialSubject.claimCount).toBe(vcB.credentialSubject.claimCount);
  });
});
