import { PrismaClient, type CompactDocument } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

export interface CompactDocumentUpload {
  clinicianId: string;
  compact: string;
  documentUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface CompactDocumentResult extends CompactDocument {
  derivedState?: string;
  expiresOn?: string | null;
}

export async function ingestCompactDocument(
  input: CompactDocumentUpload,
): Promise<CompactDocumentResult> {
  validateUpload(input);
  const derived = extractMetadata(input);
  const verified = evaluateAgainstRulesEngine(input.compact, derived);

  const record = await prisma.compactDocument.create({
    data: {
      clinicianId: input.clinicianId,
      compact: input.compact,
      documentUrl: input.documentUrl,
      verified,
      updatedAt: new Date(),
    },
  });

  return {
    ...record,
    derivedState: derived.state,
    expiresOn: derived.expiresOn?.toISOString() ?? null,
  };
}

function validateUpload(input: CompactDocumentUpload) {
  if (!input.clinicianId) throw new Error('clinicianId is required');
  if (!input.compact) throw new Error('compact type is required');
  if (!input.documentUrl) throw new Error('documentUrl is required');
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }
  if (input.sizeBytes && input.sizeBytes > 20 * 1024 * 1024) {
    throw new Error('Document exceeds 20MB limit');
  }
}

function extractMetadata(input: CompactDocumentUpload) {
  const normalizedName = input.fileName.toUpperCase();
  const stateMatch = normalizedName.match(/\b([A-Z]{2})\b/);
  const dateMatch = normalizedName.match(/(20\d{2})[-_/]?(0[1-9]|1[0-2])[-_/]?([0-3]\d)/);

  const metadata = {
    state:
      (typeof input.metadata?.state === 'string'
        ? input.metadata.state
        : stateMatch?.[1]) ?? null,
    expiresOn: dateMatch
      ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
      : typeof input.metadata?.expiresOn === 'string'
        ? new Date(input.metadata.expiresOn)
        : null,
  };

  return metadata;
}

function evaluateAgainstRulesEngine(
  compact: string,
  metadata: { state: string | null; expiresOn: Date | null },
): boolean {
  if (!metadata.state) return false;
  if (metadata.expiresOn && metadata.expiresOn.getTime() < Date.now()) {
    return false;
  }

  switch (compact.toUpperCase()) {
    case 'IMLC':
      return ['AL', 'AZ', 'CO', 'TX', 'WA'].includes(metadata.state);
    case 'PSYPACT':
      return ['CO', 'IL', 'VA', 'UT', 'PA'].includes(metadata.state);
    case 'NLC':
      return true;
    default:
      return true;
  }
}










