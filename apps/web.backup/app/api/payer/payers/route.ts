import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payer/payers - Get list of available payers
 */
export async function GET(request: NextRequest) {
  // Mock data - replace with actual database query
  const mockPayers = [
    {
      id: 'payer_001',
      name: 'Blue Cross Blue Shield',
      type: 'commercial',
      npiOrg: '1234567890',
      logoUrl: null,
      website: 'https://www.bcbs.com',
      contactEmail: 'provider@bcbs.com',
      contactPhone: '1-800-555-1234'
    },
    {
      id: 'payer_002',
      name: 'UnitedHealthcare',
      type: 'commercial',
      npiOrg: '9876543210',
      logoUrl: null,
      website: 'https://www.uhc.com',
      contactEmail: 'providers@uhc.com',
      contactPhone: '1-800-555-5678'
    },
    {
      id: 'payer_003',
      name: 'Aetna',
      type: 'commercial',
      npiOrg: '5555555555',
      logoUrl: null,
      website: 'https://www.aetna.com',
      contactEmail: 'provider.relations@aetna.com',
      contactPhone: '1-800-555-9999'
    },
    {
      id: 'payer_004',
      name: 'Medicare',
      type: 'medicare',
      logoUrl: null,
      website: 'https://www.medicare.gov',
      contactEmail: 'provider@cms.gov',
      contactPhone: '1-800-633-4227'
    },
    {
      id: 'payer_005',
      name: 'Medicaid (State Program)',
      type: 'medicaid',
      logoUrl: null,
      website: 'https://www.medicaid.gov',
      contactEmail: 'provider@medicaid.gov',
      contactPhone: '1-800-555-1111'
    }
  ];

  return NextResponse.json(mockPayers);
}

