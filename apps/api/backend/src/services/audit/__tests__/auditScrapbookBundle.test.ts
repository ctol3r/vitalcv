import { sha256ForPayload } from '../../../utils/deterministic';
import {
  buildAuditScrapbookBundle,
  buildAuditScrapbookEntry,
} from '../auditScrapbookBundle';

describe('auditScrapbookBundle', () => {
  it('computes deterministic source and normalized fact hashes inside the entry metadata', () => {
    const sourceResponseArtifact = { board: 'CA', licenseNumber: 'RN-1' };
    const normalizedCredentialFacts = { state: 'CA', active: true };

    const entry = buildAuditScrapbookEntry({
      credentialId: 'cred-1',
      verificationArtifactId: 'ver-1',
      subjectNpi: '1234567890',
      credentialType: 'STATE_LICENSE',
      source: 'state-board',
      status: 'ACTIVE',
      sourceResponseArtifact,
      normalizedCredentialFacts,
      verificationMethod: 'API',
      verificationMetadata: {
        status: 'ACTIVE',
        verifiedAt: '2026-03-14T12:00:00.000Z',
        freshUntil: '2026-06-14T12:00:00.000Z',
        sourceType: 'STATE_BOARD',
        organizationId: 'org-1',
      },
      verifiedAt: '2026-03-14T12:00:00.000Z',
      verifierAgent: 'VitalCV Verifier',
      provenanceChain: [],
      ledgerAnchor: {
        artifactId: 'compat-1',
        merkleRoot: 'merkle-root-1',
        checksum: 'checksum-1',
        chainDigest: 'chain-1',
      },
      decisionCapsuleIds: ['capsule-2', 'capsule-1'],
      decisionTypes: ['PRIVILEGING', 'HIRING'],
    });

    expect(entry.verificationMetadata.sourceResponseHash).toBe(
      sha256ForPayload(sourceResponseArtifact),
    );
    expect(entry.verificationMetadata.normalizedFactsHash).toBe(
      sha256ForPayload(normalizedCredentialFacts),
    );
    expect(entry.decisionCapsuleIds).toEqual(['capsule-1', 'capsule-2']);
    expect(entry.decisionTypes).toEqual(['HIRING', 'PRIVILEGING']);
  });

  it('replays identical bundle hashes regardless of entry order or decision ordering', () => {
    const firstEntry = buildAuditScrapbookEntry({
      credentialId: 'cred-b',
      verificationArtifactId: 'ver-b',
      subjectNpi: '1234567890',
      credentialType: 'STATE_LICENSE',
      source: 'state-board',
      status: 'ACTIVE',
      sourceResponseArtifact: { licenseNumber: 'B-1' },
      normalizedCredentialFacts: { licenseNumber: 'B-1' },
      verificationMethod: 'API',
      verificationMetadata: {
        status: 'ACTIVE',
        verifiedAt: '2026-03-14T12:00:00.000Z',
        freshUntil: null,
        sourceType: 'STATE_BOARD',
        organizationId: null,
      },
      verifiedAt: '2026-03-14T12:00:00.000Z',
      verifierAgent: 'VitalCV Verifier',
      provenanceChain: [],
      ledgerAnchor: {
        artifactId: 'compat-b',
        merkleRoot: null,
        checksum: 'checksum-b',
        chainDigest: null,
      },
      decisionCapsuleIds: ['capsule-b', 'capsule-a'],
      decisionTypes: ['HIRING'],
    });

    const secondEntry = buildAuditScrapbookEntry({
      credentialId: 'cred-a',
      verificationArtifactId: 'ver-a',
      subjectNpi: '1234567890',
      credentialType: 'NPI_ENROLLMENT',
      source: 'npi-registry',
      status: 'ACTIVE',
      sourceResponseArtifact: { npi: '1234567890' },
      normalizedCredentialFacts: { npi: '1234567890' },
      verificationMethod: 'API',
      verificationMetadata: {
        status: 'ACTIVE',
        verifiedAt: '2026-03-14T12:00:00.000Z',
        freshUntil: null,
        sourceType: 'NPPES',
        organizationId: null,
      },
      verifiedAt: '2026-03-14T12:00:00.000Z',
      verifierAgent: 'VitalCV Verifier',
      provenanceChain: [],
      ledgerAnchor: {
        artifactId: 'compat-a',
        merkleRoot: null,
        checksum: 'checksum-a',
        chainDigest: null,
      },
      decisionCapsuleIds: ['capsule-a'],
      decisionTypes: ['HIRING'],
    });

    const bundleA = buildAuditScrapbookBundle({
      npi: '1234567890',
      generatedAt: '2026-03-14T12:00:00.000Z',
      methodologyVersion: 'audit_scrapbook.v1',
      verifierAgent: 'VitalCV Verifier',
      entries: [firstEntry, secondEntry],
    });
    const bundleB = buildAuditScrapbookBundle({
      npi: '1234567890',
      generatedAt: '2026-03-14T12:00:00.000Z',
      methodologyVersion: 'audit_scrapbook.v1',
      verifierAgent: 'VitalCV Verifier',
      entries: [secondEntry, firstEntry],
    });

    expect(bundleA.bundleHash).toBe(bundleB.bundleHash);
    expect(bundleA.entries.map((entry) => entry.credentialId)).toEqual(['cred-a', 'cred-b']);
    expect(bundleB.entries.map((entry) => entry.credentialId)).toEqual(['cred-a', 'cred-b']);
  });
});
