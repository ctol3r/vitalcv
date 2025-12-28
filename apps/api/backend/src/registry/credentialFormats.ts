export type CredentialFormatId = 'us_license' | 'compact_license' | 'eu_eudcc';

export type CredentialExpiryModel = {
  type: 'fixed' | 'compact' | 'rolling';
  description: string;
  defaultMonths?: number;
};

export type CredentialFormatSchema = {
  id: CredentialFormatId;
  label: string;
  description: string;
  region: 'US' | 'COMPACT' | 'EU';
  version: string;
  requiredFields: string[];
  optionalFields: string[];
  expiryModel: CredentialExpiryModel;
  status: 'active' | 'future';
};

const credentialFormats: Record<CredentialFormatId, CredentialFormatSchema> = {
  us_license: {
    id: 'us_license',
    label: 'US Standard License VC',
    description: 'Baseline U.S. medical license format (single-state).',
    region: 'US',
    version: '2024-10',
    requiredFields: ['subjectId', 'type', 'issuingAuthority', 'licenseNumber', 'expiryDate'],
    optionalFields: ['additionalData'],
    expiryModel: {
      type: 'fixed',
      description: 'Fixed expiry date aligned with state board renewal.',
      defaultMonths: 24,
    },
    status: 'active',
  },
  compact_license: {
    id: 'compact_license',
    label: 'Compact License VC (IMLC-compliant)',
    description: 'Compact license format with multi-state privileges (e.g., IMLC).',
    region: 'COMPACT',
    version: '2024-10',
    requiredFields: [
      'subjectId',
      'type',
      'issuingAuthority',
      'licenseNumber',
      'expiryDate',
      'compactType',
      'compactMemberState',
    ],
    optionalFields: ['additionalData', 'compactPrivileges', 'compactStanding'],
    expiryModel: {
      type: 'compact',
      description: 'Compact privilege validity tied to issuing state renewal cycle.',
      defaultMonths: 24,
    },
    status: 'active',
  },
  eu_eudcc: {
    id: 'eu_eudcc',
    label: 'EU EUDCC Extension (Future)',
    description: 'EU Digital Credential extension placeholder for future alignment.',
    region: 'EU',
    version: 'future',
    requiredFields: ['subjectId', 'type', 'issuingAuthority', 'expiryDate'],
    optionalFields: ['additionalData', 'eudccVersion', 'eudccIssuer', 'eudccUvci'],
    expiryModel: {
      type: 'rolling',
      description: 'Rolling expiry for EU credential extension (future).',
      defaultMonths: 12,
    },
    status: 'future',
  },
};

export function getCredentialFormats(): CredentialFormatSchema[] {
  return Object.values(credentialFormats);
}

export function getCredentialFormat(id: string | undefined): CredentialFormatSchema | null {
  if (!id) return null;
  if (!(id in credentialFormats)) return null;
  return credentialFormats[id as CredentialFormatId];
}

export function resolveCredentialFormat(id: string | undefined): CredentialFormatSchema {
  return credentialFormats[(id as CredentialFormatId) || 'us_license'];
}

export function validateCredentialPayload(
  format: CredentialFormatSchema,
  payload: Record<string, unknown>,
): { valid: boolean; missingFields: string[] } {
  const missing = format.requiredFields.filter((field) => {
    const value = payload[field];
    if (typeof value === 'string') return value.trim().length === 0;
    return value === null || value === undefined;
  });
  return { valid: missing.length === 0, missingFields: missing };
}
