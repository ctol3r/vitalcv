/**
 * External verification source adapter interface.
 *
 * Every verification source (Nursys, NPDB, state boards, etc.) implements
 * this contract. Allows deterministic stub adapters during pilots and
 * seamless drop-in of live integrations without architecture changes.
 */

export interface VerificationResult {
  licenseStatus: string;
  jurisdiction: string;
  lastUpdated: Date;
  expirationDate?: Date;
  sourceUrl: string;
  rawPayload: unknown;
}

export interface VerificationSource {
  readonly name: string;
  verify(npi: string): Promise<VerificationResult>;
}
