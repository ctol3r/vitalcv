/**
 * B225A-FIN-004: RevenueRecognitionScheduler
 *
 * Processes RevenueRecognition events; schedules recognition over time
 * (immediate or deferred); updates RevenueRecognition.status and posts ledger entries.
 */

import { PrismaClient } from '@prisma/client';
import { RevenueRecognitionEvent, RecognitionSchedule } from '../models/RevenueRecognitionEvent';
import { LedgerPostingService } from '../ledger/postingService';

export interface RecognitionScheduleConfig {
  schedule: RecognitionSchedule;
  startDate?: Date;
  endDate?: Date;
  periods?: number; // For linear/rateable schedules
}

export class RevenueRecognitionScheduler {
  private postingService: LedgerPostingService;

  constructor(private prisma: PrismaClient) {
    this.postingService = new LedgerPostingService(prisma);
  }

  /**
   * Process a revenue recognition event based on its schedule
   */
  async processRecognition(eventId: string): Promise<RevenueRecognitionEvent> {
    const event = await RevenueRecognitionEvent.findById(this.prisma, eventId);
    if (!event) {
      throw new Error(`Revenue recognition event not found: ${eventId}`);
    }

    if (event.status !== 'pending') {
      throw new Error(`Revenue recognition event is not pending: ${event.status}`);
    }

    const now = new Date();
    let recognizedAmount = 0;
    let shouldRecognize = false;

    switch (event.recognitionSchedule) {
      case 'immediate':
        // Recognize immediately
        recognizedAmount = event.amount;
        shouldRecognize = true;
        break;

      case 'linear':
        // Linear recognition over time periods
        recognizedAmount = await this.calculateLinearRecognition(event);
        shouldRecognize = recognizedAmount > 0;
        break;

      case 'rateable':
        // Rateable recognition based on completion percentage
        recognizedAmount = await this.calculateRateableRecognition(event);
        shouldRecognize = recognizedAmount > 0;
        break;

      default:
        throw new Error(`Unknown recognition schedule: ${event.recognitionSchedule}`);
    }

    if (shouldRecognize) {
      // Update status to recognized
      const updated = await event.updateStatus('recognized', now);

      // Post ledger entry for recognized revenue
      await this.postingService.postEntry({
        orgId: event.orgId,
        amount: recognizedAmount,
        currency: event.revenueType === 'VITA' ? 'VITA' : 'USD',
        type: 'credit',
        referenceId: event.eventId,
        relatedEventId: event.id,
        metadata: {
          transactionType: 'revenue_recognition',
          recognitionSchedule: event.recognitionSchedule,
          originalAmount: event.amount,
          recognizedAmount,
        },
      });

      return updated;
    }

    return event;
  }

  /**
   * Calculate linear recognition amount
   * Recognizes revenue evenly over time periods
   */
  private async calculateLinearRecognition(
    event: RevenueRecognitionEvent
  ): Promise<number> {
    const metadata = event.metadata as any;
    const periods = metadata?.periods ?? 12; // Default 12 months
    const startDate = metadata?.startDate
      ? new Date(metadata.startDate)
      : event.createdAt;
    const endDate = metadata?.endDate
      ? new Date(metadata.endDate)
      : new Date(startDate.getTime() + periods * 30 * 24 * 60 * 60 * 1000); // Approximate months

    const now = new Date();
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = now.getTime() - startDate.getTime();

    if (elapsedDuration < 0) {
      return 0; // Not started yet
    }

    if (elapsedDuration >= totalDuration) {
      return event.amount; // Fully recognized
    }

    // Calculate recognized amount proportionally
    const recognizedAmount = Math.floor(
      (event.amount * elapsedDuration) / totalDuration
    );

    return recognizedAmount;
  }

  /**
   * Calculate rateable recognition amount
   * Recognizes revenue based on completion percentage
   */
  private async calculateRateableRecognition(
    event: RevenueRecognitionEvent
  ): Promise<number> {
    const metadata = event.metadata as any;
    const completionPercentage = metadata?.completionPercentage ?? 0;

    if (completionPercentage < 0 || completionPercentage > 100) {
      throw new Error(
        `Invalid completion percentage: ${completionPercentage}. Must be between 0 and 100.`
      );
    }

    const recognizedAmount = Math.floor(
      (event.amount * completionPercentage) / 100
    );

    return recognizedAmount;
  }

  /**
   * Process all pending revenue recognition events
   */
  async processPendingEvents(options?: {
    limit?: number;
    batchSize?: number;
  }): Promise<RevenueRecognitionEvent[]> {
    const limit = options?.limit ?? 100;
    const batchSize = options?.batchSize ?? 10;

    const pendingEvents = await RevenueRecognitionEvent.findPending(this.prisma, {
      limit,
    });

    const processed: RevenueRecognitionEvent[] = [];

    // Process in batches
    for (let i = 0; i < pendingEvents.length; i += batchSize) {
      const batch = pendingEvents.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((event) => this.processRecognition(event.id))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          processed.push(result.value);
        } else {
          console.error(
            `Failed to process revenue recognition event ${batch[index].id}:`,
            result.reason
          );
        }
      });
    }

    return processed;
  }

  /**
   * Create a revenue recognition event
   */
  async createRecognitionEvent(params: {
    eventId: string;
    orgId?: string | null;
    amount: number;
    revenueType: 'VITA' | 'FIAT';
    recognitionSchedule?: RecognitionSchedule;
    scheduleConfig?: RecognitionScheduleConfig;
    metadata?: Record<string, any>;
  }): Promise<RevenueRecognitionEvent> {
    const metadata = {
      ...params.metadata,
      ...(params.scheduleConfig?.startDate && {
        startDate: params.scheduleConfig.startDate.toISOString(),
      }),
      ...(params.scheduleConfig?.endDate && {
        endDate: params.scheduleConfig.endDate.toISOString(),
      }),
      ...(params.scheduleConfig?.periods && {
        periods: params.scheduleConfig.periods,
      }),
    };

    return await RevenueRecognitionEvent.create(this.prisma, {
      eventId: params.eventId,
      orgId: params.orgId ?? null,
      amount: params.amount,
      revenueType: params.revenueType,
      recognitionSchedule: params.recognitionSchedule ?? 'immediate',
      status: 'pending',
      metadata,
    });
  }

  /**
   * Update completion percentage for rateable recognition
   */
  async updateCompletionPercentage(
    eventId: string,
    completionPercentage: number
  ): Promise<RevenueRecognitionEvent> {
    const event = await RevenueRecognitionEvent.findById(this.prisma, eventId);
    if (!event) {
      throw new Error(`Revenue recognition event not found: ${eventId}`);
    }

    if (event.recognitionSchedule !== 'rateable') {
      throw new Error(
        `Cannot update completion percentage for non-rateable schedule: ${event.recognitionSchedule}`
      );
    }

    const metadata = {
      ...(event.metadata as Record<string, any> || {}),
      completionPercentage,
    };

    // Update metadata
    await this.prisma.revenueRecognitionEvent.update({
      where: { id: eventId },
      data: { metadata },
    });

    // Process recognition if pending
    if (event.status === 'pending') {
      return await this.processRecognition(eventId);
    }

    const updated = await RevenueRecognitionEvent.findById(this.prisma, eventId);
    if (!updated) {
      throw new Error(`Failed to retrieve updated event: ${eventId}`);
    }
    return updated;
  }
}

