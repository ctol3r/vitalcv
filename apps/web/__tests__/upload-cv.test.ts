/**
 * upload-cv.test.ts
 *
 * Tests the /api/upload/cv route handler in isolation.
 * No Clerk, no DB, no network.
 *
 * Truth contracts verified:
 *   1. Non-PDF/DOCX MIME type → 415
 *   2. PDF upload → 200; ocrLive: false, parseLive: false, parsedEntries: []
 *   3. DOCX upload → 200; ocrLive: false, parseLive: false, parsedEntries: []
 *   4. File > 5 MB → 413
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const CV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function buildMultipartRequest(
  mimeType: string,
  content: string | Uint8Array,
  filename = 'test.pdf',
): NextRequest {
  const file = new File([content], filename, { type: mimeType });
  const form = new FormData();
  form.append('file', file);
  return new NextRequest('http://localhost/api/upload/cv', {
    method: 'POST',
    body: form,
  });
}

describe('/api/upload/cv', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 415 for non-PDF/DOCX MIME type', async () => {
    const { POST } = await import('../app/api/upload/cv/route');
    const req = buildMultipartRequest('image/jpeg', 'fake-image-data', 'photo.jpg');
    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('mime_not_allowed');
  });

  it('accepts PDF and returns ocrLive: false, parseLive: false, parsedEntries: []', async () => {
    const { POST } = await import('../app/api/upload/cv/route');
    const req = buildMultipartRequest('application/pdf', '%PDF-1.4 stub', 'cv.pdf');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ocrLive: boolean;
      parseLive: boolean;
      parsedEntries: unknown[];
      provenance: string;
    };
    expect(body.ocrLive).toBe(false);
    expect(body.parseLive).toBe(false);
    expect(body.parsedEntries).toEqual([]);
    expect(body.provenance).toBe('USER_ENTERED');
  });

  it('accepts DOCX and returns ocrLive: false, parseLive: false', async () => {
    const { POST } = await import('../app/api/upload/cv/route');
    const req = buildMultipartRequest(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'PK stub docx bytes',
      'cv.docx',
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { ocrLive: boolean; parseLive: boolean };
    expect(body.ocrLive).toBe(false);
    expect(body.parseLive).toBe(false);
  });

  it('returns 413 for files exceeding the 5 MB limit', async () => {
    const { POST } = await import('../app/api/upload/cv/route');
    const oversized = new Uint8Array(CV_MAX_FILE_SIZE_BYTES + 1);
    const req = buildMultipartRequest('application/pdf', oversized, 'big.pdf');
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('file_too_large');
  });
});
