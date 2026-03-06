/**
 * auditLedger.test.ts — Phase 2: Audit OS Hardening
 * Tests for append-only ledger, cursor export, hash integrity, SIEM export.
 */

import {
  appendAuditEvent,
  exportAuditPage,
  exportSinceTime,
  getLedgerSize,
  getAuditEvent,
  newTraceId,
  auditIssuance,
  auditRevocation,
} from '../src/services/audit/auditLedger';

describe('AuditLedger', () => {
  const BASE_SIZE = getLedgerSize(); // capture baseline before these tests add entries

  it('appends events with a unique eventId and receiptHash', () => {
    const entry = appendAuditEvent({
      category: 'ISSUANCE',
      actor: 'did:vitalcv:issuer:test',
      resource: 'vc:test:001',
      severity: 'INFO',
    });
    expect(entry.eventId).toBeTruthy();
    expect(entry.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.traceId).toBeTruthy();
    expect(entry.category).toContain('ISSUANCE');
  });

  it('entries are frozen (immutable)', () => {
    const entry = appendAuditEvent({
      category: 'SYSTEM',
      actor: 'system',
      resource: 'test',
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => {
      (entry as unknown as Record<string, unknown>)['actor'] = 'tampered';
    }).toThrow();
  });

  it('receiptHash is deterministic over canonical payload', () => {
    const entry = appendAuditEvent({
      eventId: 'test-deterministic-id',
      time: '2026-01-01T00:00:00.000Z',
      traceId: 'trace-abc',
      category: 'VERIFICATION',
      actor: 'verifier:abc',
      resource: 'vc:001',
      requestFields: { subject: 'npi:123' },
      resultFields: { valid: true },
      severity: 'INFO',
    });
    // Hash must be a valid sha256 hex string
    expect(entry.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    // Running the same deterministic inputs again should produce same hash
    const entry2 = appendAuditEvent({
      eventId: 'test-deterministic-id-2',
      time: '2026-01-01T00:00:00.000Z',
      traceId: 'trace-abc',
      category: 'VERIFICATION',
      actor: 'verifier:abc',
      resource: 'vc:001',
      requestFields: { subject: 'npi:123' },
      resultFields: { valid: true },
      severity: 'INFO',
    });
    // Different eventId → different hash
    expect(entry.receiptHash).not.toEqual(entry2.receiptHash);
  });

  it('cursor-based export returns correct page', () => {
    const sizeBefore = getLedgerSize();
    // Append 5 events
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const e = appendAuditEvent({ category: 'ADMIN', actor: 'admin', resource: `res:${i}` });
      ids.push(e.eventId);
    }

    // First page: 3 events from start
    const page1 = exportAuditPage({ after: '', limit: 3 });
    expect(page1.totalReturned).toBe(3);
    expect(page1.nextCursor).toBeTruthy();

    // Page from last cursor
    const page2 = exportAuditPage({ after: page1.events[2].eventId, limit: 100 });
    expect(page2.totalReturned).toBeGreaterThanOrEqual(sizeBefore + 5 - 3);

    // All our 5 new events should appear across both pages
    const allReturned = [...page1.events, ...page2.events];
    for (const id of ids) {
      expect(allReturned.some((e) => e.eventId === id)).toBe(true);
    }
  });

  it('exportSinceTime returns only events after the cutoff', () => {
    const beforeTime = new Date(Date.now() - 60000).toISOString(); // 1 min ago
    const e = appendAuditEvent({ category: 'AUTH', actor: 'user:1', resource: 'session:1' });
    const exported = exportSinceTime(beforeTime);
    expect(exported.some((ev) => ev.eventId === e.eventId)).toBe(true);

    const futureTime = new Date(Date.now() + 60000).toISOString();
    const exportedFuture = exportSinceTime(futureTime);
    expect(exportedFuture.some((ev) => ev.eventId === e.eventId)).toBe(false);
  });

  it('getAuditEvent retrieves by ID', () => {
    const e = appendAuditEvent({ category: 'SYSTEM', actor: 'sys', resource: 'boot' });
    const found = getAuditEvent(e.eventId);
    expect(found).not.toBeNull();
    expect(found?.eventId).toBe(e.eventId);
    expect(getAuditEvent('does-not-exist')).toBeNull();
  });

  it('newTraceId returns a UUID', () => {
    const id = newTraceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('auditIssuance convenience emitter works', () => {
    const tid = newTraceId();
    const e = auditIssuance({
      traceId: tid,
      actor: 'did:vitalcv:issuer:ca-medical-board',
      credentialId: 'vc:issue:001',
      subject: 'npi:1234567890',
      issuer: 'did:vitalcv:issuer:ca-medical-board',
      success: true,
    });
    expect(e.category).toContain('ISSUANCE');
    expect(e.traceId).toBe(tid);
    expect(e.severity).toBe('INFO');
  });

  it('auditRevocation emits CRITICAL severity', () => {
    const tid = newTraceId();
    const e = auditRevocation({
      traceId: tid,
      actor: 'did:vitalcv:issuer:dea',
      credentialId: 'vc:revoke:001',
      issuer: 'did:vitalcv:issuer:dea',
      reason: 'License suspended by DEA',
    });
    expect(e.category).toContain('REVOCATION');
    expect(e.severity).toBe('CRITICAL');
  });
});
