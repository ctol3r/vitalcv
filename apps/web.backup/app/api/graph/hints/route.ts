import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward Authorization header from the client request
    const authHeader = request.headers.get('authorization');

    // Call the backend service
    const res = await fetch('http://localhost:4000/api/graph/hints', {
        headers: {
            'Authorization': authHeader || '',
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        const errorText = await res.text();
        let errorJson;
        try {
             errorJson = JSON.parse(errorText);
        } catch {
             errorJson = { error: errorText };
        }
        return NextResponse.json(errorJson, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Graph hints proxy error', error);
    return NextResponse.json({ error: 'Failed to fetch graph hints' }, { status: 500 });
  }
}















