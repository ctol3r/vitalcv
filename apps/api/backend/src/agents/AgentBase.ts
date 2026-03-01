import { log } from '../obs/logger';
import type { AgentConfig, AgentId, AgentResult, AgentStatus } from './types';

/**
 * Abstract base class for background verification agents.
 *
 * Subclasses implement `execute()` which performs a single verification
 * cycle. The base class manages the setInterval lifecycle, status
 * tracking, and structured logging.
 */
export abstract class AgentBase {
  readonly id: AgentId;
  readonly intervalMs: number;
  private _status: AgentStatus = 'idle';
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _enabled: boolean;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.intervalMs = config.intervalMs;
    this._enabled = config.enabled;
  }

  get status(): AgentStatus {
    return this._status;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** Perform a single verification cycle. */
  abstract execute(): Promise<AgentResult[]>;

  /**
   * Start the polling interval.
   * The orchestrator passes an `onResults` callback to receive results —
   * agents never import the orchestrator (no circular dependency).
   */
  start(onResults: (results: AgentResult[], durationMs: number) => void): void {
    if (this._timer) {
      log('warn', `Agent ${this.id} already started`, { agentId: this.id });
      return;
    }

    if (!this._enabled) {
      log('info', `Agent ${this.id} is disabled, skipping start`, { agentId: this.id });
      this._status = 'stopped';
      return;
    }

    this._status = 'running';
    log('info', `Agent ${this.id} started`, {
      event: 'agent_started',
      agentId: this.id,
      intervalMs: this.intervalMs,
    });

    this._timer = setInterval(async () => {
      const startMs = Date.now();
      try {
        const results = await this.execute();
        const durationMs = Date.now() - startMs;
        onResults(results, durationMs);
      } catch (error) {
        this._status = 'error';
        log('error', `Agent ${this.id} execution failed`, {
          event: 'agent_execution_error',
          agentId: this.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }, this.intervalMs);

    // Don't keep the process alive just for this timer during shutdown
    if (this._timer.unref) {
      this._timer.unref();
    }
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._status = 'stopped';
    log('info', `Agent ${this.id} stopped`, {
      event: 'agent_stopped',
      agentId: this.id,
    });
  }
}
