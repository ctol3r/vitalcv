import type { ChainReceipt } from '../chain/client';
import { AuditAnchorService, anchorOcrExtraction } from '../audit/anchor';
import {
  type LicenseFields,
  type OcrPayload,
  mapLicenseFieldsFromOcr,
} from './ocr/rules';
import {
  type TemplateDetectionResult,
  detectLicenseTemplate,
  type TemplateDetectionInput,
} from './templates';

export interface PsvOcrSource {
  payload?: OcrPayload;
  rawText?: string;
  documentBuffer?: ArrayBuffer | Buffer;
  metadata?: TemplateDetectionInput['metadata'];
}

export interface PsvOcrRequest {
  clinicianId: string;
  documentId: string;
  source: PsvOcrSource;
  vendorConfidence?: number;
  autoVerifyThreshold?: number;
  anchor?: boolean;
  extra?: Record<string, unknown>;
}

export type PsvDecisionStatus = 'AUTO_VERIFIED' | 'HITL';

export interface PsvDecision {
  status: PsvDecisionStatus;
  confidence: number;
  fields: LicenseFields;
  template: TemplateDetectionResult;
  hitlTicketId?: string;
  reason?: string;
  anchorReceipt?: ChainReceipt | null;
  decidedAt: string;
}

export interface HitlQueue {
  enqueue(payload: HitlTicketPayload): Promise<string>;
}

export interface HitlTicketPayload {
  clinicianId: string;
  documentId: string;
  fields: LicenseFields;
  confidence: number;
  vendorConfidence?: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface PsvOcrEngineOptions {
  autoVerifyThreshold?: number;
  hitlQueue?: HitlQueue;
  anchorService?: AuditAnchorService;
}

const DEFAULT_THRESHOLD = 0.85;

export class InMemoryHitlQueue implements HitlQueue {
  private readonly tickets: HitlTicketPayload[] = [];

  async enqueue(payload: HitlTicketPayload): Promise<string> {
    const ticketId = `hitl_${Date.now()}_${this.tickets.length + 1}`;
    this.tickets.push(payload);
    return ticketId;
  }

  getPendingTickets(): HitlTicketPayload[] {
    return [...this.tickets];
  }
}

export class PsvOcrEngine {
  private readonly threshold: number;
  private readonly hitlQueue: HitlQueue;
  private readonly anchorService?: AuditAnchorService;

  constructor(options: PsvOcrEngineOptions = {}) {
    this.threshold = options.autoVerifyThreshold ?? DEFAULT_THRESHOLD;
    this.hitlQueue = options.hitlQueue ?? new InMemoryHitlQueue();
    this.anchorService = options.anchorService ?? new AuditAnchorService();
  }

  async process(request: PsvOcrRequest): Promise<PsvDecision> {
    const payload = await this.resolvePayload(request.source);
    const fields = mapLicenseFieldsFromOcr(payload);
    const template = detectLicenseTemplate({
      text: fields.rawText,
      metadata: request.source.metadata ?? payload.metadata,
    });

    const confidence = computeConfidenceScore(fields, request.vendorConfidence);
    const decidedAt = new Date().toISOString();

    let anchorReceipt: ChainReceipt | null = null;
    if (request.anchor !== false) {
      anchorReceipt = await anchorOcrExtraction({
        clinicianId: request.clinicianId,
        documentId: request.documentId,
        ocrHashSource: payload.fullText ?? fields.rawText,
        fields,
        template,
        metadata: request.extra ?? {},
        auditService: this.anchorService,
      }).catch((error) => {
        console.warn('[PSV][Engine] Failed to anchor OCR extraction', error);
        return null;
      });
    }

    if (confidence < (request.autoVerifyThreshold ?? this.threshold)) {
      const reason =
        'Confidence below automated verification threshold; routed to human-in-the-loop queue';
      const hitlTicketId = await this.hitlQueue.enqueue({
        clinicianId: request.clinicianId,
        documentId: request.documentId,
        fields,
        confidence,
        vendorConfidence: request.vendorConfidence,
        reason,
        metadata: request.extra,
      });

      return {
        status: 'HITL',
        confidence,
        fields,
        template,
        hitlTicketId,
        reason,
        anchorReceipt,
        decidedAt,
      };
    }

    return {
      status: 'AUTO_VERIFIED',
      confidence,
      fields,
      template,
      anchorReceipt,
      decidedAt,
    };
  }

  private async resolvePayload(source: PsvOcrSource): Promise<OcrPayload> {
    if (source.payload) return source.payload;
    if (source.rawText) {
      return {
        fullText: source.rawText,
        metadata: source.metadata,
      };
    }
    if (source.documentBuffer) {
      const text = this.bufferToAscii(source.documentBuffer);
      return {
        fullText: text,
        metadata: source.metadata,
      };
    }
    return { fullText: '', metadata: source.metadata };
  }

  private bufferToAscii(buffer: ArrayBuffer | Buffer): string {
    if (buffer instanceof Buffer) {
      return buffer.toString('utf-8');
    }
    return Buffer.from(buffer).toString('utf-8');
  }
}

function computeConfidenceScore(fields: LicenseFields, vendorConfidence = 0.6): number {
  const weights: Record<keyof Pick<LicenseFields, 'licenseNumber' | 'expirationDate' | 'stateCode'>, number> =
    {
      licenseNumber: 0.4,
      expirationDate: 0.35,
      stateCode: 0.25,
    };

  let coverage = 0;
  coverage += fields.licenseNumber ? weights.licenseNumber : 0;
  coverage += fields.expirationDate ? weights.expirationDate : 0;
  coverage += fields.stateCode ? weights.stateCode : 0;

  const composite = coverage * 0.8 + vendorConfidence * 0.2;
  return Number(Math.max(0, Math.min(1, composite)).toFixed(4));
}











