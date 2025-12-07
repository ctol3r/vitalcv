/**
 * COMP-003: NCQA CR1-CR5 Evidence Logging Service
 *
 * Provides hooks to log credential verification events with NCQA compliance
 * dimensions (PSV source, method, date, reviewer) and services to query/export
 * this data for audits.
 */

import { PrismaClient } from '@prisma/client';

export type NCQARule = 'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5';
export type PSVSource = 'API' | 'PRIMARY_WEBSITE' | 'CVO' | 'MANUAL' | 'EMAIL' | 'PHONE' | 'FAX';
export type PSVMethod = 'API_CALL' | 'WEB_SCRAPING' | 'EMAIL' | 'PHONE' | 'FAX' | 'IN_PERSON';
export type VerificationResult = 'VERIFIED' | 'PENDING' | 'FAILED' | 'NOT_FOUND' | 'EXPIRED';

export interface NCQAEvidenceInput {
  credentialId?: string;
  eventType: string;
  ncqaRule: NCQARule;
  psvSource: PSVSource;
  psvMethod: PSVMethod;
  psvDate: Date;
  sourceUrl?: string;
  reviewerId?: string;
  reviewerName?: string;
  verificationResult: VerificationResult;
  evidenceData?: Record<string, any>;
}

export interface NCQAEvidenceQuery {
  credentialId?: string;
  ncqaRule?: NCQARule;
  psvSource?: PSVSource;
  verificationResult?: VerificationResult;
  startDate?: Date;
  endDate?: Date;
  reviewerId?: string;
}

export class NCQAEvidenceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log NCQA evidence for a credential verification event
   */
  async logEvidence(input: NCQAEvidenceInput): Promise<string> {
    const evidence = await this.prisma.nCQAEvidence.create({
      data: {
        credentialId: input.credentialId,
        eventType: input.eventType,
        ncqaRule: input.ncqaRule,
        psvSource: input.psvSource,
        psvMethod: input.psvMethod,
        psvDate: input.psvDate,
        sourceUrl: input.sourceUrl,
        reviewerId: input.reviewerId,
        reviewerName: input.reviewerName,
        verificationResult: input.verificationResult,
        evidenceData: input.evidenceData as any,
      },
    });

    return evidence.id;
  }

  /**
   * Log CR1 evidence (Primary source licensure verification)
   */
  async logCR1Evidence(params: {
    credentialId: string;
    psvSource: PSVSource;
    psvMethod: PSVMethod;
    sourceUrl?: string;
    verificationResult: VerificationResult;
    reviewerId?: string;
    reviewerName?: string;
    evidenceData?: Record<string, any>;
  }): Promise<string> {
    return this.logEvidence({
      credentialId: params.credentialId,
      eventType: 'CR1_VERIFICATION',
      ncqaRule: 'CR1',
      psvSource: params.psvSource,
      psvMethod: params.psvMethod,
      psvDate: new Date(),
      sourceUrl: params.sourceUrl,
      reviewerId: params.reviewerId,
      reviewerName: params.reviewerName,
      verificationResult: params.verificationResult,
      evidenceData: params.evidenceData,
    });
  }

  /**
   * Log CR2 evidence (Sanctions check)
   */
  async logCR2Evidence(params: {
    credentialId?: string;
    psvSource: PSVSource;
    psvMethod: PSVMethod;
    sourceUrl?: string;
    verificationResult: VerificationResult;
    reviewerId?: string;
    reviewerName?: string;
    evidenceData?: Record<string, any>;
  }): Promise<string> {
    return this.logEvidence({
      credentialId: params.credentialId,
      eventType: 'CR2_SANCTIONS_CHECK',
      ncqaRule: 'CR2',
      psvSource: params.psvSource,
      psvMethod: params.psvMethod,
      psvDate: new Date(),
      sourceUrl: params.sourceUrl,
      reviewerId: params.reviewerId,
      reviewerName: params.reviewerName,
      verificationResult: params.verificationResult,
      evidenceData: params.evidenceData,
    });
  }

  /**
   * Query NCQA evidence records
   */
  async queryEvidence(query: NCQAEvidenceQuery) {
    const where: any = {};

    if (query.credentialId) {
      where.credentialId = query.credentialId;
    }

    if (query.ncqaRule) {
      where.ncqaRule = query.ncqaRule;
    }

    if (query.psvSource) {
      where.psvSource = query.psvSource;
    }

    if (query.verificationResult) {
      where.verificationResult = query.verificationResult;
    }

    if (query.reviewerId) {
      where.reviewerId = query.reviewerId;
    }

    if (query.startDate || query.endDate) {
      where.psvDate = {};
      if (query.startDate) {
        where.psvDate.gte = query.startDate;
      }
      if (query.endDate) {
        where.psvDate.lte = query.endDate;
      }
    }

    return this.prisma.nCQAEvidence.findMany({
      where,
      orderBy: {
        psvDate: 'desc',
      },
    });
  }

  /**
   * Export evidence for a specific credential (for audit packets)
   */
  async exportCredentialEvidence(credentialId: string) {
    return this.queryEvidence({ credentialId });
  }

  /**
   * Export evidence for a specific NCQA rule within a date range
   */
  async exportRuleEvidence(ncqaRule: NCQARule, startDate: Date, endDate: Date) {
    return this.queryEvidence({
      ncqaRule,
      startDate,
      endDate,
    });
  }

  /**
   * Generate audit report summary
   */
  async generateAuditReport(params: {
    startDate: Date;
    endDate: Date;
    ncqaRule?: NCQARule;
  }) {
    const evidence = await this.queryEvidence({
      ncqaRule: params.ncqaRule,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const summary = {
      totalRecords: evidence.length,
      byRule: {} as Record<NCQARule, number>,
      bySource: {} as Record<PSVSource, number>,
      byMethod: {} as Record<PSVMethod, number>,
      byResult: {} as Record<VerificationResult, number>,
      dateRange: {
        start: params.startDate,
        end: params.endDate,
      },
      records: evidence,
    };

    for (const record of evidence) {
      // Count by rule
      summary.byRule[record.ncqaRule as NCQARule] =
        (summary.byRule[record.ncqaRule as NCQARule] || 0) + 1;

      // Count by source
      summary.bySource[record.psvSource as PSVSource] =
        (summary.bySource[record.psvSource as PSVSource] || 0) + 1;

      // Count by method
      summary.byMethod[record.psvMethod as PSVMethod] =
        (summary.byMethod[record.psvMethod as PSVMethod] || 0) + 1;

      // Count by result
      summary.byResult[record.verificationResult as VerificationResult] =
        (summary.byResult[record.verificationResult as VerificationResult] || 0) + 1;
    }

    return summary;
  }

  /**
   * Get evidence for a specific credential and rule
   */
  async getCredentialRuleEvidence(credentialId: string, ncqaRule: NCQARule) {
    return this.queryEvidence({
      credentialId,
      ncqaRule,
    });
  }
}

