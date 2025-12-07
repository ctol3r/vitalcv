/**
 * B245A-OBS-009: ObservabilityConfigService
 * Loads instrumentation configuration and sampling settings from environment/config store; supports dynamic updates; parameters: sampleRate, logLevel, exportEndpoints; includes validation and tests
 */

export interface ObservabilityConfig {
  sampleRate: number; // 0.0 to 1.0
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  exportEndpoints: {
    metrics?: string; // Prometheus endpoint
    logs?: string; // Log aggregator endpoint (Elasticsearch, CloudWatch, etc.)
    traces?: string; // Trace exporter endpoint (Zipkin, Jaeger, etc.)
  };
  enableMetrics: boolean;
  enableLogging: boolean;
  enableTracing: boolean;
  retentionDays: {
    metrics: number;
    logs: number;
    traces: number;
  };
  batchSize: {
    metrics: number;
    logs: number;
    traces: number;
  };
  flushInterval: number; // milliseconds
}

export class ObservabilityConfigService {
  private config: ObservabilityConfig;
  private listeners: Set<(config: ObservabilityConfig) => void> = new Set();

  constructor(initialConfig?: Partial<ObservabilityConfig>) {
    this.config = this.loadConfig(initialConfig);
  }

  /**
   * Load configuration from environment variables and provided config
   */
  private loadConfig(override?: Partial<ObservabilityConfig>): ObservabilityConfig {
    const defaultConfig: ObservabilityConfig = {
      sampleRate: parseFloat(process.env.OBSERVABILITY_SAMPLE_RATE || '1.0'),
      logLevel: (process.env.OBSERVABILITY_LOG_LEVEL || 'INFO') as ObservabilityConfig['logLevel'],
      exportEndpoints: {
        metrics: process.env.OBSERVABILITY_METRICS_ENDPOINT,
        logs: process.env.OBSERVABILITY_LOGS_ENDPOINT,
        traces: process.env.OBSERVABILITY_TRACES_ENDPOINT,
      },
      enableMetrics: process.env.OBSERVABILITY_ENABLE_METRICS !== 'false',
      enableLogging: process.env.OBSERVABILITY_ENABLE_LOGGING !== 'false',
      enableTracing: process.env.OBSERVABILITY_ENABLE_TRACING !== 'false',
      retentionDays: {
        metrics: parseInt(process.env.OBSERVABILITY_RETENTION_METRICS_DAYS || '30', 10),
        logs: parseInt(process.env.OBSERVABILITY_RETENTION_LOGS_DAYS || '7', 10),
        traces: parseInt(process.env.OBSERVABILITY_RETENTION_TRACES_DAYS || '3', 10),
      },
      batchSize: {
        metrics: parseInt(process.env.OBSERVABILITY_BATCH_SIZE_METRICS || '100', 10),
        logs: parseInt(process.env.OBSERVABILITY_BATCH_SIZE_LOGS || '100', 10),
        traces: parseInt(process.env.OBSERVABILITY_BATCH_SIZE_TRACES || '100', 10),
      },
      flushInterval: parseInt(process.env.OBSERVABILITY_FLUSH_INTERVAL || '5000', 10),
    };

    const mergedConfig = { ...defaultConfig, ...override };
    this.validateConfig(mergedConfig);
    return mergedConfig;
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ObservabilityConfig): void {
    if (config.sampleRate < 0 || config.sampleRate > 1) {
      throw new Error('sampleRate must be between 0.0 and 1.0');
    }

    if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(config.logLevel)) {
      throw new Error('logLevel must be one of: DEBUG, INFO, WARN, ERROR');
    }

    if (config.retentionDays.metrics < 0 || config.retentionDays.logs < 0 || config.retentionDays.traces < 0) {
      throw new Error('retentionDays must be non-negative');
    }

    if (config.batchSize.metrics < 1 || config.batchSize.logs < 1 || config.batchSize.traces < 1) {
      throw new Error('batchSize must be at least 1');
    }

    if (config.flushInterval < 0) {
      throw new Error('flushInterval must be non-negative');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<ObservabilityConfig>): void {
    const newConfig = { ...this.config, ...updates };
    this.validateConfig(newConfig);
    this.config = newConfig;

    // Notify listeners
    this.listeners.forEach((listener) => listener(this.config));
  }

  /**
   * Subscribe to configuration changes
   */
  onConfigChange(listener: (config: ObservabilityConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if sampling should occur (based on sampleRate)
   */
  shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Check if a log level should be recorded
   */
  shouldLog(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): boolean {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }
}

export default ObservabilityConfigService;

