import type { BoundingBox, DocumentLayoutFeatures, TemplateFeatureSet } from './template-classifier';
import type { KeypointExtractionResult } from './keypoint-extract';

export interface AnomalyDetectionInput {
  template: TemplateFeatureSet;
  extraction: KeypointExtractionResult;
  document: DocumentLayoutFeatures & {
    fileSizeKb?: number;
  };
}

export interface AnomalyReason {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metric?: number;
  threshold?: number;
}

export interface AnomalyDetectionResult {
  anomalyScore: number;
  reasons: AnomalyReason[];
}

export function detectOcrAnomalies(input: AnomalyDetectionInput): AnomalyDetectionResult {
  const reasons: AnomalyReason[] = [];

  const displacement = computeKeypointDisplacement(input.template, input.extraction);
  if (displacement.evaluated > 0 && displacement.averageIoU < 0.55) {
    reasons.push({
      code: 'keypoint_drift',
      severity: displacement.averageIoU < 0.35 ? 'high' : 'medium',
      message: `Keypoint overlap ${Math.round(displacement.averageIoU * 100)}% across ${displacement.evaluated} anchors`,
      metric: displacement.averageIoU,
      threshold: 0.55,
    });
  }

  const dpiReason = computeDpiDeviation(input.template.dpi, input.document.dpi);
  if (dpiReason) {
    reasons.push(dpiReason);
  }

  const boundingReason = computeBoundingBoxMismatch(input.template, input.document);
  if (boundingReason) {
    reasons.push(boundingReason);
  }

  const fallbackFields = input.extraction.traces.filter((trace) => trace.method !== 'keypoint');
  if (fallbackFields.length) {
    reasons.push({
      code: 'keypoint_missing',
      severity: fallbackFields.length > 1 ? 'medium' : 'low',
      message: `${fallbackFields.length} fields required regex fallback`,
    });
  }

  const anomalyScore = Number(
    Math.min(1, reasons.reduce((sum, reason) => sum + severityWeight(reason.severity), 0)).toFixed(3),
  );

  return {
    anomalyScore,
    reasons,
  };
}

function computeKeypointDisplacement(
  template: TemplateFeatureSet,
  extraction: KeypointExtractionResult,
): { evaluated: number; averageIoU: number } {
  const templatePoints = template.keypoints.reduce<Record<string, BoundingBox>>((acc, keypoint) => {
    acc[keypoint.field.toLowerCase()] = keypoint.bbox;
    return acc;
  }, {});

  const documentPoints = extraction.overlays
    .filter((overlay) => overlay.source === 'document')
    .reduce<Record<string, BoundingBox>>((acc, overlay) => {
      acc[overlay.label.toLowerCase()] = overlay.bbox;
      return acc;
    }, {});

  const templateLabels = Object.keys(templatePoints);
  if (!templateLabels.length) {
    return { evaluated: 0, averageIoU: 1 };
  }

  const overlaps: number[] = [];
  for (const label of templateLabels) {
    const docBox = documentPoints[label];
    if (!docBox) continue;
    overlaps.push(intersectionOverUnion(templatePoints[label], docBox));
  }

  if (overlaps.length === 0) {
    return { evaluated: 0, averageIoU: 0 };
  }

  const averageIoU = overlaps.reduce((sum, value) => sum + value, 0) / overlaps.length;
  return { evaluated: overlaps.length, averageIoU };
}

function computeDpiDeviation(expected?: number, observed?: number | null): AnomalyReason | null {
  if (!expected || !observed) return null;
  const delta = Math.abs(expected - observed);
  if (delta < 12) return null;
  return {
    code: 'dpi_inconsistent',
    severity: delta > 30 ? 'high' : 'medium',
    message: `DPI mismatch (${observed} vs expected ${expected})`,
    metric: delta,
    threshold: 12,
  };
}

function computeBoundingBoxMismatch(
  template: TemplateFeatureSet,
  document: DocumentLayoutFeatures,
): AnomalyReason | null {
  if (!template.keypoints.length || !document.textBlocks.length) {
    return null;
  }

  const templateSpread = variance(template.keypoints.map((keypoint) => keypoint.bbox.x + keypoint.bbox.width / 2));
  const documentSpread = variance(document.textBlocks.map((block) => block.bbox.x + block.bbox.width / 2));
  const spreadDelta = Math.abs(templateSpread - documentSpread);

  if (spreadDelta < 0.05) {
    return null;
  }

  return {
    code: 'layout_spread',
    severity: spreadDelta > 0.15 ? 'medium' : 'low',
    message: `Detected layout drift (${spreadDelta.toFixed(2)} deviation)`,
    metric: Number(spreadDelta.toFixed(3)),
    threshold: 0.05,
  };
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

function variance(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const total = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
  return total / values.length;
}

function severityWeight(severity: AnomalyReason['severity']): number {
  switch (severity) {
    case 'high':
      return 0.45;
    case 'medium':
      return 0.25;
    default:
      return 0.12;
  }
}

