/**
 * SD-JWT Field Mapping for Selective Disclosure
 * Maps UI presets to SD-JWT disclosure claims
 * Task: 1105-frontend-0001
 */

export type DisclosurePreset = 'minimum' | 'job' | 'full';

export interface SDJWTMapping {
  preset: DisclosurePreset;
  revealedClaims: string[];
  concealedClaims: string[];
}

export interface CredentialField {
  key: string;
  value: any;
  sensitive?: boolean;
  category?: 'identity' | 'credentials' | 'contact' | 'other';
}

/**
 * Preset configurations for different credential types
 * These align with backend SD-JWT disclosure logic
 */
const CREDENTIAL_TYPE_PRESETS: Record<
  string,
  Record<DisclosurePreset, string[]>
> = {
  MedicalLicense: {
    minimum: ['licenseNumber', 'licenseType', 'state', 'status'],
    job: [
      'licenseNumber',
      'licenseType',
      'state',
      'status',
      'specialty',
      'npi',
      'issuedAt',
      'expiresAt',
    ],
    full: ['*'], // All fields
  },
  BoardCertification: {
    minimum: ['certificationNumber', 'boardName', 'status'],
    job: [
      'certificationNumber',
      'boardName',
      'status',
      'specialty',
      'certificationDate',
      'expirationDate',
      'npi',
    ],
    full: ['*'],
  },
  EducationCredential: {
    minimum: ['degree', 'institution', 'graduationYear'],
    job: ['degree', 'institution', 'graduationYear', 'major', 'honors'],
    full: ['*'],
  },
  default: {
    minimum: [], // First 3 fields by default
    job: [], // Professional-looking fields
    full: ['*'], // Everything
  },
};

/**
 * Map UI preset selection to SD-JWT claim disclosure
 * @param preset - The disclosure preset (minimum/job/full)
 * @param fields - Available credential fields
 * @param credentialType - Type of credential (MedicalLicense, BoardCertification, etc.)
 * @returns SD-JWT mapping with revealed and concealed claims
 */
export function mapPresetToSDJWT(
  preset: DisclosurePreset,
  fields: CredentialField[],
  credentialType: string = 'default'
): SDJWTMapping {
  const presetConfig =
    CREDENTIAL_TYPE_PRESETS[credentialType] || CREDENTIAL_TYPE_PRESETS.default;
  const presetFields = presetConfig[preset];

  const allFieldKeys = fields.map((f) => f.key);
  let revealedClaims: string[] = [];

  if (presetFields.includes('*')) {
    // Full disclosure - reveal everything
    revealedClaims = allFieldKeys;
  } else if (presetFields.length === 0) {
    // Default behavior when no preset defined
    if (preset === 'minimum') {
      // First 3 fields or common identity fields
      revealedClaims = findMinimumFields(fields);
    } else if (preset === 'job') {
      // Professional/credential-related fields
      revealedClaims = findJobApplicationFields(fields);
    } else {
      revealedClaims = allFieldKeys;
    }
  } else {
    // Map preset to actual field keys present in credential
    revealedClaims = allFieldKeys.filter((key) => presetFields.includes(key));
  }

  const concealedClaims = allFieldKeys.filter((key) => !revealedClaims.includes(key));

  return {
    preset,
    revealedClaims,
    concealedClaims,
  };
}

/**
 * Find minimum essential fields for disclosure
 */
function findMinimumFields(fields: CredentialField[]): string[] {
  const minimumKeywords = ['name', 'id', 'number', 'status', 'type', 'license'];
  const minimumFields = fields
    .filter((f) =>
      minimumKeywords.some((kw) => f.key.toLowerCase().includes(kw))
    )
    .slice(0, 4);

  // Fallback to first 3 fields if no keyword matches
  if (minimumFields.length === 0) {
    return fields.slice(0, 3).map((f) => f.key);
  }

  return minimumFields.map((f) => f.key);
}

/**
 * Find fields relevant for job applications
 */
function findJobApplicationFields(fields: CredentialField[]): string[] {
  const jobKeywords = [
    'license',
    'certification',
    'npi',
    'specialty',
    'board',
    'credential',
    'degree',
    'issued',
    'expires',
    'status',
    'name',
  ];

  const jobFields = fields.filter((f) =>
    jobKeywords.some((kw) => f.key.toLowerCase().includes(kw))
  );

  // If less than half fields match, include all non-sensitive fields
  if (jobFields.length < fields.length / 2) {
    return fields.filter((f) => !f.sensitive).map((f) => f.key);
  }

  return jobFields.map((f) => f.key);
}

/**
 * Convert custom field selection to SD-JWT mapping
 * @param selectedFields - Array of selected field keys
 * @param allFields - All available fields
 * @returns SD-JWT mapping
 */
export function mapCustomSelectionToSDJWT(
  selectedFields: string[],
  allFields: CredentialField[]
): SDJWTMapping {
  const allFieldKeys = allFields.map((f) => f.key);
  const revealedClaims = selectedFields.filter((key) => allFieldKeys.includes(key));
  const concealedClaims = allFieldKeys.filter((key) => !selectedFields.includes(key));

  return {
    preset: 'full', // Custom is treated as full with manual selection
    revealedClaims,
    concealedClaims,
  };
}

/**
 * Validate SD-JWT mapping
 * Ensures all fields are accounted for and no duplicates exist
 */
export function validateSDJWTMapping(mapping: SDJWTMapping): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for duplicates
  const allClaims = [...mapping.revealedClaims, ...mapping.concealedClaims];
  const uniqueClaims = new Set(allClaims);
  if (uniqueClaims.size !== allClaims.length) {
    errors.push('Duplicate claims found in mapping');
  }

  // Check for overlaps
  const revealed = new Set(mapping.revealedClaims);
  const concealed = new Set(mapping.concealedClaims);
  const overlap = [...revealed].filter((c) => concealed.has(c));
  if (overlap.length > 0) {
    errors.push(`Claims appear in both revealed and concealed: ${overlap.join(', ')}`);
  }

  // Minimum disclosure check
  if (mapping.revealedClaims.length === 0 && mapping.preset !== 'minimum') {
    errors.push('At least one claim must be revealed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get human-readable description of what will be shared
 */
export function getDisclosureDescription(
  mapping: SDJWTMapping,
  totalFields: number
): string {
  const revealedCount = mapping.revealedClaims.length;
  const concealedCount = mapping.concealedClaims.length;

  if (revealedCount === totalFields) {
    return `Sharing all ${totalFields} fields with the verifier`;
  } else if (revealedCount === 0) {
    return 'No fields will be shared (verification only)';
  } else {
    return `Sharing ${revealedCount} of ${totalFields} fields. ${concealedCount} fields will remain private.`;
  }
}

