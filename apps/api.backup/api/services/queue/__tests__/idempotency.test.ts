import { describe, expect, it } from '@jest/globals';
import { NCIVerifiableProofType } from '@prisma/client';
import { deriveIdempotencyKey } from '../idempotency.js';

describe('queue idempotency key derivation', () => {
  it('builds deterministic key for PSV jobs', () => {
    const key = deriveIdempotencyKey('PSV_RUN', {
      clinicianId: 'clin-1',
      npi: '1234567890',
      state: 'ca',
      licenseNumber: 'LIC-1',
    });
    expect(key).toBe('psv:clin-1:CA:LIC-1');
  });

  it('derives key for privilege issuance', () => {
    const key = deriveIdempotencyKey('PRIVILEGE_ISSUE', {
      privilegeRequestId: 'req-1',
      privilegeGrantedId: 'grant-123',
      clinicianDid: 'did:key:abc',
      orgId: 'org-1',
      privilegeSetId: 'set-1',
      reviewerDid: 'did:key:reviewer',
    });
    expect(key).toBe('privilege:grant-123');
  });

  it('returns null for job types without builders', () => {
    const key = deriveIdempotencyKey('DRIFT_SWEEP', {});
    expect(key).toBeNull();
  });

  it('derives key for safety sweep jobs', () => {
    const key = deriveIdempotencyKey('SAFETY_SWEEP', {
      clinicianId: 'clin-42',
    });
    expect(key).toBe('safety-sweep:clin-42');
  });

  it('derives key for NCI publish proofs', () => {
    const key = deriveIdempotencyKey('NCI_PUBLISH_PROOFS', {
      clinicianId: 'clin-xyz',
      proofTypes: [NCIVerifiableProofType.ISSUANCE, NCIVerifiableProofType.VERIFICATION],
    });
    expect(key).toBe('nci-proof:clin-xyz:ISSUANCE,VERIFICATION');
  });

  it('allows duplicate fusion updates by default', () => {
    const key = deriveIdempotencyKey('FUSION_UPDATE', {
      fusionId: 'fusion-free',
      clinicianId: 'clin-free',
      orgId: 'org-free',
    });
    expect(key).toBeNull();
  });
});

