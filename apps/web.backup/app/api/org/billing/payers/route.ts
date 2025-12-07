import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/org/billing/payers - Get billing metrics by payer
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payerId = searchParams.get('payerId');

  // Mock data - replace with actual database query
  const mockMetrics = [
    {
      payerId: 'payer_001',
      payerName: 'Blue Cross Blue Shield',
      currentMonth: {
        enrollments: 45,
        newEnrollments: 5,
        revalidations: 2
      },
      monthlyTrend: [
        { month: '2024-06', enrollments: 38 },
        { month: '2024-07', enrollments: 39 },
        { month: '2024-08', enrollments: 41 },
        { month: '2024-09', enrollments: 42 },
        { month: '2024-10', enrollments: 43 },
        { month: '2024-11', enrollments: 45 }
      ],
      statusBreakdown: [
        { status: 'approved', count: 40 },
        { status: 'pending', count: 3 },
        { status: 'in_review', count: 2 }
      ]
    },
    {
      payerId: 'payer_002',
      payerName: 'UnitedHealthcare',
      currentMonth: {
        enrollments: 32,
        newEnrollments: 3,
        revalidations: 1
      },
      monthlyTrend: [
        { month: '2024-06', enrollments: 28 },
        { month: '2024-07', enrollments: 29 },
        { month: '2024-08', enrollments: 29 },
        { month: '2024-09', enrollments: 30 },
        { month: '2024-10', enrollments: 31 },
        { month: '2024-11', enrollments: 32 }
      ],
      statusBreakdown: [
        { status: 'approved', count: 28 },
        { status: 'pending', count: 2 },
        { status: 'in_review', count: 1 },
        { status: 'revalidating', count: 1 }
      ]
    },
    {
      payerId: 'payer_003',
      payerName: 'Aetna',
      currentMonth: {
        enrollments: 28,
        newEnrollments: 2,
        revalidations: 0
      },
      monthlyTrend: [
        { month: '2024-06', enrollments: 25 },
        { month: '2024-07', enrollments: 25 },
        { month: '2024-08', enrollments: 26 },
        { month: '2024-09', enrollments: 26 },
        { month: '2024-10', enrollments: 27 },
        { month: '2024-11', enrollments: 28 }
      ],
      statusBreakdown: [
        { status: 'approved', count: 26 },
        { status: 'pending', count: 1 },
        { status: 'in_review', count: 1 }
      ]
    }
  ];

  // Filter by payer if specified
  const filteredMetrics = payerId
    ? mockMetrics.filter(m => m.payerId === payerId)
    : mockMetrics;

  return NextResponse.json(filteredMetrics);
}

