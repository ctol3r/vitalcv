/**
 * documentPipeline.ts — Wave 47: Zero-Manual-Lift Document Intelligence
 *
 * Ingestion pipeline for uploaded medical licenses, certifications, and IDs.
 * Uses OCR/Vision model stubs to extract structured data with confidence scores.
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number; // 0.0 to 1.0
}

export type DocumentType =
  | 'MEDICAL_LICENSE'
  | 'DEA_CERTIFICATE'
  | 'BOARD_CERTIFICATION'
  | 'GOVERNMENT_ID'
  | 'UNKNOWN';

export interface DocumentExtractionResult {
  documentId: string;
  documentType: DocumentType;
  extractedFields: ExtractedField[];
  overallConfidence: number;
  rawOcrText: string;
  processingTimeMs: number;
}

export interface PipelineConfig {
  confidenceThreshold: number;
  maxRetries: number;
  ocrProvider: 'vision_model' | 'tesseract';
}

const DEFAULT_CONFIG: PipelineConfig = {
  confidenceThreshold: 0.95,
  maxRetries: 2,
  ocrProvider: 'vision_model',
};

// ── Classification ─────────────────────────────────────────────────

const DOCUMENT_TYPE_KEYWORDS: Record<DocumentType, string[]> = {
  MEDICAL_LICENSE: ['medical license', 'license to practice', 'physician license', 'state medical board'],
  DEA_CERTIFICATE: ['dea registration', 'drug enforcement', 'controlled substance', 'dea number'],
  BOARD_CERTIFICATION: ['board certified', 'board certification', 'diplomate', 'specialty board'],
  GOVERNMENT_ID: ['driver license', 'passport', 'identification card', 'department of motor'],
  UNKNOWN: [],
};

function classifyDocumentType(ocrText: string): DocumentType {
  const lowerText = ocrText.toLowerCase();

  for (const [docType, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    if (docType === 'UNKNOWN') continue;
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return docType as DocumentType;
    }
  }

  return 'UNKNOWN';
}

// ── Field Extraction ───────────────────────────────────────────────

interface FieldPattern {
  field: string;
  patterns: RegExp[];
  baseConfidence: number;
}

const FIELD_PATTERNS: FieldPattern[] = [
  {
    field: 'fullName',
    patterns: [/name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i, /(?:dr\.?\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*M\.?D\.?/i],
    baseConfidence: 0.85,
  },
  {
    field: 'licenseNumber',
    patterns: [/license\s*(?:#|number|no\.?)[:\s]*([A-Z]?\d{4,10})/i, /(?:lic|license)[:\s]*([A-Z]{1,3}\d{4,8})/i],
    baseConfidence: 0.90,
  },
  {
    field: 'licenseState',
    patterns: [/state\s*(?:of)?\s*:?\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)/i, /\b(CA|NY|TX|FL|PA|OH|IL|GA|NC|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC)\b/],
    baseConfidence: 0.88,
  },
  {
    field: 'expirationDate',
    patterns: [/expir(?:es|ation)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i, /valid\s+(?:through|until)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i],
    baseConfidence: 0.87,
  },
  {
    field: 'licenseType',
    patterns: [/type[:\s]*(MD|DO|DPM|DDS|DMD|PharmD|RN|NP|PA|DC)/i, /(?:doctor of\s+)?(medicine|osteopathy|podiatry|dental)/i],
    baseConfidence: 0.82,
  },
];

function extractFieldsFromText(ocrText: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  for (const fp of FIELD_PATTERNS) {
    let matched = false;
    for (const pattern of fp.patterns) {
      const match = ocrText.match(pattern);
      if (match?.[1]) {
        fields.push({
          field: fp.field,
          value: match[1].trim(),
          confidence: fp.baseConfidence,
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      fields.push({ field: fp.field, value: '', confidence: 0 });
    }
  }

  return fields;
}

// ── OCR Stub ───────────────────────────────────────────────────────

/**
 * TODO: Production implementation — integrate with a Vision API (e.g. Google
 * Cloud Vision, AWS Textract, or an on-premise Tesseract deployment) to
 * perform real OCR on the document buffer. The stub below returns placeholder
 * text that exercises the downstream extraction logic.
 */
async function performOcr(
  _fileBuffer: Buffer,
  _mimeType: string,
  _config: PipelineConfig,
): Promise<string> {
  log('info', 'document_pipeline_ocr_stub', {
    note: 'Using stub OCR — replace with Vision API for production',
  });

  return [
    'STATE OF CALIFORNIA',
    'Medical Board of California',
    'License to Practice Medicine',
    '',
    'Name: Jane A. Smith, M.D.',
    'License Number: A123456',
    'License Type: MD',
    'State: CA',
    'Issued: 01/15/2020',
    'Expiration: 01/15/2026',
    '',
    'This license is valid through the expiration date above.',
  ].join('\n');
}

// ── Public API ─────────────────────────────────────────────────────

async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  config?: Partial<PipelineConfig>,
): Promise<DocumentExtractionResult> {
  const merged: PipelineConfig = { ...DEFAULT_CONFIG, ...config };
  const startMs = Date.now();

  const rawOcrText = await performOcr(fileBuffer, mimeType, merged);
  const documentType = classifyDocumentType(rawOcrText);
  const extractedFields = extractFieldsFromText(rawOcrText);

  const fieldsWithValues = extractedFields.filter((f) => f.value !== '');
  const overallConfidence =
    fieldsWithValues.length > 0
      ? fieldsWithValues.reduce((sum, f) => sum + f.confidence, 0) / fieldsWithValues.length
      : 0;

  const result: DocumentExtractionResult = {
    documentId: randomUUID(),
    documentType,
    extractedFields,
    overallConfidence,
    rawOcrText,
    processingTimeMs: Date.now() - startMs,
  };

  log('info', 'document_pipeline_extraction_complete', {
    documentId: result.documentId,
    documentType: result.documentType,
    fieldCount: fieldsWithValues.length,
    overallConfidence: result.overallConfidence,
    processingTimeMs: result.processingTimeMs,
  });

  return result;
}

export const documentPipeline = { extractFromDocument, classifyDocumentType };
