import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify OTP PIN (Level 1 completion)
 * POST /api/claim/verify-pin
 */

interface RequestBody {
  npi: string;
  pin: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { npi, pin, userId } = body;

    // Validate
    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
    }
    if (!pin || pin.length !== 6) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 });
    }

    // Forward to backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/claim/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi, pin, userId }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Verify PIN Error]', error);
    return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
  }
}
