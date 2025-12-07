import { NextResponse } from 'next/server';

/**
 * GET /api/org/compacts/clinicians-by-state
 *
 * Returns the count of compact-eligible clinicians by state
 * for the authenticated organization
 *
 * Response format:
 * Array<{
 *   state: string;
 *   stateCode: string;
 *   clinicianCount: number;
 *   compacts: {
 *     imlc: number;
 *     psypact: number;
 *     counseling: number;
 *   };
 * }>
 */
export async function GET() {
  try {
    // TODO: Replace with actual authentication and database query
    // For now, return mock data for development

    const mockData = [
      {
        state: 'California',
        stateCode: 'CA',
        clinicianCount: 45,
        compacts: { imlc: 12, psypact: 25, counseling: 8 },
      },
      {
        state: 'Colorado',
        stateCode: 'CO',
        clinicianCount: 38,
        compacts: { imlc: 38, psypact: 30, counseling: 15 },
      },
      {
        state: 'New York',
        stateCode: 'NY',
        clinicianCount: 52,
        compacts: { imlc: 20, psypact: 35, counseling: 18 },
      },
      {
        state: 'Texas',
        stateCode: 'TX',
        clinicianCount: 41,
        compacts: { imlc: 15, psypact: 28, counseling: 12 },
      },
      {
        state: 'Florida',
        stateCode: 'FL',
        clinicianCount: 33,
        compacts: { imlc: 10, psypact: 22, counseling: 9 },
      },
      {
        state: 'Illinois',
        stateCode: 'IL',
        clinicianCount: 29,
        compacts: { imlc: 29, psypact: 20, counseling: 11 },
      },
      {
        state: 'Arizona',
        stateCode: 'AZ',
        clinicianCount: 25,
        compacts: { imlc: 25, psypact: 18, counseling: 7 },
      },
      {
        state: 'Washington',
        stateCode: 'WA',
        clinicianCount: 31,
        compacts: { imlc: 31, psypact: 24, counseling: 13 },
      },
      {
        state: 'Georgia',
        stateCode: 'GA',
        clinicianCount: 22,
        compacts: { imlc: 22, psypact: 16, counseling: 6 },
      },
      {
        state: 'Massachusetts',
        stateCode: 'MA',
        clinicianCount: 27,
        compacts: { imlc: 8, psypact: 19, counseling: 10 },
      },
    ];

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error fetching org compact data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch org compact data' },
      { status: 500 }
    );
  }
}

