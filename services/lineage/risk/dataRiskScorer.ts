/**
 * B228B-LIN-009: DataRiskScorer
 *
 * Analyzes data flows to detect high-risk patterns (e.g., frequent access to certain datasets,
 * unapproved transformations). Assigns risk scores and triggers alerts.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { DataAccessLogService } from '../models/DataAccessLog';

const logger = createLogger({ service: 'data-risk-scorer' });

export interface DataFlow {
  sourceSystem: string;
  targetSystem: string;
  recordId: string;
  transformationId?: string;
  timestamp: Date;
  accessorId: string;
  operationType: string;
}

export interface RiskPattern {
  id: string;
  name: string;
  description: string;
  patternType: 'frequency' | 'transformation' | 'access_pattern' | 'data_combination';
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
}

export interface RiskScore {
  recordId: string;
  score: number; // 0-100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  patterns: RiskPattern[];
  timestamp: Date;
}

export interface RiskFactor {
  factor: string;
  value: number;
  weight: number;
  description: string;
}

export interface RiskAlert {
  id: string;
  recordId: string;
  riskScore: RiskScore;
  alertType: 'frequency_threshold' | 'unapproved_transformation' | 'suspicious_pattern';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * DataRiskScorer
 * Analyzes data flows and assigns risk scores
 */
export class DataRiskScorer {
  private riskPatterns: RiskPattern[] = [];

  constructor(
    private prisma: PrismaClient,
    private dataAccessLogService: DataAccessLogService
  ) {
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize default risk patterns
   */
  private initializeDefaultPatterns(): void {
    this.riskPatterns = [
      {
        id: 'frequent-access',
        name: 'Frequent Access Pattern',
        description: 'Detects unusually frequent access to sensitive data',
        patternType: 'frequency',
        threshold: 10, // Accesses per hour
        severity: 'HIGH',
        enabled: true,
      },
      {
        id: 'unapproved-transformation',
        name: 'Unapproved Transformation',
        description: 'Detects use of unapproved or high-risk transformations',
        patternType: 'transformation',
        threshold: 1, // Any unapproved transformation
        severity: 'CRITICAL',
        enabled: true,
      },
      {
        id: 'cross-system-access',
        name: 'Cross-System Data Access',
        description: 'Detects access patterns across multiple systems',
        patternType: 'access_pattern',
        threshold: 3, // Different systems accessed
        severity: 'MEDIUM',
        enabled: true,
      },
      {
        id: 'sensitive-combination',
        name: 'Sensitive Data Combination',
        description: 'Detects combination of multiple sensitive datasets',
        patternType: 'data_combination',
        threshold: 2, // Number of sensitive datasets
        severity: 'HIGH',
        enabled: true,
      },
    ];
  }

  /**
   * Score risk for a data flow
   */
  async scoreRisk(dataFlow: DataFlow): Promise<RiskScore> {
    logger.info('Scoring risk for data flow', {
      recordId: dataFlow.recordId,
      sourceSystem: dataFlow.sourceSystem,
      targetSystem: dataFlow.targetSystem,
    });

    const factors: RiskFactor[] = [];

    // Analyze frequency
    const frequencyFactor = await this.analyzeFrequency(dataFlow);
    factors.push(frequencyFactor);

    // Analyze transformation
    const transformationFactor = await this.analyzeTransformation(dataFlow);
    factors.push(transformationFactor);

    // Analyze access pattern
    const accessPatternFactor = await this.analyzeAccessPattern(dataFlow);
    factors.push(accessPatternFactor);

    // Analyze data combination
    const dataCombinationFactor = await this.analyzeDataCombination(dataFlow);
    factors.push(dataCombinationFactor);

    // Calculate overall risk score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore =
      factors.reduce((sum, f) => sum + f.value * f.weight, 0) / (totalWeight || 1);

    // Determine severity
    const severity = this.determineSeverity(weightedScore);

    // Find matching patterns
    const matchingPatterns = this.findMatchingPatterns(factors);

    return {
      recordId: dataFlow.recordId,
      score: Math.min(100, Math.max(0, weightedScore)),
      severity,
      factors,
      patterns: matchingPatterns,
      timestamp: new Date(),
    };
  }

  /**
   * Analyze access frequency
   */
  private async analyzeFrequency(dataFlow: DataFlow): Promise<RiskFactor> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const accessCount = await this.dataAccessLogService.getAccessCount(
      dataFlow.recordId,
      oneHourAgo
    );

    const threshold = 10; // Accesses per hour
    const frequencyScore = Math.min(100, (accessCount / threshold) * 50);

    return {
      factor: 'access_frequency',
      value: frequencyScore,
      weight: 0.3,
      description: `${accessCount} accesses in the last hour`,
    };
  }

  /**
   * Analyze transformation risk
   */
  private async analyzeTransformation(dataFlow: DataFlow): Promise<RiskFactor> {
    if (!dataFlow.transformationId) {
      return {
        factor: 'transformation',
        value: 0,
        weight: 0.2,
        description: 'No transformation applied',
      };
    }

    // Check if transformation is approved
    const transformation = await this.prisma.transformationRegistry.findUnique({
      where: { transformationId: dataFlow.transformationId },
    });

    if (!transformation) {
      return {
        factor: 'transformation',
        value: 100,
        weight: 0.4,
        description: 'Unknown transformation - high risk',
      };
    }

    // Risk based on classification
    let riskValue = 0;
    switch (transformation.riskClassification) {
      case 'CRITICAL':
        riskValue = 100;
        break;
      case 'HIGH':
        riskValue = 75;
        break;
      case 'MEDIUM':
        riskValue = 50;
        break;
      case 'LOW':
        riskValue = 25;
        break;
    }

    return {
      factor: 'transformation',
      value: riskValue,
      weight: 0.3,
      description: `Transformation: ${transformation.name} (${transformation.riskClassification})`,
    };
  }

  /**
   * Analyze access pattern
   */
  private async analyzeAccessPattern(dataFlow: DataFlow): Promise<RiskFactor> {
    // Get recent accesses for this record
    const recentLogs = await this.dataAccessLogService.getLogsForRecord(dataFlow.recordId, 50);
    const uniqueSystems = new Set(recentLogs.map((log) => log.metadata?.sourceSystem || 'unknown'));

    const systemCount = uniqueSystems.size;
    const patternScore = Math.min(100, systemCount * 20);

    return {
      factor: 'access_pattern',
      value: patternScore,
      weight: 0.2,
      description: `Accessed from ${systemCount} different systems`,
    };
  }

  /**
   * Analyze data combination risk
   */
  private async analyzeDataCombination(dataFlow: DataFlow): Promise<RiskFactor> {
    // Check if multiple sensitive datasets are being combined
    const sensitiveSystems = ['credentials', 'reputation', 'finance', 'ehr'];
    const isSensitive = sensitiveSystems.includes(dataFlow.sourceSystem);

    if (!isSensitive) {
      return {
        factor: 'data_combination',
        value: 0,
        weight: 0.1,
        description: 'Non-sensitive data source',
      };
    }

    // Check if target system is also sensitive
    const isTargetSensitive = sensitiveSystems.includes(dataFlow.targetSystem);
    const combinationScore = isTargetSensitive ? 60 : 30;

    return {
      factor: 'data_combination',
      value: combinationScore,
      weight: 0.2,
      description: `Sensitive data flow: ${dataFlow.sourceSystem} → ${dataFlow.targetSystem}`,
    };
  }

  /**
   * Determine severity from score
   */
  private determineSeverity(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) {
      return 'CRITICAL';
    } else if (score >= 60) {
      return 'HIGH';
    } else if (score >= 40) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Find matching risk patterns
   */
  private findMatchingPatterns(factors: RiskFactor[]): RiskPattern[] {
    const matching: RiskPattern[] = [];

    for (const pattern of this.riskPatterns) {
      if (!pattern.enabled) {
        continue;
      }

      let matches = false;

      switch (pattern.patternType) {
        case 'frequency':
          const freqFactor = factors.find((f) => f.factor === 'access_frequency');
          if (freqFactor && freqFactor.value >= pattern.threshold * 10) {
            matches = true;
          }
          break;

        case 'transformation':
          const transFactor = factors.find((f) => f.factor === 'transformation');
          if (transFactor && transFactor.value >= pattern.threshold * 100) {
            matches = true;
          }
          break;

        case 'access_pattern':
          const patternFactor = factors.find((f) => f.factor === 'access_pattern');
          if (patternFactor && patternFactor.value >= pattern.threshold * 20) {
            matches = true;
          }
          break;

        case 'data_combination':
          const comboFactor = factors.find((f) => f.factor === 'data_combination');
          if (comboFactor && comboFactor.value >= pattern.threshold * 30) {
            matches = true;
          }
          break;
      }

      if (matches) {
        matching.push(pattern);
      }
    }

    return matching;
  }

  /**
   * Generate risk alert
   */
  async generateAlert(riskScore: RiskScore): Promise<RiskAlert | null> {
    // Only generate alerts for HIGH or CRITICAL risks
    if (riskScore.severity !== 'HIGH' && riskScore.severity !== 'CRITICAL') {
      return null;
    }

    // Check if pattern matches
    if (riskScore.patterns.length === 0) {
      return null;
    }

    const pattern = riskScore.patterns[0];
    let alertType: RiskAlert['alertType'] = 'suspicious_pattern';
    let message = '';

    switch (pattern.patternType) {
      case 'frequency':
        alertType = 'frequency_threshold';
        message = `High-frequency access detected: ${riskScore.factors.find((f) => f.factor === 'access_frequency')?.description}`;
        break;
      case 'transformation':
        alertType = 'unapproved_transformation';
        message = `Unapproved or high-risk transformation detected: ${riskScore.factors.find((f) => f.factor === 'transformation')?.description}`;
        break;
      default:
        message = `Suspicious pattern detected: ${pattern.name}`;
    }

    const alert: RiskAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recordId: riskScore.recordId,
      riskScore,
      alertType,
      message,
      timestamp: new Date(),
      acknowledged: false,
    };

    logger.warn('Risk alert generated', {
      alertId: alert.id,
      recordId: alert.recordId,
      severity: riskScore.severity,
      alertType: alert.alertType,
    });

    return alert;
  }

  /**
   * Batch score risk for multiple data flows
   */
  async scoreRiskBatch(dataFlows: DataFlow[]): Promise<RiskScore[]> {
    return Promise.all(dataFlows.map((flow) => this.scoreRisk(flow)));
  }

  /**
   * Add custom risk pattern
   */
  addRiskPattern(pattern: RiskPattern): void {
    this.riskPatterns.push(pattern);
    logger.info('Risk pattern added', { patternId: pattern.id, name: pattern.name });
  }

  /**
   * Get all risk patterns
   */
  getRiskPatterns(): RiskPattern[] {
    return [...this.riskPatterns];
  }
}

