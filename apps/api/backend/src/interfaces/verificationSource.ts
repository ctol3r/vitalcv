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
  /**
   * Decision-grade adapters return real primary-source outcomes and may be
   * persisted and presented as verification results. Fabricating or stand-in
   * adapters (deterministic stubs, fixtures) MUST declare false — production
   * refuses to serve them (sourceRegistry throws SourceAccessRequiredError).
   */
  readonly decisionGrade: boolean;
  verify(npi: string): Promise<VerificationResult>;
}
