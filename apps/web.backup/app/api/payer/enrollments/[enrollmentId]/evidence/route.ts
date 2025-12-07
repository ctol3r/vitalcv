import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payer/enrollments/[enrollmentId]/evidence - Upload evidence document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const { enrollmentId } = params;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Mock response - replace with actual file upload and database insert
    const evidence = {
      id: `ev_${Date.now()}`,
      type,
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      verified: false,
      size: file.size,
      mimeType: file.type,
      url: `/api/evidence/ev_${Date.now()}/download`
    };

    // Return updated enrollment with new evidence
    return NextResponse.json({
      id: enrollmentId,
      evidence: [evidence],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload evidence' },
      { status: 500 }
    );
  }
}

