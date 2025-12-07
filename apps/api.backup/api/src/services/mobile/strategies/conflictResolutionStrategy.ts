export interface ConflictData {
  localValue: any;
  serverValue: any;
  entityType: string;
  entityId: string;
  localTimestamp: Date;
  serverTimestamp: Date;
}

export type ConflictResolutionResult = {
  resolvedValue: any;
  strategy: string;
};

export type ConflictResolutionStrategy = (
  conflict: ConflictData
) => ConflictResolutionResult | Promise<ConflictResolutionResult>;

/**
 * Built-in conflict resolution strategies
 */
export class ConflictResolutionStrategies {
  /**
   * Last-write-wins: Use the most recent value
   */
  static lastWriteWins(conflict: ConflictData): ConflictResolutionResult {
    const localTime = conflict.localTimestamp.getTime();
    const serverTime = conflict.serverTimestamp.getTime();

    return {
      resolvedValue: localTime > serverTime ? conflict.localValue : conflict.serverValue,
      strategy: 'last-write-wins',
    };
  }

  /**
   * Server-wins: Always use server value
   */
  static serverWins(conflict: ConflictData): ConflictResolutionResult {
    return {
      resolvedValue: conflict.serverValue,
      strategy: 'server-wins',
    };
  }

  /**
   * Local-wins: Always use local value
   */
  static localWins(conflict: ConflictData): ConflictResolutionResult {
    return {
      resolvedValue: conflict.localValue,
      strategy: 'local-wins',
    };
  }

  /**
   * Merge: Attempt to merge both values
   */
  static merge(conflict: ConflictData): ConflictResolutionResult {
    const local = conflict.localValue;
    const server = conflict.serverValue;

    // If both are objects, merge them
    if (typeof local === 'object' && typeof server === 'object' && local !== null && server !== null) {
      const merged = { ...server, ...local };
      return {
        resolvedValue: merged,
        strategy: 'merge',
      };
    }

    // Otherwise, use last-write-wins
    return ConflictResolutionStrategies.lastWriteWins(conflict);
  }

  /**
   * Custom strategy registry for entity-specific logic
   */
  private static customStrategies: Map<string, ConflictResolutionStrategy> = new Map();

  /**
   * Register a custom strategy for a specific entity type
   */
  static registerStrategy(entityType: string, strategy: ConflictResolutionStrategy): void {
    this.customStrategies.set(entityType, strategy);
  }

  /**
   * Get strategy for entity type, falling back to default
   */
  static getStrategy(entityType: string, defaultStrategy: ConflictResolutionStrategy = ConflictResolutionStrategies.lastWriteWins): ConflictResolutionStrategy {
    return this.customStrategies.get(entityType) || defaultStrategy;
  }

  /**
   * Clear all custom strategies
   */
  static clearCustomStrategies(): void {
    this.customStrategies.clear();
  }
}

/**
 * ConflictResolutionStrategy service
 * Provides hooks for custom entity logic and manages resolution
 */
export class ConflictResolutionService {
  private defaultStrategy: ConflictResolutionStrategy;

  constructor(defaultStrategy: ConflictResolutionStrategy = ConflictResolutionStrategies.lastWriteWins) {
    this.defaultStrategy = defaultStrategy;
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  async resolve(conflict: ConflictData): Promise<ConflictResolutionResult> {
    const strategy = ConflictResolutionStrategies.getStrategy(conflict.entityType, this.defaultStrategy);
    return strategy(conflict);
  }

  /**
   * Set default strategy
   */
  setDefaultStrategy(strategy: ConflictResolutionStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Register entity-specific strategy
   */
  registerEntityStrategy(entityType: string, strategy: ConflictResolutionStrategy): void {
    ConflictResolutionStrategies.registerStrategy(entityType, strategy);
  }
}

