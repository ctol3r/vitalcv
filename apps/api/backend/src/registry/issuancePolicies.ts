export interface IssuancePolicy {
  sourceOfTruth: string;
  verificationMethod: string;
  freshnessIntervalDays: number;
  requiredFields: string[];
  revocationMethod: string;
}

export const issuancePolicies: Record<string, IssuancePolicy> = {
  License: {
    sourceOfTruth: 'State medical board registry (primary source)',
    verificationMethod: 'API + periodic attestation fallback',
    freshnessIntervalDays: 365,
    requiredFields: ['NPI', 'licenseNumber', 'state', 'specialty'],
    revocationMethod: 'State board disciplinary feed + manual revocation audit',
  },
  DEA: {
    sourceOfTruth: 'DEA registration system',
    verificationMethod: 'API + issuer attestation with audit trail',
    freshnessIntervalDays: 180,
    requiredFields: ['NPI', 'deaNumber', 'state'],
    revocationMethod: 'DEA revocation notice + compliance admin override',
  },
  BoardCertification: {
    sourceOfTruth: 'Specialty board certification registry',
    verificationMethod: 'API + issuer attestation (World ID optional)',
    freshnessIntervalDays: 365,
    requiredFields: ['NPI', 'specialty', 'boardName', 'certificateId'],
    revocationMethod: 'Board disciplinary bulletin + manual revocation audit',
  },
};
