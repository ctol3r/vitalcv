/**
 * Facility Privileging Engine - Audit Log API
 * Phase 4 Task 32: Audit log of all privileging decisions
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clinicianId = searchParams.get('clinicianId');
    const privilegeCode = searchParams.get('privilegeCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query params
    const params = new URLSearchParams();
    if (clinicianId) params.set('clinicianId', clinicianId);
    if (privilegeCode) params.set('privilegeCode', privilegeCode);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('limit', limit.toString());

    // Forward to backend API
    const response = await fetch(
      `${API_BASE}/api/facility/privileges/audit?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Audit log error:', error);
    return NextResponse.json(
      { error: 'Failed to load audit log' },
      { status: 500 }
    );
  }
}

