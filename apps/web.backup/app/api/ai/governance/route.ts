import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function GET(_request: NextRequest) {
  try {
    // Query backend for governance events
    const backendResponse = await fetch(`${BACKEND_URL}/api/ai/governance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      // If backend doesn't have this endpoint yet, return empty array
      if (backendResponse.status === 404) {
        return NextResponse.json({ rows: [] });
      }
      const error = await backendResponse.text();
      return NextResponse.json(
        { error: 'Backend error', details: error },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('AI governance query error:', error);
    // Return empty array on error to allow UI to render
    return NextResponse.json({ rows: [] });
  }
}

