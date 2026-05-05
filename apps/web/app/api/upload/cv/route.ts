/**
 * /api/upload/cv — multipart CV upload (foundation tier)
 *
 * POST multipart/form-data { file: File }
 *
 * Truth contract:
 *   - All uploads land as USER_ENTERED provenance. No OCR, no parsing.
 *   - MIME allowlist: application/pdf and DOCX only.
 *   - Files > 5 MB return 413.
 *   - parsedEntries is always [] (parseLive: false).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  checkCvUploadConstraints,
  getCvFoundationState,
  CV_MAX_FILE_SIZE_BYTES,
} from '@/lib/upload/cvFoundation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const foundation = getCvFoundationState();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Expected multipart/form-data body.' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Missing file field.' },
      { status: 400 },
    );
  }

  if (file.size > CV_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'file_too_large', message: 'File exceeds the 5 MB limit.' },
      { status: 413 },
    );
  }

  const check = checkCvUploadConstraints(file.type, file.size);
  if (!check.allowed) {
    return NextResponse.json(
      { error: 'mime_not_allowed', message: 'Only PDF and DOCX files are accepted.' },
      { status: 415 },
    );
  }

  return NextResponse.json(
    {
      accepted: true,
      provenance: foundation.provenance,
      ocrLive: foundation.ocrLive,
      parseLive: foundation.parseLive,
      mimeType: check.mimeType,
      sizeBytes: file.size,
      parsedEntries: [],
      message:
        'CV received. It has been recorded as user-entered. Structured parsing is not active on this entry point.',
    },
    { status: 200 },
  );
}
