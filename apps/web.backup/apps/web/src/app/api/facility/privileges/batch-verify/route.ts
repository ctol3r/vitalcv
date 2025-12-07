/**
 * Facility Privileging Engine - Batch Verification API
 * Phase 4 Task 31: Batch privilege verification (multi-provider)
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinicianIds, privilegeCodes } = body;

    if (!Array.isArray(clinicianIds) || clinicianIds.length === 0) {
      return NextResponse.json(
        { error: 'clinicianIds array is required' },
        { status: 400 }
      );
    }

    // Forward to backend API
    const response = await fetch(`${API_BASE}/api/facility/privileges/batch-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clinicianIds,
        privilegeCodes: privilegeCodes || [], // If empty, verify all privileges
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Batch verification error:', error);
    return NextResponse.json(
      { error: 'Failed to perform batch verification' },
      { status: 500 }
    );
  }
}

