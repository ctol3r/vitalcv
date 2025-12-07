import { randomUUID } from 'crypto';
import { setTimeout as delay } from 'timers/promises';
import { recordOutboundMessage } from './message-log';

export type AriesOutboundType = 'credential-offer' | 'presentation-request' | 'problem-report';

export interface AriesOutboundMessage<TPayload = Record<string, unknown>> {
  id: string;
  type: AriesOutboundType;
  threadId?: string;
  connectionId?: string;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lastError?: string;
}

export interface AriesOutboundQueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface AriesOutboundSender {
  (message: AriesOutboundMessage): Promise<void>;
}

export class AriesOutboundQueue {
  private readonly pending: AriesOutboundMessage[] = [];
  private readonly deadLetter: AriesOutboundMessage[] = [];
  private readonly inflight = new Set<string>();
  private processing = false;

  constructor(
    private readonly sender: AriesOutboundSender,
    private readonly options: AriesOutboundQueueOptions = {},
  ) {}

  enqueue<TPayload extends Record<string, unknown>>(
    message: Omit<AriesOutboundMessage<TPayload>, 'id' | 'attempts' | 'nextAttemptAt' | 'maxAttempts'>,
  ) {
    const entry: AriesOutboundMessage<TPayload> = {
      id: randomUUID(),
      attempts: 0,
      maxAttempts: this.options.maxAttempts ?? 5,
      nextAttemptAt: new Date(),
      ...message,
    };

    this.pending.push(entry);
    void this.flush();
  }

  getDeadLetterQueue(): AriesOutboundMessage[] {
    return [...this.deadLetter];
  }

  private async flush() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      while (this.hasCapacity() && this.pending.length > 0) {
        const next = this.pending.shift();
        if (!next) continue;
        const now = new Date();
        if (next.nextAttemptAt > now) {
          this.pending.push(next);
          await delay(50);
          continue;
        }

        this.inflight.add(next.id);
        await this.processMessage(next);
        this.inflight.delete(next.id);
      }
    } finally {
      this.processing = false;
    }
  }

  private hasCapacity(): boolean {
    const concurrency = this.options.concurrency ?? 3;
    return this.inflight.size < concurrency;
  }

  private async processMessage(message: AriesOutboundMessage) {
    try {
      await recordOutboundMessage({
        threadId: message.threadId ?? message.id,
        connectionId: message.connectionId,
        messageType: message.type,
        payload: message.payload,
      });

      await this.sender(message);
      console.info('[aries][queue] delivered outbound message', {
        id: message.id,
        type: message.type,
        threadId: message.threadId,
      });
    } catch (error) {
      console.warn('[aries][queue] outbound delivery failed', {
        id: message.id,
        type: message.type,
        attempts: message.attempts,
        error: error instanceof Error ? error.message : String(error),
      });

      message.attempts += 1;
      message.lastError = error instanceof Error ? error.message : String(error);
      message.nextAttemptAt = this.computeNextAttempt(message.attempts);

      if (message.attempts >= message.maxAttempts) {
        this.deadLetter.push(message);
        return;
      }

      this.pending.push(message);
    }
  }

  private computeNextAttempt(attempts: number): Date {
    const base = this.options.baseDelayMs ?? 1_000;
    const max = this.options.maxDelayMs ?? 60_000;
    const delayMs = Math.min(base * Math.pow(2, attempts - 1), max);
    return new Date(Date.now() + delayMs);
  }
}










