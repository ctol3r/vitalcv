/**
 * CloudWatch Logging Integration
 * B245B-OBS-017: Sends logs to AWS CloudWatch
 * Handles authentication, batching, error handling
 * Supports custom log groups
 * Configurable via ObservabilityConfigService
 */

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
  InputLogEvent,
  LogStream,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

export interface CloudWatchConfig {
  region?: string;
  logGroupName: string;
  logStreamName?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export interface LogEvent {
  timestamp: Date;
  level: string;
  message: string;
  service?: string;
  metadata?: Record<string, any>;
}

/**
 * CloudWatch Logging Integration
 */
export class CloudWatchIntegration {
  private client: CloudWatchLogsClient;
  private config: Required<
    Pick<CloudWatchConfig, 'logGroupName' | 'batchSize' | 'flushIntervalMs'>
  > &
    CloudWatchConfig;
  private logBuffer: InputLogEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sequenceToken: string | undefined;

  constructor(config: CloudWatchConfig) {
    this.config = {
      batchSize: 100,
      flushIntervalMs: 5000,
      ...config,
    };

    // Initialize CloudWatch client
    const clientConfig: any = {
      region: config.region || process.env.AWS_REGION || 'us-east-1',
    };

    if (config.awsAccessKeyId && config.awsSecretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      };
    }

    this.client = new CloudWatchLogsClient(clientConfig);

    // Ensure log group exists
    this.ensureLogGroup().catch((error) => {
      console.error('[CloudWatchIntegration] Error ensuring log group:', error);
    });

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Send a log event to CloudWatch
   */
  async log(event: LogEvent): Promise<void> {
    const logEvent: InputLogEvent = {
      timestamp: event.timestamp.getTime(),
      message: this.formatLogMessage(event),
    };

    this.logBuffer.push(logEvent);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.batchSize!) {
      await this.flush();
    }
  }

  /**
   * Flush buffered logs to CloudWatch
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const events = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Ensure log stream exists
      await this.ensureLogStream();

      // Send logs
      const command = new PutLogEventsCommand({
        logGroupName: this.config.logGroupName,
        logStreamName: this.config.logStreamName || this.getDefaultLogStreamName(),
        logEvents: events,
        sequenceToken: this.sequenceToken,
      });

      const response = await this.client.send(command);
      this.sequenceToken = response.nextSequenceToken;
    } catch (error: any) {
      console.error('[CloudWatchIntegration] Error flushing logs:', error);

      // If error is due to invalid sequence token, retry once
      if (
        error.name === 'InvalidSequenceTokenException' ||
        error.name === 'DataAlreadyAcceptedException'
      ) {
        try {
          await this.refreshSequenceToken();
          const retryCommand = new PutLogEventsCommand({
            logGroupName: this.config.logGroupName,
            logStreamName: this.config.logStreamName || this.getDefaultLogStreamName(),
            logEvents: events,
            sequenceToken: this.sequenceToken,
          });
          const response = await this.client.send(retryCommand);
          this.sequenceToken = response.nextSequenceToken;
        } catch (retryError) {
          console.error('[CloudWatchIntegration] Error on retry:', retryError);
          // Put events back in buffer for next flush
          this.logBuffer.unshift(...events);
        }
      } else {
        // Put events back in buffer for next flush
        this.logBuffer.unshift(...events);
      }
    }
  }

  /**
   * Ensure log group exists
   */
  private async ensureLogGroup(): Promise<void> {
    try {
      await this.client.send(
        new CreateLogGroupCommand({
          logGroupName: this.config.logGroupName,
        }),
      );
    } catch (error: any) {
      // Log group already exists or insufficient permissions
      if (error.name !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  /**
   * Ensure log stream exists
   */
  private async ensureLogStream(): Promise<void> {
    const streamName = this.config.logStreamName || this.getDefaultLogStreamName();

    try {
      await this.client.send(
        new CreateLogStreamCommand({
          logGroupName: this.config.logGroupName,
          logStreamName: streamName,
        }),
      );
    } catch (error: any) {
      // Log stream already exists
      if (error.name !== 'ResourceAlreadyExistsException') {
        // Try to get sequence token from existing stream
        await this.refreshSequenceToken();
      }
    }
  }

  /**
   * Refresh sequence token from existing log stream
   */
  private async refreshSequenceToken(): Promise<void> {
    try {
      const streamName = this.config.logStreamName || this.getDefaultLogStreamName();
      const command = new DescribeLogStreamsCommand({
        logGroupName: this.config.logGroupName,
        logStreamNamePrefix: streamName,
      });

      const response = await this.client.send(command);
      const stream = response.logStreams?.find((s: LogStream) => s.logStreamName === streamName);

      if (stream?.uploadSequenceToken) {
        this.sequenceToken = stream.uploadSequenceToken;
      }
    } catch (error) {
      console.error('[CloudWatchIntegration] Error refreshing sequence token:', error);
    }
  }

  /**
   * Get default log stream name (based on date)
   */
  private getDefaultLogStreamName(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `vitalcv-${date}`;
  }

  /**
   * Format log message
   */
  private formatLogMessage(event: LogEvent): string {
    const logData: Record<string, any> = {
      level: event.level,
      message: event.message,
      timestamp: event.timestamp.toISOString(),
    };

    if (event.service) {
      logData.service = event.service;
    }

    if (event.metadata) {
      Object.assign(logData, event.metadata);
    }

    return JSON.stringify(logData);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('[CloudWatchIntegration] Error in scheduled flush:', error);
      });
    }, this.config.flushIntervalMs!);
  }

  /**
   * Stop the integration and flush remaining logs
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining logs
    await this.flush();
  }
}

/**
 * Create CloudWatch integration from environment variables
 */
export function createCloudWatchIntegration(
  logGroupName?: string,
  overrides?: Partial<CloudWatchConfig>,
): CloudWatchIntegration {
  const config: CloudWatchConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    logGroupName: logGroupName || process.env.CLOUDWATCH_LOG_GROUP || 'vitalcv',
    logStreamName: process.env.CLOUDWATCH_LOG_STREAM,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    batchSize: parseInt(process.env.CLOUDWATCH_BATCH_SIZE || '100', 10),
    flushIntervalMs: parseInt(process.env.CLOUDWATCH_FLUSH_INTERVAL_MS || '5000', 10),
    ...overrides,
  };

  return new CloudWatchIntegration(config);
}
