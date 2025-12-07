import { createHash } from 'crypto';
import { ChainClient, type AuditEventRecord } from '../chain/client';

export interface ConsistencyIssue {
  eventId: string;
  reason: string;
  expected?: string;
  actual?: string;
}

export interface ConsistencyReport {
  checkedAt: string;
  totalEvents: number;
  verifiedEvents: number;
  issues: ConsistencyIssue[];
}

export type ConsistencyAlertHandler = (report: ConsistencyReport) => void | Promise<void>;

export class AuditConsistencyChecker {
  private readonly client: ChainClient;
  private readonly alertHandler?: ConsistencyAlertHandler;

  constructor(options?: { client?: ChainClient; alertHandler?: ConsistencyAlertHandler }) {
    this.client = options?.client ?? new ChainClient();
    this.alertHandler = options?.alertHandler;
  }

  async run(): Promise<ConsistencyReport> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const events = await this.client.fetchRecentAuditEvents(since);
    const issues: ConsistencyIssue[] = [];

    events.slice(0, 500).forEach((event) => {
      const issue = this.verifyEvent(event);
      if (issue) {
        issues.push(issue);
      }
    });

    const report: ConsistencyReport = {
      checkedAt: new Date().toISOString(),
      totalEvents: events.length,
      verifiedEvents: events.length - issues.length,
      issues,
    };

    if (issues.length && this.alertHandler) {
      await this.alertHandler(report);
    }

    return report;
  }

  private verifyEvent(event: AuditEventRecord): ConsistencyIssue | null {
    const payloadHash = this.hashPayload(event.payload);
    if (payloadHash !== event.payloadHash) {
      return {
        eventId: event.id,
        reason: 'Payload hash mismatch',
        expected: event.payloadHash,
        actual: payloadHash,
      };
    }

    if (!event.timestamp || Number.isNaN(Date.parse(event.timestamp))) {
      return {
        eventId: event.id,
        reason: 'Invalid timestamp in audit event',
        actual: event.timestamp,
      };
    }

    return null;
  }

  private hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

