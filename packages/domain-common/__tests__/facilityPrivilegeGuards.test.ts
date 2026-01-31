import { describe, expect, it } from 'vitest';
import {
  assertDelegationAllowsIssuance,
  assertFacilityPrivilegeIssuanceValid,
  assertFacilityPrivilegeScope,
  assertTemplateSupersessionValid,
  FacilityPrivilegeViolation,
} from '../facilityPrivilegeGuards';
import {
  FacilityDepartmentDelegation,
  FacilityPrivilegeCredential,
  FacilityPrivilegeTemplateVersion,
} from '../facilityPrivilegeContracts';

const templateBase: FacilityPrivilegeTemplateVersion = {
  templateId: 'template-001',
  versionId: 'template-001-v1',
  version: 1,
  facilityId: 'facility-001',
  name: 'Core Privileges',
  privilegeCodes: ['PRIV-1', 'PRIV-2'],
  createdAt: '2025-01-01T00:00:00Z',
  status: 'active',
};

const delegationBase: FacilityDepartmentDelegation = {
  delegationId: 'delegation-001',
  facilityId: 'facility-001',
  departmentId: 'dept-123',
  allowedTemplateIds: ['template-001'],
  allowedPrivilegeCodes: ['PRIV-1'],
  issuedAt: '2025-01-02T00:00:00Z',
  expiresAt: '2025-12-31T00:00:00Z',
  status: 'active',
};

const credentialBase: FacilityPrivilegeCredential = {
  credentialId: 'cred-001',
  issuerType: 'facility',
  facilityId: 'facility-001',
  issuerDid: 'did:example:facility-001',
  subjectDid: 'did:example:practitioner-1',
  templateVersionId: 'template-001-v1',
  privilegeCodes: ['PRIV-1'],
  issuedAt: '2025-01-03T00:00:00Z',
  expiresAt: '2025-06-01T00:00:00Z',
  issuedByDepartmentId: 'dept-123',
  proof: {
    type: 'Ed25519Signature2020',
    created: '2025-01-03T00:00:00Z',
    verificationMethod: 'did:example:facility-001#key-1',
    proofPurpose: 'assertionMethod',
    proofValue: 'proof-value',
    issuerType: 'facility',
  },
};

const expectViolation = (action: () => void, violationType: FacilityPrivilegeViolation['violationType']) => {
  try {
    action();
  } catch (error) {
    if (error instanceof FacilityPrivilegeViolation) {
      expect(error.violationType).toBe(violationType);
      return;
    }
    throw error;
  }
  throw new Error('Expected FacilityPrivilegeViolation');
};

describe('Facility privilege guards', () => {
  it('enforces template supersession within facility', () => {
    const nextVersion: FacilityPrivilegeTemplateVersion = {
      ...templateBase,
      versionId: 'template-001-v2',
      version: 2,
      supersedesVersionId: 'template-001-v1',
    };

    expect(() => assertTemplateSupersessionValid(nextVersion, templateBase)).not.toThrow();
  });

  it('rejects supersession across facilities', () => {
    const nextVersion: FacilityPrivilegeTemplateVersion = {
      ...templateBase,
      versionId: 'template-001-v2',
      version: 2,
      facilityId: 'facility-999',
      supersedesVersionId: 'template-001-v1',
    };

    expectViolation(
      () => assertTemplateSupersessionValid(nextVersion, templateBase),
      'FACILITY_MISMATCH'
    );
  });

  it('rejects delegation without template scope', () => {
    const delegation: FacilityDepartmentDelegation = {
      ...delegationBase,
      allowedTemplateIds: ['template-999'],
    };

    expectViolation(
      () => assertDelegationAllowsIssuance(delegation, templateBase, ['PRIV-1'], '2025-01-03T00:00:00Z'),
      'DELEGATION_SCOPE'
    );
  });

  it('rejects issuance without delegation when department issues', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          credentialBase,
          templateBase,
          'did:example:facility-001'
        ),
      'DELEGATION_REQUIRED'
    );
  });

  it('rejects privilege codes outside template scope', () => {
    const credential: FacilityPrivilegeCredential = {
      ...credentialBase,
      privilegeCodes: ['PRIV-9'],
    };

    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          credential,
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'PRIVILEGE_SCOPE'
    );
  });

  it('rejects credential proof that does not reference facility DID', () => {
    const credential: FacilityPrivilegeCredential = {
      ...credentialBase,
      proof: {
        ...credentialBase.proof,
        verificationMethod: 'did:example:other#key-1',
      },
    };

    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          credential,
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'SIGNATURE_MISMATCH'
    );
  });

  it('rejects scope checks that cross facilities', () => {
    const credential: FacilityPrivilegeCredential = {
      ...credentialBase,
      issuedByDepartmentId: undefined,
    };

    expectViolation(
      () => assertFacilityPrivilegeScope(credential, 'facility-999', ['PRIV-1']),
      'FACILITY_MISMATCH'
    );
  });

  it('accepts valid facility issuance with delegation', () => {
    expect(() =>
      assertFacilityPrivilegeIssuanceValid(
        credentialBase,
        templateBase,
        'did:example:facility-001',
        delegationBase
      )
    ).not.toThrow();
  });
});
