import { NextRequest, NextResponse } from 'next/server';

/**
 * Document Upload & Verification (Level 2)
 * POST /api/claim/doc
 *
 * Accepts multipart/form-data with license and selfie files
 */

interface RequestBody {
  npi: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const npi = formData.get('npi') as string;
    const userId = formData.get('userId') as string;
    const license = formData.get('license') as File;
    const selfie = formData.get('selfie') as File;

    // Validate
    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    if (!license || !selfie) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 });
    }

    // Forward to backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const backendFormData = new FormData();
    backendFormData.append('npi', npi);
    backendFormData.append('userId', userId);
    backendFormData.append('license', license);
    backendFormData.append('selfie', selfie);

    const response = await fetch(`${backendUrl}/api/claim/doc-multipart`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Document Upload Error]', error);
    return NextResponse.json({ error: 'Failed to upload documents' }, { status: 500 });
  }
}
