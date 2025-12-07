/**
 * Credential Chain Service
 * Tasks 201.12, 201.14, 201.15, 201.17, 201.22, 201.24
 *
 * Wraps credential-related extrinsics and queries for the VitalCV Chain
 */

import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { PolkadotService } from './PolkadotService';
import {
  CredentialAnchorInput,
  AnchorResult,
  OnChainCredentialStatus,
  OnChainCredentialRecord
} from './types';
import { buildCredentialHash, isValidHash } from './hashBuilder';
import { normalizeChainError, formatErrorForLog } from './errorNormalizer';

export class CredentialChainService {
  private polkadotService: PolkadotService;
  private keyring: Keyring;
  private signingKey: KeyringPair | null = null;

  constructor(polkadotService: PolkadotService) {
    this.polkadotService = polkadotService;
    this.keyring = new Keyring({ type: 'sr25519' });
    this.initializeSigningKey();
  }

  /**
   * Task 201.33 - Load signing key from environment
   */
  private initializeSigningKey(): void {
    const seed = process.env.SUBSTRATE_SEED || process.env.SUBSTRATE_SUDO_SEED;

    if (seed) {
      try {
        this.signingKey = this.keyring.addFromUri(seed);
        console.log('🔑 Loaded Substrate signing key:', this.signingKey.address);
      } catch (error) {
        console.error('❌ Failed to load signing key:', error);
      }
    } else {
      console.warn('⚠️  No SUBSTRATE_SEED provided - chain operations will be read-only');
    }
  }

  /**
   * Task 201.14 - Issue (anchor) credential on-chain
   */
  async anchorCredential(input: CredentialAnchorInput): Promise<AnchorResult> {
    if (!this.signingKey) {
      return {
        success: false,
        error: 'No signing key available. Set SUBSTRATE_SEED environment variable.',
      };
    }

    try {
      const api = this.polkadotService.getApi();

      // Validate hash
      if (!isValidHash(input.hash)) {
        return {
          success: false,
          error: `Invalid hash format: ${input.hash}`,
        };
      }

      console.log(`⚓ Anchoring credential ${input.credentialId}...`);

      // Call pallet.credentials.issueCredential(id, hash, issuerDid)
      // @ts-ignore - Custom pallet types
      const tx = api.tx.credentials?.issueCredential?.(
        input.credentialId,
        input.hash,
        input.issuerDid
      );

      if (!tx) {
        return {
          success: false,
          error: 'credentials.issueCredential extrinsic not available on this chain',
        };
      }

      // Task 201.15 - Extract txHash, blockHash, and events from result
      const result = await this.signAndSend(tx);

      return result;
    } catch (error) {
      const normalized = normalizeChainError(error, this.polkadotService.getApi());
      console.error('❌ Anchoring failed:', formatErrorForLog(normalized));

      return {
        success: false,
        error: normalized.message,
      };
    }
  }

  /**
   * Task 201.15 - Sign and send extrinsic, extract result
   */
  private async signAndSend(tx: any): Promise<AnchorResult> {
    return new Promise((resolve, reject) => {
      const events: any[] = [];

      tx.signAndSend(this.signingKey, ({ status, dispatchError, events: txEvents, txHash }: any) => {
        // Collect events
        if (txEvents) {
          events.push(...txEvents);
        }

        // Handle errors
        if (dispatchError) {
          const normalized = normalizeChainError(
            dispatchError,
            this.polkadotService.getApi()
          );

          resolve({
            success: false,
            txHash: txHash?.toHex(),
            error: normalized.message,
          });
          return;
        }

        // Task 201.15 - Extract txHash, blockHash when finalized
        if (status.isFinalized) {
          const blockHash = status.asFinalized.toHex();

          resolve({
            success: true,
            txHash: txHash.toHex(),
            blockHash,
            events: events.map(e => ({
              section: e.event.section,
              method: e.event.method,
              data: e.event.data.toJSON(),
            })),
          });
        }
      }).catch((error: any) => {
        reject(error);
      });
    });
  }

  /**
   * Revoke credential on-chain
   */
  async revokeCredential(credentialId: string, reason?: string): Promise<AnchorResult> {
    if (!this.signingKey) {
      return {
        success: false,
        error: 'No signing key available',
      };
    }

    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore
      const tx = api.tx.credentials?.revokeCredential?.(credentialId, reason || '');

      if (!tx) {
        return {
          success: false,
          error: 'credentials.revokeCredential not available',
        };
      }

      return await this.signAndSend(tx);
    } catch (error) {
      const normalized = normalizeChainError(error, this.polkadotService.getApi());

      return {
        success: false,
        error: normalized.message,
      };
    }
  }

  /**
   * Update credential status on-chain
   */
  async updateCredentialStatus(
    credentialId: string,
    status: 'active' | 'revoked' | 'suspended'
  ): Promise<AnchorResult> {
    if (!this.signingKey) {
      return {
        success: false,
        error: 'No signing key available',
      };
    }

    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore
      const tx = api.tx.credentials?.updateStatus?.(credentialId, status);

      if (!tx) {
        return {
          success: false,
          error: 'credentials.updateStatus not available',
        };
      }

      return await this.signAndSend(tx);
    } catch (error) {
      const normalized = normalizeChainError(error, this.polkadotService.getApi());

      return {
        success: false,
        error: normalized.message,
      };
    }
  }

  /**
   * Task 201.22 - Query credential status from chain
   */
  async getCredentialStatus(credentialId: string): Promise<OnChainCredentialStatus | null> {
    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore - Query pallet storage
      const statusData = await api.query.credentials?.credentialStatus?.(credentialId);

      if (!statusData || statusData.isNone) {
        return null;
      }

      const decoded = statusData.toJSON() as any;

      return {
        id: credentialId,
        status: decoded.status?.toLowerCase() || 'active',
        issuedAt: decoded.issuedAt || 0,
        revokedAt: decoded.revokedAt,
        issuer: decoded.issuer,
      };
    } catch (error) {
      console.error('Failed to query credential status:', error);
      return null;
    }
  }

  /**
   * Task 201.24 - Get full on-chain credential record
   */
  async getOnChainRecord(credentialId: string): Promise<OnChainCredentialRecord | null> {
    try {
      const api = this.polkadotService.getApi();

      // @ts-ignore
      const recordData = await api.query.credentials?.credentialRecords?.(credentialId);

      if (!recordData || recordData.isNone) {
        return null;
      }

      const decoded = recordData.toJSON() as any;

      return {
        id: decoded.id,
        hash: decoded.hash,
        issuer: decoded.issuer,
        status: {
          id: credentialId,
          status: decoded.status?.toLowerCase() || 'active',
          issuedAt: decoded.issuedAt || 0,
          revokedAt: decoded.revokedAt,
          issuer: decoded.issuer,
        },
        blockNumber: decoded.blockNumber || 0,
        timestamp: decoded.timestamp || 0,
      };
    } catch (error) {
      console.error('Failed to query on-chain record:', error);
      return null;
    }
  }

  /**
   * Batch anchor multiple credentials
   */
  async batchAnchorCredentials(inputs: CredentialAnchorInput[]): Promise<AnchorResult[]> {
    const results: AnchorResult[] = [];

    for (const input of inputs) {
      const result = await this.anchorCredential(input);
      results.push(result);
    }

    return results;
  }

  /**
   * Get signing account address
   */
  getSignerAddress(): string | null {
    return this.signingKey?.address || null;
  }

  /**
   * Check if service has signing capability
   */
  canSign(): boolean {
    return this.signingKey !== null;
  }
}

