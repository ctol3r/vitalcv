/**
 * B245A-OBS-003: LogService
 * Service persists logs, adds correlation IDs; tests for log saving & retrieval
 */

import { PrismaClient, LogLevel } from '@prisma/client';
import { LogEventModel, LogEventInput } from '../models/LogEvent.js';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  [key: string]: any;
}

export class LogService {
  private logEventModel: LogEventModel;
  private serviceName: string;
  private defaultCorrelationId?: string;

  constructor(prisma: PrismaClient, serviceName: string = 'default-service') {
    this.logEventModel = new LogEventModel(prisma);
    this.serviceName = serviceName;
  }

  /**
   * Set default correlation ID for all logs from this service instance
   */
  setCorrelationId(correlationId: string): void {
    this.defaultCorrelationId = correlationId;
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Log an info message
   */
  async info(message: string, context?: LogContext, correlationId?: string): Promise<void> {
    await this.log(LogLevel.INFO, message, context, correlationId);
  }

  /**
   * Log a warning message
   */
  async warn(message: string, context?: LogContext, correlationId?: string): Promise<void> {
    await this.log(LogLevel.WARN, message, context, correlationId);
  }

  /**
   * Log an error message
   */
  async error(message: string, context?: LogContext, correlationId?: string): Promise<void> {
    await this.log(LogLevel.ERROR, message, context, correlationId);
  }

  /**
   * Log a debug message
   */
  async debug(message: string, context?: LogContext, correlationId?: string): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context, correlationId);
  }

  /**
   * Log a message with specified level
   */
  async log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    correlationId?: string
  ): Promise<void> {
    await this.logEventModel.create({
      serviceName: this.serviceName,
      level,
      message,
      context,
      correlationId: correlationId || this.defaultCorrelationId,
      timestamp: new Date(),
    });
  }

  /**
   * Get logs by correlation ID
   */
  async getByCorrelationId(correlationId: string) {
    return this.logEventModel.findByCorrelationId(correlationId);
  }

  /**
   * Get error logs
   */
  async getErrors(limit: number = 50) {
    return this.logEventModel.getErrors(this.serviceName, limit);
  }

  /**
   * Query logs
   */
  async query(
    level?: LogLevel,
    correlationId?: string,
    startTime?: Date,
    endTime?: Date,
    messageContains?: string,
    limit: number = 100
  ) {
    return this.logEventModel.findMany(
      {
        serviceName: this.serviceName,
        level,
        correlationId,
        startTime,
        endTime,
        messageContains,
      },
      limit
    );
  }
}

export default LogService;

