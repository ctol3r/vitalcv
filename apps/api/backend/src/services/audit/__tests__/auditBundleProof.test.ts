import {
  createCredentialArtifactRecord,
  createVerificationArtifactRecord,
} from '../../credentials/credentialIngestionArtifacts';

const mockVerificationRunFindMany = jest.fn();
const mockAuditEventFindFirst = jest.fn();
const mockGetCapsulesByNpi = jest.fn();
const mockVerifyDecisionCapsuleReplay = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationRun: {
      findMany: mockVerificationRunFindMany,
    },
    auditEvent: {
      findFirst: mockAuditEventFindFirst,
    },
  },
}));

jest.mock('../../decision/capsuleEngine', () => ({
  capsuleEngine: {
    getCapsulesByNpi: mockGetCapsulesByNpi,
    verifyDecisionCapsuleReplay: mockVerifyDecisionCapsuleReplay,
  },
}));

import {
  buildAuditBundleProof,
  validateAuditBundleEvidenceHashes,
} from '../auditBundleProof';

describe('buildAuditBundleProof', () => {
  const npi = '1003000126';
  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: npi,
    source_name: 'npi-registry',
    credential_type: 'NPI_ENROLLMENT',
    issuer_org_id: 'cms:nppes',
    issued_at: '2026-03-13T12:00:00.000Z',
    expires_at: null,
    status: 'ACTIVE',
    metadata: {
      full_name: 'Seeded Provider',
    },
  });
  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: npi,
    source_name: 'npi-registry',
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: 'NPPES',
    verification_method: 'API',
    verified_at: '2026-03-13T12:00:00.000Z',
    fresh_until: '2026-04-12T12:00:00.000Z',
    payload_json: {
      provider_name: 'Seeded Provider',
    },
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T12:00:00.000Z'));

    mockVerificationRunFindMany.mockReset();
    mockAuditEventFindFirst.mockReset();
    mockGetCapsulesByNpi.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();

    mockVerificationRunFindMany.mockResolvedValue([
      {
        id: 'run-1',
        artifacts: [
          {
            id: 'cred-1',
            artifactJson: credentialArtifact,
            createdAt: new Date('2026-03-13T12:00:01.000Z'),
          },
          {
            id: 'ver-1',
            artifactJson: verificationArtifact,
            createdAt: new Date('2026-03-13T12:00:02.000Z'),
          },
        ],
      },
    ]);
    mockAuditEventFindFirst.mockResolvedValue({
      id: 'audit-1',
      merkleRoot: 'merkle-1',
      createdAt: new Date('2026-03-14T11:00:00.000Z'),
    });
    mockGetCapsulesByNpi.mockResolvedValue([
      {
        id: 'capsule-1',
        decisionType: 'HIRING',
        decisionAction: 'APPROVE',
        verifierOrgId: 'org-1',
        trustStateHash: 'a'.repeat(64),
        artifactHash: 'b'.repeat(64),
        decisionTimestamp: '2026-03-14T11:55:00.000Z',
        metadata: {
          trust_state_snapshot: {
            readiness_level: 'L3',
          },
        },
      },
    ]);
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-1',
      valid: true,
      expectedArtifactHash: 'b'.repeat(64),
      actualArtifactHash: 'b'.repeat(64),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('builds complete audit bundles with valid evidence hashes', async () => {
    const bundle = await buildAuditBundleProof(npi);

    expect(bundle.file_name).toBe('audit_bundle.json');
    expect(bundle.credential_artifacts).toHaveLength(1);
    expect(bundle.verification_artifacts).toHaveLength(1);
    expect(bundle.trust_state_snapshot).toEqual({ readiness_level: 'L3' });
    expect(bundle.decision_capsule_reference).toEqual(expect.objectContaining({
      capsule_id: 'capsule-1',
      replay_valid: true,
    }));
    expect(bundle.ledger_anchor_reference).toEqual({
      audit_event_id: 'audit-1',
      merkle_root: 'merkle-1',
      anchored_at: '2026-03-14T11:00:00.000Z',
    });
    expect(validateAuditBundleEvidenceHashes(bundle)).toBe(true);
  });

  test('rejects bundles when replay verification fails', async () => {
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-1',
      valid: false,
      expectedArtifactHash: 'b'.repeat(64),
      actualArtifactHash: 'c'.repeat(64),
    });

    await expect(buildAuditBundleProof(npi)).rejects.toThrow(
      'Decision capsule replay verification failed for capsule-1',
    );
  });

  test('rejects incomplete artifact bundles', async () => {
    mockVerificationRunFindMany.mockResolvedValue([
      {
        id: 'run-1',
        artifacts: [
          {
            id: 'cred-1',
            artifactJson: credentialArtifact,
            createdAt: new Date('2026-03-13T12:00:01.000Z'),
          },
        ],
      },
    ]);

    await expect(buildAuditBundleProof(npi)).rejects.toThrow(
      'Audit bundle missing verification artifacts for 1003000126',
    );
  });
});
