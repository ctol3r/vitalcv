import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payer/enrollments/[enrollmentId]/evidence/zip - Download all evidence as ZIP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const { enrollmentId } = params;

  // Mock response - replace with actual ZIP creation
  // In production, this would:
  // 1. Fetch all evidence documents for the enrollment
  // 2. Create a ZIP file containing all documents
  // 3. Stream the ZIP file to the client

  // For now, return a simple blob
  const mockZipContent = 'Mock ZIP file content';
  const blob = new Blob([mockZipContent], { type: 'application/zip' });

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="enrollment_${enrollmentId}_evidence.zip"`
    }
  });
}

