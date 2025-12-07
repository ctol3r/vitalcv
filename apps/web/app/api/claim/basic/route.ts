import { NextRequest, NextResponse } from 'next/server';

/**
 * Start Basic Claim (Level 1 - Email OTP)
 * POST /api/claim/basic
 */

interface RequestBody {
  npi: string;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { npi, email } = body;

    // Validate
    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Forward to backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/claim/basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi, email }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Basic Claim Error]', error);
    return NextResponse.json({ error: 'Failed to start claim' }, { status: 500 });
  }
}
