export interface CredentialWrapper {
  credentialId: string;
  region: string;
  wrapped: {
    original: any;
    regionSpecific: any;
    metadata: Record<string, any>;
  };
}

export function credentialWrapper(credentialId: string, region: string): CredentialWrapper {
  return {
    credentialId,
    region,
    wrapped: {
      original: { id: credentialId, type: 'license' },
      regionSpecific: {
        interpretation: `${region}_interpretation`,
        validity: 'valid',
        requirements: ['met'],
      },
      metadata: {
        wrappedAt: new Date().toISOString(),
        region,
      },
    },
  };
}








