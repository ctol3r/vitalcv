/**
 * Wallet Home Types
 * Core types for credential list items and wallet state
 */

export type CredentialStatus = 'active' | 'expiring' | 'expired' | 'revoked';

export type CredentialType = 'license' | 'board' | 'employment' | 'dea_mate' | 'compact' | 'id' | 'cert';

export type FilterType = 'all' | 'active' | 'expiring' | 'revoked';

export interface CredentialListItem {
  id: string;
  icon: string; // Icon name/identifier
  title: string;
  issuer: {
    name: string;
    did?: string;
    logoUrl?: string;
  };
  status: CredentialStatus;
  anchor: {
    confirmed: boolean;
    txHash?: string;
    network?: string;
    timestamp?: string;
  };
  expiry?: {
    date: string;
    daysRemaining: number;
  };
  complianceBadges?: ('DEA' | 'Board' | 'NPDB')[];
  trustScore?: number;
  lastVerified?: string;
  daysSinceVerification?: number;
  complianceStreak?: number; // Days in good standing
  type: CredentialType;
  metadata?: Record<string, unknown>;
}

export interface WalletHomeState {
  type: 'loading' | 'loaded' | 'error';
  credentials?: CredentialListItem[];
  error?: string;
}

export interface WalletCacheEntry {
  credentials: CredentialListItem[];
  timestamp: number;
  version: string;
}








