import { randomBytes } from 'crypto';
import { emitMetric } from '@vitalcv/metrics-core';

const PACKAGE_NAME = 'oidc-utils';

export interface NonceMetadata {
  clientId?: string;
  subject?: string;
  scope?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface NonceRecord {
  value: string;
  issuedAt: number;
  expiresAt: number;
  consumedAt?: number;
  metadata?: NonceMetadata;
}

export interface NonceStore {
  issue(ttlSeconds?: number, metadata?: NonceMetadata): Promise<NonceRecord>;
  consume(value: string): Promise<NonceRecord | null>;
  peek(value: string): NonceRecord | undefined;
  purgeExpired(now?: number): number;
  size(): number;
}

export interface NonceStoreOptions {
  ttlSeconds?: number;
  prefix?: string;
}

/**
 * Simple in-memory nonce store for replay protection.
 */
export class InMemoryNonceStore implements NonceStore {
  private readonly ttlSeconds: number;
  private readonly prefix: string;
  private readonly nonces = new Map<string, NonceRecord>();

  constructor(options: NonceStoreOptions = {}) {
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.prefix = options.prefix ?? 'nonce';
  }

  size(): number {
    return this.nonces.size;
  }

  peek(value: string): NonceRecord | undefined {
    return this.nonces.get(value);
  }

  async issue(ttlSeconds = this.ttlSeconds, metadata?: NonceMetadata): Promise<NonceRecord> {
    const now = Date.now();
    const value = `${this.prefix}-${randomBytes(16).toString('base64url')}`;
    const record: NonceRecord = {
      value,
      issuedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      metadata,
    };

    this.nonces.set(value, record);
    await emitMetric('oidc.nonce.issue', {
      package: PACKAGE_NAME,
      operation: 'nonce.issue',
      status: 'issued',
      ttlSeconds,
    });

    return record;
  }

  async consume(value: string): Promise<NonceRecord | null> {
    const record = this.nonces.get(value);
    const now = Date.now();

    if (!record) {
      await emitMetric('oidc.nonce.consume', {
        package: PACKAGE_NAME,
        operation: 'nonce.consume',
        status: 'miss',
      });
      return null;
    }

    if (record.expiresAt <= now) {
      this.nonces.delete(value);
      await emitMetric('oidc.nonce.consume', {
        package: PACKAGE_NAME,
        operation: 'nonce.consume',
        status: 'expired',
      });
      return null;
    }

    this.nonces.delete(value);
    record.consumedAt = now;
    await emitMetric('oidc.nonce.consume', {
      package: PACKAGE_NAME,
      operation: 'nonce.consume',
      status: 'success',
    });

    return record;
  }

  purgeExpired(now = Date.now()): number {
    let removed = 0;
    for (const record of this.nonces.values()) {
      if (record.expiresAt <= now) {
        this.nonces.delete(record.value);
        removed += 1;
      }
    }
    return removed;
  }
}

