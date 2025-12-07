import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payer/reminders - Get revalidation reminders
 */
export async function GET(request: NextRequest) {
  // Mock data - replace with actual database query
  const mockReminders = [
    {
      enrollmentId: 'enr_003',
      payerName: 'Cigna',
      dueDate: '2025-01-15T00:00:00Z',
      daysRemaining: 63,
      severity: 'warning' as const,
      dismissed: false
    },
    {
      enrollmentId: 'enr_004',
      payerName: 'Humana',
      dueDate: '2024-12-20T00:00:00Z',
      daysRemaining: 37,
      severity: 'warning' as const,
      dismissed: false
    },
    {
      enrollmentId: 'enr_005',
      payerName: 'Kaiser Permanente',
      dueDate: '2024-12-05T00:00:00Z',
      daysRemaining: 22,
      severity: 'urgent' as const,
      dismissed: false
    }
  ];

  return NextResponse.json(mockReminders);
}

