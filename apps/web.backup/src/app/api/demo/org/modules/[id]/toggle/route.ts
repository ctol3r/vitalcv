/**
 * API Route: POST /api/demo/org/modules/[id]/toggle
 *
 * Enable/disable a module (where safe).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    // TODO: In production, call backend service:
    // const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    // const res = await fetch(`${backendUrl}/api/modules/${id}/toggle`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ enabled }),
    // });
    // const data = await res.json();

    // For now, return success (mock)
    return NextResponse.json({
      success: true,
      module: {
        id,
        name: `Module ${id}`,
        enabled,
      },
    });
  } catch (error) {
    console.error('Error toggling module:', error);
    return NextResponse.json(
      { error: 'Failed to toggle module' },
      { status: 500 }
    );
  }
}

