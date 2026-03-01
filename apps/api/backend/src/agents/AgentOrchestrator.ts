import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { log } from '../obs/logger';
import type { AgentBase } from './AgentBase';
import type {
  AgentId,
  AgentResult,
  OrchestratorEventMap,
  SanctionResult,
  TelemetryEntry,
} from './types';

// ── Circular Buffer ───────────────────────────────────────────
//
// Thread-safety note: Node.js is single-threaded for JavaScript
// execution. setInterval callbacks, Promise resolutions, and Express
// request handlers all run on the same event loop. Therefore no mutex
// is needed — push() from the interval and toArray() from the HTTP
// handler are never concurrent. The only requirement is that
// individual operations are non-interruptible (no await between
// index update and element write), which this implementation satisfies.

class CircularBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<T | undefined>(capacity).fill(undefined);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Return entries in chronological order (oldest first). */
  toArray(limit?: number): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    const start = this.count < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      const entry = this.buffer[idx];
      if (entry !== undefined) {
        result.push(entry);
      }
    }

    if (limit !== undefined && limit < result.length) {
      return result.slice(-limit);
    }
    return result;
  }

  get size(): number {
    return this.count;
  }
}

// ── Typed EventEmitter ────────────────────────────────────────

class TypedEventEmitter<TEvents extends Record<string, unknown[]>> {
  private readonly emitter = new EventEmitter();

  on<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void,
  ): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void,
  ): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit<K extends keyof TEvents & string>(event: K, ...args: TEvents[K]): boolean {
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners(): this {
    this.emitter.removeAllListeners();
    return this;
  }
}

// ── Orchestrator ──────────────────────────────────────────────

const TELEMETRY_BUFFER_SIZE = 100;
const TELEMETRY_DEFAULT_LIMIT = 10;

export class AgentOrchestrator extends TypedEventEmitter<OrchestratorEventMap> {
  private static instance: AgentOrchestrator | null = null;

  private readonly agents = new Map<AgentId, AgentBase>();
  private readonly telemetry = new CircularBuffer<TelemetryEntry>(TELEMETRY_BUFFER_SIZE);
  private _started = false;

  private constructor() {
    super();
  }

  static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (AgentOrchestrator.instance) {
      AgentOrchestrator.instance.shutdown();
      AgentOrchestrator.instance = null;
    }
  }

  // ── Registry ──────────────────────────────────────────────

  register(agent: AgentBase): void {
    if (this.agents.has(agent.id)) {
      log('warn', `Agent ${agent.id} already registered, replacing`, {
        event: 'agent_replaced',
        agentId: agent.id,
      });
      this.agents.get(agent.id)!.stop();
    }
    this.agents.set(agent.id, agent);
    log('info', `Agent ${agent.id} registered`, {
      event: 'agent_registered',
      agentId: agent.id,
      intervalMs: agent.intervalMs,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────

  start(): void {
    if (this._started) {
      log('warn', 'AgentOrchestrator already started', { event: 'orchestrator_already_started' });
      return;
    }

    this._started = true;

    for (const [id, agent] of this.agents) {
      agent.start((results, durationMs) => {
        this.handleResults(id, results, durationMs);
      });
    }

    log('info', 'AgentOrchestrator started', {
      event: 'orchestrator_started',
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys()),
    });
  }

  shutdown(): void {
    for (const [, agent] of this.agents) {
      agent.stop();
    }
    this.removeAllListeners();
    this._started = false;

    log('info', 'AgentOrchestrator shut down', {
      event: 'orchestrator_shutdown',
    });
  }

  get started(): boolean {
    return this._started;
  }

  // ── Telemetry Access ──────────────────────────────────────

  getRecentTelemetry(limit: number = TELEMETRY_DEFAULT_LIMIT): TelemetryEntry[] {
    return this.telemetry.toArray(limit);
  }

  getAgentStatuses(): Array<{ id: AgentId; status: string; enabled: boolean }> {
    return Array.from(this.agents.values()).map((agent) => ({
      id: agent.id,
      status: agent.status,
      enabled: agent.enabled,
    }));
  }

  // ── Internal ──────────────────────────────────────────────

  private handleResults(agentId: AgentId, results: AgentResult[], durationMs: number): void {
    for (const result of results) {
      const entry: TelemetryEntry = {
        id: crypto.randomUUID(),
        agentId,
        action: this.deriveAction(result),
        npi: result.npi,
        result,
        durationMs,
        timestamp: new Date().toISOString(),
      };

      this.telemetry.push(entry);
      this.emit('verification_completed', entry);

      if (result.agentId === 'sanctions' && (result as SanctionResult).status === 'EXCLUDED') {
        this.emit('sanction_detected', entry);
        log('warn', `SANCTION DETECTED for NPI ${result.npi}`, {
          event: 'sanction_detected',
          npi: result.npi,
          receiptHash: (result as SanctionResult).receiptHash,
        });
      }
    }
  }

  private deriveAction(result: AgentResult): string {
    switch (result.agentId) {
      case 'sanctions':
        return 'sanctions_check';
      case 'state_board':
        return 'license_validation';
      default:
        return 'unknown';
    }
  }
}
