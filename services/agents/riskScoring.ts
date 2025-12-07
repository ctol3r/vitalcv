/**
 * NeuralTrust Risk Scoring Adapter - B140B-AGENT-021
 *
 * Integrates with NeuralTrust API for risk scoring of agent actions:
 * - Data leak detection
 * - Prompt injection detection
 * - Jailbreak attempts
 * - Malicious patterns
 * - PII exposure risks
 */

import { z } from 'zod';
import { sharedSignalsAdapter, SignalType, SignalSeverity, SignalSource } from './sharedSignalsAdapter';

// ============================================================
// ENUMS & TYPES
// ============================================================

export enum RiskCategory {
  DATA_LEAK = 'dataLeak',
  PROMPT_INJECTION = 'promptInjection',
  JAILBREAK = 'jailbreak',
  PII_EXPOSURE = 'piiExposure',
  MALICIOUS_CONTENT = 'maliciousContent',
  UNAUTHORIZED_ACCESS = 'unauthorizedAccess',
  POLICY_VIOLATION = 'policyViolation',
  SAFE = 'safe',
}

export enum RiskLevel {
  SAFE = 'safe',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ============================================================
// SCHEMAS
// ============================================================

export const ActionInputSchema = z.object({
  agentId: z.string(),
  action: z.string(),
  input: z.string(),
  context: z.record(z.any()).optional(),
  taskId: z.string().optional(),
  workflowId: z.string().optional(),
});

export type ActionInput = z.infer<typeof ActionInputSchema>;

export const RiskScoreResultSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  action: z.string(),

  // Risk scoring
  riskScore: z.number().min(0).max(1),
  riskLevel: z.nativeEnum(RiskLevel),
  riskCategory: z.nativeEnum(RiskCategory),

  // Detailed analysis
  categories: z.array(z.object({
    category: z.nativeEnum(RiskCategory),
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })),

  // Flags and indicators
  flags: z.array(z.string()).default([]),
  indicators: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: z.string(),
  })).default([]),

  // Recommendations
  blocked: z.boolean().default(false),
  recommendations: z.array(z.string()).default([]),

  // Metadata
  timestamp: z.date().default(() => new Date()),
  processingTime: z.number().optional(), // milliseconds
  metadata: z.record(z.any()).optional(),
});

export type RiskScoreResult = z.infer<typeof RiskScoreResultSchema>;

// ============================================================
// NEURALTRUST CLIENT (STUB)
// ============================================================

class NeuralTrustClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl || process.env.NEURALTRUST_API_URL || 'https://api.neuraltrust.ai/v1';
    this.apiKey = apiKey || process.env.NEURALTRUST_API_KEY || 'stub-key';
  }

  /**
   * Analyze action for risks (stub implementation)
   */
  async analyzeAction(input: ActionInput): Promise<RiskScoreResult> {
    const startTime = Date.now();

    // Stub implementation - detect patterns in input
    const analysis = this.stubAnalyze(input);

    const processingTime = Date.now() - startTime;

    return {
      ...analysis,
      id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: input.agentId,
      action: input.action,
      timestamp: new Date(),
      processingTime,
    };
  }

  /**
   * Stub analysis logic
   */
  private stubAnalyze(input: ActionInput): Omit<RiskScoreResult, 'id' | 'agentId' | 'action' | 'timestamp' | 'processingTime'> {
    const inputLower = input.input.toLowerCase();
    const categories: Array<{ category: RiskCategory; score: number; confidence: number }> = [];
    const flags: string[] = [];
    const indicators: Array<{ type: string; description: string; severity: string }> = [];

    // Check for data leak patterns
    if (this.checkDataLeak(inputLower)) {
      categories.push({ category: RiskCategory.DATA_LEAK, score: 0.85, confidence: 0.9 });
      flags.push('potential_data_leak');
      indicators.push({
        type: 'data_leak',
        description: 'Detected patterns suggesting data exfiltration attempt',
        severity: 'high',
      });
    }

    // Check for prompt injection
    if (this.checkPromptInjection(inputLower)) {
      categories.push({ category: RiskCategory.PROMPT_INJECTION, score: 0.75, confidence: 0.85 });
      flags.push('prompt_injection_attempt');
      indicators.push({
        type: 'prompt_injection',
        description: 'Detected prompt injection patterns',
        severity: 'medium',
      });
    }

    // Check for jailbreak attempts
    if (this.checkJailbreak(inputLower)) {
      categories.push({ category: RiskCategory.JAILBREAK, score: 0.9, confidence: 0.8 });
      flags.push('jailbreak_attempt');
      indicators.push({
        type: 'jailbreak',
        description: 'Detected jailbreak attempt patterns',
        severity: 'critical',
      });
    }

    // Check for PII exposure
    if (this.checkPII(inputLower)) {
      categories.push({ category: RiskCategory.PII_EXPOSURE, score: 0.7, confidence: 0.95 });
      flags.push('pii_detected');
      indicators.push({
        type: 'pii_exposure',
        description: 'Detected personally identifiable information',
        severity: 'high',
      });
    }

    // Check for malicious content
    if (this.checkMalicious(inputLower)) {
      categories.push({ category: RiskCategory.MALICIOUS_CONTENT, score: 0.8, confidence: 0.75 });
      flags.push('malicious_content');
      indicators.push({
        type: 'malicious_content',
        description: 'Detected potentially malicious content',
        severity: 'high',
      });
    }

    // Calculate overall risk score
    const maxScore = categories.length > 0
      ? Math.max(...categories.map(c => c.score * c.confidence))
      : 0;

    const riskScore = maxScore;
    const riskLevel = this.scoreToLevel(riskScore);
    const riskCategory = categories.length > 0
      ? categories.reduce((max, c) => c.score > max.score ? c : max).category
      : RiskCategory.SAFE;

    const blocked = riskScore >= 0.8;
    const recommendations = this.generateRecommendations(categories, blocked);

    return {
      riskScore,
      riskLevel,
      riskCategory,
      categories,
      flags,
      indicators,
      blocked,
      recommendations,
      metadata: {
        patterns_checked: ['data_leak', 'prompt_injection', 'jailbreak', 'pii', 'malicious'],
      },
    };
  }

  private checkDataLeak(input: string): boolean {
    const patterns = [
      /export.*data/,
      /download.*all/,
      /send.*external/,
      /transfer.*database/,
      /dump.*credentials/,
    ];
    return patterns.some(p => p.test(input));
  }

  private checkPromptInjection(input: string): boolean {
    const patterns = [
      /ignore.*previous.*instructions/,
      /disregard.*system.*prompt/,
      /new.*instructions:/,
      /you are now/,
      /forget.*rules/,
    ];
    return patterns.some(p => p.test(input));
  }

  private checkJailbreak(input: string): boolean {
    const patterns = [
      /bypass.*restrictions/,
      /remove.*limitations/,
      /developer mode/,
      /unrestricted access/,
      /admin.*override/,
    ];
    return patterns.some(p => p.test(input));
  }

  private checkPII(input: string): boolean {
    const patterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
    ];
    return patterns.some(p => p.test(input));
  }

  private checkMalicious(input: string): boolean {
    const patterns = [
      /<script>/i,
      /javascript:/i,
      /on\w+=/i,
      /eval\(/,
      /exec\(/,
    ];
    return patterns.some(p => p.test(input));
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 0.8) return RiskLevel.CRITICAL;
    if (score >= 0.6) return RiskLevel.HIGH;
    if (score >= 0.4) return RiskLevel.MEDIUM;
    if (score >= 0.2) return RiskLevel.LOW;
    return RiskLevel.SAFE;
  }

  private generateRecommendations(
    categories: Array<{ category: RiskCategory; score: number; confidence: number }>,
    blocked: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (blocked) {
      recommendations.push('Action blocked due to high risk score');
    }

    categories.forEach(cat => {
      switch (cat.category) {
        case RiskCategory.DATA_LEAK:
          recommendations.push('Review data access patterns and apply data loss prevention controls');
          break;
        case RiskCategory.PROMPT_INJECTION:
          recommendations.push('Sanitize user inputs and apply prompt validation');
          break;
        case RiskCategory.JAILBREAK:
          recommendations.push('Enforce security guardrails and system prompt protections');
          break;
        case RiskCategory.PII_EXPOSURE:
          recommendations.push('Redact PII and apply data masking');
          break;
        case RiskCategory.MALICIOUS_CONTENT:
          recommendations.push('Filter malicious patterns and apply content security policy');
          break;
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring for anomalies');
    }

    return recommendations;
  }
}

// ============================================================
// RISK SCORING ADAPTER CLASS
// ============================================================

export class RiskScoringAdapter {
  private static instance: RiskScoringAdapter;
  private client: NeuralTrustClient;
  private scoreHistory: Map<string, RiskScoreResult[]> = new Map();

  private constructor() {
    this.client = new NeuralTrustClient();
  }

  static getInstance(): RiskScoringAdapter {
    if (!RiskScoringAdapter.instance) {
      RiskScoringAdapter.instance = new RiskScoringAdapter();
    }
    return RiskScoringAdapter.instance;
  }

  /**
   * Score an agent action
   */
  async scoreAction(input: ActionInput): Promise<RiskScoreResult> {
    const validated = ActionInputSchema.parse(input);

    // Call NeuralTrust API (stub)
    const result = await this.client.analyzeAction(validated);

    // Store in history
    this.storeScore(result);

    // Emit signal if risk is detected
    if (result.riskScore >= 0.5) {
      this.emitRiskSignal(result);
    }

    return result;
  }

  /**
   * Get score history for agent
   */
  getAgentScoreHistory(agentId: string, limit?: number): RiskScoreResult[] {
    const history = this.scoreHistory.get(agentId) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Get agent risk statistics
   */
  getAgentRiskStats(agentId: string): {
    totalActions: number;
    averageRiskScore: number;
    highRiskActions: number;
    blockedActions: number;
    topCategories: Array<{ category: RiskCategory; count: number }>;
  } {
    const history = this.scoreHistory.get(agentId) || [];

    if (history.length === 0) {
      return {
        totalActions: 0,
        averageRiskScore: 0,
        highRiskActions: 0,
        blockedActions: 0,
        topCategories: [],
      };
    }

    const totalActions = history.length;
    const averageRiskScore = history.reduce((sum, r) => sum + r.riskScore, 0) / totalActions;
    const highRiskActions = history.filter(r => r.riskScore >= 0.6).length;
    const blockedActions = history.filter(r => r.blocked).length;

    // Count categories
    const categoryCount = new Map<RiskCategory, number>();
    history.forEach(r => {
      if (r.riskCategory !== RiskCategory.SAFE) {
        categoryCount.set(r.riskCategory, (categoryCount.get(r.riskCategory) || 0) + 1);
      }
    });

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalActions,
      averageRiskScore,
      highRiskActions,
      blockedActions,
      topCategories,
    };
  }

  /**
   * Store score in history
   */
  private storeScore(result: RiskScoreResult): void {
    if (!this.scoreHistory.has(result.agentId)) {
      this.scoreHistory.set(result.agentId, []);
    }

    const history = this.scoreHistory.get(result.agentId)!;
    history.push(result);

    // Keep only recent history (last 1000 per agent)
    if (history.length > 1000) {
      this.scoreHistory.set(result.agentId, history.slice(-1000));
    }
  }

  /**
   * Emit risk signal to shared signals adapter
   */
  private emitRiskSignal(result: RiskScoreResult): void {
    const signalType = this.mapCategoryToSignalType(result.riskCategory);
    const severity = this.mapLevelToSeverity(result.riskLevel);

    sharedSignalsAdapter.emitSignal({
      type: signalType,
      severity,
      source: SignalSource.MONITORING,
      agentId: result.agentId,
      description: `Risk detected: ${result.riskCategory} (score: ${result.riskScore.toFixed(2)})`,
      details: {
        riskScore: result.riskScore,
        riskCategory: result.riskCategory,
        flags: result.flags,
        indicators: result.indicators,
      },
      indicators: result.flags,
      riskScore: result.riskScore,
      confidence: 0.85,
      affectedResources: [result.agentId],
      metadata: result.metadata,
    });
  }

  /**
   * Map risk category to signal type
   */
  private mapCategoryToSignalType(category: RiskCategory): SignalType {
    switch (category) {
      case RiskCategory.DATA_LEAK:
        return SignalType.DATA_LEAK_ATTEMPT;
      case RiskCategory.PROMPT_INJECTION:
      case RiskCategory.JAILBREAK:
        return SignalType.SECURITY_INCIDENT;
      case RiskCategory.PII_EXPOSURE:
        return SignalType.POLICY_VIOLATION;
      case RiskCategory.MALICIOUS_CONTENT:
        return SignalType.SECURITY_INCIDENT;
      case RiskCategory.UNAUTHORIZED_ACCESS:
        return SignalType.UNAUTHORIZED_ACCESS;
      case RiskCategory.POLICY_VIOLATION:
        return SignalType.POLICY_VIOLATION;
      default:
        return SignalType.ANOMALOUS_BEHAVIOR;
    }
  }

  /**
   * Map risk level to signal severity
   */
  private mapLevelToSeverity(level: RiskLevel): SignalSeverity {
    switch (level) {
      case RiskLevel.CRITICAL:
        return SignalSeverity.CRITICAL;
      case RiskLevel.HIGH:
        return SignalSeverity.HIGH;
      case RiskLevel.MEDIUM:
        return SignalSeverity.MEDIUM;
      case RiskLevel.LOW:
      case RiskLevel.SAFE:
      default:
        return SignalSeverity.LOW;
    }
  }

  /**
   * Clear history (for testing)
   */
  clear(): void {
    this.scoreHistory.clear();
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const riskScoringAdapter = RiskScoringAdapter.getInstance();
export default riskScoringAdapter;

