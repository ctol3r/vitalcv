/**
 * Recent Links API Route
 *
 * Returns recently discovered links for auto-refresh
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const since = searchParams.get('since'); // Timestamp

  try {
    // Get all links (in production, filter by timestamp)
    // For now, just return empty or mock recent links
    const recentLinks: any[] = [];

    // Mock some recent AI-inferred links for demo
    if (process.env.NODE_ENV === 'development') {
      recentLinks.push({
        id: 'recent-1',
        sourceId: 'cred-123',
        targetId: 'npi-456',
        targetName: 'Dr. Jane Smith',
        targetType: 'npi',
        relationship: 'issued_to',
        score: 0.92,
        inferred: true,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      links: recentLinks,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get recent links error:', error);
    return NextResponse.json({ links: [] });
  }
}
