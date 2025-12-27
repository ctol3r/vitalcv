import { log } from '../../obs/logger';
import { LifecycleEngine, LifecycleEvaluation, LifecycleSubject } from './engine';
import { CredentialLifecyclePhase } from './rules';

export type ScheduledLifecycleSubject = LifecycleSubject & {
  previousStatus?: CredentialLifecyclePhase;
};

export type LifecycleSchedulerOptions = {
  engine: LifecycleEngine;
  loadSubjects: () => Promise<ScheduledLifecycleSubject[]>;
  onEvaluation?: (result: LifecycleEvaluation) => Promise<void> | void;
  intervalMs?: number;
};

export class LifecycleScheduler {
  private readonly intervalMs: number;

  private timer?: NodeJS.Timeout;

  private running = false;

  constructor(private readonly options: LifecycleSchedulerOptions) {
    this.intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => {
        log('error', 'lifecycle_scheduler_run_failed', { error: err.message });
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async runCycle(): Promise<LifecycleEvaluation[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const subjects = await this.options.loadSubjects();
      const results: LifecycleEvaluation[] = [];

      // Evaluate serially to keep ordering deterministic and simpler to debug.
      for (const subject of subjects) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const evaluation = await this.options.engine.evaluate(
            subject,
            subject.previousStatus,
          );
          results.push(evaluation);
          if (this.options.onEvaluation) {
            // eslint-disable-next-line no-await-in-loop
            await this.options.onEvaluation(evaluation);
          }
        } catch (err: any) {
          log('error', 'lifecycle_evaluation_failed', {
            credentialId: subject.credentialId,
            error: err?.message ?? String(err),
          });
        }
      }

      return results;
    } finally {
      this.running = false;
    }
  }
}
