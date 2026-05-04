import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  asAdapterDecisionMetadata,
  assertBackendPersistenceSafe,
  buildBackendPersistenceDeferDecision,
  evaluateBackendPersistenceReadiness,
  explainBackendPersistenceDecision,
} from '../lib/issuer-verification/backendPersistenceDecision';
import type {
  BackendPersistenceCapabilityCheck,
  BackendPersistenceReadinessInput,
} from '../lib/issuer-verification/backendPersistenceDecision';
import {
  previewRepositoryAdapterResultWithDecision,
} from '../lib/issuer-verification/repositoryAuditAdapter';
import { chooseIssuerAuditPersistenceAdapter } from '../lib/issuer-verification/auditPersistenceAdapter';
import { buildIssuerAuditEventRecord } from '../lib/issuer-verification/auditPersistence';

const BANNED = [
  ['audit', 'event', 'recorded'].join(' '),
  ['logged', 'to', 'audit', 'trail'].join(' '),
  ['production', 'audit', 'trail'].join(' '),
  ['persisted', 'by', 'default'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
  ['irreversible', 'proof'].join(' '),
  ['global', 'credential', 'truth'].join(' '),
  ['tamper', 'proof'].join('-'),
];

const ALL_CAPS_TRUE: BackendPersistenceReadinessInput['capabilities'] = {
  stores_scoped_psv_receipt: true,
  preserves_limitation_notes: true,
  preserves_source_basis: true,
  preserves_responder_attribution: true,
  preserves_freshness_and_scope: true,
  distinguishes_candidate_vs_receipt: true,
  supports_audit_event_persistence: true,
  exposes_server_only_writer: true,
  has_test_coverage: true,
};

function evaluate(
  caps: BackendPersistenceReadinessInput['capabilities'] = {},
) {
  return evaluateBackendPersistenceReadiness({
    decidedAt: '2026-04-26T00:00:00.000Z',
    capabilities: caps,
  });
}

describe('evaluateBackendPersistenceReadiness — defaults', () => {
  it('default (no capabilities) returns defer_until_contract_aligned', () => {
    const result = evaluate();
    expect(result.decision.status).toBe('defer_until_contract_aligned');
    expect(result.allCapabilitiesSatisfied).toBe(false);
  });

  it('default decision implies repository_candidate adapter, never repository_enabled', () => {
    const result = evaluate();
    expect(result.decision.impliedAdapterKind).toBe('repository_candidate');
    expect(result.decision.impliedAdapterKind).not.toBe('repository_enabled');
  });

  it('default decision lists every capability as unsatisfied', () => {
    const result = evaluate();
    for (const check of result.decision.capabilityChecks) {
      expect(check.satisfied).toBe(false);
      expect(check.mappedBlocker).toBeDefined();
    }
    expect(result.decision.capabilityChecks.length).toBe(9);
  });

  it('default decision blockers cover every category cited by the contract audit', () => {
    const result = evaluate();
    expect(result.decision.blockers).toEqual(
      expect.arrayContaining([
        'contract_shape_mismatch',
        'missing_limitations',
        'missing_source_basis',
        'missing_responder_attribution',
        'missing_freshness_scope',
        'no_writer_confirmation',
        'client_server_boundary_violation',
        'untested_repository',
      ]),
    );
  });

  it('buildBackendPersistenceDeferDecision returns defer status with the supplied reason', () => {
    const decision = buildBackendPersistenceDeferDecision({
      decidedAt: '2026-04-26T00:00:00.000Z',
      reason: 'demo defer reason',
    });
    expect(decision.status).toBe('defer_until_contract_aligned');
    expect(decision.reason).toBe('demo defer reason');
  });
});

describe('evaluateBackendPersistenceReadiness — single-capability gates', () => {
  it.each<{
    capability: keyof NonNullable<BackendPersistenceReadinessInput['capabilities']>;
    expectedBlocker: string;
  }>([
    {
      capability: 'preserves_limitation_notes',
      expectedBlocker: 'missing_limitations',
    },
    {
      capability: 'preserves_source_basis',
      expectedBlocker: 'missing_source_basis',
    },
    {
      capability: 'preserves_responder_attribution',
      expectedBlocker: 'missing_responder_attribution',
    },
    {
      capability: 'preserves_freshness_and_scope',
      expectedBlocker: 'missing_freshness_scope',
    },
    {
      capability: 'supports_audit_event_persistence',
      expectedBlocker: 'no_writer_confirmation',
    },
    {
      capability: 'exposes_server_only_writer',
      expectedBlocker: 'client_server_boundary_violation',
    },
    {
      capability: 'has_test_coverage',
      expectedBlocker: 'untested_repository',
    },
  ])(
    'missing $capability surfaces blocker $expectedBlocker',
    ({ capability, expectedBlocker }) => {
      // Set every capability satisfied EXCEPT the one under test.
      const caps: NonNullable<BackendPersistenceReadinessInput['capabilities']> = {
        ...ALL_CAPS_TRUE,
        [capability]: false,
      };
      const result = evaluate(caps);
      expect(result.decision.status).not.toBe('implement_now');
      expect(result.decision.blockers).toContain(expectedBlocker);
    },
  );

  it('client/server boundary violation alone produces status=unsafe', () => {
    const caps: NonNullable<BackendPersistenceReadinessInput['capabilities']> = {
      ...ALL_CAPS_TRUE,
      exposes_server_only_writer: false,
    };
    const result = evaluate(caps);
    expect(result.decision.status).toBe('unsafe');
  });

  it('missing audit-event persistence (without boundary violation) routes to needs_backend_adapter', () => {
    const caps: NonNullable<BackendPersistenceReadinessInput['capabilities']> = {
      ...ALL_CAPS_TRUE,
      supports_audit_event_persistence: false,
    };
    const result = evaluate(caps);
    expect(result.decision.status).toBe('needs_backend_adapter');
  });
});

describe('evaluateBackendPersistenceReadiness — implement_now path', () => {
  it('with every capability satisfied returns implement_now', () => {
    const result = evaluate(ALL_CAPS_TRUE);
    expect(result.decision.status).toBe('implement_now');
    expect(result.allCapabilitiesSatisfied).toBe(true);
    expect(result.decision.impliedAdapterKind).toBe('repository_enabled');
    expect(result.decision.blockers).toEqual([]);
  });

  it('implement_now recommendation still requires writer confirmation per row', () => {
    const result = evaluate(ALL_CAPS_TRUE);
    const text = result.decision.recommendation.summary.toLowerCase();
    expect(text).toContain('writer confirmation');
  });

  it('reason override is preserved verbatim', () => {
    const result = evaluateBackendPersistenceReadiness({
      decidedAt: '2026-04-26T00:00:00.000Z',
      capabilities: ALL_CAPS_TRUE,
      reason: 'explicit reason from caller',
    });
    expect(result.decision.reason).toBe('explicit reason from caller');
  });
});

describe('assertBackendPersistenceSafe', () => {
  it('throws unless status is implement_now', () => {
    const defer = evaluate().decision;
    expect(() => assertBackendPersistenceSafe(defer)).toThrow(/implement_now/);
  });

  it('does not throw when status is implement_now', () => {
    const ready = evaluate(ALL_CAPS_TRUE).decision;
    expect(() => assertBackendPersistenceSafe(ready)).not.toThrow();
  });
});

describe('explainBackendPersistenceDecision', () => {
  it('includes status / blockers / recommendation summary', () => {
    const decision = evaluate().decision;
    const text = explainBackendPersistenceDecision(decision);
    expect(text.toLowerCase()).toContain('defer_until_contract_aligned');
    expect(text.toLowerCase()).toContain('contract_shape_mismatch');
  });

  it('does not contain banned phrases for any capability configuration', () => {
    const decisions = [
      evaluate().decision,
      evaluate(ALL_CAPS_TRUE).decision,
      evaluate({ ...ALL_CAPS_TRUE, exposes_server_only_writer: false }).decision,
      evaluate({
        ...ALL_CAPS_TRUE,
        supports_audit_event_persistence: false,
      }).decision,
    ];
    for (const decision of decisions) {
      const text = explainBackendPersistenceDecision(decision).toLowerCase();
      for (const phrase of BANNED) {
        expect(text).not.toContain(phrase.toLowerCase());
      }
    }
  });
});

describe('Decision purity — no I/O, no DB, no network', () => {
  it('helper source contains no fetch/axios/prisma/db/AuditEvent/email/SMS/webhook tokens', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/backendPersistenceDecision.ts',
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
      "import('@/",
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });

  it('helper does not statically import any backend module', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/backendPersistenceDecision.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]apps\/api/);
    expect(src).not.toMatch(/from ['"]@vitalcv\/psv['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*prisma_client['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*psvReceipts\.repo['"]/);
  });
});

describe('Cannot upgrade truth tier', () => {
  it('decision payload carries no decisionGrade / proofTier / globalCredentialTruth fields', () => {
    const decision = evaluate(ALL_CAPS_TRUE).decision;
    expect((decision as Record<string, unknown>).decisionGrade).toBeUndefined();
    expect((decision as Record<string, unknown>).proofTier).toBeUndefined();
    expect(
      (decision as Record<string, unknown>).globalCredentialTruth,
    ).toBeUndefined();
  });

  it('capability check items carry no truth-tier fields', () => {
    const decision = evaluate().decision;
    for (const check of decision.capabilityChecks) {
      expect((check as Record<string, unknown>).decisionGrade).toBeUndefined();
      expect((check as Record<string, unknown>).proofTier).toBeUndefined();
      expect(
        (check as Record<string, unknown>).globalCredentialTruth,
      ).toBeUndefined();
    }
  });
});

describe('asAdapterDecisionMetadata', () => {
  it('defer decision maps to repository_candidate kind in adapter metadata', () => {
    const meta = asAdapterDecisionMetadata(evaluate().decision);
    expect(meta.kind).toBe('repository_candidate');
    expect(meta.reason.toLowerCase()).toContain('defer_until_contract_aligned');
  });

  it('implement_now decision maps to repository_enabled kind', () => {
    const meta = asAdapterDecisionMetadata(evaluate(ALL_CAPS_TRUE).decision);
    expect(meta.kind).toBe('repository_enabled');
    expect(meta.wiringDescription?.toLowerCase()).toContain(
      'backend persistence enabled',
    );
  });

  it('repository adapter preview surfaces the upstream defer summary verbatim', () => {
    const decision = evaluate().decision;
    const adapterDecision = chooseIssuerAuditPersistenceAdapter({
      mode: 'repository',
    });
    const record = buildIssuerAuditEventRecord({
      eventId: 'ev-1',
      correlation: { correlationId: 'c-1', requestId: 'r-1' },
      actor: {
        actorId: 'a-1',
        displayName: 'demo',
        role: 'demo',
      },
      eventType: 'consent_recorded',
      occurredAt: '2026-04-26T00:00:00.000Z',
      source: 'attested',
    });
    const result = previewRepositoryAdapterResultWithDecision(
      adapterDecision,
      record,
      {
        status: decision.status,
        blockers: [...decision.blockers],
        reason: decision.recommendation.summary,
      },
    );
    expect(result.persisted).toBe(false);
    expect(result.message.toLowerCase()).toContain(
      'defer_until_contract_aligned',
    );
    expect(result.message.toLowerCase()).toContain(
      'contract_shape_mismatch',
    );
  });
});

describe('Knowledge Trust Graph — ISSUER-9 alignment', () => {
  it('keeps the backend persistence nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'BackendPersistenceDecision',
        'BackendPersistenceCapabilityCheck',
        'BackendPersistenceBlocker',
        'ServerRepositoryAuditAdapter',
        'WriterConfirmation',
        'ContractAlignment',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        "Backend repository compatibility is not persistence; only a writer's confirmation makes a record persisted.",
        'Real backend persistence requires writer confirmation per row; absence of confirmation keeps the record at pending_not_written.',
        'No client-side path may write audit records; the persistence boundary lives on the server.',
        'Deferring backend persistence is safer than wiring a contract-misaligned writer; defer is the documented default.',
        'Every BackendPersistenceCapabilityCheck must be satisfied before a BackendPersistenceDecision returns implement_now.',
        'ServerRepositoryAuditAdapter exists only after contract alignment; this slice does not ship one.',
      ]),
    );
  });
});

describe('Capability check shape', () => {
  it('every default capability check carries notes and a mappedBlocker when unsatisfied', () => {
    const decision = evaluate().decision;
    for (const check of decision.capabilityChecks) {
      expect(check.notes.length).toBeGreaterThan(0);
      const ck = check as BackendPersistenceCapabilityCheck;
      expect(ck.mappedBlocker).toBeDefined();
    }
  });

  it('a satisfied capability check has no mappedBlocker', () => {
    const decision = evaluate(ALL_CAPS_TRUE).decision;
    for (const check of decision.capabilityChecks) {
      expect(check.satisfied).toBe(true);
      expect(check.mappedBlocker).toBeUndefined();
    }
  });
});
