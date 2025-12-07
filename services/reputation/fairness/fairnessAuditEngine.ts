/**
 * B224B-REP-008: FairnessAuditEngine
 *
 * Regularly audits the reputation algorithm for biases across protected classes;
 * produces reports; integrates with BiasDetectionEngine.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import {
  BiasDetectionEngine,
  BiasDetectionResult,
  BiasType,
  AutonomousDecisionContext,
} from '../../ethics/biasDetector';
import { createHash } from 'crypto';

const logger = createLogger({ service: 'reputation-fairness-audit' });

export interface ProtectedClass {
  dimension: string; // e.g., 'race', 'gender', 'age', 'geography', 'specialty'
  values: string[]; // e.g., ['male', 'female'], ['18-30', '31-50', '51+']
}

export interface FairnessAuditConfig {
  /** Protected classes to analyze */
  protectedClasses: ProtectedClass[];
  /** Time window for audit (in days) */
  auditWindowDays: number;
  /** Frequency of audits (in days) */
  auditFrequencyDays: number;
  /** Minimum sample size per protected class */
  minSampleSize: number;
  /** Bias detection thresholds */
  biasThresholds: {
    demographic: number;
    geographical: number;
    specialty: number;
  };
}

export interface FairnessAuditResult {
  auditDate: Date;
  periodStart: Date;
  periodEnd: Date;
  protectedClasses: string[];
  biasesDetected: Record<string, BiasDetectionResult>;
  recommendations: string[];
  reportHash: string;
}

const DEFAULT_CONFIG: FairnessAuditConfig = {
  protectedClasses: [
    { dimension: 'race', values: [] }, // Values populated from data
    { dimension: 'gender', values: [] },
    { dimension: 'age', values: [] },
    { dimension: 'geography', values: [] },
    { dimension: 'specialty', values: [] },
  ],
  auditWindowDays: 90,
  auditFrequencyDays: 30,
  minSampleSize: 50,
  biasThresholds: {
    demographic: 0.15,
    geographical: 0.15,
    specialty: 0.15,
  },
};

/**
 * FairnessAuditEngine
 *
 * Regularly audits reputation algorithm for biases across protected classes.
 */
export class FairnessAuditEngine {
  private biasDetectionEngine: BiasDetectionEngine;
  private config: FairnessAuditConfig;

  constructor(
    private prisma: PrismaClient,
    config?: Partial<FairnessAuditConfig>
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.biasDetectionEngine = new BiasDetectionEngine({
      thresholds: {
        geographical: this.config.biasThresholds.geographical,
        demographic: this.config.biasThresholds.demographic,
        institutional: 0.15,
        temporal: 0.10,
      },
      analysisWindowDays: this.config.auditWindowDays,
      minSampleSize: this.config.minSampleSize,
    });
  }

  /**
   * Run a fairness audit for the specified period
   */
  async runAudit(periodStart?: Date, periodEnd?: Date): Promise<FairnessAuditResult> {
    const endDate = periodEnd || new Date();
    const startDate = periodStart || new Date(endDate.getTime() - this.config.auditWindowDays * 24 * 60 * 60 * 1000);

    logger.info('Starting fairness audit', {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
    });

    const biasesDetected: Record<string, BiasDetectionResult> = {};
    const recommendations: string[] = [];

    // Analyze each protected class dimension
    for (const protectedClass of this.config.protectedClasses) {
      const biasResults = await this.analyzeProtectedClass(protectedClass, startDate, endDate);

      if (biasResults.length > 0) {
        for (const result of biasResults) {
          const key = `${protectedClass.dimension}_${result.biasType}`;
          biasesDetected[key] = result;

          if (result.recommendations) {
            recommendations.push(...result.recommendations);
          }
        }
      }
    }

    // Generate report hash
    const reportData = {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      protectedClasses: this.config.protectedClasses.map((pc) => pc.dimension),
      biasesDetected,
      recommendations,
    };

    const reportHash = createHash('sha256')
      .update(JSON.stringify(reportData))
      .digest('hex');

    const auditResult: FairnessAuditResult = {
      auditDate: new Date(),
      periodStart: startDate,
      periodEnd: endDate,
      protectedClasses: this.config.protectedClasses.map((pc) => pc.dimension),
      biasesDetected,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      reportHash,
    };

    // Save audit report to database
    await this.saveAuditReport(auditResult);

    logger.info('Fairness audit completed', {
      biasesDetected: Object.keys(biasesDetected).length,
      recommendations: recommendations.length,
      reportHash,
    });

    return auditResult;
  }

  /**
   * Analyze a specific protected class dimension for bias
   */
  private async analyzeProtectedClass(
    protectedClass: ProtectedClass,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BiasDetectionResult[]> {
    logger.debug('Analyzing protected class', {
      dimension: protectedClass.dimension,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    const results: BiasDetectionResult[] = [];

    // Query reputation decisions/computations from the period
    // In production, this would query actual reputation computation records
    const decisions = await this.getReputationDecisions(periodStart, periodEnd);

    if (decisions.length < this.config.minSampleSize) {
      logger.debug('Insufficient sample size for protected class analysis', {
        dimension: protectedClass.dimension,
        sampleSize: decisions.length,
        minSampleSize: this.config.minSampleSize,
      });
      return [];
    }

    // Analyze each decision for bias
    for (const decision of decisions) {
      const context: AutonomousDecisionContext = {
        decisionId: decision.id,
        orgId: decision.orgId,
        region: decision.region,
        decisionType: 'reputation_computation',
        demographics: decision.demographics,
        institution: decision.institution,
        outcome: decision.outcome,
        metadata: decision.metadata,
        timestamp: decision.timestamp,
      };

      const biasResult = await this.biasDetectionEngine.analyzeDecision(context);
      if (biasResult) {
        results.push(biasResult);
      }
    }

    return results;
  }

  /**
   * Get reputation decisions/computations for a time period
   * This is a placeholder - in production, would query actual reputation computation records
   */
  private async getReputationDecisions(
    periodStart: Date,
    periodEnd: Date
  ): Promise<Array<{
    id: string;
    orgId?: string;
    region?: string;
    demographics?: {
      ageGroup?: string;
      gender?: string;
      ethnicity?: string;
      specialty?: string;
    };
    institution?: {
      type?: string;
      size?: string;
      region?: string;
    };
    outcome: 'approved' | 'rejected' | 'deferred' | 'pending';
    metadata?: Record<string, unknown>;
    timestamp: Date;
  }>> {
    // Placeholder: In production, this would query ClinicianReputation records
    // or reputation computation logs with demographic data
    logger.debug('Querying reputation decisions', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    // Return empty array for now - would be populated with actual data
    return [];
  }

  /**
   * Save audit report to database
   */
  private async saveAuditReport(result: FairnessAuditResult): Promise<void> {
    try {
      await this.prisma.fairnessAuditReport.create({
        data: {
          auditDate: result.auditDate,
          periodStart: result.periodStart,
          periodEnd: result.periodEnd,
          protectedClasses: result.protectedClasses,
          biasesDetected: result.biasesDetected as any,
          recommendations: result.recommendations as any,
          reportHash: result.reportHash,
        },
      });

      logger.info('Fairness audit report saved', {
        reportHash: result.reportHash,
      });
    } catch (error) {
      logger.error('Error saving fairness audit report', { error });
      throw error;
    }
  }

  /**
   * Get latest audit report
   */
  async getLatestAuditReport(): Promise<FairnessAuditResult | null> {
    const report = await this.prisma.fairnessAuditReport.findFirst({
      orderBy: { auditDate: 'desc' },
    });

    if (!report) {
      return null;
    }

    return {
      auditDate: report.auditDate,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      protectedClasses: report.protectedClasses,
      biasesDetected: (report.biasesDetected as any) || {},
      recommendations: (report.recommendations as any) || [],
      reportHash: report.reportHash || '',
    };
  }

  /**
   * Schedule regular audits (to be called by a cron job)
   */
  async scheduleNextAudit(): Promise<void> {
    const lastAudit = await this.getLatestAuditReport();
    const now = new Date();

    if (!lastAudit) {
      // No previous audit, run one now
      await this.runAudit();
      return;
    }

    const daysSinceLastAudit = Math.floor(
      (now.getTime() - lastAudit.auditDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceLastAudit >= this.config.auditFrequencyDays) {
      logger.info('Scheduled audit due, running now', {
        daysSinceLastAudit,
        auditFrequencyDays: this.config.auditFrequencyDays,
      });
      await this.runAudit();
    } else {
      logger.debug('Scheduled audit not yet due', {
        daysSinceLastAudit,
        auditFrequencyDays: this.config.auditFrequencyDays,
      });
    }
  }

  /**
   * Set BiasDetectionEngine instance (for dependency injection)
   */
  setBiasDetectionEngine(engine: BiasDetectionEngine): void {
    this.biasDetectionEngine = engine;
    logger.info('BiasDetectionEngine set for FairnessAuditEngine');
  }
}

/**
 * Create a new FairnessAuditEngine instance
 */
export function createFairnessAuditEngine(
  prisma: PrismaClient,
  config?: Partial<FairnessAuditConfig>
): FairnessAuditEngine {
  return new FairnessAuditEngine(prisma, config);
}

