/**
 * Wave 3 — Trust container proof-pack surfacing tests.
 *
 * Unit-level coverage for the manifest entry shape and audit mapping.
 * No database, no network. Exercising these in isolation catches
 * contract drift before the broader packet-export suite runs.
 */

import {
  CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
  buildTrustContainerManifestEntry,
  fingerprintTrustContainerEntry,
  toTrustContainerAuditMetadata,
  trustContainerDisplayLabel,
  trustContainerNotIssuedEntry,
  type CredentialEnvelopePayload,
  type IssuedCredentialResult,
} from '../index';

function envelope(
  overrides: Partial<CredentialEnvelopePayload> = {},
): CredentialEnvelopePayload {
  return {
    entityId: 'artifact_abc123',
    subject: { npi: '1234567890', entityId: 'artifact_abc123' },
    clinicianNpi: '1234567890',
    sourceCoverage: ['NPPES', 'OIG_LEIE'],
    psvReceiptRefs: [],
    proofTier: 'DECISION_GRADE',
    freshness: {
      label: 'REAL_TIME',
      evidenceAsOf: '2026-04-24T00:00:00.000Z',
      ttlSeconds: 604800,
    },
    limitationNotes: [],
    auditHash: 'c'.repeat(64),
    issuer: { did: 'did:vitalcv:issuer_default', name: 'VitalCV', provider: 'mock' },
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    status: 'DECISION_GRADE',
    ...overrides,
  };
}

function issuance(
  overrides: Partial<IssuedCredentialResult> = {},
): IssuedCredentialResult {
  return {
    id: 'mock_vc_test',
    did: 'did:vitalcv-mock:issuer',
    vcPayload: { type: 'VerifiableCredential' },
    issuedAt: '2026-04-24T00:00:00.000Z',
    envelopeHash: 'deadbeef'.repeat(8),
    mock: true,
    ...overrides,
  };
}

describe('TrustContainerManifestEntry', () => {
  it('mirrors envelope fields for an issued mock credential', () => {
    const entry = buildTrustContainerManifestEntry({
      issuance: issuance(),
      envelope: envelope(),
      provider: 'mock',
    });
    expect(entry.status).toBe('issued');
    expect(entry.trustContainerId).toBe('mock_vc_test');
    expect(entry.provider).toBe('mock');
    expect(entry.mock).toBe(true);
    expect(entry.environment).toBe('mock-dev');
    expect(entry.label).toBe('Mock/dev credential container');
    expect(entry.proofTier).toBe('DECISION_GRADE');
    expect(entry.proofStatus).toBe('DECISION_GRADE');
    expect(entry.artifactHash).toBe('c'.repeat(64));
    expect(entry.auditHash).toBe('c'.repeat(64));
    expect(entry.schemaVersion).toBe('1.0.0');
    expect(entry.limitationNotes).toEqual([]);
  });

  it('labels a Dock-scaffolded (non-mock) issuance distinctly', () => {
    const entry = buildTrustContainerManifestEntry({
      issuance: issuance({ mock: undefined, id: 'dock_vc_scaffold_123' }),
      envelope: envelope(),
      provider: 'dock',
    });
    expect(entry.environment).toBe('dock-scaffold');
    expect(entry.label).toBe('Dock scaffold credential container');
    expect(entry.mock).toBe(false);
  });

  it('preserves limitation notes verbatim from the envelope', () => {
    const limitations = ['Identity not strictly verified', 'Exclusions not fully cleared'];
    const entry = buildTrustContainerManifestEntry({
      issuance: issuance(),
      envelope: envelope({
        status: 'PARTIAL',
        proofTier: 'PARTIAL',
        limitationNotes: limitations,
      }),
      provider: 'mock',
    });
    expect(entry.proofStatus).toBe('PARTIAL');
    expect(entry.proofTier).toBe('PARTIAL');
    expect(entry.limitationNotes).toEqual(limitations);
  });

  it('builds a not_issued entry when issuance is skipped', () => {
    const entry = trustContainerNotIssuedEntry('container disabled in this environment');
    expect(entry.status).toBe('not_issued');
    expect(entry.trustContainerId).toBeNull();
    expect(entry.provider).toBeNull();
    expect(entry.environment).toBeNull();
    expect(entry.label).toBe('Credential container: not issued');
    expect(entry.mock).toBe(false);
    expect(entry.skipReason).toBe('container disabled in this environment');
    expect(entry.limitationNotes).toEqual([]);
  });

  it('trustContainerDisplayLabel is defensive against missing entries', () => {
    expect(trustContainerDisplayLabel(undefined)).toBe('Credential container: not issued');
    expect(trustContainerDisplayLabel(null)).toBe('Credential container: not issued');
    const issuedEntry = buildTrustContainerManifestEntry({
      issuance: issuance(),
      envelope: envelope(),
      provider: 'mock',
    });
    expect(trustContainerDisplayLabel(issuedEntry)).toBe('Mock/dev credential container');
    const skipped = trustContainerNotIssuedEntry('skip');
    expect(trustContainerDisplayLabel(skipped)).toBe('Credential container: not issued');
  });

  it('toTrustContainerAuditMetadata produces a compact id-bearing record when issued', () => {
    const entry = buildTrustContainerManifestEntry({
      issuance: issuance(),
      envelope: envelope(),
      provider: 'mock',
    });
    const audit = toTrustContainerAuditMetadata(entry);
    expect(audit.trustContainerId).toBe('mock_vc_test');
    expect(audit.provider).toBe('mock');
    expect(audit.environment).toBe('mock-dev');
    expect(audit.status).toBe('issued');
    expect(audit.mock).toBe(true);
    expect(audit.proofTier).toBe('DECISION_GRADE');
    expect(audit.auditHash).toBe('c'.repeat(64));
    expect('skipReason' in audit).toBe(false);
  });

  it('toTrustContainerAuditMetadata surfaces skipReason when not issued', () => {
    const audit = toTrustContainerAuditMetadata(trustContainerNotIssuedEntry('disabled'));
    expect(audit.status).toBe('not_issued');
    expect(audit.trustContainerId).toBeNull();
    expect(audit.skipReason).toBe('disabled');
  });

  it('fingerprint is stable across canonical key order', () => {
    const entry = buildTrustContainerManifestEntry({
      issuance: issuance(),
      envelope: envelope(),
      provider: 'mock',
    });
    const copy = {
      mock: entry.mock,
      status: entry.status,
      label: entry.label,
      trustContainerId: entry.trustContainerId,
      schemaVersion: entry.schemaVersion,
      provider: entry.provider,
      environment: entry.environment,
      issuedAt: entry.issuedAt,
      artifactHash: entry.artifactHash,
      auditHash: entry.auditHash,
      proofStatus: entry.proofStatus,
      proofTier: entry.proofTier,
      limitationNotes: [...entry.limitationNotes],
    };
    expect(fingerprintTrustContainerEntry(entry)).toBe(
      fingerprintTrustContainerEntry(copy as typeof entry),
    );
  });
});
