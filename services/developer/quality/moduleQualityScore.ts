/**
 * B227B-DEV-010: ModuleQualityScore
 *
 * Calculates quality score per module based on:
 * - Test coverage
 * - Vulnerability count
 * - Performance benchmarks
 * Exposes API for Marketplace to display scores
 */

import { PrismaClient } from '@prisma/client';
import { ScanReport } from '../security/moduleScanner';
import { TestHarnessResult } from '../testing/testHarness';

export interface QualityMetrics {
  moduleId: string;
  overallScore: number; // 0-100
  testCoverageScore: number; // 0-100
  securityScore: number; // 0-100
  performanceScore: number; // 0-100
  maintainabilityScore: number; // 0-100
  calculatedAt: Date;
  details: {
    testCoverage: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    vulnerabilities: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    performance: {
      averageResponseTime?: number;
      throughput?: number;
      resourceUsage?: {
        cpu?: number;
        memory?: number;
      };
    };
    maintainability: {
      codeComplexity?: number;
      documentationScore?: number;
      codeStyleScore?: number;
    };
  };
}

export interface QualityScoreInput {
  moduleId: string;
  scanReport?: ScanReport;
  testResult?: TestHarnessResult;
  performanceMetrics?: {
    averageResponseTime?: number;
    throughput?: number;
    resourceUsage?: {
      cpu?: number;
      memory?: number;
    };
  };
  maintainabilityMetrics?: {
    codeComplexity?: number;
    documentationScore?: number;
    codeStyleScore?: number;
  };
}

export class ModuleQualityScore {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate quality score for a module
   */
  async calculateQualityScore(input: QualityScoreInput): Promise<QualityMetrics> {
    const calculatedAt = new Date();

    // Step 1: Calculate test coverage score
    const testCoverageScore = this.calculateTestCoverageScore(input.testResult);

    // Step 2: Calculate security score
    const securityScore = this.calculateSecurityScore(input.scanReport);

    // Step 3: Calculate performance score
    const performanceScore = this.calculatePerformanceScore(input.performanceMetrics);

    // Step 4: Calculate maintainability score
    const maintainabilityScore = this.calculateMaintainabilityScore(input.maintainabilityMetrics);

    // Step 5: Calculate overall score (weighted average)
    const overallScore = this.calculateOverallScore({
      testCoverageScore,
      securityScore,
      performanceScore,
      maintainabilityScore,
    });

    const metrics: QualityMetrics = {
      moduleId: input.moduleId,
      overallScore,
      testCoverageScore,
      securityScore,
      performanceScore,
      maintainabilityScore,
      calculatedAt,
      details: {
        testCoverage: {
          statements: input.testResult?.coverage.statements || 0,
          branches: input.testResult?.coverage.branches || 0,
          functions: input.testResult?.coverage.functions || 0,
          lines: input.testResult?.coverage.lines || 0,
        },
        vulnerabilities: {
          total: input.scanReport?.totalVulnerabilities || 0,
          critical: input.scanReport?.criticalCount || 0,
          high: input.scanReport?.highCount || 0,
          medium: input.scanReport?.mediumCount || 0,
          low: input.scanReport?.lowCount || 0,
        },
        performance: input.performanceMetrics || {},
        maintainability: input.maintainabilityMetrics || {},
      },
    };

    return metrics;
  }

  /**
   * Calculate test coverage score (0-100)
   */
  private calculateTestCoverageScore(testResult?: TestHarnessResult): number {
    if (!testResult || !testResult.coverage) {
      return 0;
    }

    // Weighted average of coverage metrics
    const weights = {
      statements: 0.3,
      branches: 0.3,
      functions: 0.2,
      lines: 0.2,
    };

    const score =
      testResult.coverage.statements * weights.statements +
      testResult.coverage.branches * weights.branches +
      testResult.coverage.functions * weights.functions +
      testResult.coverage.lines * weights.lines;

    // Penalize for test failures
    if (testResult.totalFailed > 0) {
      const failureRate = testResult.totalFailed / testResult.totalTests;
      return Math.max(0, score * (1 - failureRate * 0.5));
    }

    return Math.min(100, score);
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(scanReport?: ScanReport): number {
    if (!scanReport) {
      return 0;
    }

    // Start with 100 and deduct points for vulnerabilities
    let score = 100;

    // Critical vulnerabilities: -20 points each
    score -= scanReport.criticalCount * 20;

    // High vulnerabilities: -10 points each
    score -= scanReport.highCount * 10;

    // Medium vulnerabilities: -5 points each
    score -= scanReport.mediumCount * 5;

    // Low vulnerabilities: -1 point each
    score -= scanReport.lowCount * 1;

    // Cap at 0
    return Math.max(0, score);
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(performanceMetrics?: QualityScoreInput['performanceMetrics']): number {
    if (!performanceMetrics) {
      return 50; // Neutral score if no metrics available
    }

    let score = 100;

    // Penalize for high response time
    if (performanceMetrics.averageResponseTime) {
      // Assume 100ms is excellent, 1000ms is poor
      const responseTimeScore = Math.max(0, 100 - (performanceMetrics.averageResponseTime / 10));
      score = Math.min(score, responseTimeScore);
    }

    // Reward high throughput
    if (performanceMetrics.throughput) {
      // Assume 1000 req/s is excellent, 100 req/s is poor
      const throughputScore = Math.min(100, (performanceMetrics.throughput / 10));
      score = (score + throughputScore) / 2;
    }

    // Penalize for high resource usage
    if (performanceMetrics.resourceUsage) {
      if (performanceMetrics.resourceUsage.cpu !== undefined) {
        // Assume 50% CPU is good, 90%+ is poor
        const cpuScore = Math.max(0, 100 - (performanceMetrics.resourceUsage.cpu * 1.1));
        score = Math.min(score, cpuScore);
      }

      if (performanceMetrics.resourceUsage.memory !== undefined) {
        // Assume 50% memory is good, 90%+ is poor
        const memoryScore = Math.max(0, 100 - (performanceMetrics.resourceUsage.memory * 1.1));
        score = Math.min(score, memoryScore);
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate maintainability score (0-100)
   */
  private calculateMaintainabilityScore(
    maintainabilityMetrics?: QualityScoreInput['maintainabilityMetrics']
  ): number {
    if (!maintainabilityMetrics) {
      return 50; // Neutral score if no metrics available
    }

    let score = 100;

    // Penalize for high code complexity
    if (maintainabilityMetrics.codeComplexity !== undefined) {
      // Assume complexity < 10 is excellent, > 50 is poor
      const complexityScore = Math.max(0, 100 - (maintainabilityMetrics.codeComplexity * 2));
      score = Math.min(score, complexityScore);
    }

    // Reward good documentation
    if (maintainabilityMetrics.documentationScore !== undefined) {
      score = (score + maintainabilityMetrics.documentationScore) / 2;
    }

    // Reward good code style
    if (maintainabilityMetrics.codeStyleScore !== undefined) {
      score = (score + maintainabilityMetrics.codeStyleScore) / 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate overall quality score (weighted average)
   */
  private calculateOverallScore(scores: {
    testCoverageScore: number;
    securityScore: number;
    performanceScore: number;
    maintainabilityScore: number;
  }): number {
    // Weights for each component
    const weights = {
      testCoverage: 0.3,
      security: 0.3,
      performance: 0.2,
      maintainability: 0.2,
    };

    const overallScore =
      scores.testCoverageScore * weights.testCoverage +
      scores.securityScore * weights.security +
      scores.performanceScore * weights.performance +
      scores.maintainabilityScore * weights.maintainability;

    return Math.round(overallScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get quality score for a module
   */
  async getQualityScore(moduleId: string): Promise<QualityMetrics | null> {
    // In production, fetch from database or recalculate
    return null;
  }

  /**
   * Update quality score for a module
   */
  async updateQualityScore(moduleId: string, metrics: QualityMetrics): Promise<void> {
    // In production, save to database
    // Could store in MarketplaceModule metadata or separate QualityMetrics table
  }

  /**
   * Get quality scores for multiple modules (for marketplace display)
   */
  async getQualityScores(moduleIds: string[]): Promise<Map<string, QualityMetrics>> {
    const scores = new Map<string, QualityMetrics>();

    for (const moduleId of moduleIds) {
      const score = await this.getQualityScore(moduleId);
      if (score) {
        scores.set(moduleId, score);
      }
    }

    return scores;
  }
}

