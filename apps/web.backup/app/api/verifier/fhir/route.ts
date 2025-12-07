import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const policyParam = searchParams.get('policy');

    if (!policyParam) {
      return NextResponse.json(
        { error: 'Missing policy parameter' },
        { status: 400 }
      );
    }

    let policy;
    try {
      policy = JSON.parse(policyParam);
    } catch {
      return NextResponse.json(
        { error: 'Invalid policy JSON' },
        { status: 400 }
      );
    }

    // Forward to backend FHIR verifier
    const backendResponse = await fetch(`${BACKEND_URL}/api/verifier/fhir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ policy }),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      return NextResponse.json(
        { error: 'Backend error', details: error },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('FHIR verifier error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

