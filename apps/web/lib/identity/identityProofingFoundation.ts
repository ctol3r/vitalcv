import {
  getConfiguredIdentityVendorId,
  getMockIdentityProofingVendor,
  type IdentityVendorId,
  type MockIdentityProofingVendor,
} from './mockIdentityProofing';

export type IdentityVendorCandidateId =
  | 'persona'
  | 'stripe_identity'
  | 'onfido'
  | 'veriff';

export interface IdentityVendorCandidate {
  vendorId: IdentityVendorCandidateId;
  displayName: string;
  recommendedUse: string;
  procurementRequired: true;
  selected: false;
}

export interface IdentityProofingFoundation {
  isLive: false;
  configuredVendorId: IdentityVendorId;
  activeVendor: MockIdentityProofingVendor;
  vendorSelected: false;
  procurementRequired: true;
  highestIalClaimed: 'none';
  boardCeilingPercent: 30;
  candidates: IdentityVendorCandidate[];
  disclaimers: string[];
}

const CANDIDATES: IdentityVendorCandidate[] = [
  {
    vendorId: 'persona',
    displayName: 'Persona',
    recommendedUse:
      'Recommended first procurement target for configurable identity workflows and audit-oriented review.',
    procurementRequired: true,
    selected: false,
  },
  {
    vendorId: 'stripe_identity',
    displayName: 'Stripe Identity',
    recommendedUse:
      'Fallback candidate if VitalCV chooses a narrower developer-friendly identity proofing integration.',
    procurementRequired: true,
    selected: false,
  },
  {
    vendorId: 'onfido',
    displayName: 'Onfido',
    recommendedUse:
      'Enterprise candidate pending retention, consent, and audit-safe receipt review.',
    procurementRequired: true,
    selected: false,
  },
  {
    vendorId: 'veriff',
    displayName: 'Veriff',
    recommendedUse:
      'Risk-focused candidate pending audit artifact and operational transparency review.',
    procurementRequired: true,
    selected: false,
  },
];

export function buildIdentityProofingFoundation(
  vendorEnv = process.env.NEXT_PUBLIC_IDENTITY_VENDOR,
): IdentityProofingFoundation {
  const configuredVendorId = getConfiguredIdentityVendorId(vendorEnv);
  const activeVendor = getMockIdentityProofingVendor();

  return {
    isLive: false,
    configuredVendorId,
    activeVendor,
    vendorSelected: false,
    procurementRequired: true,
    highestIalClaimed: 'none',
    boardCeilingPercent: 30,
    candidates: CANDIDATES.map((candidate) => ({ ...candidate })),
    disclaimers: [
      'Identity proofing is not live. NEXT_PUBLIC_IDENTITY_VENDOR=mock is a foundation fixture only.',
      'No vendor has been selected or procured.',
      'No IAL2 or IAL3 assurance is claimed by this foundation.',
      'These rows stay at approximately 30% until vendor procurement closes. This is a procurement decision, not engineering.',
    ],
  };
}
