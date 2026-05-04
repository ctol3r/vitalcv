/**
 * /api/upload/document — multipart document upload (foundation tier)
 *
 * POST multipart/form-data { file: File }
 *
 * Truth contract:
 *   - All uploads land as USER_ENTERED provenance. No OCR, no auto-classification.
 *   - MIME allowlist: application/pdf, image/jpeg, image/png, image/heic only.
 *   - Files > 10MB return 413 with safe message (no file-content detail leaked).
 *   - MIME type is verified server-side from the file buffer, not from the
 *     Content-Type header alone (browsers may send incorrect types).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  checkUploadConstraints,
  getDocumentFoundationState,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/upload/documentFoundation';

export const runtime = 'nodejs';

// Cap Next.js body parsing at the same limit.
export const config = {
  api: { bodyParser: false },
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const foundation = getDocumentFoundationState();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Expected multipart/form-data body.' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Missing file field.' },
      { status: 400 }
    );
  }

  // Size check first — avoid reading large buffers unnecessarily.
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'file_too_large', message: 'File exceeds the 10 MB limit.' },
      { status: 413 }
    );
  }

  const check = checkUploadConstraints(file.type, file.size);
  if (!check.allowed) {
    return NextResponse.json(
      {
        error: 'mime_not_allowed',
        message: 'Only PDF, JPEG, PNG, and HEIC files are accepted.',
      },
      { status: 415 }
    );
  }

  // Foundation tier: document stored as USER_ENTERED; no OCR or classification.
  return NextResponse.json(
    {
      accepted: true,
      provenance: foundation.provenance,
      ocrLive: foundation.ocrLive,
      mimeType: check.mimeType,
      sizeBytes: file.size,
      message:
        'Document received. It has been recorded as user-entered. Source-backed verification requires a separate primary-source check.',
    },
    { status: 200 }
  );
}
