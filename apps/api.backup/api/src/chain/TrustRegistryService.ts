/**
 * Trust Registry Service
 * Tasks 201.35, 201.36, 201.37
 *
 * Manages trusted issuers and capabilities on-chain
 */

import { PolkadotService } from './PolkadotService';
import { TrustedIssuer } from './types';

export class TrustRegistryService {
  private polkadotService: PolkadotService;

  constructor(polkadotService: PolkadotService) {
    this.polkadotService = polkadotService;
  }

  /**
   * Task 201.36 - Query allowed issuers from chain
   */
  async getAllowedIssuers(): Promise<TrustedIssuer[]> {
    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore - Query trust registry pallet
      const issuersData = await api.query.trustRegistry?.trustedIssuers?.entries?.();

      if (!issuersData) {
        console.warn('Trust registry not available on this chain');
        return [];
      }

      const issuers: TrustedIssuer[] = [];

      for (const [key, value] of issuersData) {
        const decoded = value.toJSON() as any;

        issuers.push({
          did: decoded.did,
          accountId: decoded.accountId,
          capabilities: decoded.capabilities || [],
          registeredAt: decoded.registeredAt || 0,
        });
      }

      return issuers;
    } catch (error) {
      console.error('Failed to query allowed issuers:', error);
      return [];
    }
  }

  /**
   * Task 201.35 - Validate issuer DID is permitted
   */
  async isIssuerPermitted(issuerDid: string, capability?: string): Promise<boolean> {
    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore
      const issuerData = await api.query.trustRegistry?.trustedIssuers?.(issuerDid);

      if (!issuerData || issuerData.isNone) {
        console.log(`❌ Issuer ${issuerDid} not found in trust registry`);
        return false;
      }

      const decoded = issuerData.toJSON() as any;

      // If specific capability required, check for it
      if (capability) {
        const capabilities = decoded.capabilities || [];
        const hasCapability = capabilities.includes(capability);

        if (!hasCapability) {
          console.log(`❌ Issuer ${issuerDid} lacks capability: ${capability}`);
          return false;
        }
      }

      console.log(`✅ Issuer ${issuerDid} is permitted`);
      return true;
    } catch (error) {
      console.error('Failed to check issuer permissions:', error);
      return false;
    }
  }

  /**
   * Get issuer details
   */
  async getIssuerDetails(issuerDid: string): Promise<TrustedIssuer | null> {
    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore
      const issuerData = await api.query.trustRegistry?.trustedIssuers?.(issuerDid);

      if (!issuerData || issuerData.isNone) {
        return null;
      }

      const decoded = issuerData.toJSON() as any;

      return {
        did: issuerDid,
        accountId: decoded.accountId,
        capabilities: decoded.capabilities || [],
        registeredAt: decoded.registeredAt || 0,
      };
    } catch (error) {
      console.error('Failed to get issuer details:', error);
      return null;
    }
  }

  /**
   * Check if issuer has specific capability
   */
  async hasCapability(issuerDid: string, capability: string): Promise<boolean> {
    const issuer = await this.getIssuerDetails(issuerDid);
    return issuer?.capabilities.includes(capability) || false;
  }

  /**
   * Task 201.34 - Map DID to on-chain account ID
   */
  async getAccountIdForDid(issuerDid: string): Promise<string | null> {
    const issuer = await this.getIssuerDetails(issuerDid);
    return issuer?.accountId || null;
  }

  /**
   * Get all capabilities for an issuer
   */
  async getIssuerCapabilities(issuerDid: string): Promise<string[]> {
    const issuer = await this.getIssuerDetails(issuerDid);
    return issuer?.capabilities || [];
  }
}

