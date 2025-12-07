import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * GET /api/pubmed/search?q=...
 * Proxy PubMed search to backend
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || searchParams.get('query');
  const max = searchParams.get('max') || '10';

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/pubmed/search?q=${encodeURIComponent(query)}&max=${max}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'PubMed search failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[PubMed Search Error]', error);
    return NextResponse.json({ error: 'Failed to search PubMed', message: error.message }, { status: 500 });
  }
}

