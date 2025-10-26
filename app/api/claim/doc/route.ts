/**
 * Document Upload API - Handles Level 2 identity document uploads
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const npi = formData.get('npi') as string;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI format' }, { status: 400 });
    }

    // Collect uploaded files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Validate file types and sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
      }
      if (file.size > maxSize) {
        return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 400 });
      }
    }

    // In production:
    // 1. Upload to S3/Cloud Storage
    // 2. Run identity verification (AWS Rekognition, ID.me, etc.)
    // 3. Store document metadata in database
    // 4. Update claim level to 2

    console.log(`[Document Upload] NPI ${npi}: ${files.length} files uploaded`);

    // Mock processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      uploadedCount: files.length,
      message: 'Documents uploaded and verified successfully',
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ error: 'Failed to upload documents' }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
