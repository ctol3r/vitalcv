/**
 * B128C-FE-031: Frontend API route for KPI evidence links
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { kpiId: string } }
) {
  try {
    const { kpiId } = params;

    // Fetch from backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4005';
    const response = await fetch(`${backendUrl}/api/evidence/kpi/${kpiId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 1 hour
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('KPI evidence API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch KPI evidence',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

