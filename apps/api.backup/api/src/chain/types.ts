/**
 * Substrate Chain Types
 * Task 201.9 & 201.10 - Chain type definitions
 */

export interface ChainMetadata {
  chainName: string;
  genesisHash: string;
  runtimeVersion: {
    specName: string;
    specVersion: number;
    transactionVersion: number;
  };
}

export interface CredentialAnchorInput {
  credentialId: string;
  hash: string;
  issuerDid: string;
  metadata?: Record<string, any>;
}

export interface AnchorResult {
  success: boolean;
  txHash?: string;
  blockHash?: string;
  events?: any[];
  error?: string;
}

export interface OnChainCredentialStatus {
  id: string;
  status: 'active' | 'revoked' | 'suspended';
  issuedAt: number;
  revokedAt?: number;
  issuer: string;
}

export interface OnChainCredentialRecord {
  id: string;
  hash: string;
  issuer: string;
  status: OnChainCredentialStatus;
  blockNumber: number;
  timestamp: number;
}

export interface TrustedIssuer {
  did: string;
  accountId: string;
  capabilities: string[];
  registeredAt: number;
}

export interface ChainHealth {
  connected: boolean;
  peers: number;
  syncing: boolean;
  blockNumber: number;
  timestamp: number;
}

// Custom types for VitalCV pallets
export const VITALCV_TYPES = {
  CredentialId: 'H256',
  CredentialHash: 'H256',
  CredentialStatus: {
    _enum: ['Active', 'Revoked', 'Suspended']
  },
  CredentialRecord: {
    id: 'CredentialId',
    hash: 'CredentialHash',
    issuer: 'AccountId',
    status: 'CredentialStatus',
    issuedAt: 'u64',
    revokedAt: 'Option<u64>'
  },
  TrustedIssuerRecord: {
    did: 'Vec<u8>',
    accountId: 'AccountId',
    capabilities: 'Vec<Vec<u8>>',
    registeredAt: 'u64'
  }
};

