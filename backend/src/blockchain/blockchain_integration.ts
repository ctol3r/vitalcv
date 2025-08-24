<<<<<<< HEAD
// blockchain_integration.ts - placeholder for overall blockchain integration

import { ChainlinkAdapter } from './oracles/chainlink_adapter';

export class BlockchainIntegration {
  private chainlink = new ChainlinkAdapter();

  async getLicenseStatus(licenseId: string) {
    return this.chainlink.fetchLicenseStatus(licenseId);
  }

  async getRiskSignals(address: string) {
    return this.chainlink.fetchRiskSignals(address);
  }
=======
import { queryRiskScore } from './chainlink_oracle';

export type CredentialStatus = 'valid' | 'revoked';

/**
 * Example blockchain integration utilities.
 * The real implementation would interact with smart contracts and oracles.
 */

export async function getOnChainRisk(userId: string): Promise<number> {
  // Delegate to the Chainlink Functions oracle integration.
  return queryRiskScore(userId);
}

/**
 * Placeholder blockchain check implementation.
 * In a real system this would query the on-chain credential registry.
 */
export async function checkCredentialStatus(
  credentialId: string
): Promise<CredentialStatus> {
  // TODO: Integrate with actual Polkadot or other blockchain service.
  // For now always return 'valid'.
  return 'valid';
>>>>>>> origin/main
}
