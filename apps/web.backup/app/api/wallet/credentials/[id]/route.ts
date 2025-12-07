/**
 * Credential Detail API
 * GET - Get detailed information about a specific credential
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // TODO: Implement actual credential fetching from backend/database
    // For now, return mock data
    const credential = {
      id,
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
          firstName: 'John',
          lastName: 'Doe',
          issueDate: '2023-01-15',
          status: 'Active',
        },
      },
      status: 'valid',
      issuedAt: '2023-01-15T10:00:00Z',
      expiresAt: '2025-01-15T10:00:00Z',
      proofLink: 'https://explorer.polkadot.io/tx/0x123',
      schemaId: 'https://schema.vitalcv.io/medical-license/v1',
      metadata: {
        description: 'Medical license credential for California',
      },
      auditTrail: [
        {
          id: 'audit-001',
          type: 'issued',
          timestamp: '2023-01-15T10:00:00Z',
          actor: 'California Medical Board',
          auditRef: 'AUDIT-001',
          details: 'Credential issued by California Medical Board',
        },
        {
          id: 'audit-002',
          type: 'verified',
          timestamp: '2023-06-10T14:30:00Z',
          actor: 'UCSF Medical Center',
          auditRef: 'AUDIT-045',
          details: 'Verified by UCSF Medical Center for employment',
        },
        {
          id: 'audit-003',
          type: 'verified',
          timestamp: '2023-12-05T09:15:00Z',
          actor: 'Kaiser Permanente',
          auditRef: 'AUDIT-102',
          details: 'Verified by Kaiser Permanente for credentialing',
        },
      ],
      proofData: {
        chainId: 'substrate-mainnet',
        blockNumber: 12345678,
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        timestamp: '2023-01-15T10:00:00Z',
      },
    };

    return NextResponse.json(credential);
  } catch (error) {
    console.error('Error fetching credential:', error);
    return NextResponse.json({ error: 'Failed to fetch credential' }, { status: 500 });
  }
}
