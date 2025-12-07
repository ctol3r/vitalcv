import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/providers/[id]/sanctions
 * Sanctions + OIG lookups
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // TODO: Integrate with sanctions/OIG lookup services
    const sanctions = {
      providerId: id,
      oig: {
        checked: false,
        matches: [],
      },
      sanctions: {
        checked: false,
        matches: [],
      },
    };

    return NextResponse.json(sanctions);
  } catch (error) {
    console.error('[dashboard][providers][id][sanctions]', error);
    return NextResponse.json(
      { error: 'Failed to fetch sanctions data' },
      { status: 500 },
    );
  }
}

