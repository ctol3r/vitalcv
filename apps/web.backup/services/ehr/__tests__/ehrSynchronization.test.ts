import { describe, expect, it } from '@jest/globals';
import {
  calculateBackoffDelayMs,
  canTransitionSynchronizationStatus,
  CreateEhrSynchronizationSchema,
  EhrSynchronizationSchema,
  EhrSynchronizationStatus,
  serializeEhrSynchronization,
  shouldRetrySynchronization,
} from '../models/EHRSynchronization.js';

describe('EHRSynchronization model', () => {
  it('validates complete synchronization records', () => {
    const now = new Date();
    const parsed = EhrSynchronizationSchema.parse({
      id: 'ckxyz123',
      clinicianId: 'clinician-123',
      privilegeCode: 'PRIV-READ',
      ehrSystem: 'epic',
      status: EhrSynchronizationStatus.PENDING,
      attemptCount: 0,
      lastAttemptAt: now,
      error: null,
      metadata: { region: 'us-west' },
      createdAt: now,
      updatedAt: now,
    });

    expect(parsed.privilegeCode).toBe('PRIV-READ');
  });

  it('defaults status/attemptCount on create schema', () => {
    const parsed = CreateEhrSynchronizationSchema.parse({
      clinicianId: 'clinician-xyz',
      privilegeCode: 'CARD-SURG',
      ehrSystem: 'cerner',
    });

    expect(parsed.status).toBe(EhrSynchronizationStatus.PENDING);
    expect(parsed.attemptCount).toBe(0);
  });

  it('enforces valid status transitions', () => {
    expect(
      canTransitionSynchronizationStatus(EhrSynchronizationStatus.PENDING, EhrSynchronizationStatus.RETRYING).allowed
    ).toBe(true);

    const invalid = canTransitionSynchronizationStatus(EhrSynchronizationStatus.SYNCED, EhrSynchronizationStatus.RETRYING);
    expect(invalid.allowed).toBe(false);
    expect(invalid.reason).toContain('Cannot transition');
  });

  it('calculates exponential backoff with caps', () => {
    expect(calculateBackoffDelayMs(0)).toBe(1000);
    expect(calculateBackoffDelayMs(3)).toBe(8000);
    expect(calculateBackoffDelayMs(10)).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it('decides whether retries are allowed', () => {
    expect(
      shouldRetrySynchronization({ status: EhrSynchronizationStatus.RETRYING, attemptCount: 2 }, 5)
    ).toBe(true);
    expect(
      shouldRetrySynchronization({ status: EhrSynchronizationStatus.FAILED, attemptCount: 5 }, 5)
    ).toBe(false);
    expect(
      shouldRetrySynchronization({ status: EhrSynchronizationStatus.SYNCED, attemptCount: 2 }, 5)
    ).toBe(false);
  });

  it('serializes records to API friendly payloads', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const serialized = serializeEhrSynchronization({
      id: 'sync-1',
      clinicianId: 'clinician-1',
      privilegeCode: 'IMAGING',
      ehrSystem: 'meditech',
      status: EhrSynchronizationStatus.RETRYING,
      attemptCount: 2,
      lastAttemptAt: now,
      error: 'timeout',
      metadata: { note: 'retrying' },
      createdAt: now,
      updatedAt: now,
    });

    expect(serialized.lastAttemptAt).toBe('2024-01-01T00:00:00.000Z');
    expect(serialized.error).toBe('timeout');
  });
});


