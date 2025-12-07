export type AgentMaturityLevel = 'Reactive' | 'Managed' | 'Proactive';

export type BreachType = 'injection' | 'leak' | 'supply-chain' | 'tool' | 'llm';

export interface AgentMaturityMetrics {
  agentId: string;
  level: AgentMaturityLevel;
  readinessScore: number; // 0-1
  breaches: {
    injection: number;
    leak: number;
    supplyChain: number;
    tool: number;
    llm: number;
  };
  lastUpdated: number;
}

export interface AgentTelemetry {
  agentId: string;
  timestamp: number;
  eventType: 'tool_call' | 'breach' | 'decision' | 'error';
  breachType?: BreachType;
  details: Record<string, unknown>;
}

/**
 * Agent maturity telemetry service
 * Tracks agent readiness and breach types
 */
export class AgentTelemetryService {
  private metrics: Map<string, AgentMaturityMetrics> = new Map();
  private telemetry: AgentTelemetry[] = [];

  /**
   * Record telemetry event
   */
  recordEvent(telemetry: AgentTelemetry): void {
    this.telemetry.push(telemetry);

    // Update metrics based on event
    this.updateMetrics(telemetry);
  }

  /**
   * Update agent maturity metrics
   */
  private updateMetrics(telemetry: AgentTelemetry): void {
    const existing = this.metrics.get(telemetry.agentId) || {
      agentId: telemetry.agentId,
      level: 'Reactive' as AgentMaturityLevel,
      readinessScore: 0.5,
      breaches: { injection: 0, leak: 0, supplyChain: 0, tool: 0, llm: 0 },
      lastUpdated: Date.now(),
    };

    if (telemetry.eventType === 'breach' && telemetry.breachType) {
      const breachType = telemetry.breachType;
      if (breachType === 'injection') existing.breaches.injection++;
      else if (breachType === 'leak') existing.breaches.leak++;
      else if (breachType === 'supply-chain') existing.breaches.supplyChain++;
      else if (breachType === 'tool') existing.breaches.tool++;
      else if (breachType === 'llm') existing.breaches.llm++;
    }

    // Calculate readiness score (decreases with breaches)
    const totalBreaches = existing.breaches.injection + existing.breaches.leak +
                         existing.breaches.supplyChain + existing.breaches.tool + existing.breaches.llm;
    existing.readinessScore = Math.max(0, 1 - (totalBreaches * 0.1));

    // Determine maturity level
    if (totalBreaches === 0 && existing.readinessScore > 0.9) {
      existing.level = 'Proactive';
    } else if (totalBreaches < 3 && existing.readinessScore > 0.7) {
      existing.level = 'Managed';
    } else {
      existing.level = 'Reactive';
    }

    existing.lastUpdated = Date.now();
    this.metrics.set(telemetry.agentId, existing);
  }

  /**
   * Get metrics for an agent
   */
  getMetrics(agentId: string): AgentMaturityMetrics | null {
    return this.metrics.get(agentId) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): AgentMaturityMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get telemetry for an agent
   */
  getTelemetry(agentId: string, limit: number = 100): AgentTelemetry[] {
    return this.telemetry
      .filter(t => t.agentId === agentId)
      .slice(-limit);
  }
}

// Singleton instance
let telemetryService: AgentTelemetryService | null = null;

export function getTelemetryService(): AgentTelemetryService {
  if (!telemetryService) {
    telemetryService = new AgentTelemetryService();
  }
  return telemetryService;
}

