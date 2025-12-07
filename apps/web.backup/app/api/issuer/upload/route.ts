/**
 * Issuer Document Upload API
 * POST - Upload document for credential issuance
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // TODO: Implement actual file upload to storage (S3, etc.)
    // For now, return mock URL
    const mockFileUrl = `https://storage.vitalcv.io/uploads/${Date.now()}-${file.name}`;

    return NextResponse.json({
      fileUrl: mockFileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
