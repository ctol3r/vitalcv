/**
 * types.ts — W3C VC 2.0 Bitstring Status List data-model types.
 * https://www.w3.org/TR/vc-bitstring-status-list/
 */

/** VC 2.0 base context — REQUIRED on every BitstringStatusListCredential. */
export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

export type StatusPurpose = 'revocation' | 'suspension';

/**
 * The `credentialStatus` entry embedded in an issued VC (spec §4.2).
 */
export interface BitstringStatusListEntry {
  id?: string;
  type: 'BitstringStatusListEntry';
  statusPurpose: StatusPurpose;
  /** Spec allows a string-encoded integer; producers here emit numbers. */
  statusListIndex: number | string;
  /** URL of the BitstringStatusListCredential. */
  statusListCredential: string;
}

/**
 * The status list credential itself (spec §4.1).
 */
export interface BitstringStatusListCredential {
  '@context': string[];
  id: string;
  type: string[]; // ['VerifiableCredential', 'BitstringStatusListCredential']
  issuer: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject: {
    id: string;
    type: 'BitstringStatusList';
    statusPurpose: StatusPurpose;
    encodedList: string;
  };
}
