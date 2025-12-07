/**
 * Hospital Credentialing Dashboard Types
 * Chain-backed, compliance-ready credential management
 */

export type DashboardState = 'loading' | 'ready' | 'error';

export type DashboardTab = 'overview' | 'providers' | 'queue' | 'compliance' | 'audit';

export interface VerifierDashboardOverview {
  totalProviders: number;
  activeCredentials: number;
  expiringSoon: number; // < 45 days
  pendingVerification: number;
  complianceAlerts: number;
  chainAnchors: {
    total: number;
    stale: number; // > 7 days old
    valid: number;
  };
  recentActivity: DashboardActivity[];
}

export interface DashboardActivity {
  id: string;
  type: 'verification' | 'expiration' | 'alert' | 'chain_update';
  providerId: string;
  providerName: string;
  message: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProviderListItem {
  id: string;
  clinicianId: string;
  name: string;
  specialty: string;
  trustScore: number; // 0-100
  compliance: {
    dea: ComplianceStatus;
    license: ComplianceStatus;
    sanctions: ComplianceStatus;
  };
  expiringItemsCount: number;
  chainStale: boolean; // Chain anchor > 7 days old
  lastVerified?: string;
}

export type ComplianceStatus = 'valid' | 'expiring' | 'expired' | 'missing' | 'flagged';

export interface CredentialDetail {
  id: string;
  type: string; // 'DEA', 'License', 'Board Certification', etc.
  expiration: string | null;
  anchorStatus: AnchorStatus;
  issuerTrust: number; // 0-100
  complianceSummary: ComplianceStatus;
  chainHash?: string;
  blockNumber?: number;
  verifiedAt?: string;
}

export interface AnchorStatus {
  anchored: boolean;
  txHash?: string;
  blockNumber?: number;
  timestamp?: string;
  stale: boolean; // > 7 days old
}

export interface VerificationQueueItem {
  id: string;
  providerId: string;
  providerName: string;
  credentialId: string;
  credentialType: string;
  status: 'pending' | 'expiring' | 'missing_evidence' | 'compliance_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  expirationDate?: string;
  daysUntilExpiration?: number;
  specialty: string;
  trustRisk: number; // 0-100
  missingEvidence?: string[];
  lastVerified?: string;
  chainHash?: string;
}

export interface ComplianceAlert {
  id: string;
  type: 'expiring_license' | 'expiring_dea' | 'suspicious_change' | 'stale_anchor' | 'evidence_mismatch';
  providerId: string;
  providerName: string;
  credentialId?: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ChainAuditEvent {
  id: string;
  blockNumber: number;
  txHash: string;
  anchorId: string;
  eventType: 'anchor' | 'update' | 'discrepancy' | 'reverify';
  providerId?: string;
  credentialId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface NCQAVerificationMatrix {
  providerId: string;
  providerName: string;
  credentials: Array<{
    type: string;
    sourceDocument: string;
    verificationTimestamp: string;
    verifiedBy: string;
    chainHash: string;
    status: 'verified' | 'pending' | 'expired';
  }>;
  lastUpdated: string;
}

export interface PSVEvidencePack {
  providerId: string;
  credentials: Array<{
    id: string;
    type: string;
    evidence: Array<{
      type: 'document' | 'chain_anchor' | 'issuer_attestation';
      url?: string;
      hash?: string;
      timestamp: string;
    }>;
  }>;
}

