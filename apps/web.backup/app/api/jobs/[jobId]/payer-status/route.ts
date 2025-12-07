import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/jobs/[jobId]/payer-status - Get payer enrollment status for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  // Mock data - replace with actual logic that checks enrollments
  // This would check if the clinician has the required payer enrollment for the job

  const mockStatuses = [
    {
      jobId: jobId,
      payerId: 'payer_001',
      payerName: 'Blue Cross Blue Shield',
      chipStatus: 'payer_ready' as const,
      chipLabel: 'Payer Ready',
      chipTooltip: 'You are enrolled and can start immediately with this payer.',
      enrollmentId: 'enr_001',
      enrollmentStatus: 'approved' as const
    },
    {
      jobId: jobId,
      chipStatus: 'enrollment_pending' as const,
      chipLabel: 'Enrollment Pending',
      chipTooltip: 'Your enrollment is under review. Estimated approval in 30-60 days.',
      payerId: 'payer_002',
      payerName: 'UnitedHealthcare',
      enrollmentId: 'enr_002',
      enrollmentStatus: 'in_review' as const
    },
    {
      jobId: jobId,
      chipStatus: 'enrollment_required' as const,
      chipLabel: 'Enrollment Required',
      chipTooltip: 'You need to complete payer enrollment before starting this position.',
      payerId: 'payer_003',
      payerName: 'Aetna'
    },
    {
      jobId: jobId,
      chipStatus: 'not_applicable' as const,
      chipLabel: 'N/A',
      chipTooltip: 'No payer enrollment required for this position.'
    }
  ];

  // Return a random status for demo purposes
  const randomIndex = Math.floor(Math.random() * mockStatuses.length);
  return NextResponse.json(mockStatuses[randomIndex]);
}

