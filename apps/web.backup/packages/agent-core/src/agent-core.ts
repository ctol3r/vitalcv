import { emitMetric } from '@vitalcv/metrics-core';

const DEFAULT_METRIC = 'agent_core.task';
const PACKAGE_NAME = 'agent-core';

export interface AgentContext {
  requestId: string;
  agentId: string;
  createdAt?: number;
  locale?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

export interface AgentTask<Input = unknown> {
  id?: string;
  type: string;
  domain: string;
  input: Input;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface TaskResult<Output = unknown> {
  success: true;
  output: Output;
  durationMs: number;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorResult {
  success: false;
  error: string;
  retryable?: boolean;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export type TaskOutcome<Output = unknown> = TaskResult<Output> | ErrorResult;

export interface DomainTaskProvider {
  domain: string;
  name?: string;
  supports(taskType: string): boolean;
  execute(task: AgentTask, context: AgentContext): Promise<TaskOutcome<any>>;
}

export class AgentTaskRegistry {
  private readonly providers = new Map<string, DomainTaskProvider[]>();

  register(provider: DomainTaskProvider): void {
    const domainProviders = this.providers.get(provider.domain) ?? [];
    domainProviders.push(provider);
    this.providers.set(provider.domain, domainProviders);
  }

  getProviders(domain: string): DomainTaskProvider[] {
    return this.providers.get(domain) ?? [];
  }
}

export interface AgentTaskEngineOptions {
  metricName?: string;
}

export class AgentTaskEngine {
  private readonly registry: AgentTaskRegistry;
  private readonly metricName: string;

  constructor(options: AgentTaskEngineOptions = {}, registry?: AgentTaskRegistry) {
    this.metricName = options.metricName || DEFAULT_METRIC;
    this.registry = registry ?? new AgentTaskRegistry();
  }

  registerProvider(provider: DomainTaskProvider): void {
    this.registry.register(provider);
  }

  async runTask<Output = unknown>(
    task: AgentTask,
    context: AgentContext
  ): Promise<TaskOutcome<Output>> {
    const providers = this.registry
      .getProviders(task.domain)
      .filter(provider => provider.supports(task.type));

    const metricBase = {
      package: PACKAGE_NAME,
      domain: task.domain,
      taskType: task.type,
    };

    if (providers.length === 0) {
      const error: ErrorResult = {
        success: false,
        error: `No providers registered for domain '${task.domain}' / task '${task.type}'`,
        retryable: false,
      };
      await emitMetric(this.metricName, {
        ...metricBase,
        status: 'missing_provider',
      });
      return error;
    }

    for (const provider of providers) {
      const start = Date.now();
      try {
        const result = await provider.execute(task, context);
        const durationMs = Date.now() - start;
        if (result.success) {
          const successResult: TaskResult<Output> = {
            ...result,
            durationMs: result.durationMs ?? durationMs,
            provider: result.provider ?? provider.name,
          };
          await emitMetric(this.metricName, {
            ...metricBase,
            status: 'success',
            provider: provider.name,
            durationMs: successResult.durationMs,
          });
          return successResult;
        }

        const errorResult: ErrorResult = {
          ...result,
          provider: result.provider ?? provider.name,
        };

        await emitMetric(this.metricName, {
          ...metricBase,
          status: 'provider_error',
          provider: provider.name,
          retryable: errorResult.retryable ?? false,
        });

        if (!errorResult.retryable) {
          return errorResult;
        }
        // Retryable error - try next provider, if any
      } catch (error) {
        await emitMetric(this.metricName, {
          ...metricBase,
          status: 'exception',
          provider: provider.name,
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    const finalError: ErrorResult = {
      success: false,
      error: 'All providers failed to execute the task',
      retryable: true,
    };

    await emitMetric(this.metricName, {
      ...metricBase,
      status: 'error',
      reason: 'all_providers_failed',
    });

    return finalError;
  }
}

