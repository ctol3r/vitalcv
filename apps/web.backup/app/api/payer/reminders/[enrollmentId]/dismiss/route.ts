import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payer/reminders/[enrollmentId]/dismiss - Dismiss a reminder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const { enrollmentId } = params;

  // Mock response - replace with actual database update
  return NextResponse.json({
    success: true,
    enrollmentId,
    dismissed: true
  });
}

