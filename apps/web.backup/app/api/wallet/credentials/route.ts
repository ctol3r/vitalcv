/**
 * Wallet Credentials API
 * GET - List all credentials for the current user
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // TODO: Implement actual credential fetching from backend/database
    // For now, return mock data
    const credentials = [
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
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        status: 'valid',
        issuedAt: '2023-01-15T10:00:00Z',
        expiresAt: '2025-01-15T10:00:00Z',
        proofLink: 'https://explorer.polkadot.io/tx/0x123',
        metadata: {
          description: 'Medical license credential',
        },
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
            specialty: 'Internal Medicine',
          },
        },
        status: 'expiring',
        issuedAt: '2022-06-01T10:00:00Z',
        expiresAt: '2024-12-31T10:00:00Z',
      },
    ];

    return NextResponse.json(credentials);
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}
