import {
  appendAuditEvent,
  getAuditEvent,
  resetAuditLedgerForTests,
} from '../auditLedger';

describe('auditLedger', () => {
  beforeEach(() => {
    resetAuditLedgerForTests();
  });

  it('clones and freezes nested audit fields so stored events cannot drift', () => {
    const requestFields = {
      actorContext: {
        workflow: 'passport',
        steps: ['review'],
      },
    };

    const entry = appendAuditEvent({
      eventId: 'audit-immutable',
      time: '2026-03-18T10:00:00.000Z',
      traceId: 'trace-1',
      category: 'DECISION',
      actor: 'system:test',
      resource: 'entity-1',
      requestFields,
      resultFields: {
        outcome: {
          status: 'RECORDED',
        },
      },
    });

    requestFields.actorContext.workflow = 'mutated';
    requestFields.actorContext.steps.push('accept');

    const stored = getAuditEvent('audit-immutable');
    expect(stored?.requestFields).toEqual({
      actorContext: {
        workflow: 'passport',
        steps: ['review'],
      },
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.requestFields)).toBe(true);
    expect(Object.isFrozen((entry.requestFields as { actorContext: unknown }).actorContext)).toBe(true);
  });

  it('rejects duplicate audit event ids', () => {
    appendAuditEvent({
      eventId: 'audit-duplicate',
      time: '2026-03-18T10:00:00.000Z',
      traceId: 'trace-1',
      category: 'DECISION',
      actor: 'system:test',
      resource: 'entity-1',
    });

    expect(() => appendAuditEvent({
      eventId: 'audit-duplicate',
      time: '2026-03-18T10:01:00.000Z',
      traceId: 'trace-2',
      category: 'DECISION',
      actor: 'system:test',
      resource: 'entity-2',
    })).toThrow('Audit event already exists: audit-duplicate');
  });

  it('hashes nested request fields deterministically regardless of key insertion order', () => {
    const first = appendAuditEvent({
      eventId: 'audit-hash-a',
      time: '2026-03-18T10:00:00.000Z',
      traceId: 'trace-1',
      category: 'DECISION',
      actor: 'system:test',
      resource: 'entity-1',
      requestFields: {
        nested: {
          b: 'second',
          a: 'first',
        },
      },
    });

    resetAuditLedgerForTests();

    const second = appendAuditEvent({
      eventId: 'audit-hash-a',
      time: '2026-03-18T10:00:00.000Z',
      traceId: 'trace-1',
      category: 'DECISION',
      actor: 'system:test',
      resource: 'entity-1',
      requestFields: {
        nested: {
          a: 'first',
          b: 'second',
        },
      },
    });

    expect(second.receiptHash).toBe(first.receiptHash);
  });
});
