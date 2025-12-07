import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payer/enrollments/[enrollmentId] - Get single enrollment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const { enrollmentId } = params;

  // Mock data - replace with actual database query
  const mockEnrollment = {
    id: enrollmentId,
    clinicianNpi: '1234567890',
    clinicianName: 'Dr. Sarah Johnson',
    payerId: 'payer_001',
    payer: {
      id: 'payer_001',
      name: 'Blue Cross Blue Shield',
      type: 'commercial',
      logoUrl: null,
      website: 'https://www.bcbs.com',
      contactEmail: 'provider@bcbs.com',
      contactPhone: '1-800-555-1234',
    },
    status: 'approved',
    productLines: ['medical', 'telehealth'],
    createdAt: '2024-01-15T10:00:00Z',
    submittedAt: '2024-01-16T10:00:00Z',
    approvedAt: '2024-03-01T10:00:00Z',
    effectiveDate: '2024-03-01T10:00:00Z',
    lastUpdated: '2024-03-01T10:00:00Z',
    nextRevalidation: '2027-03-01T10:00:00Z',
    revalidationFrequency: 36,
    caqhProviderId: 'CAQH123456',
    vitalcvCredentialIds: ['vc_lic_001', 'vc_cert_001'],
    evidence: [
      {
        id: 'ev_001',
        type: 'license',
        filename: 'medical_license_CA.pdf',
        uploadedAt: '2024-01-16T10:00:00Z',
        verified: true,
        verifiedAt: '2024-02-01T10:00:00Z',
        verifiedBy: 'System',
        size: 245678,
        mimeType: 'application/pdf',
        url: '/api/evidence/ev_001/download'
      },
      {
        id: 'ev_002',
        type: 'board_cert',
        filename: 'board_certification.pdf',
        uploadedAt: '2024-01-16T11:00:00Z',
        verified: true,
        verifiedAt: '2024-02-01T11:00:00Z',
        verifiedBy: 'Admin',
        expiresAt: '2030-12-31T23:59:59Z',
        size: 189234,
        mimeType: 'application/pdf',
        url: '/api/evidence/ev_002/download'
      }
    ],
    events: [
      {
        id: 'evt_001',
        timestamp: '2024-01-15T10:00:00Z',
        eventType: 'created',
        status: 'draft',
        note: 'Enrollment draft created',
        actor: 'Dr. Sarah Johnson'
      },
      {
        id: 'evt_002',
        timestamp: '2024-01-16T10:00:00Z',
        eventType: 'document_added',
        note: 'Medical license uploaded',
        actor: 'Dr. Sarah Johnson'
      },
      {
        id: 'evt_003',
        timestamp: '2024-01-16T10:30:00Z',
        eventType: 'submitted',
        status: 'pending',
        note: 'Enrollment submitted to payer',
        actor: 'Dr. Sarah Johnson'
      },
      {
        id: 'evt_004',
        timestamp: '2024-02-15T14:20:00Z',
        eventType: 'status_change',
        status: 'in_review',
        note: 'Payer began review process',
        actor: 'BCBS System'
      },
      {
        id: 'evt_005',
        timestamp: '2024-03-01T10:00:00Z',
        eventType: 'status_change',
        status: 'approved',
        note: 'Enrollment approved - effective immediately',
        actor: 'BCBS Credentialing Team'
      }
    ],
    notes: 'All documents verified. Provider meets all payer requirements.'
  };

  return NextResponse.json(mockEnrollment);
}

/**
 * PUT /api/payer/enrollments/[enrollmentId] - Update enrollment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const { enrollmentId } = params;
  const updates = await request.json();

  // Mock response - replace with actual database update
  return NextResponse.json({
    id: enrollmentId,
    ...updates,
    lastUpdated: new Date().toISOString()
  });
}

