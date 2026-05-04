import { describe, expect, it } from 'vitest';
import {
  checkUploadConstraints,
  getDocumentFoundationState,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/upload/documentFoundation';

// Case 1 — foundation state: ocrLive is always false
describe('getDocumentFoundationState', () => {
  it('ocrLive and autoClassificationLive are false at foundation tier', () => {
    const state = getDocumentFoundationState();
    expect(state.ocrLive).toBe(false);
    expect(state.autoClassificationLive).toBe(false);
  });

  it('provenance is USER_ENTERED — no auto-classification path upgrades it', () => {
    const state = getDocumentFoundationState();
    // This assertion is the truth contract: there is no code path where
    // provenance becomes anything other than USER_ENTERED via this foundation.
    expect(state.provenance).toBe('USER_ENTERED');
    expect(state.provenance).not.toBe('VERIFIED');
  });
});

// Case 2 — MIME allowlist
describe('checkUploadConstraints — MIME allowlist', () => {
  it('allows PDF files within size limit', () => {
    const result = checkUploadConstraints('application/pdf', 1024);
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.mimeType).toBe('application/pdf');
  });

  it('blocks disallowed MIME types', () => {
    const result = checkUploadConstraints('text/html', 1024);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('mime_not_allowed');
  });
});

// Case 3 — 10 MB size enforcement
describe('checkUploadConstraints — file size', () => {
  it('blocks files exceeding 10 MB', () => {
    const oversized = MAX_FILE_SIZE_BYTES + 1;
    const result = checkUploadConstraints('application/pdf', oversized);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('file_too_large');
  });

  it('allows files exactly at the 10 MB limit', () => {
    const result = checkUploadConstraints('image/jpeg', MAX_FILE_SIZE_BYTES);
    expect(result.allowed).toBe(true);
  });
});

// Case 4 — MIME allowlist is the exact set (no implicit wildcard)
describe('ALLOWED_MIME_TYPES — complete set', () => {
  it('contains only the four specified types', () => {
    expect(ALLOWED_MIME_TYPES).toEqual([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/heic',
    ]);
  });
});
