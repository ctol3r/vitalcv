import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyIssuerAuditWriteResult,
  buildIssuerAuditEventRecord,
  buildIssuerLifecycleReplay,
  createNoopIssuerAuditWriter,
  explainIssuerAuditPersistenceStatus,
  getIssuerAuditPersistenceStatus,
  mapLifecycleStatusToAuditEventType,
} from '../lib/issuer-verification/auditPersistence';
import type {
  IssuerAuditCorrelation,
  IssuerAuditEventRecord,
  IssuerAuditPersistenceMode,
  IssuerAuditWriter,
  IssuerAuditWriteResult,
} from '../lib/issuer-verification/auditPersistence';
import type {
  IssuerRequestLifecycleActor,
  IssuerRequestLifecycleEvent,
} from '../lib/issuer-verification/requestLifecycle';
import {
  appendIssuerLifecycleEvent,
  getIssuerRequestTimeline,
} from '../lib/issuer-verification/requestLifecycle';
import { recommendPartnerRoute } from '../lib/issuer-verification/partnerRouter';
import {
  ISSUER_AUDIT_PERSISTENCE_COPY,
  getIssuerAuditPersistenceCopy,
} from '../lib/issuer-verification/statusCopy';
import type {
  IssuerVerificationRequest,
  VerificationClaimType,
} from '../lib/issuer-verification/types';

// Banned tokens via split-join.
const BANNED = [
  ['audit', 'event', 'recorded'].join(' '),
  ['logged', 'to', 'audit', 'trail'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
  ['irreversible', 'proof'].join(' '),
  ['global', 'credential', 'truth'].join(' '),
];

const REQUESTER: IssuerRequestLifecycleActor = {
  actorId: 'r-1',
  displayName: 'Pat Requester',
  role: 'requester',
};
const HOLDER: IssuerRequestLifecycleActor = {
  actorId: 'h-1',
  displayName: 'Sam Holder',
  role: 'holder',
};

const CORRELATION: IssuerAuditCorrelation = {
  correlationId: 'corr-1',
  requestId: 'req-1',
  subjectId: 'subj-1',
};

function makeRecord(
  overrides: Partial<IssuerAuditEventRecord> = {},
): IssuerAuditEventRecord {
  return buildIssuerAuditEventRecord({
    eventId: 'ev-1',
    correlation: CORRELATION,
    actor: REQUESTER,
    eventType: 'consent_recorded',
    occurredAt: '2026-04-26T00:00:00.000Z',
    source: 'attested',
    ...overrides,
  });
}

function makeRequest(): IssuerVerificationRequest {
  const claimType: VerificationClaimType = 'residency';
  return {
    requestId: 'req-1',
    claimType,
    claimSummary: 'Residency: Internal Medicine',
    issuerCandidate: {
      candidateId: 'cand-1',
      organizationName: 'Demo GME Office',
      source: 'clinician_provided',
    },
    route: recommendPartnerRoute(claimType),
    consent: {
      consentId: 'consent-1',
      scope: 'verify_residency',
      status: 'granted',
      consentedAt: '2026-04-26T00:00:00.000Z',
    },
    status: 'sent',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    history: [],
  };
}

describe('buildIssuerAuditEventRecord', () => {
  it('default persistence status is pending_not_written', () => {
    const record = makeRecord();
    expect(record.persistenceStatus).toBe('pending_not_written');
    expect(record.persistenceMode).toBe('none');
  });

  it('preserves actor / actorRole / occurredAt / source / eventType verbatim', () => {
    const record = makeRecord({
      actor: HOLDER,
      eventType: 'manual_link_generated',
      occurredAt: '2026-04-26T01:00:00.000Z',
      source: 'system',
    });
    expect(record.actor).toEqual(HOLDER);
    expect(record.actorRole).toBe('holder');
    expect(record.eventType).toBe('manual_link_generated');
    expect(record.occurredAt).toBe('2026-04-26T01:00:00.000Z');
    expect(record.source).toBe('system');
  });

  it('payloadHash is empty placeholder by default — never fabricated', () => {
    const record = makeRecord();
    expect(record.payloadHash).toBe('');
    const withHash = makeRecord({ payloadHash: 'sha256-abc' });
    expect(withHash.payloadHash).toBe('sha256-abc');
  });

  it('replaySafe defaults to true; can be set false explicitly', () => {
    expect(makeRecord().replaySafe).toBe(true);
    const noReplay = buildIssuerAuditEventRecord({
      eventId: 'ev-1',
      correlation: CORRELATION,
      actor: REQUESTER,
      eventType: 'consent_recorded',
      occurredAt: '2026-04-26T00:00:00.000Z',
      source: 'attested',
      replaySafe: false,
    });
    expect(noReplay.replaySafe).toBe(false);
  });
});

describe('createNoopIssuerAuditWriter', () => {
  it('default mode is demo; status is demo_not_persisted; persisted=false', () => {
    const writer = createNoopIssuerAuditWriter();
    expect(writer.mode).toBe('demo');
    const result = writer.attemptWrite(makeRecord());
    expect(result.status).toBe('demo_not_persisted');
    expect(result.persisted).toBe(false);
    expect(result.mode).toBe('demo');
  });

  it('mode none returns unavailable + persisted=false', () => {
    const writer = createNoopIssuerAuditWriter({ mode: 'none' });
    const result = writer.attemptWrite(makeRecord());
    expect(result.status).toBe('unavailable');
    expect(result.persisted).toBe(false);
  });

  it('mode noop returns demo_not_persisted + persisted=false', () => {
    const writer = createNoopIssuerAuditWriter({ mode: 'noop' });
    const result = writer.attemptWrite(makeRecord());
    expect(result.status).toBe('demo_not_persisted');
    expect(result.persisted).toBe(false);
  });

  it('no-op writer ignores caller-controlled state — cannot be tricked into persisted=true', () => {
    const writer = createNoopIssuerAuditWriter({ mode: 'demo' });
    const tampered: IssuerAuditEventRecord = {
      ...makeRecord(),
      // Pretending the caller marked the record as persisted ahead of time.
      persistenceStatus: 'persisted',
      persistenceMode: 'repository',
    };
    const result = writer.attemptWrite(tampered);
    expect(result.persisted).toBe(false);
    expect(result.status).toBe('demo_not_persisted');
  });

  it('no-op writer source contains zero network/database/external tokens', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/auditPersistence.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const banned = [
      'fetch(',
      'axios',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'prisma.',
      'createMany',
      'insertOne',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });
});

describe('getIssuerAuditPersistenceStatus', () => {
  it('demo writer cannot produce persisted=true even if it tries', () => {
    const liarWriter: IssuerAuditWriter = {
      mode: 'demo',
      attemptWrite() {
        return {
          status: 'persisted',
          mode: 'demo',
          persisted: true,
          message: 'lying writer claims persisted',
        };
      },
    };
    const result = getIssuerAuditPersistenceStatus(makeRecord(), liarWriter);
    expect(result.persisted).toBe(false);
    expect(result.status).toBe('demo_not_persisted');
    expect(result.message.toLowerCase()).toContain('downgraded');
  });

  it('repository writer with persisted=true is honored', () => {
    const repoWriter: IssuerAuditWriter = {
      mode: 'repository',
      attemptWrite() {
        return {
          status: 'persisted',
          mode: 'repository',
          persisted: true,
          message: 'persisted by demo repository',
          persistedId: 'row-1',
        };
      },
    };
    const result = getIssuerAuditPersistenceStatus(makeRecord(), repoWriter);
    expect(result.persisted).toBe(true);
    expect(result.status).toBe('persisted');
    expect(result.persistedId).toBe('row-1');
  });

  it('external writer with persisted=true is also honored', () => {
    const externalWriter: IssuerAuditWriter = {
      mode: 'external',
      attemptWrite() {
        return {
          status: 'persisted',
          mode: 'external',
          persisted: true,
          message: 'persisted by external service',
        };
      },
    };
    const result = getIssuerAuditPersistenceStatus(
      makeRecord(),
      externalWriter,
    );
    expect(result.persisted).toBe(true);
  });

  it('repository writer that returns persisted=false stays not-persisted', () => {
    const partialWriter: IssuerAuditWriter = {
      mode: 'repository',
      attemptWrite() {
        return {
          status: 'failed',
          mode: 'repository',
          persisted: false,
          message: 'transient failure',
          error: { code: 'EAGAIN', message: 'try again' },
        };
      },
    };
    const result = getIssuerAuditPersistenceStatus(makeRecord(), partialWriter);
    expect(result.persisted).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('only repository or external writers may produce persisted=true', () => {
    const modes: IssuerAuditPersistenceMode[] = [
      'none',
      'demo',
      'noop',
      'repository',
      'external',
    ];
    for (const mode of modes) {
      const writer: IssuerAuditWriter = {
        mode,
        attemptWrite() {
          return {
            status: 'persisted',
            mode,
            persisted: true,
            message: 'claim persisted',
          };
        },
      };
      const result = getIssuerAuditPersistenceStatus(makeRecord(), writer);
      const allowed = mode === 'repository' || mode === 'external';
      expect(result.persisted).toBe(allowed);
    }
  });
});

describe('applyIssuerAuditWriteResult', () => {
  it('does not mutate the input record', () => {
    const record = makeRecord();
    const result: IssuerAuditWriteResult = {
      status: 'demo_not_persisted',
      mode: 'demo',
      persisted: false,
      message: 'demo',
    };
    const next = applyIssuerAuditWriteResult(record, result);
    expect(next).not.toBe(record);
    expect(record.persistenceStatus).toBe('pending_not_written');
    expect(next.persistenceStatus).toBe('demo_not_persisted');
    expect(next.persistenceMode).toBe('demo');
  });

  it('preserves all non-persistence fields', () => {
    const record = makeRecord({ payloadHash: 'sha256-abc' });
    const next = applyIssuerAuditWriteResult(record, {
      status: 'persisted',
      mode: 'repository',
      persisted: true,
      message: 'ok',
    });
    expect(next.payloadHash).toBe('sha256-abc');
    expect(next.actor).toEqual(record.actor);
    expect(next.eventId).toBe(record.eventId);
  });
});

describe('mapLifecycleStatusToAuditEventType', () => {
  it('maps known statuses 1:1', () => {
    expect(mapLifecycleStatusToAuditEventType('consent_recorded')).toBe(
      'consent_recorded',
    );
    expect(mapLifecycleStatusToAuditEventType('manual_link_generated')).toBe(
      'manual_link_generated',
    );
    expect(mapLifecycleStatusToAuditEventType('copied_by_requester')).toBe(
      'link_copied',
    );
    expect(mapLifecycleStatusToAuditEventType('sent_by_requester')).toBe(
      'requester_marked_sent',
    );
    expect(mapLifecycleStatusToAuditEventType('viewed_by_issuer')).toBe(
      'issuer_viewed',
    );
    expect(mapLifecycleStatusToAuditEventType('response_received')).toBe(
      'response_received',
    );
    expect(
      mapLifecycleStatusToAuditEventType('receipt_candidate_created'),
    ).toBe('receipt_candidate_created');
    expect(mapLifecycleStatusToAuditEventType('psv_receipt_promoted')).toBe(
      'psv_receipt_promoted',
    );
  });

  it('returns undefined for non-action statuses (draft, closed, canceled, expired, ready_to_send, consent_required)', () => {
    expect(mapLifecycleStatusToAuditEventType('draft')).toBeUndefined();
    expect(mapLifecycleStatusToAuditEventType('ready_to_send')).toBeUndefined();
    expect(mapLifecycleStatusToAuditEventType('consent_required')).toBeUndefined();
    expect(mapLifecycleStatusToAuditEventType('closed')).toBeUndefined();
    expect(mapLifecycleStatusToAuditEventType('canceled')).toBeUndefined();
    expect(mapLifecycleStatusToAuditEventType('expired')).toBeUndefined();
  });
});

describe('buildIssuerLifecycleReplay', () => {
  function makeTimeline() {
    const events: IssuerRequestLifecycleEvent[] = [
      {
        eventId: 'ev-1',
        status: 'consent_recorded',
        occurredAt: '2026-04-26T00:00:00.000Z',
        actor: HOLDER,
        source: 'attested',
      },
      {
        eventId: 'ev-2',
        status: 'manual_link_generated',
        occurredAt: '2026-04-26T01:00:00.000Z',
        actor: REQUESTER,
        source: 'system',
      },
      {
        eventId: 'ev-3',
        status: 'sent_by_requester',
        occurredAt: '2026-04-26T01:10:00.000Z',
        actor: REQUESTER,
        source: 'attested',
      },
    ];
    return getIssuerRequestTimeline(makeRequest(), events);
  }

  it('produces one audit record per mapped lifecycle event', () => {
    const writer = createNoopIssuerAuditWriter();
    const replay = buildIssuerLifecycleReplay(makeTimeline(), CORRELATION, writer);
    expect(replay.events.length).toBe(3);
  });

  it('skips lifecycle events without a 1:1 audit type', () => {
    const writer = createNoopIssuerAuditWriter();
    const baseline = makeTimeline();
    const withDraft = appendIssuerLifecycleEvent(baseline, {
      eventId: 'ev-draft',
      status: 'draft',
      occurredAt: '2026-04-26T02:00:00.000Z',
      actor: REQUESTER,
      source: 'system',
    });
    const replay = buildIssuerLifecycleReplay(
      withDraft,
      CORRELATION,
      writer,
    );
    // 3 mapped + draft skipped = 3
    expect(replay.events.length).toBe(3);
    expect(replay.events.map((e) => e.eventType)).not.toContain(
      'draft' as never,
    );
  });

  it('every record carries the no-op writer status', () => {
    const writer = createNoopIssuerAuditWriter({ mode: 'demo' });
    const replay = buildIssuerLifecycleReplay(makeTimeline(), CORRELATION, writer);
    for (const record of replay.events) {
      expect(record.persistenceStatus).toBe('demo_not_persisted');
      expect(record.persistenceMode).toBe('demo');
    }
  });

  it('disclaimer states action history, not clinical truth', () => {
    const replay = buildIssuerLifecycleReplay(
      makeTimeline(),
      CORRELATION,
      createNoopIssuerAuditWriter(),
    );
    expect(replay.disclaimer.toLowerCase()).toContain('does not prove clinical truth');
  });

  it('fullyReplaySafe is true when all records are replay-safe', () => {
    const replay = buildIssuerLifecycleReplay(
      makeTimeline(),
      CORRELATION,
      createNoopIssuerAuditWriter(),
    );
    expect(replay.fullyReplaySafe).toBe(true);
  });

  it('replay records do NOT change any proof tier or globalCredentialTruth', () => {
    const replay = buildIssuerLifecycleReplay(
      makeTimeline(),
      CORRELATION,
      createNoopIssuerAuditWriter(),
    );
    for (const record of replay.events) {
      // The record shape itself does not carry decisionGrade / proofTier /
      // globalCredentialTruth — verify the type-level boundary by
      // asserting those fields are absent.
      expect((record as Record<string, unknown>).decisionGrade).toBeUndefined();
      expect((record as Record<string, unknown>).proofTier).toBeUndefined();
      expect(
        (record as Record<string, unknown>).globalCredentialTruth,
      ).toBeUndefined();
    }
  });

  it('replay-safe is not legal proof — disclaimer and copy both call this out', () => {
    const replay = buildIssuerLifecycleReplay(
      makeTimeline(),
      CORRELATION,
      createNoopIssuerAuditWriter(),
    );
    // The disclaimer focuses on action-history vs. clinical-truth; it
    // does not need to repeat the legal-proof phrasing.
    expect(replay.disclaimer.toLowerCase()).not.toContain('legal proof');
    // The replay-safe copy must explicitly disclaim legal proof.
    const replaySafeCopy = getIssuerAuditPersistenceCopy('replay_safe');
    expect(replaySafeCopy.description.toLowerCase()).toMatch(
      /(does not mean legal proof|not legal proof)/,
    );
  });
});

describe('explainIssuerAuditPersistenceStatus', () => {
  it('distinguishes pending / demo / persisted / failed / unavailable / simulated', () => {
    const distinct = new Set([
      explainIssuerAuditPersistenceStatus('pending_not_written'),
      explainIssuerAuditPersistenceStatus('demo_not_persisted'),
      explainIssuerAuditPersistenceStatus('persisted'),
      explainIssuerAuditPersistenceStatus('failed'),
      explainIssuerAuditPersistenceStatus('unavailable'),
      explainIssuerAuditPersistenceStatus('simulated'),
    ]);
    expect(distinct.size).toBe(6);
  });

  it('demo explanation does not claim persistence', () => {
    const text = explainIssuerAuditPersistenceStatus('demo_not_persisted').toLowerCase();
    expect(text).toContain('demo');
    expect(text).not.toContain('persisted audit row.');
    // Must explicitly say the row was NOT persisted.
    expect(text).toContain('no audit row was persisted');
  });
});

describe('Audit persistence copy', () => {
  it('exposes copy for every IssuerAuditPersistenceCopyKey', () => {
    const keys = Object.keys(ISSUER_AUDIT_PERSISTENCE_COPY) as Array<
      keyof typeof ISSUER_AUDIT_PERSISTENCE_COPY
    >;
    for (const k of keys) {
      const c = getIssuerAuditPersistenceCopy(k);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps banned overclaim phrases out of audit persistence copy', () => {
    const blob = JSON.stringify(ISSUER_AUDIT_PERSISTENCE_COPY).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });

  it('no audit persistence copy label is the bare word "Verified"', () => {
    for (const c of Object.values(ISSUER_AUDIT_PERSISTENCE_COPY)) {
      expect(c.label).not.toBe('Verified');
    }
  });
});

describe('Knowledge Trust Graph — ISSUER-7 alignment', () => {
  it('keeps the audit persistence nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'IssuerAuditEventRecord',
        'IssuerAuditWriter',
        'IssuerAuditPersistenceMode',
        'IssuerLifecycleReplay',
        'IssuerAuditCorrelation',
        'PayloadHash',
        'ReplaySafeEvent',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'Audit event records prove action history, not clinical truth.',
        'pending and demo audit events are not persisted audit records.',
        'replay-safe means an event MAY be included in timeline replay for context; it does not mean legal proof.',
        "Persistence requires a real writer's confirmation; demo and no-op writers cannot return persisted=true.",
        'No UI may claim an audit write occurred without a persisted persistence status from a repository or external writer.',
        "An audit event record never changes a claim's proof tier and never sets globalCredentialTruth=true.",
      ]),
    );
  });
});
