/**
 * Facility-Issued Privilege Credentials (Canonical Facility Authority)
 *
 * Facilities are the sole issuers. Departments can issue only through
 * explicit, scoped delegation from the facility.
 *
 * Templates are immutable. Changes require new versions that explicitly
 * supersede prior versions. Credentials bind to a template version at issuance.
 */

export type FacilityIssuerType = 'facility';

export interface FacilityPrivilegeTemplateVersion {
  templateId: string;
  versionId: string;
  version: number;
  facilityId: string;
  name: string;
  description?: string;
  privilegeCodes: string[];
  createdAt: string;
  supersedesVersionId?: string | null;
  status: 'active' | 'superseded';
}

export interface FacilityDepartmentDelegation {
  delegationId: string;
  facilityId: string;
  departmentId: string;
  allowedTemplateIds: string[];
  allowedPrivilegeCodes: string[];
  issuedAt: string;
  expiresAt?: string | null;
  status: 'active' | 'revoked' | 'expired';
}

export interface FacilityPrivilegeCredential {
  credentialId: string;
  issuerType: FacilityIssuerType;
  facilityId: string;
  issuerDid: string;
  subjectDid: string;
  templateVersionId: string;
  privilegeCodes: string[];
  issuedAt: string;
  expiresAt: string;
  issuedByDepartmentId?: string;
  proof: {
    type: 'Ed25519Signature2020' | 'JcsEd25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
    issuerType: FacilityIssuerType;
  };
}

export interface FacilityPrivilegeRevocation {
  revocationId: string;
  credentialId: string;
  facilityId: string;
  revokedAt: string;
  reason?: string;
  revokedByDepartmentId?: string;
}
