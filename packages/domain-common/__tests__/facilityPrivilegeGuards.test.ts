import { describe, expect, it } from 'vitest';
import {
  assertDelegationAllowsIssuance,
  assertFacilityPrivilegeIssuanceValid,
  assertFacilityPrivilegeScope,
  assertFacilityPrivilegeTemplateValid,
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

describe('Facility privilege template validity', () => {
  it('rejects an absent required field', () => {
    expectViolation(
      () => assertFacilityPrivilegeTemplateValid({ ...templateBase, templateId: '' }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects a non-string required field', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeTemplateValid({
          ...templateBase,
          versionId: 123 as unknown as string,
        }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects a whitespace-only required field', () => {
    expectViolation(
      () => assertFacilityPrivilegeTemplateValid({ ...templateBase, facilityId: '   ' }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects a blank template name', () => {
    expectViolation(
      () => assertFacilityPrivilegeTemplateValid({ ...templateBase, name: '' }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects a non-finite version number', () => {
    expectViolation(
      () => assertFacilityPrivilegeTemplateValid({ ...templateBase, version: Number.NaN }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects a version below 1', () => {
    expectViolation(
      () => assertFacilityPrivilegeTemplateValid({ ...templateBase, version: 0 }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects privilegeCodes that are not an array', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeTemplateValid({
          ...templateBase,
          privilegeCodes: 'PRIV-1' as unknown as string[],
        }),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects an empty privilegeCodes list', () => {
    expectViolation(
      () => assertFacilityPrivilegeTemplateValid({ ...templateBase, privilegeCodes: [] }),
      'INVALID_TEMPLATE'
    );
  });
});

describe('Facility privilege template supersession', () => {
  const nextVersion: FacilityPrivilegeTemplateVersion = {
    ...templateBase,
    versionId: 'template-001-v2',
    version: 2,
    supersedesVersionId: 'template-001-v1',
  };

  it('rejects supersession that changes templateId', () => {
    expectViolation(
      () =>
        assertTemplateSupersessionValid({ ...nextVersion, templateId: 'template-999' }, templateBase),
      'TEMPLATE_SUPERSESSION'
    );
  });

  it('rejects supersession that does not reference the prior version', () => {
    expectViolation(
      () =>
        assertTemplateSupersessionValid({ ...nextVersion, supersedesVersionId: null }, templateBase),
      'TEMPLATE_SUPERSESSION'
    );
  });

  it('rejects supersession that does not raise the version number', () => {
    expectViolation(
      () => assertTemplateSupersessionValid({ ...nextVersion, version: 1 }, templateBase),
      'TEMPLATE_SUPERSESSION'
    );
  });
});

describe('Facility delegation issuance limits', () => {
  const issuedAt = '2025-01-03T00:00:00Z';

  it('rejects a delegation from another facility', () => {
    expectViolation(
      () =>
        assertDelegationAllowsIssuance(
          { ...delegationBase, facilityId: 'facility-999' },
          templateBase,
          ['PRIV-1'],
          issuedAt
        ),
      'FACILITY_MISMATCH'
    );
  });

  it('rejects a delegation that is not active', () => {
    expectViolation(
      () =>
        assertDelegationAllowsIssuance(
          { ...delegationBase, status: 'revoked' },
          templateBase,
          ['PRIV-1'],
          issuedAt
        ),
      'DELEGATION_SCOPE'
    );
  });

  it('rejects a delegation that scopes no privilege codes', () => {
    expectViolation(
      () =>
        assertDelegationAllowsIssuance(
          { ...delegationBase, allowedPrivilegeCodes: [] },
          templateBase,
          ['PRIV-1'],
          issuedAt
        ),
      'DELEGATION_SCOPE'
    );
  });

  it('rejects privileges outside the delegated scope', () => {
    expectViolation(
      () => assertDelegationAllowsIssuance(delegationBase, templateBase, ['PRIV-2'], issuedAt),
      'PRIVILEGE_SCOPE'
    );
  });

  it('rejects unparseable delegation timestamps', () => {
    expectViolation(
      () =>
        assertDelegationAllowsIssuance(
          { ...delegationBase, expiresAt: 'not-a-date' },
          templateBase,
          ['PRIV-1'],
          issuedAt
        ),
      'DELEGATION_EXPIRED'
    );
  });

  it('rejects issuance after the delegation has expired', () => {
    expectViolation(
      () =>
        assertDelegationAllowsIssuance(
          { ...delegationBase, expiresAt: '2025-01-02T00:00:00Z' },
          templateBase,
          ['PRIV-1'],
          '2025-06-01T00:00:00Z'
        ),
      'DELEGATION_EXPIRED'
    );
  });

  it('accepts a delegation with no expiry', () => {
    expect(() =>
      assertDelegationAllowsIssuance(
        { ...delegationBase, expiresAt: null },
        templateBase,
        ['PRIV-1'],
        issuedAt
      )
    ).not.toThrow();
  });
});

describe('Facility privilege issuance validity', () => {
  it('rejects a credential that does not declare issuerType=facility', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          { ...credentialBase, issuerType: 'department' as unknown as 'facility' },
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'ISSUER_TYPE_MISMATCH'
    );
  });

  it('rejects a proof that does not declare issuerType=facility', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          {
            ...credentialBase,
            proof: {
              ...credentialBase.proof,
              issuerType: 'department' as unknown as 'facility',
            },
          },
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'ISSUER_TYPE_MISMATCH'
    );
  });

  it('rejects a credential issued for another facility', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          { ...credentialBase, facilityId: 'facility-999' },
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'FACILITY_MISMATCH'
    );
  });

  it('rejects a credential bound to a different template version', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          { ...credentialBase, templateVersionId: 'template-001-v2' },
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'INVALID_TEMPLATE'
    );
  });

  it('rejects an expiry that is not after issuance', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          { ...credentialBase, expiresAt: credentialBase.issuedAt },
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'INVALID_EXPIRY'
    );
  });

  it('rejects unparseable credential timestamps', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          { ...credentialBase, expiresAt: 'not-a-date' },
          templateBase,
          'did:example:facility-001',
          delegationBase
        ),
      'INVALID_EXPIRY'
    );
  });

  it('rejects a delegation for a different department', () => {
    expectViolation(
      () =>
        assertFacilityPrivilegeIssuanceValid(
          credentialBase,
          templateBase,
          'did:example:facility-001',
          { ...delegationBase, departmentId: 'dept-999' }
        ),
      'DELEGATION_SCOPE'
    );
  });

  it('accepts facility-level issuance with no department and no delegation', () => {
    expect(() =>
      assertFacilityPrivilegeIssuanceValid(
        { ...credentialBase, issuedByDepartmentId: undefined },
        templateBase,
        'did:example:facility-001'
      )
    ).not.toThrow();
  });
});

describe('Facility privilege scope checks', () => {
  it('rejects required privileges the credential does not carry', () => {
    expectViolation(
      () => assertFacilityPrivilegeScope(credentialBase, 'facility-001', ['PRIV-2']),
      'PRIVILEGE_SCOPE'
    );
  });

  it('accepts a scope the credential fully satisfies', () => {
    expect(() =>
      assertFacilityPrivilegeScope(credentialBase, 'facility-001', ['PRIV-1'])
    ).not.toThrow();
  });
});
