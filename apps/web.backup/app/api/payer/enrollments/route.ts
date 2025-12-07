import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payer/enrollments - Get list of enrollments
 * Query params: status, payerId, productLine, revalidationDue, search
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Mock data - replace with actual database queries
  const mockEnrollments = [
    {
      id: 'enr_001',
      clinicianNpi: '1234567890',
      clinicianName: 'Dr. Sarah Johnson',
      payerId: 'payer_001',
      payer: {
        id: 'payer_001',
        name: 'Blue Cross Blue Shield',
        type: 'commercial',
        logoUrl: null,
      },
      status: 'approved',
      productLines: ['medical', 'telehealth'],
      createdAt: '2024-01-15T10:00:00Z',
      submittedAt: '2024-01-16T10:00:00Z',
      approvedAt: '2024-03-01T10:00:00Z',
      lastUpdated: '2024-03-01T10:00:00Z',
      nextRevalidation: '2027-03-01T10:00:00Z',
      revalidationFrequency: 36,
      evidence: [
        {
          id: 'ev_001',
          type: 'license',
          filename: 'medical_license_CA.pdf',
          uploadedAt: '2024-01-16T10:00:00Z',
          verified: true,
          verifiedAt: '2024-02-01T10:00:00Z',
          size: 245678,
          mimeType: 'application/pdf',
        }
      ],
      events: [
        {
          id: 'evt_001',
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'created',
          status: 'draft',
          note: 'Enrollment draft created'
        },
        {
          id: 'evt_002',
          timestamp: '2024-01-16T10:00:00Z',
          eventType: 'submitted',
          status: 'pending',
          note: 'Enrollment submitted to payer'
        },
        {
          id: 'evt_003',
          timestamp: '2024-03-01T10:00:00Z',
          eventType: 'status_change',
          status: 'approved',
          note: 'Enrollment approved by payer'
        }
      ]
    },
    {
      id: 'enr_002',
      clinicianNpi: '1234567890',
      clinicianName: 'Dr. Sarah Johnson',
      payerId: 'payer_002',
      payer: {
        id: 'payer_002',
        name: 'UnitedHealthcare',
        type: 'commercial',
        logoUrl: null,
      },
      status: 'pending',
      productLines: ['behavioral'],
      createdAt: '2024-10-15T10:00:00Z',
      submittedAt: '2024-10-16T10:00:00Z',
      lastUpdated: '2024-10-16T10:00:00Z',
      evidence: [],
      events: [
        {
          id: 'evt_004',
          timestamp: '2024-10-15T10:00:00Z',
          eventType: 'created',
          status: 'draft'
        },
        {
          id: 'evt_005',
          timestamp: '2024-10-16T10:00:00Z',
          eventType: 'submitted',
          status: 'pending'
        }
      ]
    }
  ];

  return NextResponse.json({
    enrollments: mockEnrollments,
    total: mockEnrollments.length
  });
}

/**
 * POST /api/payer/enrollments - Create new enrollment
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Mock response - replace with actual database insert
  const newEnrollment = {
    id: `enr_${Date.now()}`,
    ...body,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    evidence: [],
    events: [
      {
        id: `evt_${Date.now()}`,
        timestamp: new Date().toISOString(),
        eventType: 'created',
        status: body.status || 'draft',
        note: 'Enrollment created'
      }
    ]
  };

  return NextResponse.json(newEnrollment, { status: 201 });
}

