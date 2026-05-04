export type IdentityVendorId = 'mock';

export interface MockIdentityProofingVendor {
  vendorId: IdentityVendorId;
  displayName: string;
  isLive: false;
  invitationOnly: false;
  supportsGovernmentId: false;
  supportsLiveness: false;
  supportsIal2Claim: false;
  supportsIal3Claim: false;
  disclaimer: string;
}

export const MOCK_IDENTITY_VENDOR: MockIdentityProofingVendor = {
  vendorId: 'mock',
  displayName: 'Mock identity proofing',
  isLive: false,
  invitationOnly: false,
  supportsGovernmentId: false,
  supportsLiveness: false,
  supportsIal2Claim: false,
  supportsIal3Claim: false,
  disclaimer:
    'Mock identity proofing is a foundation fixture only. It does not verify identity, bind a person to an NPI, or create IAL evidence.',
};

export function getConfiguredIdentityVendorId(
  value = process.env.NEXT_PUBLIC_IDENTITY_VENDOR,
): IdentityVendorId {
  return value === 'mock' || !value ? 'mock' : 'mock';
}

export function getMockIdentityProofingVendor(): MockIdentityProofingVendor {
  return { ...MOCK_IDENTITY_VENDOR };
}
