import { PrismaClient, type ForeignCredential } from '@prisma/client';
import { anchorForeignCredentialAdded } from '../audit/anchor';

const prisma = new PrismaClient();

export interface ForeignCredentialUpload {
  clinicianId: string;
  country: string;
  type?: string;
  documentName?: string;
  mimeType?: string;
  /** Optional raw file contents (already OCR'd or parsed upstream). */
  content?: string | Buffer;
  /** Optional structured text that was extracted by a front-end parser. */
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface ForeignCredentialIdentifiers {
  gmcNumber?: string;
  nmcPin?: string;
  euDirectiveId?: string;
  imgReference?: string;
  identifiers?: string[];
}

export interface ForeignCredentialIngestResult {
  record: ForeignCredential;
  identifiers: ForeignCredentialIdentifiers;
  inferredType: string;
}

export async function ingestForeignCredential(
  upload: ForeignCredentialUpload,
): Promise<ForeignCredentialIngestResult> {
  validateUpload(upload);

  const documentText = coerceDocumentText(upload);
  const identifiers = extractIdentifiers(documentText, uploadmetadata(upload));
  const inferredType = determineType(upload, identifiers);
  const normalizedCountry = upload.country.trim().toUpperCase();

  const record = await prisma.foreignCredential.create({
    data: {
      clinicianId: upload.clinicianId,
      country: normalizedCountry,
      type: inferredType,
      data: {
        source: {
          name: upload.documentName ?? null,
          mimeType: upload.mimeType ?? null,
        },
        identifiers,
        metadata: upload.metadata ?? {},
        extractedAt: new Date().toISOString(),
        preview: documentText.slice(0, 2_000),
      },
    },
  });

  anchorForeignCredentialAdded({
    clinicianId: record.clinicianId,
    credentialId: record.id,
    country: normalizedCountry,
    identifiers,
  });

  return { record, identifiers, inferredType };
}

function validateUpload(upload: ForeignCredentialUpload) {
  if (!upload.clinicianId) {
    throw new Error('clinicianId is required for foreign credential ingestion');
  }
  if (!upload.country) {
    throw new Error('country is required for foreign credential ingestion');
  }
  if (!upload.content && !upload.text && !upload.metadata) {
    throw new Error('document content, text, or metadata must be provided');
  }
}

function coerceDocumentText(upload: ForeignCredentialUpload): string {
  if (typeof upload.text === 'string' && upload.text.trim().length > 0) {
    return upload.text;
  }

  if (typeof upload.content === 'string') {
    return upload.content;
  }

  if (Buffer.isBuffer(upload.content)) {
    return upload.content.toString('utf8');
  }

  const ocrText = uploadmetadata(upload).ocrText;
  if (ocrText) {
    return ocrText;
  }

  return [upload.documentName ?? '', JSON.stringify(upload.metadata ?? {})]
    .filter(Boolean)
    .join('\n');
}

function uploadmetadata(upload: ForeignCredentialUpload): Record<string, unknown> {
  return (upload.metadata ?? {}) as Record<string, unknown>;
}

function extractIdentifiers(
  text: string,
  metadata: Record<string, unknown>,
): ForeignCredentialIdentifiers {
  const normalized = text.toUpperCase();
  const gmcRegex = /\bGMC(?:\s*(?:NO\.?|NUMBER|Nº|#)?\s*[:#]?\s*)(\d{5,7})\b/i;
  const nmcRegex = /\b(?:NMC|PIN)\s*(?:NO\.?|NUMBER|Nº|#)?\s*[:#]?\s*([A-Z]\d{5,6})\b/i;
  const euRegex = /\b(?:EU|EUD|DIRECTIVE)\s*(?:ID|NO\.?|NUMBER|CARD)?[:#]?\s*([A-Z0-9\-]{6,})\b/i;

  const identifiers: ForeignCredentialIdentifiers = {};
  identifiers.gmcNumber = coerceIdentifier(metadata, 'gmcNumber', gmcRegex, text);
  identifiers.nmcPin = coerceIdentifier(metadata, 'nmcPin', nmcRegex, text);
  identifiers.euDirectiveId = coerceIdentifier(metadata, 'euDirectiveId', euRegex, text);

  const matches: string[] = [];
  let match: RegExpExecArray | null = null;
  const multiRegex = /\b(?:GMC|NMC|EU|IMG)[-\s#:]*([A-Z0-9]{4,})\b/gi;
  while ((match = multiRegex.exec(normalized))) {
    matches.push(match[1]);
  }
  if (matches.length) {
    identifiers.identifiers = matches;
  }

  if (!identifiers.imgReference) {
    const imgRef = metadata.imgReference;
    if (typeof imgRef === 'string' && imgRef.trim().length > 0) {
      identifiers.imgReference = imgRef.trim();
    } else if (normalized.includes('INTERNATIONAL MEDICAL GRADUATE')) {
      identifiers.imgReference = matches[0];
    }
  }

  return identifiers;
}

function coerceIdentifier(
  metadata: Record<string, unknown>,
  key: string,
  regex: RegExp,
  text: string,
): string | undefined {
  const direct = metadata[key];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const match = text.match(regex);
  if (match?.[1]) {
    return match[1].replace(/\s+/g, '').toUpperCase();
  }

  return undefined;
}

function determineType(
  upload: ForeignCredentialUpload,
  identifiers: ForeignCredentialIdentifiers,
): string {
  if (upload.type) {
    return upload.type;
  }

  const country = upload.country.trim().toUpperCase();
  if (country === 'UK') {
    if (identifiers.gmcNumber) return 'GMC';
    if (identifiers.nmcPin) return 'NMC';
    return 'IMG';
  }

  if (country === 'EU' || country === 'EEA' || country.startsWith('EU-')) {
    if (identifiers.euDirectiveId) return 'EU-Directive';
    return 'EU-Directive';
  }

  return 'IMG';
}










