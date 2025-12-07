/**
 * B226A-INT-005: ExternalEventIngestJob
 *
 * Periodic job that ingests updates from FHIR subscription, TEFCA events,
 * and board notifications. De-duplicates and publishes to relevant queues.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger, serializeError } from '@chai-vc/logging-core';
import Queue from 'bull';
import { fhirTefcaConnector } from '../../services/interop/tefca/fhirConnector';
import { licensingBoardService } from '../../services/interop/licensing/licensingBoardService';

const prisma = new PrismaClient();
const log = createLogger({ service: 'external-event-ingest' });

// Queues for different event types
const enrollmentQueue = new Queue('enrollment-updates', process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const credentialQueue = new Queue('credential-updates', process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const reputationQueue = new Queue('reputation-updates', process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const portfolioQueue = new Queue('portfolio-updates', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

interface IngestSummary {
  fhirEvents: number;
  tefcaEvents: number;
  boardNotifications: number;
  duplicates: number;
  published: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

interface EventDeduplicationKey {
  source: string;
  eventId: string;
  npi?: string;
  timestamp: Date;
}

class ExternalEventIngestJob {
  private readonly deduplicationWindow: number = 24 * 60 * 60 * 1000; // 24 hours
  private readonly processedEvents: Set<string> = new Set();

  /**
   * Generate deduplication key for an event
   */
  private generateDedupKey(event: EventDeduplicationKey): string {
    const parts = [
      event.source,
      event.eventId,
      event.npi || '',
      event.timestamp.toISOString().split('T')[0], // Date only
    ];
    return parts.join(':');
  }

  /**
   * Check if event has been processed recently
   */
  private async isDuplicate(event: EventDeduplicationKey): Promise<boolean> {
    const key = this.generateDedupKey(event);

    // Check in-memory cache
    if (this.processedEvents.has(key)) {
      return true;
    }

    // Check database for recent events
    const cutoff = new Date(Date.now() - this.deduplicationWindow);
    const existing = await prisma.auditEvent.findFirst({
      where: {
        type: 'EXTERNAL_EVENT_INGEST',
        createdAt: {
          gte: cutoff,
        },
        data: {
          path: ['eventId'],
          equals: event.eventId,
        },
      },
    });

    if (existing) {
      this.processedEvents.add(key);
      return true;
    }

    return false;
  }

  /**
   * Record processed event
   */
  private async recordProcessedEvent(event: EventDeduplicationKey, metadata?: Record<string, any>): Promise<void> {
    const key = this.generateDedupKey(event);
    this.processedEvents.add(key);

    await prisma.auditEvent.create({
      data: {
        type: 'EXTERNAL_EVENT_INGEST',
        subjectNpi: event.npi,
        data: {
          source: event.source,
          eventId: event.eventId,
          timestamp: event.timestamp,
          ...metadata,
        },
      },
    });
  }

  /**
   * Ingest FHIR subscription events
   */
  private async ingestFhirSubscriptionEvents(since?: Date): Promise<number> {
    log.info('Ingesting FHIR subscription events', { since });

    try {
      const result = await fhirTefcaConnector.sync(since);

      // Queue enrollment updates
      if (result.enrollments > 0) {
        await enrollmentQueue.add('fhir-enrollments', {
          source: 'fhir-subscription',
          count: result.enrollments,
          timestamp: new Date(),
        });
      }

      // Queue credential updates
      if (result.credentials > 0) {
        await credentialQueue.add('fhir-credentials', {
          source: 'fhir-subscription',
          count: result.credentials,
          timestamp: new Date(),
        });
      }

      return result.enrollments + result.credentials + result.events;
    } catch (error) {
      log.error('Failed to ingest FHIR subscription events', {
        error: serializeError(error),
      });
      throw error;
    }
  }

  /**
   * Ingest TEFCA events
   */
  private async ingestTefcaEvents(since?: Date): Promise<number> {
    log.info('Ingesting TEFCA events', { since });

    try {
      // Fetch TEFCA events using the connector
      const events = await fhirTefcaConnector.fetchEventNotifications(since);
      let processed = 0;

      for (const event of events) {
        const dedupKey: EventDeduplicationKey = {
          source: 'tefca',
          eventId: event.eventId,
          npi: event.npi,
          timestamp: event.timestamp,
        };

        if (await this.isDuplicate(dedupKey)) {
          continue;
        }

        // Queue event based on type
        if (event.eventType.includes('enrollment') || event.eventType.includes('provider')) {
          await enrollmentQueue.add('tefca-event', {
            eventId: event.eventId,
            eventType: event.eventType,
            npi: event.npi,
            payload: event.payload,
            timestamp: event.timestamp,
          });
        } else if (event.eventType.includes('credential')) {
          await credentialQueue.add('tefca-event', {
            eventId: event.eventId,
            eventType: event.eventType,
            npi: event.npi,
            payload: event.payload,
            timestamp: event.timestamp,
          });
        } else {
          // Default to portfolio queue
          await portfolioQueue.add('tefca-event', {
            eventId: event.eventId,
            eventType: event.eventType,
            npi: event.npi,
            payload: event.payload,
            timestamp: event.timestamp,
          });
        }

        await this.recordProcessedEvent(dedupKey, {
          eventType: event.eventType,
        });

        processed++;
      }

      return processed;
    } catch (error) {
      log.error('Failed to ingest TEFCA events', {
        error: serializeError(error),
      });
      throw error;
    }
  }

  /**
   * Ingest board notifications
   */
  private async ingestBoardNotifications(since?: Date): Promise<number> {
    log.info('Ingesting board notifications', { since });

    try {
      // Get all NPI claims with license information
      const npiClaims = await prisma.npiClaim.findMany({
        where: {
          tags: {
            path: ['licenses'],
            not: null,
          },
        },
        take: 100, // Process in batches
      });

      let processed = 0;

      for (const claim of npiClaims) {
        const tags = claim.tags as any;
        const licenses = tags?.licenses || {};

        for (const [state, licenseInfo] of Object.entries(licenses)) {
          const info = licenseInfo as any;
          if (!info.licenseNumber) continue;

          try {
            // Sync license data
            const result = await licensingBoardService.syncProviderLicenseData(
              claim.npi,
              info.licenseNumber,
              state
            );

            // Queue reputation updates if there are disciplinary actions
            if (result.disciplinaryActions.length > 0) {
              await reputationQueue.add('board-notification', {
                npi: claim.npi,
                state,
                licenseNumber: info.licenseNumber,
                actions: result.disciplinaryActions,
                timestamp: new Date(),
              });
            }

            // Queue enrollment updates if license status changed
            if (result.licenseStatus) {
              const dedupKey: EventDeduplicationKey = {
                source: 'licensing-board',
                eventId: `license-${claim.npi}-${state}-${result.licenseStatus.status}`,
                npi: claim.npi,
                timestamp: new Date(),
              };

              if (!(await this.isDuplicate(dedupKey))) {
                await enrollmentQueue.add('board-notification', {
                  npi: claim.npi,
                  state,
                  licenseStatus: result.licenseStatus,
                  timestamp: new Date(),
                });

                await this.recordProcessedEvent(dedupKey);
              }
            }

            processed++;
          } catch (error) {
            log.error('Failed to process board notification', {
              npi: claim.npi,
              state,
              error: serializeError(error),
            });
            // Continue with next license
          }
        }
      }

      return processed;
    } catch (error) {
      log.error('Failed to ingest board notifications', {
        error: serializeError(error),
      });
      throw error;
    }
  }

  /**
   * Run the ingestion job
   */
  async run(since?: Date): Promise<IngestSummary> {
    const startedAt = new Date();
    const summary: IngestSummary = {
      fhirEvents: 0,
      tefcaEvents: 0,
      boardNotifications: 0,
      duplicates: 0,
      published: 0,
      errors: [],
      startedAt,
      finishedAt: startedAt,
    };

    log.info('Starting external event ingestion job', { since });

    try {
      // Ingest from all sources in parallel
      const [fhirCount, tefcaCount, boardCount] = await Promise.all([
        this.ingestFhirSubscriptionEvents(since).catch(error => {
          summary.errors.push(`FHIR ingestion failed: ${error.message}`);
          return 0;
        }),
        this.ingestTefcaEvents(since).catch(error => {
          summary.errors.push(`TEFCA ingestion failed: ${error.message}`);
          return 0;
        }),
        this.ingestBoardNotifications(since).catch(error => {
          summary.errors.push(`Board notification ingestion failed: ${error.message}`);
          return 0;
        }),
      ]);

      summary.fhirEvents = fhirCount;
      summary.tefcaEvents = tefcaCount;
      summary.boardNotifications = boardCount;
      summary.published = fhirCount + tefcaCount + boardCount;

      log.info('External event ingestion job completed', summary);
    } catch (error) {
      summary.errors.push(`Job failed: ${error instanceof Error ? error.message : String(error)}`);
      log.error('External event ingestion job failed', {
        error: serializeError(error),
        summary,
      });
    } finally {
      summary.finishedAt = new Date();
    }

    return summary;
  }
}

export const externalEventIngestJob = new ExternalEventIngestJob();

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const since = process.argv[2] ? new Date(process.argv[2]) : undefined;
  externalEventIngestJob
    .run(since)
    .then((summary) => {
      log.info('External event ingestion completed', summary);
      process.exit(summary.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      log.error('Fatal error in external event ingestion', {
        error: serializeError(error),
      });
      process.exit(1);
    });
}

export default externalEventIngestJob;

