/**
 * Wallet API Client
 * Handles credential fetching, verification, and sharing
 */

import { getJSON, postJSON } from '@/components/api/http';

export interface Credential {
  id: string;
  type: string;
  issuer: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    claims: Record<string, any>;
  };
  status: 'valid' | 'expiring' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt?: string;
  proofLink?: string;
  schemaId?: string;
  metadata?: {
    issuerLogo?: string;
    description?: string;
  };
  riskScore?: number;
}

export interface CredentialDetail extends Credential {
  auditTrail: AuditEvent[];
  proofData?: {
    chainId: string;
    blockNumber: number;
    transactionHash: string;
    timestamp: string;
  };
}

export interface AuditEvent {
  id: string;
  type: 'issued' | 'verified' | 'revoked' | 'expired';
  timestamp: string;
  actor?: string;
  auditRef: string;
  details?: string;
}

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  verifiableCredential: any[];
  proof?: any;
  selectedFields?: string[];
}

export async function getCredentials(): Promise<Credential[]> {
  try {
    return await getJSON<Credential[]>('/api/wallet/credentials');
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    // Return mock data for development
    return getMockCredentials();
  }
}

export async function getCredentialDetail(id: string): Promise<CredentialDetail> {
  try {
    return await getJSON<CredentialDetail>(`/api/wallet/credentials/${id}`);
  } catch (error) {
    console.error(`Failed to fetch credential ${id}:`, error);
    return getMockCredentialDetail(id);
  }
}

export async function createPresentation(
  credentialIds: string[],
  selectedFields?: Record<string, string[]>,
): Promise<VerifiablePresentation> {
  return await postJSON<VerifiablePresentation>('/api/wallet/presentation', {
    credentialIds,
    selectedFields,
  });
}

export async function revokeCredential(id: string, reason?: string): Promise<void> {
  await postJSON(`/api/wallet/credentials/${id}/revoke`, { reason });
}

// Mock data for development
function getMockCredentials(): Credential[] {
  return [
    {
      id: 'cred-001',
      type: 'MedicalLicense',
      issuer: {
        id: 'did:example:ca-medical-board',
        name: 'California Medical Board',
      },
      subject: {
        id: 'did:example:holder-123',
        claims: {
          licenseNumber: 'CA-12345',
          specialty: 'Internal Medicine',
          npi: '1234567890',
        },
      },
      status: 'valid',
      issuedAt: '2023-01-15T10:00:00Z',
      expiresAt: '2025-01-15T10:00:00Z',
      proofLink: 'https://explorer.example.com/tx/0x123',
    },
    {
      id: 'cred-002',
      type: 'BoardCertification',
      issuer: {
        id: 'did:example:abim',
        name: 'American Board of Internal Medicine',
      },
      subject: {
        id: 'did:example:holder-123',
        claims: {
          certificationNumber: 'ABIM-67890',
          certificationDate: '2022-06-01',
        },
      },
      status: 'expiring',
      issuedAt: '2022-06-01T10:00:00Z',
      expiresAt: '2024-12-31T10:00:00Z',
    },
  ];
}

function getMockCredentialDetail(id: string): CredentialDetail {
  const mockCred = getMockCredentials().find((c) => c.id === id) || getMockCredentials()[0];

  return {
    ...mockCred,
    auditTrail: [
      {
        id: 'audit-001',
        type: 'issued',
        timestamp: mockCred.issuedAt,
        actor: mockCred.issuer.name,
        auditRef: 'AUDIT-001',
        details: `Credential issued by ${mockCred.issuer.name}`,
      },
      {
        id: 'audit-002',
        type: 'verified',
        timestamp: '2023-06-10T14:30:00Z',
        actor: 'UCSF Medical Center',
        auditRef: 'AUDIT-045',
        details: 'Verified by UCSF Medical Center',
      },
    ],
    proofData: {
      chainId: 'substrate-mainnet',
      blockNumber: 12345678,
      transactionHash: '0x1234567890abcdef',
      timestamp: mockCred.issuedAt,
    },
  };
}

// Helper to calculate credential status
export function calculateCredentialStatus(
  credential: Credential,
): 'valid' | 'expiring' | 'revoked' | 'expired' {
  if (credential.status === 'revoked') return 'revoked';

  if (credential.expiresAt) {
    const expiryDate = new Date(credential.expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (expiryDate < now) return 'expired';
    if (daysUntilExpiry <= 30) return 'expiring';
  }

  return 'valid';
}
