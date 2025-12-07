/**
 * Credential Repository
 * Fetches and maps credentials from backend
 */

import type { CredentialListItem } from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:4000';

interface BackendCredential {
  id: string;
  credentialId?: string;
  type: string;
  credentialType?: string;
  issuer: {
    id?: string;
    did?: string;
    name: string;
    logoUrl?: string;
  };
  status: 'active' | 'expired' | 'revoked' | 'expiring';
  issuedAt?: string;
  expiresAt?: string;
  anchor?: {
    confirmed: boolean;
    txHash?: string;
    network?: string;
    timestamp?: string;
  };
  trustScore?: number;
  lastVerified?: string;
  complianceBadges?: string[];
  metadata?: Record<string, unknown>;
  summary?: Record<string, unknown>;
}

export class CredentialRepository {
  /**
   * List all credentials for the current user
   */
  static async listAll(): Promise<CredentialListItem[]> {
    try {
      // Try wallet credentials API first
      const response = await fetch(`${API_BASE}/api/wallet/credentials`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Fallback to index API if wallet API fails
        return this.listAllFromIndex();
      }

      const data = await response.json();
      const credentials = Array.isArray(data) ? data : data.credentials || [];

      return credentials.map((cred: BackendCredential) => this.mapToListItem(cred));
    } catch (error) {
      console.warn('[CredentialRepository] Wallet API failed, trying index:', error);
      return this.listAllFromIndex();
    }
  }

  /**
   * Fallback: fetch from index API
   */
  private static async listAllFromIndex(): Promise<CredentialListItem[]> {
    const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

    try {
      const response = await fetch(
        `${API_BASE}/api/index/${encodeURIComponent(CLINICIAN_ID)}?diff=true`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`Index API failed with ${response.status}`);
      }

      const data = await response.json();
      const allRows: any[] = data.rows || [];

      return allRows.map((row) => this.mapIndexRowToListItem(row));
    } catch (error) {
      console.error('[CredentialRepository] Failed to fetch credentials:', error);
      return [];
    }
  }

  /**
   * Map backend credential to list item
   */
  private static mapToListItem(cred: BackendCredential): CredentialListItem {
    const status = this.mapStatus(cred.status);
    const type = this.mapCredentialType(cred.type || cred.credentialType || 'cert');

    const expiry = cred.expiresAt
      ? {
          date: cred.expiresAt,
          daysRemaining: this.calculateDaysRemaining(cred.expiresAt),
        }
      : undefined;

    const daysSinceVerification = cred.lastVerified
      ? this.calculateDaysSince(cred.lastVerified)
      : undefined;

    return {
      id: cred.id || cred.credentialId || `cred_${Date.now()}`,
      icon: this.getIconForType(type),
      title: this.getTitleForCredential(cred),
      issuer: {
        name: cred.issuer?.name || 'Unknown Issuer',
        did: cred.issuer?.did || cred.issuer?.id,
        logoUrl: cred.issuer?.logoUrl,
      },
      status,
      anchor: cred.anchor || { confirmed: false },
      expiry,
      complianceBadges: this.mapComplianceBadges(cred.complianceBadges),
      trustScore: cred.trustScore,
      lastVerified: cred.lastVerified,
      daysSinceVerification,
      type,
      metadata: cred.metadata || cred.summary,
    };
  }

  /**
   * Map index row to list item
   */
  private static mapIndexRowToListItem(row: any): CredentialListItem {
    const status = this.mapStatus(row.status);
    const type = this.mapCredentialType(row.credentialType || 'cert');

    const expiresAt = row.summary?.expiresAt;
    const expiry = expiresAt
      ? {
          date: expiresAt,
          daysRemaining: this.calculateDaysRemaining(expiresAt),
        }
      : undefined;

    return {
      id: row.credentialId,
      icon: this.getIconForType(type),
      title: String(row.summary?.label || row.credentialId),
      issuer: {
        name: row.issuerDid || 'Unknown Issuer',
        did: row.issuerDid,
      },
      status,
      anchor: { confirmed: false },
      expiry,
      type,
      metadata: row.summary,
    };
  }

  private static mapStatus(status: string): CredentialListItem['status'] {
    if (status === 'active') return 'active';
    if (status === 'expired') return 'expired';
    if (status === 'revoked') return 'revoked';
    if (status === 'expiring') return 'expiring';
    return 'active';
  }

  private static mapCredentialType(type: string): CredentialListItem['type'] {
    const normalized = type.toLowerCase();
    if (normalized.includes('license')) return 'license';
    if (normalized.includes('board')) return 'board';
    if (normalized.includes('employment')) return 'employment';
    if (normalized.includes('dea') || normalized.includes('mate')) return 'dea_mate';
    if (normalized.includes('compact')) return 'compact';
    if (normalized.includes('id')) return 'id';
    return 'cert';
  }

  private static getIconForType(type: CredentialListItem['type']): string {
    const iconMap: Record<CredentialListItem['type'], string> = {
      license: 'id-card',
      board: 'award',
      employment: 'briefcase',
      dea_mate: 'shield',
      compact: 'globe',
      id: 'fingerprint',
      cert: 'certificate',
    };
    return iconMap[type] || 'certificate';
  }

  private static getTitleForCredential(cred: BackendCredential): string {
    if (cred.metadata?.label) return String(cred.metadata.label);
    if (cred.metadata?.description) return String(cred.metadata.description);
    if (cred.type) return cred.type;
    return 'Credential';
  }

  private static calculateDaysRemaining(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private static calculateDaysSince(date: string): number {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private static mapComplianceBadges(
    badges?: string[]
  ): CredentialListItem['complianceBadges'] {
    if (!badges) return undefined;
    return badges.filter((b): b is 'DEA' | 'Board' | 'NPDB' =>
      ['DEA', 'Board', 'NPDB'].includes(b)
    ) as ('DEA' | 'Board' | 'NPDB')[];
  }
}








