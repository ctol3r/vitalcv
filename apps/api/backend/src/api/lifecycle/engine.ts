import { CredentialAuthority, CredentialLifecycle } from './models';
import {
  CredentialLifecyclePhase,
  daysUntilExpiry,
  lifecyclePhase,
  renewalWindowOpensAt,
} from './rules';

export type PulseEventType =
  | 'CREDENTIAL_EXPIRING_SOON'
  | 'RENEWAL_WINDOW_OPEN'
  | 'CREDENTIAL_EXPIRED';

export type PulseEvent = {
  type: PulseEventType;
  credentialId: string;
  authorityId?: string;
  status: CredentialLifecyclePhase;
  occurredAt: string;
  details?: Record<string, unknown>;
};

export interface PulseEmitter {
  emit(event: PulseEvent): Promise<void> | void;
}

export type LifecycleSubject = {
  credentialId: string;
  authority: CredentialAuthority;
  lifecycle: CredentialLifecycle;
};

export type LifecycleEvaluation = {
  credentialId: string;
  authorityId?: string;
  status: CredentialLifecyclePhase;
  asOf: string;
  expiresAt: string;
  renewalWindowOpensAt: string;
  daysUntilExpiry: number;
  emittedEvents: PulseEvent[];
};

export class LifecycleEngine {
  private readonly clock: () => Date;

  private readonly pulseEmitter?: PulseEmitter;

  constructor(options?: { clock?: () => Date; pulseEmitter?: PulseEmitter }) {
    this.clock = options?.clock ?? (() => new Date());
    this.pulseEmitter = options?.pulseEmitter;
  }

  private async emit(events: PulseEvent[]): Promise<void> {
    if (!this.pulseEmitter) return;
    for (const evt of events) {
      // eslint-disable-next-line no-await-in-loop
      await this.pulseEmitter.emit(evt);
    }
  }

  async evaluate(
    subject: LifecycleSubject,
    previousStatus?: CredentialLifecyclePhase,
  ): Promise<LifecycleEvaluation> {
    const asOfDate = this.clock();
    const status = lifecyclePhase(subject.lifecycle, asOfDate);
    const windowOpensAt = renewalWindowOpensAt(subject.lifecycle);
    const expiry = subject.lifecycle.expiresAt instanceof Date
      ? subject.lifecycle.expiresAt
      : new Date(subject.lifecycle.expiresAt);
    const daysRemaining = daysUntilExpiry(subject.lifecycle, asOfDate);

    const events: PulseEvent[] = [];
    if (status === 'RENEWAL_WINDOW' && previousStatus !== 'RENEWAL_WINDOW') {
      events.push(
        {
          type: 'RENEWAL_WINDOW_OPEN',
          credentialId: subject.credentialId,
          authorityId: subject.authority.id,
          status,
          occurredAt: asOfDate.toISOString(),
          details: {
            renewalWindowDays: subject.lifecycle.renewalWindowDays,
            previousStatus: previousStatus ?? 'UNKNOWN',
          },
        },
        {
          type: 'CREDENTIAL_EXPIRING_SOON',
          credentialId: subject.credentialId,
          authorityId: subject.authority.id,
          status,
          occurredAt: asOfDate.toISOString(),
          details: {
            daysUntilExpiry: daysRemaining,
            renewalWindowOpensAt: windowOpensAt.toISOString(),
          },
        },
      );
    }

    if (status === 'EXPIRED' && previousStatus !== 'EXPIRED') {
      events.push({
        type: 'CREDENTIAL_EXPIRED',
        credentialId: subject.credentialId,
        authorityId: subject.authority.id,
        status,
        occurredAt: asOfDate.toISOString(),
        details: {
          previousStatus: previousStatus ?? 'UNKNOWN',
          renewalWindowDays: subject.lifecycle.renewalWindowDays,
        },
      });
    }

    await this.emit(events);

    return {
      credentialId: subject.credentialId,
      authorityId: subject.authority.id,
      status,
      asOf: asOfDate.toISOString(),
      expiresAt: expiry.toISOString(),
      renewalWindowOpensAt: windowOpensAt.toISOString(),
      daysUntilExpiry: daysRemaining,
      emittedEvents: events,
    };
  }
}
