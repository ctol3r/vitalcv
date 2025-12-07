const log = getServiceLogger('agents/sharedSignalsAdapter');
/**
 * Shared Signals Adapter - B140B-AGENT-020
 *
 * Consumes and produces risk signals for agents:
 * - Anomalous behavior detection
 * - Policy violations
 * - Security incidents
 * - Performance anomalies
 *
 * Integrates with Shared Signals Framework (SSF) and influences routing decisions
 */

import { z } from 'zod';
import { getServiceLogger } from '../logging/serviceLogger';

// ============================================================
// ENUMS & TYPES
// ============================================================

export enum SignalType {
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
  POLICY_VIOLATION = 'policy_violation',
  SECURITY_INCIDENT = 'security_incident',
  PERFORMANCE_ANOMALY = 'performance_anomaly',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  DATA_LEAK_ATTEMPT = 'data_leak_attempt',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
}

export enum SignalSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum SignalSource {
  AGENT = 'agent',
  ROUTER = 'router',
  WORKFLOW = 'workflow',
  EXTERNAL = 'external',
  MONITORING = 'monitoring',
}

// ============================================================
// SCHEMAS
// ============================================================

export const RiskSignalSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(SignalType),
  severity: z.nativeEnum(SignalSeverity),
  source: z.nativeEnum(SignalSource),
  agentId: z.string().optional(),
  workflowId: z.string().optional(),
  taskId: z.string().optional(),

  // Signal details
  description: z.string(),
  details: z.record(z.any()).optional(),
  indicators: z.array(z.string()).default([]),

  // Context
  timestamp: z.date().default(() => new Date()),
  affectedResources: z.array(z.string()).default([]),

  // Risk scoring
  riskScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).default(0.8),

  // Status
  status: z.enum(['active', 'resolved', 'investigating', 'false_positive']).default('active'),
  resolvedAt: z.date().optional(),

  // Metadata
  metadata: z.record(z.any()).optional(),
});

export type RiskSignal = z.infer<typeof RiskSignalSchema>;

export const SignalEventSchema = z.object({
  signalId: z.string(),
  eventType: z.enum(['created', 'updated', 'resolved', 'escalated']),
  timestamp: z.date().default(() => new Date()),
  data: z.record(z.any()).optional(),
});

export type SignalEvent = z.infer<typeof SignalEventSchema>;

// ============================================================
// SHARED SIGNALS ADAPTER CLASS
// ============================================================

export class SharedSignalsAdapter {
  private static instance: SharedSignalsAdapter;
  private signals: Map<string, RiskSignal> = new Map();
  private signalHistory: SignalEvent[] = [];
  private listeners: Map<SignalType, Array<(signal: RiskSignal) => void>> = new Map();

  // Signal thresholds
  private readonly ANOMALY_THRESHOLD = 0.7;
  private readonly CRITICAL_THRESHOLD = 0.9;

  private constructor() {
    this.initializeListeners();
  }

  static getInstance(): SharedSignalsAdapter {
    if (!SharedSignalsAdapter.instance) {
      SharedSignalsAdapter.instance = new SharedSignalsAdapter();
    }
    return SharedSignalsAdapter.instance;
  }

  /**
   * Emit a risk signal
   */
  emitSignal(signal: Omit<RiskSignal, 'id'>): RiskSignal {
    const fullSignal: RiskSignal = {
      ...signal,
      id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const validated = RiskSignalSchema.parse(fullSignal);
    this.signals.set(validated.id, validated);

    // Record event
    this.recordEvent({
      signalId: validated.id,
      eventType: 'created',
      timestamp: new Date(),
      data: { severity: validated.severity, type: validated.type },
    });

    // Notify listeners
    this.notifyListeners(validated);

    // Auto-escalate critical signals
    if (validated.riskScore >= this.CRITICAL_THRESHOLD) {
      this.escalateSignal(validated.id);
    }

    return validated;
  }

  /**
   * Get signal by ID
   */
  getSignal(id: string): RiskSignal | undefined {
    return this.signals.get(id);
  }

  /**
   * Get all active signals
   */
  getActiveSignals(): RiskSignal[] {
    return Array.from(this.signals.values()).filter(s => s.status === 'active');
  }

  /**
   * Get signals by agent
   */
  getSignalsByAgent(agentId: string): RiskSignal[] {
    return Array.from(this.signals.values()).filter(s => s.agentId === agentId);
  }

  /**
   * Get signals by type
   */
  getSignalsByType(type: SignalType): RiskSignal[] {
    return Array.from(this.signals.values()).filter(s => s.type === type);
  }

  /**
   * Get signals by severity
   */
  getSignalsBySeverity(severity: SignalSeverity): RiskSignal[] {
    return Array.from(this.signals.values()).filter(s => s.severity === severity);
  }

  /**
   * Resolve a signal
   */
  resolveSignal(id: string, resolution?: string): RiskSignal | undefined {
    const signal = this.signals.get(id);
    if (!signal) {
      return undefined;
    }

    const updated = {
      ...signal,
      status: 'resolved' as const,
      resolvedAt: new Date(),
      metadata: {
        ...signal.metadata,
        resolution,
      },
    };

    this.signals.set(id, updated);

    this.recordEvent({
      signalId: id,
      eventType: 'resolved',
      timestamp: new Date(),
      data: { resolution },
    });

    return updated;
  }

  /**
   * Mark signal as false positive
   */
  markFalsePositive(id: string): RiskSignal | undefined {
    const signal = this.signals.get(id);
    if (!signal) {
      return undefined;
    }

    const updated = {
      ...signal,
      status: 'false_positive' as const,
      resolvedAt: new Date(),
    };

    this.signals.set(id, updated);

    this.recordEvent({
      signalId: id,
      eventType: 'resolved',
      timestamp: new Date(),
      data: { falsePositive: true },
    });

    return updated;
  }

  /**
   * Escalate a signal
   */
  escalateSignal(id: string): RiskSignal | undefined {
    const signal = this.signals.get(id);
    if (!signal) {
      return undefined;
    }

    // Increase severity
    const severityOrder = [
      SignalSeverity.LOW,
      SignalSeverity.MEDIUM,
      SignalSeverity.HIGH,
      SignalSeverity.CRITICAL,
    ];
    const currentIndex = severityOrder.indexOf(signal.severity);
    const newSeverity = currentIndex < 3 ? severityOrder[currentIndex + 1] : signal.severity;

    const updated = {
      ...signal,
      severity: newSeverity,
      metadata: {
        ...signal.metadata,
        escalated: true,
        escalatedAt: new Date(),
      },
    };

    this.signals.set(id, updated);

    this.recordEvent({
      signalId: id,
      eventType: 'escalated',
      timestamp: new Date(),
      data: { oldSeverity: signal.severity, newSeverity },
    });

    return updated;
  }

  /**
   * Calculate agent risk score based on signals
   */
  calculateAgentRiskScore(agentId: string): number {
    const agentSignals = this.getSignalsByAgent(agentId).filter(s => s.status === 'active');

    if (agentSignals.length === 0) {
      return 0;
    }

    // Weighted average of signal risk scores
    const totalWeight = agentSignals.reduce((sum, signal) => {
      const severityWeight = this.getSeverityWeight(signal.severity);
      return sum + severityWeight;
    }, 0);

    const weightedScore = agentSignals.reduce((sum, signal) => {
      const severityWeight = this.getSeverityWeight(signal.severity);
      return sum + (signal.riskScore * signal.confidence * severityWeight);
    }, 0);

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Check if agent should be blocked based on signals
   */
  shouldBlockAgent(agentId: string): boolean {
    const riskScore = this.calculateAgentRiskScore(agentId);
    return riskScore >= this.CRITICAL_THRESHOLD;
  }

  /**
   * Get agent risk summary
   */
  getAgentRiskSummary(agentId: string): {
    riskScore: number;
    activeSignals: number;
    criticalSignals: number;
    shouldBlock: boolean;
    recentSignals: RiskSignal[];
  } {
    const signals = this.getSignalsByAgent(agentId);
    const activeSignals = signals.filter(s => s.status === 'active');
    const criticalSignals = activeSignals.filter(s => s.severity === SignalSeverity.CRITICAL);
    const riskScore = this.calculateAgentRiskScore(agentId);

    return {
      riskScore,
      activeSignals: activeSignals.length,
      criticalSignals: criticalSignals.length,
      shouldBlock: this.shouldBlockAgent(agentId),
      recentSignals: activeSignals.slice(-5),
    };
  }

  /**
   * Register listener for signal type
   */
  onSignal(type: SignalType, callback: (signal: RiskSignal) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(signal: RiskSignal): void {
    const typeListeners = this.listeners.get(signal.type) || [];
    typeListeners.forEach(callback => {
      try {
        callback(signal);
      } catch (error) {
        log.error('Error in signal listener:', error);
      }
    });
  }

  /**
   * Get signal history
   */
  getHistory(limit?: number): SignalEvent[] {
    if (limit) {
      return this.signalHistory.slice(-limit);
    }
    return [...this.signalHistory];
  }

  /**
   * Record signal event
   */
  private recordEvent(event: SignalEvent): void {
    this.signalHistory.push(event);

    // Keep only recent history (last 10000 events)
    if (this.signalHistory.length > 10000) {
      this.signalHistory = this.signalHistory.slice(-10000);
    }
  }

  /**
   * Get severity weight for scoring
   */
  private getSeverityWeight(severity: SignalSeverity): number {
    switch (severity) {
      case SignalSeverity.LOW:
        return 1;
      case SignalSeverity.MEDIUM:
        return 2;
      case SignalSeverity.HIGH:
        return 4;
      case SignalSeverity.CRITICAL:
        return 8;
    }
  }

  /**
   * Initialize default listeners
   */
  private initializeListeners(): void {
    // Example: Log critical security incidents
    this.onSignal(SignalType.SECURITY_INCIDENT, (signal) => {
      if (signal.severity === SignalSeverity.CRITICAL) {
        log.warn(`[CRITICAL] Security incident detected: ${signal.description}`, {
          agentId: signal.agentId,
          riskScore: signal.riskScore,
        });
      }
    });

    // Example: Log data leak attempts
    this.onSignal(SignalType.DATA_LEAK_ATTEMPT, (signal) => {
      log.warn(`[ALERT] Data leak attempt detected: ${signal.description}`, {
        agentId: signal.agentId,
        severity: signal.severity,
      });
    });
  }

  /**
   * Clear all signals (for testing)
   */
  clear(): void {
    this.signals.clear();
    this.signalHistory = [];
  }

  /**
   * Export signals for external systems (SSF format)
   */
  exportSignals(): any[] {
    return Array.from(this.signals.values()).map(signal => ({
      iss: 'https://chai-vc-platform.com',
      jti: signal.id,
      iat: Math.floor(signal.timestamp.getTime() / 1000),
      event_type: `risk.${signal.type}`,
      severity: signal.severity,
      subject: {
        agent_id: signal.agentId,
        workflow_id: signal.workflowId,
      },
      risk_score: signal.riskScore,
      description: signal.description,
    }));
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const sharedSignalsAdapter = SharedSignalsAdapter.getInstance();
export default sharedSignalsAdapter;

