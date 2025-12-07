import { NextResponse } from 'next/server';

/**
 * GET /api/clinician/compacts
 *
 * Returns compact status information for the authenticated clinician
 *
 * Response format:
 * {
 *   npi: string;
 *   name: string;
 *   compacts: Array<{
 *     compact: 'IMLC' | 'PSYPACT' | 'COUNSELING';
 *     status: 'ACTIVE' | 'ELIGIBLE' | 'PENDING' | 'NOT_ELIGIBLE';
 *     eligibleStates: string[];
 *     homeState?: string;
 *     dateEnrolled?: string;
 *     expirationDate?: string;
 *     notes?: string;
 *   }>;
 *   allLicensedStates: string[];
 * }
 */
export async function GET() {
  try {
    // TODO: Replace with actual authentication and database query
    // For now, return mock data for development

    const mockData = {
      npi: '1234567890',
      name: 'Dr. Jane Smith',
      compacts: [
        {
          compact: 'IMLC',
          status: 'ACTIVE',
          eligibleStates: ['AL', 'AZ', 'CO', 'GA', 'ID', 'IL', 'IA', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH', 'PA', 'SD', 'TN', 'UT', 'WA', 'WV', 'WI', 'WY'],
          homeState: 'CO',
          dateEnrolled: '2024-03-15',
          expirationDate: '2025-03-15',
        },
        {
          compact: 'PSYPACT',
          status: 'ELIGIBLE',
          eligibleStates: ['AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'GA', 'ID', 'IL', 'IN', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MO', 'NE', 'NV', 'NH', 'NJ', 'NC', 'OH', 'OK', 'PA', 'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WI'],
          homeState: 'CO',
        },
        {
          compact: 'COUNSELING',
          status: 'NOT_ELIGIBLE',
          eligibleStates: [],
          notes: 'Requires professional counseling license',
        },
      ],
      allLicensedStates: ['CO', 'CA', 'NY'],
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error fetching compact data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compact data' },
      { status: 500 }
    );
  }
}

