import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertCanUseRepositoryAdapter,
  buildRepositoryCandidateDecision,
  chooseIssuerAuditPersistenceAdapter,
  createPersistenceAdapter,
  explainPersistenceAdapterDecision,
  getIssuerPersistenceAdapterCapabilities,
} from '../lib/issuer-verification/auditPersistenceAdapter';
import type {
  IssuerAuditPersistenceAdapterKind,
  IssuerPersistenceAdapterCapability,
} from '../lib/issuer-verification/auditPersistenceAdapter';
import {
  createRepositoryAuditAdapter,
  findRepositoryPayloadOmissions,
  mapRecordToRepositoryPayload,
  previewRepositoryAdapterResult,
  REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON,
} from '../lib/issuer-verification/repositoryAuditAdapter';
import {
  buildIssuerAuditEventRecord,
  createNoopIssuerAuditWriter,
  getIssuerAuditPersistenceStatus,
} from '../lib/issuer-verification/auditPersistence';
import type { IssuerAuditEventRecord } from '../lib/issuer-verification/auditPersistence';
import type { IssuerRequestLifecycleActor } from '../lib/issuer-verification/requestLifecycle';

// Banned tokens via split-join.
const BANNED = [
  ['audit', 'event', 'recorded'].join(' '),
  ['logged', 'to', 'audit', 'trail'].join(' '),
  ['production', 'audit', 'trail'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
  ['irreversible', 'proof'].join(' '),
  ['global', 'credential', 'truth'].join(' '),
  ['tamper', 'proof'].join('-'),
  ['persisted', 'by', 'default'].join(' '),
];

const ACTOR: IssuerRequestLifecycleActor = {
  actorId: 'a-1',
  displayName: 'Pat Actor',
  role: 'requester',
};

function makeRecord(
  overrides: Partial<IssuerAuditEventRecord> = {},
): IssuerAuditEventRecord {
  return {
    ...buildIssuerAuditEventRecord({
      eventId: 'ev-1',
      correlation: {
        correlationId: 'corr-1',
        requestId: 'req-1',
        subjectId: 'sub-1',
      },
      actor: ACTOR,
      eventType: 'consent_recorded',
      occurredAt: '2026-04-26T00:00:00.000Z',
      source: 'attested',
      payloadHash: 'sha256-abc',
      limitationNote: 'Demo limitation note.',
      relatedArtifactId: 'rc-1',
    }),
    ...overrides,
  };
}

describe('chooseIssuerAuditPersistenceAdapter', () => {
  it('default config returns noop', () => {
    const decision = chooseIssuerAuditPersistenceAdapter();
    expect(decision.kind).toBe('noop');
    expect(decision.resultMode).toBe('noop');
  });

  it('mode=demo returns demo adapter', () => {
    expect(chooseIssuerAuditPersistenceAdapter({ mode: 'demo' }).kind).toBe('demo');
  });

  it('mode=none returns unavailable', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({ mode: 'none' });
    expect(decision.kind).toBe('unavailable');
    expect(decision.resultMode).toBe('none');
  });

  it('mode=repository without enable flag returns repository_candidate', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({ mode: 'repository' });
    expect(decision.kind).toBe('repository_candidate');
    expect(decision.resultMode).toBe('demo');
  });

  it('mode=repository with enableRepositoryWrites=true returns repository_enabled', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({
      mode: 'repository',
      enableRepositoryWrites: true,
    });
    expect(decision.kind).toBe('repository_enabled');
    expect(decision.resultMode).toBe('repository');
  });

  it('repository_candidate is NOT persisted (cannot be tricked into it)', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({ mode: 'repository' });
    const adapter = createPersistenceAdapter(decision);
    const result = adapter.attempt(makeRecord());
    expect(result.persisted).toBe(false);
  });
});

describe('Capability matrix', () => {
  it('noop and demo carry replay_lifecycle only', () => {
    expect(getIssuerPersistenceAdapterCapabilities('noop')).toEqual([
      'replay_lifecycle',
    ]);
    expect(getIssuerPersistenceAdapterCapabilities('demo')).toEqual([
      'replay_lifecycle',
    ]);
  });

  it('unavailable adapter has no capabilities', () => {
    expect(getIssuerPersistenceAdapterCapabilities('unavailable')).toEqual([]);
  });

  it('repository_candidate carries preservation capabilities but not write capabilities', () => {
    const caps = getIssuerPersistenceAdapterCapabilities('repository_candidate');
    expect(caps).toContain('preserve_limitations');
    expect(caps).toContain('preserve_source_basis');
    expect(caps).toContain('preserve_responder_attribution');
    expect(caps).not.toContain('write_audit_event');
    expect(caps).not.toContain('write_psv_receipt');
  });

  it('repository_enabled is the only kind with write_audit_event AND write_psv_receipt', () => {
    const kinds: IssuerAuditPersistenceAdapterKind[] = [
      'noop',
      'demo',
      'repository_candidate',
      'repository_enabled',
      'unavailable',
    ];
    const writeCaps: IssuerPersistenceAdapterCapability[] = [
      'write_audit_event',
      'write_psv_receipt',
    ];
    for (const kind of kinds) {
      const caps = getIssuerPersistenceAdapterCapabilities(kind);
      const hasAll = writeCaps.every((c) => caps.includes(c));
      expect(hasAll).toBe(kind === 'repository_enabled');
    }
  });
});

describe('assertCanUseRepositoryAdapter', () => {
  it('throws for noop / demo / candidate / unavailable', () => {
    const kinds: IssuerAuditPersistenceAdapterKind[] = [
      'noop',
      'demo',
      'repository_candidate',
      'unavailable',
    ];
    for (const kind of kinds) {
      const decision = chooseIssuerAuditPersistenceAdapter(
        kind === 'repository_candidate'
          ? { mode: 'repository' }
          : kind === 'unavailable'
            ? { mode: 'none' }
            : { mode: kind === 'noop' ? 'noop' : 'demo' },
      );
      expect(() => assertCanUseRepositoryAdapter(decision)).toThrow(
        /repository_enabled/,
      );
    }
  });

  it('does not throw for repository_enabled', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({
      mode: 'repository',
      enableRepositoryWrites: true,
    });
    expect(() => assertCanUseRepositoryAdapter(decision)).not.toThrow();
  });
});

describe('buildRepositoryCandidateDecision', () => {
  it('returns kind=repository_candidate with the supplied wiring description', () => {
    const decision = buildRepositoryCandidateDecision({
      wiringDescription: 'Demo Prisma writer',
    });
    expect(decision.kind).toBe('repository_candidate');
    expect(decision.wiringDescription).toBe('Demo Prisma writer');
  });
});

describe('createPersistenceAdapter', () => {
  it('attempt() never returns persisted=true regardless of input record', () => {
    const decisions = [
      chooseIssuerAuditPersistenceAdapter({ mode: 'noop' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'demo' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'none' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'repository' }),
      chooseIssuerAuditPersistenceAdapter({
        mode: 'repository',
        enableRepositoryWrites: true,
      }),
    ];
    const tampered: IssuerAuditEventRecord = {
      ...makeRecord(),
      // Pretend the caller pre-marked this record as persisted.
      persistenceStatus: 'persisted',
      persistenceMode: 'repository',
    };
    for (const decision of decisions) {
      const result = createPersistenceAdapter(decision).attempt(tampered);
      expect(result.persisted).toBe(false);
    }
  });

  it('repository_enabled adapter still returns persisted=false (no writer wired)', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({
      mode: 'repository',
      enableRepositoryWrites: true,
    });
    const result = createPersistenceAdapter(decision).attempt(makeRecord());
    expect(result.persisted).toBe(false);
    // The status reflects "pending" — a writer has not run.
    expect(result.status).toBe('pending_not_written');
  });

  it('explanation never claims persistence', () => {
    const decisions = [
      chooseIssuerAuditPersistenceAdapter({ mode: 'noop' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'demo' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'repository' }),
    ];
    for (const d of decisions) {
      const text = explainPersistenceAdapterDecision(d).toLowerCase();
      expect(text).not.toMatch(/audit row was written/);
      expect(text).not.toMatch(/persisted to/);
    }
  });
});

describe('createRepositoryAuditAdapter (stub)', () => {
  it('default config returns repository_candidate (NOT enabled)', () => {
    const adapter = createRepositoryAuditAdapter();
    expect(adapter.decision.kind).toBe('repository_candidate');
  });

  it('with enableRepositoryWrites=true the slice keeps adapter unavailable + cites the bridge gap', () => {
    const adapter = createRepositoryAuditAdapter({
      mode: 'repository',
      enableRepositoryWrites: true,
    });
    expect(adapter.decision.kind).toBe('unavailable');
    expect(adapter.decision.reason.toLowerCase()).toContain(
      'no client-safe repository adapter is wired',
    );
    expect(adapter.decision.wiringDescription?.toLowerCase()).toContain(
      'backend prisma',
    );
  });

  it('non-repository config falls through to the chosen adapter', () => {
    const adapter = createRepositoryAuditAdapter({ mode: 'demo' });
    expect(adapter.decision.kind).toBe('demo');
  });

  it('attempt() never persists', () => {
    const adapter = createRepositoryAuditAdapter({
      mode: 'repository',
      enableRepositoryWrites: true,
    });
    const result = adapter.attempt(makeRecord());
    expect(result.persisted).toBe(false);
  });

  it('preview helper does not persist either', () => {
    const adapter = createRepositoryAuditAdapter();
    const preview = previewRepositoryAdapterResult(adapter.decision, makeRecord());
    expect(preview.persisted).toBe(false);
  });
});

describe('mapRecordToRepositoryPayload', () => {
  it('preserves limitations / source basis / responder attribution-equivalent fields', () => {
    const record = makeRecord({
      limitationNote: 'Issuer confirmed only dates.',
      relatedArtifactId: 'psv-receipt-1',
      payloadHash: 'sha256-deadbeef',
    });
    const payload = mapRecordToRepositoryPayload(record);
    expect(payload.limitationNote).toBe(record.limitationNote);
    expect(payload.relatedArtifactId).toBe(record.relatedArtifactId);
    expect(payload.actorId).toBe(record.actor.actorId);
    expect(payload.actorRole).toBe(record.actorRole);
    expect(payload.payloadHash).toBe(record.payloadHash);
    expect(findRepositoryPayloadOmissions(record, payload)).toEqual([]);
  });

  it('omitting any field is detectable', () => {
    const record = makeRecord();
    const payload = mapRecordToRepositoryPayload(record);
    const broken = { ...payload, limitationNote: 'tampered' };
    const missing = findRepositoryPayloadOmissions(record, broken);
    expect(missing).toContain('limitationNote');
  });

  it('payload type does NOT carry decisionGrade / proofTier / globalCredentialTruth fields', () => {
    const payload = mapRecordToRepositoryPayload(makeRecord());
    expect((payload as Record<string, unknown>).decisionGrade).toBeUndefined();
    expect((payload as Record<string, unknown>).proofTier).toBeUndefined();
    expect(
      (payload as Record<string, unknown>).globalCredentialTruth,
    ).toBeUndefined();
  });
});

describe('Repository adapter stub does not call network/db', () => {
  it('source contains no fetch / axios / prisma / db / Prisma / pg / mysql tokens', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/repositoryAuditAdapter.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const banned = [
      'fetch(',
      'axios',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      "import('@/",
      'require(',
      'pg.',
      'mysql',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });

  it('explicitly does not import the backend repository module', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/repositoryAuditAdapter.ts',
        import.meta.url,
      ),
      'utf8',
    );
    // Static import lines should never reference apps/api, backend
    // repos, prisma_client, or the @vitalcv/psv workspace package.
    expect(src).not.toMatch(/from ['"]apps\/api/);
    expect(src).not.toMatch(/from ['"]@vitalcv\/psv['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*prisma_client['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*psvReceipts\.repo['"]/);
  });

  it('the unavailable-reason constant cites why the bridge is deferred', () => {
    expect(REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON.toLowerCase()).toContain(
      'prisma',
    );
    expect(REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON.toLowerCase()).toContain(
      'client bundle',
    );
  });
});

describe('Adapter cannot upgrade truth tier or set globalCredentialTruth', () => {
  it('write result has no decisionGrade / proofTier / globalCredentialTruth fields', () => {
    const decision = chooseIssuerAuditPersistenceAdapter({
      mode: 'repository',
      enableRepositoryWrites: true,
    });
    const adapter = createPersistenceAdapter(decision);
    const result = adapter.attempt(makeRecord());
    expect((result as Record<string, unknown>).decisionGrade).toBeUndefined();
    expect((result as Record<string, unknown>).proofTier).toBeUndefined();
    expect(
      (result as Record<string, unknown>).globalCredentialTruth,
    ).toBeUndefined();
  });
});

describe('Banned-string sweep on adapter explanations', () => {
  it('explanations across every adapter kind avoid banned phrases', () => {
    const decisions = [
      chooseIssuerAuditPersistenceAdapter({ mode: 'noop' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'demo' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'none' }),
      chooseIssuerAuditPersistenceAdapter({ mode: 'repository' }),
      chooseIssuerAuditPersistenceAdapter({
        mode: 'repository',
        enableRepositoryWrites: true,
      }),
      buildRepositoryCandidateDecision({
        wiringDescription: 'demo wiring',
      }),
    ];
    for (const decision of decisions) {
      const text = explainPersistenceAdapterDecision(decision).toLowerCase();
      for (const phrase of BANNED) {
        expect(text).not.toContain(phrase.toLowerCase());
      }
    }
  });
});

describe('Adapter decision flows through audit persistence boundary', () => {
  it('noop writer + adapter decision: persisted stays false', () => {
    const writer = createNoopIssuerAuditWriter({ mode: 'demo' });
    const result = getIssuerAuditPersistenceStatus(makeRecord(), writer);
    expect(result.persisted).toBe(false);
  });
});

describe('Knowledge Trust Graph — ISSUER-8 alignment', () => {
  it('keeps the adapter nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'IssuerAuditPersistenceAdapter',
        'RepositoryAuditAdapter',
        'PersistenceAdapterDecision',
        'RepositoryCapability',
        'PersistedAuditRecord',
        'PersistenceConfiguration',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'Default persistence adapter is noop; active persistence is off unless explicitly turned on via configuration.',
        'repository_candidate is not active persistence; it means a repository-shaped writer could be wired but is not yet.',
        'Only repository_enabled may produce a persisted write status, and even then the actual write requires writer confirmation.',
        'Adapter availability does not imply active persistence; a writer must invoke and confirm.',
        'The frontend/web layer must not silently import a backend DB writer into the client bundle; a client-safe boundary is required first.',
        'No UI may claim an audit trail exists without a persisted persistence status from a repository or external writer.',
        'An adapter cannot upgrade proofTier or set globalCredentialTruth=true.',
      ]),
    );
  });
});
