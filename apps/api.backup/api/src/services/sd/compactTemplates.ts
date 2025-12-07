
/**
 * Compact-specific SD-JWT Templates
 *
 * Defines disclosure patterns for interstate compacts.
 */

export interface SdTemplate {
  id: string;
  description: string;
  claimsToReveal: string[];
}

export const CompactSdTemplates = {
  /**
   * Reveal only which compact the license belongs to (e.g., "NLC", "IMLC").
   * Hides state, license number, and personal details.
   */
  revealCompactTypeOnly: {
    id: 'compact-type-only',
    description: 'Reveal only the Compact Type',
    claimsToReveal: ['compactType']
  },

  /**
   * Reveal the compact type and the home state.
   * Useful for basic verification where specific license details aren't needed.
   */
  revealMemberStateOnly: {
    id: 'member-state-only',
    description: 'Reveal Compact Type and Home State',
    claimsToReveal: ['compactType', 'memberState']
  },

  /**
   * Hybrid Proof:
   * - Reveals Compact Type (SD)
   * - Includes ZK Proof of Eligibility (verifies state membership and active status without revealing them)
   *
   * The 'zkProof' claim should be revealed to allow verification.
   */
  revealEligibilityProof: {
    id: 'eligibility-proof',
    description: 'Zero-Knowledge Proof of Eligibility (Hybrid SD-JWT + ZK)',
    claimsToReveal: ['compactType', 'zkProof']
  }
};














