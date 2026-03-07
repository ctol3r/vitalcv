export interface VerifierFixture {
  verifierDid: string;
  apiKey: string;
}

export function createVerifierFixture(suffix = 'sdk'): VerifierFixture {
  return {
    verifierDid: `did:vitalcv:verifier:wave124-${suffix}`,
    apiKey: `verifier-key-${suffix}`,
  };
}
