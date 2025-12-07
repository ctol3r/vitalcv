/**
 * Microkernel DomainModule Interface
 *
 * Defines the contract for all microkernel modules in the system.
 */

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  source?: string;
}

export interface DomainTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ModuleCapability {
  name: string;
  description: string;
  version?: string;
  supportedEvents?: string[];
  supportedTasks?: string[];
}

/**
 * DomainModule interface that all microkernel modules must implement
 */
export interface DomainModule {
  /**
   * Module identifier
   */
  readonly id: string;

  /**
   * Module name
   */
  readonly name: string;

  /**
   * Handle domain events
   */
  handleEvent(event: DomainEvent): Promise<void>;

  /**
   * Handle domain tasks
   */
  handleTask(task: DomainTask): Promise<TaskResult>;

  /**
   * Get module capabilities
   */
  getCapabilities(): ModuleCapability;
}

