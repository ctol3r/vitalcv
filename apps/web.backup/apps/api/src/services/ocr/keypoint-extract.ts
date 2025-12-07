import { PrismaClient } from '@prisma/client';

import {
  type LicenseFields,
  mapLicenseFieldsFromOcr,
  type OcrFieldCandidate,
} from '../psv/ocr/rules';
import {
  type BoundingBox,
  type DocumentLayoutFeatures,
  coerceTemplateFeatures,
} from './template-classifier';

const prisma = new PrismaClient();

export interface KeypointExtractionInput {
  templateId: string;
  document: DocumentLayoutFeatures;
}

export interface FieldExtractionTrace {
  field: keyof Pick<LicenseFields, 'licenseNumber' | 'expirationDate' | 'stateCode' | 'issueDate' | 'holderName' | 'addressLine'>;
  method: 'keypoint' | 'regex' | 'fallback';
  confidence: number;
  value: string | null;
  notes?: string;
}

export interface KeypointExtractionResult {
  fields: LicenseFields;
  traces: FieldExtractionTrace[];
  overlays: Array<{
    label: string;
    bbox: BoundingBox;
    confidence: number;
    source: 'template' | 'document';
  }>;
  templateVersion?: string;
}

type CanonicalField = 'licenseNumber' | 'expirationDate' | 'stateCode';

export async function extractKeypointFields(
  input: KeypointExtractionInput,
): Promise<KeypointExtractionResult> {
  const template = await prisma.licenseTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!template) {
    throw new Error(`License template ${input.templateId} not found`);
  }

  const features = coerceTemplateFeatures(template.features);
  const keypointMatches = matchKeypoints(features.keypoints, input.document);
  const payloadFields: OcrFieldCandidate[] = buildFieldCandidates(keypointMatches, input.document);
  const ocrPayload = {
    fullText: input.document.textBlocks.map((block) => block.text).join('\n'),
    fields: payloadFields,
  };
  const fields = mapLicenseFieldsFromOcr(ocrPayload);
  overrideWithKeypoints(fields, keypointMatches);

  const traces: FieldExtractionTrace[] = buildTraces(fields, keypointMatches);
  const overlays = buildOverlays(features.keypoints, input.document, keypointMatches);

  return {
    fields,
    traces,
    overlays,
    templateVersion: template.version,
  };
}

function matchKeypoints(
  keypoints: Array<{ field: string; bbox: BoundingBox }>,
  document: DocumentLayoutFeatures,
) {
  const matches: Partial<Record<CanonicalField, { value: string; confidence: number; bbox: BoundingBox }>> = {};

  for (const keypoint of keypoints) {
    const canonicalField = resolveFieldName(keypoint.field);
    if (!canonicalField) continue;

    const match = findNearestTextBlock(keypoint.bbox, document);
    if (!match) continue;

    const confidence = Number((match.score).toFixed(3));
    matches[canonicalField] = {
      value: match.text,
      confidence,
      bbox: match.bbox,
    };
  }

  return matches;
}

function findNearestTextBlock(
  target: BoundingBox,
  document: DocumentLayoutFeatures,
): { text: string; bbox: BoundingBox; score: number } | null {
  const candidates = document.detectedKeypoints ?? document.textBlocks;
  if (!candidates.length) return null;

  let best: { text: string; bbox: BoundingBox; score: number } | null = null;
  for (const candidate of candidates) {
    const bbox: BoundingBox = 'bbox' in candidate ? candidate.bbox : target;
    const text = 'text' in candidate && candidate.text ? candidate.text : ('label' in candidate ? candidate.label ?? '' : '');
    if (!text.trim()) continue;
    const score = computeMatchScore(target, bbox);
    if (!best || score > best.score) {
      best = {
        text: text.trim(),
        bbox,
        score,
      };
    }
  }

  return best;
}

function buildFieldCandidates(
  matches: Partial<Record<CanonicalField, { value: string; confidence: number }>>,
  document: DocumentLayoutFeatures,
): OcrFieldCandidate[] {
  const candidates: OcrFieldCandidate[] = [];
  for (const [field, match] of Object.entries(matches)) {
    if (!match) continue;
    candidates.push({
      label: field,
      value: match.value,
      confidence: match.confidence,
    });
  }

  document.textBlocks.slice(0, 20).forEach((block) => {
    candidates.push({
      label: undefined,
      value: block.text,
      confidence: 0.35,
    });
  });

  return candidates;
}

function overrideWithKeypoints(
  fields: LicenseFields,
  matches: Partial<Record<CanonicalField, { value: string; confidence: number }>>,
) {
  if (matches.licenseNumber) {
    fields.licenseNumber = matches.licenseNumber.value;
    fields.matches.licenseNumber = matches.licenseNumber.value;
    fields.confidences.licenseNumber = matches.licenseNumber.confidence;
  }
  if (matches.expirationDate) {
    fields.expirationDate = matches.expirationDate.value;
    fields.matches.expirationDate = matches.expirationDate.value;
    fields.confidences.expirationDate = matches.expirationDate.confidence;
  }
  if (matches.stateCode) {
    fields.stateCode = matches.stateCode.value;
    fields.matches.stateCode = matches.stateCode.value;
    fields.confidences.stateCode = matches.stateCode.confidence;
  }
}

function buildTraces(
  fields: LicenseFields,
  matches: Partial<Record<CanonicalField, { value: string; confidence: number }>>,
): FieldExtractionTrace[] {
  const canonicalFields: CanonicalField[] = ['licenseNumber', 'expirationDate', 'stateCode'];
  return canonicalFields.map((field) => ({
    field,
    method: matches[field] ? 'keypoint' : fields.matches[field] ? 'regex' : 'fallback',
    confidence: matches[field]?.confidence ?? fields.confidences[field] ?? 0,
    value: fields[field],
    notes: matches[field] ? 'Template keypoint matched' : undefined,
  }));
}

function buildOverlays(
  keypoints: Array<{ field: string; bbox: BoundingBox }>,
  document: DocumentLayoutFeatures,
  matches: Partial<Record<CanonicalField, { bbox: BoundingBox; confidence: number }>>,
): KeypointExtractionResult['overlays'] {
  const overlays: KeypointExtractionResult['overlays'] = [];
  keypoints.forEach((keypoint) => {
    overlays.push({
      label: keypoint.field,
      bbox: keypoint.bbox,
      confidence: 0.4,
      source: 'template',
    });
  });

  Object.entries(matches).forEach(([field, match]) => {
    if (!match) return;
    overlays.push({
      label: field,
      bbox: match.bbox,
      confidence: match.confidence,
      source: 'document',
    });
  });

  (document.detectedKeypoints ?? []).forEach((detected) => {
    overlays.push({
      label: detected.label ?? 'detected',
      bbox: detected.bbox,
      confidence: 0.35,
      source: 'document',
    });
  });

  return overlays;
}

function resolveFieldName(field: string): CanonicalField | null {
  const normalized = field.toLowerCase();
  if (normalized.includes('license')) return 'licenseNumber';
  if (normalized.includes('exp') || normalized.includes('valid')) return 'expirationDate';
  if (normalized.includes('state') || normalized.includes('jurisdiction')) return 'stateCode';
  return null;
}

function computeMatchScore(target: BoundingBox, candidate: BoundingBox): number {
  const iou = intersectionOverUnion(target, candidate);
  const centerDistance = Math.sqrt(
    Math.pow(target.x + target.width / 2 - (candidate.x + candidate.width / 2), 2) +
      Math.pow(target.y + target.height / 2 - (candidate.y + candidate.height / 2), 2),
  );
  const distanceScore = Math.max(0, 1 - centerDistance);
  return Math.min(1, iou * 0.7 + distanceScore * 0.3);
}

function intersectionOverUnion(a: BoundingBox, b: BoundingBox): number {
  const xLeft = Math.max(a.x, b.x);
  const yTop = Math.max(a.y, b.y);
  const xRight = Math.min(a.x + a.width, b.x + b.width);
  const yBottom = Math.min(a.y + a.height, b.y + b.height);
  if (xRight <= xLeft || yBottom <= yTop) return 0;

  const intersection = (xRight - xLeft) * (yBottom - yTop);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;
  return union === 0 ? 0 : intersection / union;
}










