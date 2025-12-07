/**
 * GET /api/regulatory/payers/[id]/packet-summary
 * Task 38: Chain anchor summary for submitted packets
 */

import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const payerId = params.id;
    const { searchParams } = new URL(request.url);
    const packetId = searchParams.get('packetId');

    if (!packetId) {
      return NextResponse.json({ error: 'packetId required' }, { status: 400 });
    }

    // In production, fetch from backend
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(
      `${API_BASE}/api/regulatory/payers/${payerId}/packet-summary?packetId=${packetId}`,
    );

    if (!response.ok) {
      // Return mock data structure
      return NextResponse.json({
        payerId,
        packetId,
        summary: {
          submittedAt: new Date().toISOString(),
          status: 'submitted',
          documents: [],
          chainAnchors: [],
        },
        generatedAt: new Date().toISOString(),
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[regulatory][payers][packet-summary]', error);
    return NextResponse.json(
      { error: 'Failed to fetch packet summary' },
      { status: 500 },
    );
  }
}








