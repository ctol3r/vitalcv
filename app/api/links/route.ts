/**
 * Links API Route
 *
 * Handle AI-powered semantic link management
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (replace with actual DB/vector store)
const linkStore: Map<string, any> = new Map();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const entityId = searchParams.get('entity');
  const sourceId = searchParams.get('source');
  const targetId = searchParams.get('target');

  try {
    if (entityId) {
      // Find all links for a specific entity (as source or target)
      const entityLinks = Array.from(linkStore.values()).filter(
        (link) => link.sourceId === entityId || link.targetId === entityId,
      );

      return NextResponse.json({ links: entityLinks });
    }

    if (sourceId && targetId) {
      // Find specific link
      const link = Array.from(linkStore.values()).find(
        (l) => l.sourceId === sourceId && l.targetId === targetId,
      );

      return NextResponse.json({ link });
    }

    // Return all links
    const allLinks = Array.from(linkStore.values());
    return NextResponse.json({ links: allLinks });
  } catch (error) {
    console.error('Get links error:', error);
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, targetId, relationship, targetName, targetType } = body;

    if (!sourceId || !targetId || !relationship) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create link
    const link = {
      id: `${sourceId}-${targetId}-${Date.now()}`,
      sourceId,
      targetId,
      targetName: targetName || 'Unknown',
      targetType: targetType || 'credential',
      relationship,
      score: body.score || 0.85, // Default confidence
      inferred: false,
      createdAt: new Date().toISOString(),
    };

    linkStore.set(link.id, link);

    return NextResponse.json({ link });
  } catch (error) {
    console.error('Create link error:', error);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const linkId = searchParams.get('id');

  if (!linkId) {
    return NextResponse.json({ error: 'Link ID required' }, { status: 400 });
  }

  try {
    linkStore.delete(linkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete link error:', error);
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
  }
}
