// CV upload foundation — parsing and OCR are not live.
// All uploaded CVs land as USER_ENTERED provenance; they never
// acquire VERIFIED provenance through this path.
export type CvProvenance = 'USER_ENTERED';

export type CvFoundationState = {
  ocrLive: false;
  parseLive: false;
  provenance: CvProvenance;
};

export function getCvFoundationState(): CvFoundationState {
  return { ocrLive: false, parseLive: false, provenance: 'USER_ENTERED' };
}

// MIME types allowed for CV upload: PDF and DOCX only.
export const CV_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type CvAllowedMimeType = (typeof CV_ALLOWED_MIME_TYPES)[number];

export const CV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type CvMimeCheckResult =
  | { allowed: true; mimeType: CvAllowedMimeType }
  | { allowed: false; reason: 'mime_not_allowed' | 'file_too_large' };

export function checkCvUploadConstraints(
  mimeType: string,
  sizeBytes: number,
): CvMimeCheckResult {
  if (sizeBytes > CV_MAX_FILE_SIZE_BYTES) {
    return { allowed: false, reason: 'file_too_large' };
  }
  if ((CV_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { allowed: true, mimeType: mimeType as CvAllowedMimeType };
  }
  return { allowed: false, reason: 'mime_not_allowed' };
}
