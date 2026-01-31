import {
  FacilityDepartmentDelegation,
  FacilityPrivilegeCredential,
  FacilityPrivilegeTemplateVersion,
} from './facilityPrivilegeContracts';

export class FacilityPrivilegeViolation extends Error {
  constructor(
    message: string,
    public readonly violationType:
      | 'FACILITY_MISMATCH'
      | 'ISSUER_TYPE_MISMATCH'
      | 'INVALID_TEMPLATE'
      | 'TEMPLATE_SUPERSESSION'
      | 'DELEGATION_REQUIRED'
      | 'DELEGATION_SCOPE'
      | 'DELEGATION_EXPIRED'
      | 'PRIVILEGE_SCOPE'
      | 'SIGNATURE_MISMATCH'
      | 'INVALID_EXPIRY'
  ) {
    super(message);
    this.name = 'FacilityPrivilegeViolation';
  }
}

const assertNonEmpty = (value: string, fieldName: string) => {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new FacilityPrivilegeViolation(
      `${fieldName} must be a non-empty string`,
      'INVALID_TEMPLATE'
    );
  }
};

const assertPrivilegeSubset = (requested: string[], allowed: string[], context: string) => {
  const missing = requested.filter((privilege) => !allowed.includes(privilege));
  if (missing.length > 0) {
    throw new FacilityPrivilegeViolation(
      `${context} contains privileges outside the allowed scope: ${missing.join(', ')}`,
      'PRIVILEGE_SCOPE'
    );
  }
};

export function assertFacilityPrivilegeTemplateValid(
  template: FacilityPrivilegeTemplateVersion
): void {
  assertNonEmpty(template.templateId, 'FacilityPrivilegeTemplateVersion.templateId');
  assertNonEmpty(template.versionId, 'FacilityPrivilegeTemplateVersion.versionId');
  assertNonEmpty(template.facilityId, 'FacilityPrivilegeTemplateVersion.facilityId');
  assertNonEmpty(template.name, 'FacilityPrivilegeTemplateVersion.name');

  if (!Number.isFinite(template.version) || template.version < 1) {
    throw new FacilityPrivilegeViolation(
      'FacilityPrivilegeTemplateVersion.version must be a positive number',
      'INVALID_TEMPLATE'
    );
  }

  if (!Array.isArray(template.privilegeCodes) || template.privilegeCodes.length === 0) {
    throw new FacilityPrivilegeViolation(
      'FacilityPrivilegeTemplateVersion.privilegeCodes must contain at least one privilege',
      'INVALID_TEMPLATE'
    );
  }
}

export function assertTemplateSupersessionValid(
  nextVersion: FacilityPrivilegeTemplateVersion,
  previousVersion: FacilityPrivilegeTemplateVersion
): void {
  assertFacilityPrivilegeTemplateValid(nextVersion);
  assertFacilityPrivilegeTemplateValid(previousVersion);

  if (nextVersion.facilityId !== previousVersion.facilityId) {
    throw new FacilityPrivilegeViolation(
      'Template supersession must stay within the same facility',
      'FACILITY_MISMATCH'
    );
  }

  if (nextVersion.templateId !== previousVersion.templateId) {
    throw new FacilityPrivilegeViolation(
      'Template supersession must keep the same templateId',
      'TEMPLATE_SUPERSESSION'
    );
  }

  if (nextVersion.supersedesVersionId !== previousVersion.versionId) {
    throw new FacilityPrivilegeViolation(
      'Template supersession must explicitly reference the prior version',
      'TEMPLATE_SUPERSESSION'
    );
  }

  if (nextVersion.version <= previousVersion.version) {
    throw new FacilityPrivilegeViolation(
      'Template supersession requires a higher version number',
      'TEMPLATE_SUPERSESSION'
    );
  }
}

export function assertDelegationAllowsIssuance(
  delegation: FacilityDepartmentDelegation,
  template: FacilityPrivilegeTemplateVersion,
  privilegeCodes: string[],
  issuedAt: string
): void {
  if (delegation.facilityId !== template.facilityId) {
    throw new FacilityPrivilegeViolation(
      'Delegation facilityId must match template facilityId',
      'FACILITY_MISMATCH'
    );
  }

  if (delegation.status !== 'active') {
    throw new FacilityPrivilegeViolation(
      'Delegation must be active to issue privileges',
      'DELEGATION_SCOPE'
    );
  }

  const hasTemplateScope = delegation.allowedTemplateIds.includes(template.templateId);
  if (!hasTemplateScope) {
    throw new FacilityPrivilegeViolation(
      'Delegation does not allow this template',
      'DELEGATION_SCOPE'
    );
  }

  if (delegation.allowedPrivilegeCodes.length === 0) {
    throw new FacilityPrivilegeViolation(
      'Delegation must explicitly scope privilege codes',
      'DELEGATION_SCOPE'
    );
  }

  assertPrivilegeSubset(privilegeCodes, delegation.allowedPrivilegeCodes, 'Delegation');

  if (delegation.expiresAt) {
    const issuedTime = Date.parse(issuedAt);
    const expiryTime = Date.parse(delegation.expiresAt);
    if (!Number.isFinite(issuedTime) || !Number.isFinite(expiryTime)) {
      throw new FacilityPrivilegeViolation(
        'Delegation timestamps must be valid ISO 8601 strings',
        'DELEGATION_EXPIRED'
      );
    }
    if (issuedTime > expiryTime) {
      throw new FacilityPrivilegeViolation(
        'Delegation expired before issuance',
        'DELEGATION_EXPIRED'
      );
    }
  }
}

export function assertFacilityPrivilegeIssuanceValid(
  credential: FacilityPrivilegeCredential,
  template: FacilityPrivilegeTemplateVersion,
  facilityDid: string,
  delegation?: FacilityDepartmentDelegation
): void {
  assertFacilityPrivilegeTemplateValid(template);

  if (credential.issuerType !== 'facility' || credential.proof.issuerType !== 'facility') {
    throw new FacilityPrivilegeViolation(
      'Facility-issued credentials must declare issuerType=facility',
      'ISSUER_TYPE_MISMATCH'
    );
  }

  if (credential.facilityId !== template.facilityId) {
    throw new FacilityPrivilegeViolation(
      'Credential facilityId must match template facilityId',
      'FACILITY_MISMATCH'
    );
  }

  if (credential.templateVersionId !== template.versionId) {
    throw new FacilityPrivilegeViolation(
      'Credential must bind to the exact template version',
      'INVALID_TEMPLATE'
    );
  }

  if (!credential.proof.verificationMethod.includes(facilityDid)) {
    throw new FacilityPrivilegeViolation(
      'Credential proof must reference the facility DID',
      'SIGNATURE_MISMATCH'
    );
  }

  assertPrivilegeSubset(credential.privilegeCodes, template.privilegeCodes, 'Credential');

  const issuedTime = Date.parse(credential.issuedAt);
  const expiryTime = Date.parse(credential.expiresAt);
  if (!Number.isFinite(issuedTime) || !Number.isFinite(expiryTime) || issuedTime >= expiryTime) {
    throw new FacilityPrivilegeViolation(
      'Credential expiresAt must be after issuedAt',
      'INVALID_EXPIRY'
    );
  }

  if (credential.issuedByDepartmentId) {
    if (!delegation) {
      throw new FacilityPrivilegeViolation(
        'Department issuance requires explicit facility delegation',
        'DELEGATION_REQUIRED'
      );
    }
    if (delegation.departmentId !== credential.issuedByDepartmentId) {
      throw new FacilityPrivilegeViolation(
        'Delegation departmentId must match credential issuance',
        'DELEGATION_SCOPE'
      );
    }
    assertDelegationAllowsIssuance(
      delegation,
      template,
      credential.privilegeCodes,
      credential.issuedAt
    );
  }
}

export function assertFacilityPrivilegeScope(
  credential: FacilityPrivilegeCredential,
  facilityId: string,
  requiredPrivilegeCodes: string[]
): void {
  if (credential.facilityId !== facilityId) {
    throw new FacilityPrivilegeViolation(
      'Credential facilityId does not match requested facility scope',
      'FACILITY_MISMATCH'
    );
  }

  assertPrivilegeSubset(requiredPrivilegeCodes, credential.privilegeCodes, 'Scope');
}
