/**
 * FaultInjector
 *
 * Injects various types of faults into the system for testing:
 * - Module crash: Simulates a module/service crashing
 * - Network partition: Simulates network connectivity issues
 * - Delayed queue: Introduces delays in queue processing
 * - Data corruption: Corrupts data at various points
 *
 * Configurable per scenario to test resilience and recovery mechanisms.
 */

export enum FaultType {
  MODULE_CRASH = 'MODULE_CRASH',
  NETWORK_PARTITION = 'NETWORK_PARTITION',
  DELAYED_QUEUE = 'DELAYED_QUEUE',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
}

export interface FaultConfig {
  type: FaultType;
  target: string; // Module/service name or identifier
  severity?: 'low' | 'medium' | 'high' | 'critical';
  duration?: number; // Duration in milliseconds (0 = permanent until cleared)
  probability?: number; // Probability of fault occurring (0-1)
  metadata?: Record<string, any>;
}

export interface FaultState {
  id: string;
  config: FaultConfig;
  active: boolean;
  startTime: number;
  endTime?: number;
  triggered: boolean;
}

export class FaultInjector {
  private activeFaults: Map<string, FaultState> = new Map();
  private moduleCrashHandlers: Map<string, () => void> = new Map();
  private networkPartitionHandlers: Map<string, (partitioned: boolean) => void> = new Map();
  private queueDelayHandlers: Map<string, (delayMs: number) => void> = new Map();
  private dataCorruptionHandlers: Map<string, (data: any) => any> = new Map();

  /**
   * Register a handler for module crash faults
   */
  registerModuleCrashHandler(moduleId: string, handler: () => void): void {
    this.moduleCrashHandlers.set(moduleId, handler);
  }

  /**
   * Register a handler for network partition faults
   */
  registerNetworkPartitionHandler(
    networkId: string,
    handler: (partitioned: boolean) => void
  ): void {
    this.networkPartitionHandlers.set(networkId, handler);
  }

  /**
   * Register a handler for queue delay faults
   */
  registerQueueDelayHandler(queueId: string, handler: (delayMs: number) => void): void {
    this.queueDelayHandlers.set(queueId, handler);
  }

  /**
   * Register a handler for data corruption faults
   */
  registerDataCorruptionHandler(
    dataPath: string,
    handler: (data: any) => any
  ): void {
    this.dataCorruptionHandlers.set(dataPath, handler);
  }

  /**
   * Inject a fault based on configuration
   */
  async injectFault(config: FaultConfig): Promise<string> {
    const faultId = `fault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const faultState: FaultState = {
      id: faultId,
      config,
      active: false,
      startTime: Date.now(),
      triggered: false,
    };

    // Check probability if specified
    if (config.probability !== undefined && Math.random() > config.probability) {
      return faultId; // Fault not triggered due to probability
    }

    // Apply fault based on type
    switch (config.type) {
      case FaultType.MODULE_CRASH:
        await this.injectModuleCrash(config, faultState);
        break;
      case FaultType.NETWORK_PARTITION:
        await this.injectNetworkPartition(config, faultState);
        break;
      case FaultType.DELAYED_QUEUE:
        await this.injectQueueDelay(config, faultState);
        break;
      case FaultType.DATA_CORRUPTION:
        await this.injectDataCorruption(config, faultState);
        break;
      default:
        throw new Error(`Unknown fault type: ${config.type}`);
    }

    faultState.active = true;
    this.activeFaults.set(faultId, faultState);

    // Auto-clear if duration is specified
    if (config.duration && config.duration > 0) {
      setTimeout(() => {
        this.clearFault(faultId);
      }, config.duration);
    }

    return faultId;
  }

  /**
   * Inject module crash fault
   */
  private async injectModuleCrash(config: FaultConfig, state: FaultState): Promise<void> {
    const handler = this.moduleCrashHandlers.get(config.target);
    if (handler) {
      handler();
    } else {
      // Default behavior: throw error
      throw new Error(`Module crash simulated for: ${config.target}`);
    }
    state.triggered = true;
  }

  /**
   * Inject network partition fault
   */
  private async injectNetworkPartition(config: FaultConfig, state: FaultState): Promise<void> {
    const handler = this.networkPartitionHandlers.get(config.target);
    if (handler) {
      handler(true);
    }
    state.triggered = true;
  }

  /**
   * Inject queue delay fault
   */
  private async injectQueueDelay(config: FaultConfig, state: FaultState): Promise<void> {
    const delayMs = config.metadata?.delayMs || 1000;
    const handler = this.queueDelayHandlers.get(config.target);
    if (handler) {
      handler(delayMs);
    }
    state.triggered = true;
  }

  /**
   * Inject data corruption fault
   */
  private async injectDataCorruption(config: FaultConfig, state: FaultState): Promise<void> {
    const handler = this.dataCorruptionHandlers.get(config.target);
    if (handler) {
      // Handler will be called when data is accessed
      state.triggered = true;
    }
  }

  /**
   * Apply data corruption to data if handler is registered
   */
  corruptData(dataPath: string, data: any): any {
    const handler = this.dataCorruptionHandlers.get(dataPath);
    if (handler) {
      return handler(data);
    }
    return data;
  }

  /**
   * Clear a specific fault
   */
  clearFault(faultId: string): boolean {
    const fault = this.activeFaults.get(faultId);
    if (!fault) {
      return false;
    }

    fault.active = false;
    fault.endTime = Date.now();

    // Restore normal operation
    switch (fault.config.type) {
      case FaultType.NETWORK_PARTITION:
        const networkHandler = this.networkPartitionHandlers.get(fault.config.target);
        if (networkHandler) {
          networkHandler(false);
        }
        break;
      case FaultType.DELAYED_QUEUE:
        const queueHandler = this.queueDelayHandlers.get(fault.config.target);
        if (queueHandler) {
          queueHandler(0); // Remove delay
        }
        break;
    }

    this.activeFaults.delete(faultId);
    return true;
  }

  /**
   * Clear all active faults
   */
  clearAllFaults(): void {
    const faultIds = Array.from(this.activeFaults.keys());
    faultIds.forEach((id) => this.clearFault(id));
  }

  /**
   * Get all active faults
   */
  getActiveFaults(): FaultState[] {
    return Array.from(this.activeFaults.values()).filter((f) => f.active);
  }

  /**
   * Check if a specific fault is active
   */
  isFaultActive(faultId: string): boolean {
    return this.activeFaults.get(faultId)?.active || false;
  }

  /**
   * Get fault state by ID
   */
  getFaultState(faultId: string): FaultState | undefined {
    return this.activeFaults.get(faultId);
  }
}

