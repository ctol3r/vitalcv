/**
 * ChainService
 * Handles blockchain anchor status and verification
 */

import { getJSON } from '@/components/api/http';

export interface AnchorStatus {
  credentialId: string;
  anchored: boolean;
  blockNumber?: number;
  blockHash?: string;
  transactionHash?: string;
  timestamp?: string;
  network?: string;
  explorerUrl?: string;
  verified: boolean;
  mismatch?: boolean;
  cachedProof?: {
    proof: string;
    cachedAt: string;
  };
}

export interface ChainEvent {
  id: string;
  type: 'anchor' | 're-anchor' | 'revoke' | 'verify';
  timestamp: string;
  blockNumber?: number;
  transactionHash?: string;
  actor?: string;
  details?: string;
}

export class ChainService {
  async getAnchorStatus(credentialId: string): Promise<AnchorStatus> {
    try {
      const data = await getJSON<AnchorStatus>(`/api/chain/credentials/${credentialId}/anchor`);
      return data;
    } catch (error) {
      console.error(`[ChainService] Failed to fetch anchor status for ${credentialId}:`, error);
      // Return mock data for development
      return this.getMockAnchorStatus(credentialId);
    }
  }

  async getChainTimeline(credentialId: string): Promise<ChainEvent[]> {
    try {
      const data = await getJSON<ChainEvent[]>(`/api/chain/credentials/${credentialId}/timeline`);
      return data;
    } catch (error) {
      console.error(`[ChainService] Failed to fetch chain timeline for ${credentialId}:`, error);
      return this.getMockTimeline(credentialId);
    }
  }

  getExplorerUrl(transactionHash: string, network: string = 'substrate-mainnet'): string {
    // Map network to explorer URL
    const explorers: Record<string, string> = {
      'substrate-mainnet': 'https://polkadot.js.org/apps/#/explorer/query',
      'substrate-testnet': 'https://polkadot.js.org/apps/#/explorer/query',
      'ethereum': 'https://etherscan.io/tx',
      'polygon': 'https://polygonscan.com/tx',
    };

    const baseUrl = explorers[network] || explorers['substrate-mainnet'];
    return `${baseUrl}/${transactionHash}`;
  }

  private getMockAnchorStatus(credentialId: string): AnchorStatus {
    return {
      credentialId,
      anchored: true,
      blockNumber: 12345678,
      blockHash: '0xabcdef123456...',
      transactionHash: '0x1234567890abcdef',
      timestamp: new Date().toISOString(),
      network: 'substrate-mainnet',
      explorerUrl: this.getExplorerUrl('0x1234567890abcdef', 'substrate-mainnet'),
      verified: true,
      mismatch: false,
      cachedProof: {
        proof: JSON.stringify({ blockNumber: 12345678, hash: '0xabcdef123456...' }),
        cachedAt: new Date().toISOString(),
      },
    };
  }

  private getMockTimeline(credentialId: string): ChainEvent[] {
    return [
      {
        id: `event-${credentialId}-1`,
        type: 'anchor',
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        blockNumber: 12345678,
        transactionHash: '0x1234567890abcdef',
        actor: 'VitalCV Trust Ledger',
        details: 'Initial anchor to blockchain',
      },
      {
        id: `event-${credentialId}-2`,
        type: 'verify',
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        actor: 'UCSF Medical Center',
        details: 'Credential verified by verifier',
      },
      {
        id: `event-${credentialId}-3`,
        type: 're-anchor',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        blockNumber: 12345679,
        transactionHash: '0xabcdef1234567890',
        actor: 'VitalCV Trust Ledger',
        details: 'Re-anchored after credential update',
      },
    ];
  }
}

export const chainService = new ChainService();

