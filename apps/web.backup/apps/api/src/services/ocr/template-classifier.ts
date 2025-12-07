import { PrismaClient, type LicenseTemplate as LicenseTemplateModel } from '@prisma/client';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateKeypoint {
  field: string;
  bbox: BoundingBox;
  anchorText?: string;
  regex?: string;
}

export interface TemplateFeatureSet {
  keypoints: TemplateKeypoint[];
  sampleText?: string[];
  layoutVector?: number[];
  dpi?: number;
  version?: string;
  notes?: string;
}

export interface DocumentLayoutFeatures {
  textBlocks: Array<{ text: string; bbox: BoundingBox }>;
  detectedKeypoints?: Array<{ label: string; bbox: BoundingBox; text?: string }>;
  dpi?: number;
  width?: number;
  height?: number;
}

export interface TemplateClassification {
  templateId: string | null;
  confidence: number;
  candidates: Array<{
    templateId: string;
    confidence: number;
    label: string;
  }>;
}

interface TemplateIndexEntry {
  template: LicenseTemplateModel;
  features: TemplateFeatureSet;
  embedding: number[];
  tokens: Set<string>;
}

const prisma = new PrismaClient();

export class LicenseTemplateClassifier {
  private index: Map<string, TemplateIndexEntry> | null = null;

  constructor(private readonly client: PrismaClient = prisma) {}

  async refresh(): Promise<void> {
    const templates = await this.client.licenseTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    this.index = new Map(
      templates.map((template) => {
        const features = coerceTemplateFeatures(template.features);
        const embedding = buildTemplateEmbedding(features);
        const tokens = buildTokenSet(features.sampleText ?? []);
        return [
          template.id,
          {
            template,
            features,
            embedding,
            tokens,
          },
        ];
      }),
    );
  }

  async classify(document: DocumentLayoutFeatures): Promise<TemplateClassification> {
    await this.ensureIndex();
    if (!this.index || this.index.size === 0) {
      return {
        templateId: null,
        confidence: 0,
        candidates: [],
      };
    }

    const docEmbedding = buildDocumentEmbedding(document);
    const docTokens = buildTokenSet(document.textBlocks.map((block) => block.text));
    const docDpi = document.dpi ?? null;

    const scores: Array<{ templateId: string; confidence: number; label: string }> = [];
    for (const [templateId, entry] of this.index.entries()) {
      const similarity = cosineSimilarity(docEmbedding, entry.embedding);
      const lexicalScore = jaccardSimilarity(docTokens, entry.tokens);
      const dpiScore = deriveDpiScore(entry.features.dpi ?? null, docDpi);
      const confidence = Number((similarity * 0.6 + lexicalScore * 0.25 + dpiScore * 0.15).toFixed(3));
      scores.push({
        templateId,
        confidence,
        label: `${entry.template.state} v${entry.template.version}`,
      });
    }

    scores.sort((a, b) => b.confidence - a.confidence);
    const best = scores[0];
    if (!best || best.confidence < 0.45) {
      return {
        templateId: null,
        confidence: best?.confidence ?? 0,
        candidates: scores.slice(0, 3),
      };
    }

    return {
      templateId: best.templateId,
      confidence: best.confidence,
      candidates: scores.slice(0, 3),
    };
  }

  private async ensureIndex() {
    if (!this.index) {
      await this.refresh();
    }
  }
}

export function coerceTemplateFeatures(raw: unknown): TemplateFeatureSet {
  if (!raw || typeof raw !== 'object') {
    return { keypoints: [] };
  }
  const record = raw as Record<string, unknown>;
  const keypoints = Array.isArray(record.keypoints)
    ? (record.keypoints as TemplateKeypoint[]).map((keypoint) => ({
        field: keypoint.field,
        bbox: normalizeBoundingBox(keypoint.bbox),
        anchorText: keypoint.anchorText,
        regex: keypoint.regex,
      }))
    : [];
  const sampleText = Array.isArray(record.sampleText)
    ? (record.sampleText as unknown[]).map((text) => String(text))
    : undefined;
  const layoutVector = Array.isArray(record.layoutVector)
    ? (record.layoutVector as unknown[]).map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : undefined;

  return {
    keypoints,
    sampleText,
    layoutVector,
    dpi: typeof record.dpi === 'number' ? record.dpi : undefined,
    version: typeof record.version === 'string' ? record.version : undefined,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
  };
}

function buildTemplateEmbedding(features: TemplateFeatureSet): number[] {
  if (features.layoutVector?.length) {
    return features.layoutVector;
  }

  if (!features.keypoints.length) {
    return [0, 0, 0, 0, 0, 0, 0];
  }

  const centers = features.keypoints.map((keypoint) => ({
    cx: keypoint.bbox.x + keypoint.bbox.width / 2,
    cy: keypoint.bbox.y + keypoint.bbox.height / 2,
  }));
  const avgX = centers.reduce((sum, point) => sum + point.cx, 0) / centers.length;
  const avgY = centers.reduce((sum, point) => sum + point.cy, 0) / centers.length;
  const spreadX =
    Math.sqrt(centers.reduce((sum, point) => sum + Math.pow(point.cx - avgX, 2), 0) / centers.length) || 0.01;
  const spreadY =
    Math.sqrt(centers.reduce((sum, point) => sum + Math.pow(point.cy - avgY, 2), 0) / centers.length) || 0.01;
  const keypointDensity = Math.min(1, features.keypoints.length / 12);
  const lexicalRichness = computeLexicalRichness(features.sampleText ?? []);
  const anchorCoverage =
    Math.min(1, features.keypoints.filter((keypoint) => Boolean(keypoint.anchorText)).length / (features.keypoints.length || 1));

  return [
    avgX,
    avgY,
    spreadX,
    spreadY,
    keypointDensity,
    lexicalRichness,
    anchorCoverage,
  ].map((value) => Number(value.toFixed(4)));
}

function buildDocumentEmbedding(document: DocumentLayoutFeatures): number[] {
  if (!document.textBlocks.length) {
    return [0, 0, 0, 0, 0, 0, 0];
  }

  const centers = document.textBlocks.map((block) => ({
    cx: block.bbox.x + block.bbox.width / 2,
    cy: block.bbox.y + block.bbox.height / 2,
  }));
  const avgX = centers.reduce((sum, point) => sum + point.cx, 0) / centers.length;
  const avgY = centers.reduce((sum, point) => sum + point.cy, 0) / centers.length;
  const spreadX =
    Math.sqrt(centers.reduce((sum, point) => sum + Math.pow(point.cx - avgX, 2), 0) / centers.length) || 0.01;
  const spreadY =
    Math.sqrt(centers.reduce((sum, point) => sum + Math.pow(point.cy - avgY, 2), 0) / centers.length) || 0.01;
  const keypointDensity = Math.min(
    1,
    (document.detectedKeypoints?.length ?? document.textBlocks.length) / 12,
  );
  const lexicalRichness = computeLexicalRichness(document.textBlocks.map((block) => block.text));
  const anchorCoverage = document.detectedKeypoints?.length ? Math.min(1, document.detectedKeypoints.length / 12) : 0.2;

  return [
    avgX,
    avgY,
    spreadX,
    spreadY,
    keypointDensity,
    lexicalRichness,
    anchorCoverage,
  ].map((value) => Number(value.toFixed(4)));
}

function normalizeBoundingBox(box?: BoundingBox): BoundingBox {
  if (!box) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: clamp(box.x),
    y: clamp(box.y),
    width: clamp(box.width),
    height: clamp(box.height),
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}

function computeLexicalRichness(lines: string[]): number {
  if (!lines.length) return 0;
  const tokens = buildTokenSet(lines);
  const totalTokens = lines.join(' ').split(/\s+/).filter(Boolean).length || 1;
  return Math.min(1, tokens.size / totalTokens);
}

function buildTokenSet(lines: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const line of lines) {
    line
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 2 && token.length < 24)
      .forEach((token) => tokens.add(token));
  }
  return tokens;
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += 1;
  });
  return Number((intersection / (left.size + right.size - intersection)).toFixed(3));
}

function deriveDpiScore(expected: number | null, observed: number | null): number {
  if (!expected || !observed) return 0.5;
  const delta = Math.abs(expected - observed);
  if (delta <= 5) return 1;
  if (delta <= 15) return 0.7;
  if (delta <= 30) return 0.4;
  return 0.1;
}










