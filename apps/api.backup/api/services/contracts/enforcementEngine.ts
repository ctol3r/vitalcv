/**
 * B231B-CON-006: ContractEnforcementEngine
 *
 * Evaluates contract terms (e.g., usage limits, SLA requirements, revenue share thresholds)
 * in real-time; produces compliance status and triggers enforcement actions.
 */

import { PrismaClient } from '@prisma/client';

export type ComplianceStatus = 'compliant' | 'warning' | 'breach' | 'unknown';

export interface ContractTerms {
  usageLimits?: {
    maxRequests?: number;
    maxDataTransfer?: number; // in bytes
    maxStorage?: number; // in bytes
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
  slaRequirements?: {
    uptime?: number; // percentage (0-100)
    maxLatency?: number; // in milliseconds
    maxErrorRate?: number; // percentage (0-100)
  };
  revenueShareThresholds?: {
    minRevenue?: number; // in cents
    maxRevenue?: number; // in cents
    basisPoints?: number; // 0-10000
  };
  dataSharingLimits?: {
    maxRecords?: number;
    allowedDataTypes?: string[];
    retentionPeriod?: number; // in days
  };
}

export interface ComplianceResult {
  status: ComplianceStatus;
  contractId: string;
  evaluatedAt: Date;
  violations: Violation[];
  warnings: Warning[];
  metrics: {
    currentUsage?: UsageMetrics;
    currentSLA?: SLAMetrics;
    currentRevenue?: RevenueMetrics;
  };
}

export interface Violation {
  type: 'usage_limit' | 'sla_breach' | 'revenue_threshold' | 'data_sharing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  threshold?: number;
  actual?: number;
  contractTerm?: string;
}

export interface Warning {
  type: 'approaching_limit' | 'sla_degradation' | 'revenue_anomaly';
  description: string;
  threshold?: number;
  actual?: number;
  percentageRemaining?: number;
}

export interface UsageMetrics {
  requests: number;
  dataTransfer: number; // bytes
  storage: number; // bytes
  period: string;
  periodStart: Date;
}

export interface SLAMetrics {
  uptime: number; // percentage
  avgLatency: number; // milliseconds
  errorRate: number; // percentage
  period: string;
  periodStart: Date;
}

export interface RevenueMetrics {
  totalRevenue: number; // in cents
  orgShare: number; // in cents
  platformShare: number; // in cents
  period: string;
  periodStart: Date;
}

export interface EnforcementAction {
  type: 'suspend_service' | 'throttle' | 'notify' | 'log_only';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  contractId: string;
  violationId?: string;
}

/**
 * ContractEnforcementEngine - Real-time contract compliance evaluation
 */
export class ContractEnforcementEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Evaluate contract compliance for a given contract
   */
  async evaluateCompliance(
    contractId: string,
    currentMetrics?: {
      usage?: UsageMetrics;
      sla?: SLAMetrics;
      revenue?: RevenueMetrics;
    }
  ): Promise<ComplianceResult> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
      include: {
        template: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'signed') {
      return {
        status: 'unknown',
        contractId,
        evaluatedAt: new Date(),
        violations: [],
        warnings: [],
        metrics: {},
      };
    }

    const terms = (contract.terms || {}) as ContractTerms;
    const violations: Violation[] = [];
    const warnings: Warning[] = [];

    // Evaluate usage limits
    if (terms.usageLimits && currentMetrics?.usage) {
      const usageResult = this.evaluateUsageLimits(
        terms.usageLimits,
        currentMetrics.usage
      );
      violations.push(...usageResult.violations);
      warnings.push(...usageResult.warnings);
    }

    // Evaluate SLA requirements
    if (terms.slaRequirements && currentMetrics?.sla) {
      const slaResult = this.evaluateSLARequirements(
        terms.slaRequirements,
        currentMetrics.sla
      );
      violations.push(...slaResult.violations);
      warnings.push(...slaResult.warnings);
    }

    // Evaluate revenue share thresholds
    if (terms.revenueShareThresholds && currentMetrics?.revenue) {
      const revenueResult = this.evaluateRevenueThresholds(
        terms.revenueShareThresholds,
        currentMetrics.revenue
      );
      violations.push(...revenueResult.violations);
      warnings.push(...revenueResult.warnings);
    }

    // Determine overall compliance status
    const status = this.determineComplianceStatus(violations, warnings);

    return {
      status,
      contractId,
      evaluatedAt: new Date(),
      violations,
      warnings,
      metrics: {
        currentUsage: currentMetrics?.usage,
        currentSLA: currentMetrics?.sla,
        currentRevenue: currentMetrics?.revenue,
      },
    };
  }

  /**
   * Evaluate usage limits compliance
   */
  private evaluateUsageLimits(
    limits: NonNullable<ContractTerms['usageLimits']>,
    current: UsageMetrics
  ): { violations: Violation[]; warnings: Warning[] } {
    const violations: Violation[] = [];
    const warnings: Warning[] = [];

    if (limits.maxRequests !== undefined && current.requests > limits.maxRequests) {
      violations.push({
        type: 'usage_limit',
        severity: current.requests > limits.maxRequests * 1.2 ? 'critical' : 'high',
        description: `Request limit exceeded: ${current.requests} > ${limits.maxRequests}`,
        threshold: limits.maxRequests,
        actual: current.requests,
        contractTerm: 'usageLimits.maxRequests',
      });
    } else if (
      limits.maxRequests !== undefined &&
      current.requests > limits.maxRequests * 0.9
    ) {
      warnings.push({
        type: 'approaching_limit',
        description: `Approaching request limit: ${current.requests}/${limits.maxRequests} (${Math.round((current.requests / limits.maxRequests) * 100)}%)`,
        threshold: limits.maxRequests,
        actual: current.requests,
        percentageRemaining: Math.round(((limits.maxRequests - current.requests) / limits.maxRequests) * 100),
      });
    }

    if (limits.maxDataTransfer !== undefined && current.dataTransfer > limits.maxDataTransfer) {
      violations.push({
        type: 'usage_limit',
        severity: 'high',
        description: `Data transfer limit exceeded: ${current.dataTransfer} bytes > ${limits.maxDataTransfer} bytes`,
        threshold: limits.maxDataTransfer,
        actual: current.dataTransfer,
        contractTerm: 'usageLimits.maxDataTransfer',
      });
    }

    if (limits.maxStorage !== undefined && current.storage > limits.maxStorage) {
      violations.push({
        type: 'usage_limit',
        severity: 'high',
        description: `Storage limit exceeded: ${current.storage} bytes > ${limits.maxStorage} bytes`,
        threshold: limits.maxStorage,
        actual: current.storage,
        contractTerm: 'usageLimits.maxStorage',
      });
    }

    return { violations, warnings };
  }

  /**
   * Evaluate SLA requirements compliance
   */
  private evaluateSLARequirements(
    requirements: NonNullable<ContractTerms['slaRequirements']>,
    current: SLAMetrics
  ): { violations: Violation[]; warnings: Warning[] } {
    const violations: Violation[] = [];
    const warnings: Warning[] = [];

    if (requirements.uptime !== undefined && current.uptime < requirements.uptime) {
      violations.push({
        type: 'sla_breach',
        severity: current.uptime < requirements.uptime * 0.95 ? 'critical' : 'high',
        description: `Uptime SLA breached: ${current.uptime}% < ${requirements.uptime}%`,
        threshold: requirements.uptime,
        actual: current.uptime,
        contractTerm: 'slaRequirements.uptime',
      });
    } else if (
      requirements.uptime !== undefined &&
      current.uptime < requirements.uptime * 1.05
    ) {
      warnings.push({
        type: 'sla_degradation',
        description: `Uptime approaching SLA threshold: ${current.uptime}% (target: ${requirements.uptime}%)`,
        threshold: requirements.uptime,
        actual: current.uptime,
      });
    }

    if (requirements.maxLatency !== undefined && current.avgLatency > requirements.maxLatency) {
      violations.push({
        type: 'sla_breach',
        severity: current.avgLatency > requirements.maxLatency * 1.5 ? 'critical' : 'medium',
        description: `Latency SLA breached: ${current.avgLatency}ms > ${requirements.maxLatency}ms`,
        threshold: requirements.maxLatency,
        actual: current.avgLatency,
        contractTerm: 'slaRequirements.maxLatency',
      });
    }

    if (requirements.maxErrorRate !== undefined && current.errorRate > requirements.maxErrorRate) {
      violations.push({
        type: 'sla_breach',
        severity: current.errorRate > requirements.maxErrorRate * 2 ? 'critical' : 'high',
        description: `Error rate SLA breached: ${current.errorRate}% > ${requirements.maxErrorRate}%`,
        threshold: requirements.maxErrorRate,
        actual: current.errorRate,
        contractTerm: 'slaRequirements.maxErrorRate',
      });
    }

    return { violations, warnings };
  }

  /**
   * Evaluate revenue share thresholds
   */
  private evaluateRevenueThresholds(
    thresholds: NonNullable<ContractTerms['revenueShareThresholds']>,
    current: RevenueMetrics
  ): { violations: Violation[]; warnings: Warning[] } {
    const violations: Violation[] = [];
    const warnings: Warning[] = [];

    if (thresholds.minRevenue !== undefined && current.totalRevenue < thresholds.minRevenue) {
      warnings.push({
        type: 'revenue_anomaly',
        description: `Revenue below minimum threshold: ${current.totalRevenue} < ${thresholds.minRevenue}`,
        threshold: thresholds.minRevenue,
        actual: current.totalRevenue,
      });
    }

    if (thresholds.maxRevenue !== undefined && current.totalRevenue > thresholds.maxRevenue) {
      violations.push({
        type: 'revenue_threshold',
        severity: 'medium',
        description: `Revenue exceeded maximum threshold: ${current.totalRevenue} > ${thresholds.maxRevenue}`,
        threshold: thresholds.maxRevenue,
        actual: current.totalRevenue,
        contractTerm: 'revenueShareThresholds.maxRevenue',
      });
    }

    return { violations, warnings };
  }

  /**
   * Determine overall compliance status based on violations and warnings
   */
  private determineComplianceStatus(
    violations: Violation[],
    warnings: Warning[]
  ): ComplianceStatus {
    if (violations.length === 0 && warnings.length === 0) {
      return 'compliant';
    }

    const criticalViolations = violations.filter((v) => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      return 'breach';
    }

    const highViolations = violations.filter((v) => v.severity === 'high');
    if (highViolations.length > 0) {
      return 'breach';
    }

    if (violations.length > 0) {
      return 'breach';
    }

    if (warnings.length > 0) {
      return 'warning';
    }

    return 'unknown';
  }

  /**
   * Generate enforcement actions based on compliance result
   */
  generateEnforcementActions(result: ComplianceResult): EnforcementAction[] {
    const actions: EnforcementAction[] = [];

    for (const violation of result.violations) {
      switch (violation.severity) {
        case 'critical':
          actions.push({
            type: 'suspend_service',
            severity: 'critical',
            description: `Critical violation detected: ${violation.description}`,
            contractId: result.contractId,
            violationId: `${violation.type}-${Date.now()}`,
          });
          break;
        case 'high':
          actions.push({
            type: 'throttle',
            severity: 'high',
            description: `High severity violation: ${violation.description}`,
            contractId: result.contractId,
            violationId: `${violation.type}-${Date.now()}`,
          });
          break;
        case 'medium':
        case 'low':
          actions.push({
            type: 'notify',
            severity: violation.severity,
            description: `Violation detected: ${violation.description}`,
            contractId: result.contractId,
            violationId: `${violation.type}-${Date.now()}`,
          });
          break;
      }
    }

    // Always log violations and warnings
    if (result.violations.length > 0 || result.warnings.length > 0) {
      actions.push({
        type: 'log_only',
        severity: 'low',
        description: `Logging compliance evaluation for contract ${result.contractId}`,
        contractId: result.contractId,
      });
    }

    return actions;
  }

  /**
   * Evaluate compliance for all active contracts
   */
  async evaluateAllActiveContracts(
    metricsProvider: (contractId: string) => Promise<{
      usage?: UsageMetrics;
      sla?: SLAMetrics;
      revenue?: RevenueMetrics;
    }>
  ): Promise<ComplianceResult[]> {
    const activeContracts = await this.prisma.partnerContract.findMany({
      where: {
        status: 'signed',
        effectiveDate: { lte: new Date() },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: new Date() } },
        ],
      },
    });

    const results: ComplianceResult[] = [];

    for (const contract of activeContracts) {
      try {
        const metrics = await metricsProvider(contract.id);
        const result = await this.evaluateCompliance(contract.id, metrics);
        results.push(result);
      } catch (error) {
        console.error(`Error evaluating contract ${contract.id}:`, error);
      }
    }

    return results;
  }
}

