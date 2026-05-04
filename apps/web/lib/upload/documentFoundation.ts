// Document upload foundation — OCR and classification are not live.
// All uploaded documents land as USER_ENTERED provenance; they never
// acquire VERIFIED provenance through this path.
export type DocumentProvenance = 'USER_ENTERED';

export type DocumentFoundationState = {
  ocrLive: false;
  autoClassificationLive: false;
  provenance: DocumentProvenance;
};

export function getDocumentFoundationState(): DocumentFoundationState {
  return {
    ocrLive: false,
    autoClassificationLive: false,
    provenance: 'USER_ENTERED',
  };
}

// MIME types allowed for document upload.
// Only these types pass the server-side MIME check.
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export type MimeCheckResult =
  | { allowed: true; mimeType: AllowedMimeType }
  | { allowed: false; reason: 'mime_not_allowed' | 'file_too_large' };

export function checkUploadConstraints(
  mimeType: string,
  sizeBytes: number,
): MimeCheckResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { allowed: false, reason: 'file_too_large' };
  }
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { allowed: true, mimeType: mimeType as AllowedMimeType };
  }
  return { allowed: false, reason: 'mime_not_allowed' };
}
