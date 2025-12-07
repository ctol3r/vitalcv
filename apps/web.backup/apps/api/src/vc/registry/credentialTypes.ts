/**
 * VC Type Registry for Healthcare Credential Flavors
 *
 * Defines VitalCV-specific credential types with JSON schemas, human names,
 * allowed issuers, and default status lists. Referenced by OID4VCI metadata
 * and wallet UI.
 */

import type { CredentialSchema } from '../models';

export interface CredentialTypeDefinition {
  type: string; // VC type identifier (e.g., "LicenseCredential")
  humanName: string; // Human-readable name
  description: string;
  jsonSchema: CredentialSchema; // JSON Schema URL or object
  allowedIssuers: string[]; // Issuer organization IDs or DIDs
  defaultStatusList?: {
    purpose: 'revocation' | 'suspension';
    issuerId: string;
  };
  requiredClaims: string[]; // Required claim paths
  optionalClaims: string[]; // Optional claim paths
  validityPeriod?: {
    defaultDays: number;
    maxDays?: number;
  };
}

/**
 * Registry of all supported credential types
 */
export const CREDENTIAL_TYPE_REGISTRY: Record<string, CredentialTypeDefinition> = {
  LicenseCredential: {
    type: 'LicenseCredential',
    humanName: 'Medical License',
    description: 'State medical board license credential',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/license/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: [
      'did:web:vitalcv.com:issuer:medical-board',
      'did:web:vitalcv.com:issuer:state-board',
    ],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:medical-board',
    },
    requiredClaims: [
      'credentialSubject.licenseNumber',
      'credentialSubject.stateCode',
      'credentialSubject.licenseType',
      'credentialSubject.issueDate',
      'credentialSubject.expirationDate',
    ],
    optionalClaims: [
      'credentialSubject.specialty',
      'credentialSubject.restrictions',
      'credentialSubject.boardCertifications',
    ],
    validityPeriod: {
      defaultDays: 365,
      maxDays: 1095, // 3 years
    },
  },

  BoardCertificationCredential: {
    type: 'BoardCertificationCredential',
    humanName: 'Board Certification',
    description: 'Medical specialty board certification',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/board-certification/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: [
      'did:web:vitalcv.com:issuer:abms',
      'did:web:vitalcv.com:issuer:aoa',
      'did:web:vitalcv.com:issuer:specialty-board',
    ],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:abms',
    },
    requiredClaims: [
      'credentialSubject.certificationBoard',
      'credentialSubject.specialty',
      'credentialSubject.certificationDate',
      'credentialSubject.expirationDate',
    ],
    optionalClaims: [
      'credentialSubject.certificationNumber',
      'credentialSubject.maintenanceOfCertification',
    ],
    validityPeriod: {
      defaultDays: 2555, // 7 years (typical MOC cycle)
      maxDays: 3650, // 10 years
    },
  },

  SanctionClearanceCredential: {
    type: 'SanctionClearanceCredential',
    humanName: 'Sanction Clearance',
    description: 'Verification of no active sanctions or exclusions',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/sanction-clearance/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: [
      'did:web:vitalcv.com:issuer:oig',
      'did:web:vitalcv.com:issuer:sam',
      'did:web:vitalcv.com:issuer:compliance',
    ],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:oig',
    },
    requiredClaims: [
      'credentialSubject.checkedAt',
      'credentialSubject.sources',
      'credentialSubject.status',
    ],
    optionalClaims: ['credentialSubject.previousSanctions', 'credentialSubject.notes'],
    validityPeriod: {
      defaultDays: 90, // Re-check every 90 days
      maxDays: 180,
    },
  },

  IdentityAssertionCredential: {
    type: 'IdentityAssertionCredential',
    humanName: 'Identity Assertion',
    description: 'Verified identity assertion with NPI and demographic data',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/identity/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: ['did:web:vitalcv.com:issuer:identity', 'did:web:vitalcv.com:issuer:nppes'],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:identity',
    },
    requiredClaims: [
      'credentialSubject.id', // DID
      'credentialSubject.npi',
      'credentialSubject.givenName',
      'credentialSubject.familyName',
    ],
    optionalClaims: [
      'credentialSubject.middleName',
      'credentialSubject.dateOfBirth',
      'credentialSubject.email',
      'credentialSubject.phone',
    ],
    validityPeriod: {
      defaultDays: 365,
      maxDays: 1095,
    },
  },

  DEACredential: {
    type: 'DEACredential',
    humanName: 'DEA Registration',
    description: 'Drug Enforcement Administration registration credential',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/dea/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: ['did:web:vitalcv.com:issuer:dea'],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:dea',
    },
    requiredClaims: [
      'credentialSubject.deaNumber',
      'credentialSubject.schedules',
      'credentialSubject.issueDate',
      'credentialSubject.expirationDate',
    ],
    optionalClaims: ['credentialSubject.stateRestrictions'],
    validityPeriod: {
      defaultDays: 1095, // 3 years
      maxDays: 1095,
    },
  },

  CompactEligibilityCredential: {
    type: 'CompactEligibilityCredential',
    humanName: 'Compact Eligibility',
    description: 'Interstate medical licensure compact eligibility',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/compact-eligibility/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: ['did:web:vitalcv.com:issuer:imlcc', 'did:web:vitalcv.com:issuer:compact'],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:imlcc',
    },
    requiredClaims: [
      'credentialSubject.primaryState',
      'credentialSubject.eligibleStates',
      'credentialSubject.eligibilityDate',
    ],
    optionalClaims: ['credentialSubject.compactType', 'credentialSubject.restrictions'],
    validityPeriod: {
      defaultDays: 365,
      maxDays: 1095,
    },
  },

  PrivilegeCredential: {
    type: 'PrivilegeCredential',
    humanName: 'Clinical Privileges',
    description: 'Hospital or facility clinical privileges',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/privilege/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: ['did:web:vitalcv.com:issuer:facility', 'did:web:vitalcv.com:issuer:hospital'],
    defaultStatusList: {
      purpose: 'suspension',
      issuerId: 'did:web:vitalcv.com:issuer:facility',
    },
    requiredClaims: [
      'credentialSubject.facilityId',
      'credentialSubject.privilegeCodes',
      'credentialSubject.grantedDate',
    ],
    optionalClaims: [
      'credentialSubject.expirationDate',
      'credentialSubject.conditions',
      'credentialSubject.supervisionLevel',
    ],
    validityPeriod: {
      defaultDays: 365,
      maxDays: 1095,
    },
  },

  EducationCredential: {
    type: 'EducationCredential',
    humanName: 'Medical Education',
    description: 'Medical school or residency training credential',
    jsonSchema: {
      id: 'https://schemas.vitalcv.com/credentials/education/v1',
      type: 'JsonSchemaValidator2018',
    },
    allowedIssuers: [
      'did:web:vitalcv.com:issuer:medical-school',
      'did:web:vitalcv.com:issuer:residency-program',
    ],
    defaultStatusList: {
      purpose: 'revocation',
      issuerId: 'did:web:vitalcv.com:issuer:medical-school',
    },
    requiredClaims: [
      'credentialSubject.institution',
      'credentialSubject.degree',
      'credentialSubject.completionDate',
    ],
    optionalClaims: [
      'credentialSubject.gpa',
      'credentialSubject.honors',
      'credentialSubject.specialization',
    ],
    validityPeriod: {
      defaultDays: 3650, // 10 years (typically permanent)
      maxDays: 36500, // 100 years (effectively permanent)
    },
  },
};

/**
 * Get credential type definition
 */
export function getCredentialType(type: string): CredentialTypeDefinition | undefined {
  return CREDENTIAL_TYPE_REGISTRY[type];
}

/**
 * List all supported credential types
 */
export function listCredentialTypes(): CredentialTypeDefinition[] {
  return Object.values(CREDENTIAL_TYPE_REGISTRY);
}

/**
 * Check if an issuer is allowed to issue a credential type
 */
export function isIssuerAllowed(issuerId: string, credentialType: string): boolean {
  const typeDef = getCredentialType(credentialType);
  if (!typeDef) {
    return false;
  }

  return typeDef.allowedIssuers.some((allowed) => {
    // Exact match
    if (allowed === issuerId) {
      return true;
    }

    // DID method match (e.g., did:web:vitalcv.com:issuer:*)
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(issuerId);
    }

    return false;
  });
}

/**
 * Get default status list for a credential type
 */
export function getDefaultStatusList(credentialType: string):
  | {
      purpose: 'revocation' | 'suspension';
      issuerId: string;
    }
  | undefined {
  const typeDef = getCredentialType(credentialType);
  return typeDef?.defaultStatusList;
}

/**
 * Validate credential claims against type definition
 */
export function validateCredentialClaims(
  credentialType: string,
  claims: Record<string, unknown>,
): { valid: boolean; missing: string[]; invalid: string[] } {
  const typeDef = getCredentialType(credentialType);
  if (!typeDef) {
    return {
      valid: false,
      missing: [],
      invalid: [`Unknown credential type: ${credentialType}`],
    };
  }

  const missing: string[] = [];
  const invalid: string[] = [];

  // Check required claims
  for (const claimPath of typeDef.requiredClaims) {
    const value = getNestedValue(claims, claimPath);
    if (value === undefined || value === null) {
      missing.push(claimPath);
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}
