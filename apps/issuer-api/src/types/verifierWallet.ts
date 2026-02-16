export type VitalVC = {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: Record<string, string | number | boolean | null>;
  credentialStatus?: {
    id: string;
    type: 'VitalCredentialStatus';
  };
  organizationId?: string;
  organization_id?: string;
  [key: string]: string | number | boolean | null | string[] | object | undefined;
};

export type SimulatedWallet = {
  id: string;
  organizationId: string;
  storedCredentials: VitalVC[];
};
