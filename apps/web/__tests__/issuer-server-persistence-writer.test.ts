import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  asAuditWriteResult,
  buildServerPsvReceiptWriteInput,
  canUseServerPsvReceiptWriter,
  createDeferredServerPsvReceiptWriter,
  createUnavailableServerPsvReceiptWriter,
  explainServerWriterResult,
  writePsvReceiptWithConfirmation,
} from '../lib/issuer-verification/serverPsvReceiptWriter';
import type {
  ServerPsvReceiptWriter,
  ServerPsvReceiptWriteInput,
  ServerPsvReceiptWriteResult,
  ServerPsvReceiptWriterConfirmation,
} from '../lib/issuer-verification/serverPsvReceiptWriter';
import type {
  PolicyReviewActor,
  PSVReceipt,
} from '../lib/issuer-verification/types';

const ACTOR: PolicyReviewActor = {
  actorId: 'actor-1',
  displayName: 'Pat Reviewer',
  role: 'policy_reviewer',
};

function fullReceipt(): ServerPsvReceiptWriteInput['receipt'] {
  return {
    psvReceiptId: 'psv-receipt-1',
    psvCandidateId: 'psv-cand-1',
    receiptCandidateId: 'rc-1',
    requestId: 'req-1',
    claimId: 'claim-1',
    claimType: 'residency',
    promotedAt: '2026-04-26T03:00:00.000Z',
    promotedBy: ACTOR,
    sourceBasis: {
      sourceOrganizationName: 'Demo GME Office',
      isContractedAgent: false,
      basisNote: 'Direct from source.',
    },
    attributedResponder: {
      name: 'J. Doe',
      role: 'Program Coordinator',
      attributedAt: '2026-04-26T01:00:00.000Z',
      attributionMethod: 'self_attested',
    },
    scope: {
      claimType: 'residency',
      covers: 'Residency program completion 2018-2021.',
      doesNotCover:
        'Does not cover board certification, license status, or malpractice history.',
      sourceOrganizationName: 'Demo GME Office',
    },
    limitations: [],
    freshness: {
      ttlDays: 365,
      issuedAt: '2026-04-26T03:00:00.000Z',
      staleAfter: '2027-04-26T03:00:00.000Z',
    },
  };
}

function validInput(
  overrides: Partial<ServerPsvReceiptWriteInput> = {},
): ServerPsvReceiptWriteInput {
  return {
    receipt: fullReceipt(),
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('canUseServerPsvReceiptWriter — structural gates', () => {
  it('valid input passes', () => {
    expect(canUseServerPsvReceiptWriter(validInput())).toBeUndefined();
  });

  it.each([
    ['psvReceiptId', 'missing_required_field'] as const,
    ['scope', 'missing_required_field'] as const,
    ['limitations', 'missing_required_field'] as const,
    ['sourceBasis', 'missing_required_field'] as const,
    ['attributedResponder', 'missing_required_field'] as const,
    ['freshness', 'missing_required_field'] as const,
  ])('missing %s on receipt is refused as %s', (field, expected) => {
    const r = { ...fullReceipt() } as Record<string, unknown>;
    delete r[field];
    const failure = canUseServerPsvReceiptWriter({
      receipt: r as ServerPsvReceiptWriteInput['receipt'],
      correlationId: 'corr-1',
    });
    expect(failure).toBe(expected);
  });

  it('missing correlationId is refused as missing_required_field', () => {
    const failure = canUseServerPsvReceiptWriter({
      receipt: fullReceipt(),
      correlationId: '',
    });
    expect(failure).toBe('missing_required_field');
  });

  it('input carrying decisionGrade on the receipt is refused as forbidden_truth_tier_field', () => {
    const r = { ...fullReceipt(), decisionGrade: true } as unknown as ServerPsvReceiptWriteInput['receipt'];
    expect(
      canUseServerPsvReceiptWriter({ receipt: r, correlationId: 'corr-1' }),
    ).toBe('forbidden_truth_tier_field');
  });

  it('input carrying proofTier on the receipt is refused', () => {
    const r = { ...fullReceipt(), proofTier: 'psv_receipt' } as unknown as ServerPsvReceiptWriteInput['receipt'];
    expect(
      canUseServerPsvReceiptWriter({ receipt: r, correlationId: 'corr-1' }),
    ).toBe('forbidden_truth_tier_field');
  });

  it('input carrying globalCredentialTruth on the receipt is refused', () => {
    const r = { ...fullReceipt(), globalCredentialTruth: false } as unknown as ServerPsvReceiptWriteInput['receipt'];
    expect(
      canUseServerPsvReceiptWriter({ receipt: r, correlationId: 'corr-1' }),
    ).toBe('forbidden_truth_tier_field');
  });

  it('client-supplied persisted flag is refused', () => {
    const tampered = {
      ...validInput(),
      persisted: true,
    } as unknown as ServerPsvReceiptWriteInput;
    expect(canUseServerPsvReceiptWriter(tampered)).toBe(
      'client_supplied_persisted_flag',
    );
  });

  it('client-supplied confirmation field is refused', () => {
    const tampered = {
      ...validInput(),
      confirmation: {
        confirmedAt: '2026-04-26T03:00:00.000Z',
        confirmedBy: 'demo',
        writerMode: 'repository',
        persistedRowId: 'row-1',
      },
    } as unknown as ServerPsvReceiptWriteInput;
    expect(canUseServerPsvReceiptWriter(tampered)).toBe(
      'client_supplied_persisted_flag',
    );
  });
});

describe('buildServerPsvReceiptWriteInput — strips forbidden truth-tier fields', () => {
  it('returns a clean receipt object even if input had truth-tier fields', () => {
    const dirty = {
      ...fullReceipt(),
      decisionGrade: true,
      proofTier: 'psv_receipt',
      globalCredentialTruth: false,
    } as unknown as ServerPsvReceiptWriteInput['receipt'];
    const built = buildServerPsvReceiptWriteInput({
      receipt: dirty,
      correlationId: 'corr-1',
    });
    const r = built.receipt as Record<string, unknown>;
    expect(r.decisionGrade).toBeUndefined();
    expect(r.proofTier).toBeUndefined();
    expect(r.globalCredentialTruth).toBeUndefined();
    // But the well-formed fields are still there.
    expect(built.receipt.psvReceiptId).toBe('psv-receipt-1');
    expect(built.receipt.scope).toBeDefined();
  });
});

describe('createDeferredServerPsvReceiptWriter — never persists', () => {
  it('valid input → status=deferred, persisted=false', async () => {
    const writer = createDeferredServerPsvReceiptWriter();
    const result = await writer.attempt(validInput());
    expect(result.status).toBe('deferred');
    expect(result.persisted).toBe(false);
    expect(result.message.toLowerCase()).toContain('deferred pending schema');
    expect(result.preservedReceipt).toEqual(fullReceipt());
  });

  it('invalid input (missing field) → status=failed, persisted=false', async () => {
    const writer = createDeferredServerPsvReceiptWriter();
    const result = await writer.attempt({
      receipt: { ...fullReceipt(), psvReceiptId: '' },
      correlationId: 'corr-1',
    });
    expect(result.status).toBe('failed');
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('missing_required_field');
  });

  it('input with forbidden truth-tier field → status=failed', async () => {
    const writer = createDeferredServerPsvReceiptWriter();
    const result = await writer.attempt({
      receipt: { ...fullReceipt(), globalCredentialTruth: true } as unknown as ServerPsvReceiptWriteInput['receipt'],
      correlationId: 'corr-1',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('forbidden_truth_tier_field');
  });

  it('dryRun=true → status=dry_run, persisted=false', async () => {
    const writer = createDeferredServerPsvReceiptWriter();
    const result = await writer.attempt({ ...validInput(), dryRun: true });
    expect(result.status).toBe('dry_run');
    expect(result.persisted).toBe(false);
  });

  it('preserves limitations / source basis / responder attribution / freshness / scope verbatim on every outcome', async () => {
    const writer = createDeferredServerPsvReceiptWriter();
    const limitations = [
      { kind: 'legally_only' as const, description: 'Demo legally-only.' },
    ];
    const input = validInput({
      receipt: {
        ...fullReceipt(),
        limitations,
      },
    });
    const result = await writer.attempt(input);
    expect(result.preservedReceipt.limitations).toEqual(limitations);
    expect(result.preservedReceipt.sourceBasis).toEqual(
      input.receipt.sourceBasis,
    );
    expect(result.preservedReceipt.attributedResponder).toEqual(
      input.receipt.attributedResponder,
    );
    expect(result.preservedReceipt.freshness).toEqual(input.receipt.freshness);
    expect(result.preservedReceipt.scope).toEqual(input.receipt.scope);
  });

  it('result type carries no decisionGrade / proofTier / globalCredentialTruth', async () => {
    const writer = createDeferredServerPsvReceiptWriter();
    const result = await writer.attempt(validInput());
    expect((result as Record<string, unknown>).decisionGrade).toBeUndefined();
    expect((result as Record<string, unknown>).proofTier).toBeUndefined();
    expect(
      (result as Record<string, unknown>).globalCredentialTruth,
    ).toBeUndefined();
    expect(
      (result.preservedReceipt as Record<string, unknown>).globalCredentialTruth,
    ).toBeUndefined();
  });
});

describe('createUnavailableServerPsvReceiptWriter', () => {
  it('always returns status=unavailable, persisted=false', async () => {
    const writer = createUnavailableServerPsvReceiptWriter();
    const result = await writer.attempt(validInput());
    expect(result.status).toBe('unavailable');
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('writer_unavailable');
  });

  it('cannot be tricked into persisted by tampered input', async () => {
    const writer = createUnavailableServerPsvReceiptWriter();
    const tampered = {
      ...validInput(),
      persisted: true,
      confirmation: {
        confirmedAt: '2026-04-26T00:00:00.000Z',
        confirmedBy: 'demo',
        writerMode: 'repository',
        persistedRowId: 'row-1',
      },
    } as unknown as ServerPsvReceiptWriteInput;
    const result = await writer.attempt(tampered);
    expect(result.persisted).toBe(false);
  });
});

describe('writePsvReceiptWithConfirmation — orchestrator gates', () => {
  function liarWriter(
    overrides: Partial<ServerPsvReceiptWriteResult> = {},
  ): ServerPsvReceiptWriter {
    return {
      kind: 'demo',
      async attempt(input: ServerPsvReceiptWriteInput) {
        return {
          status: 'persisted',
          persisted: true,
          message: 'lying writer claims persisted',
          preservedReceipt: input.receipt,
          ...overrides,
        };
      },
    };
  }

  function honestRepoWriter(): ServerPsvReceiptWriter {
    return {
      kind: 'repository',
      async attempt(input: ServerPsvReceiptWriteInput) {
        const confirmation: ServerPsvReceiptWriterConfirmation = {
          confirmedAt: '2026-04-26T03:30:00.000Z',
          confirmedBy: 'real-writer',
          writerMode: 'repository',
          persistedRowId: 'row-1',
        };
        return {
          status: 'persisted',
          persisted: true,
          message: 'persisted by repository writer',
          confirmation,
          preservedReceipt: input.receipt,
        };
      },
    };
  }

  it('writer claims persisted=true without confirmation → boundary downgrades to failed', async () => {
    const result = await writePsvReceiptWithConfirmation({
      writer: liarWriter(),
      input: validInput(),
    });
    expect(result.persisted).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('invalid_writer_confirmation');
  });

  it('writer claims persisted with bad writerMode → boundary downgrades', async () => {
    const result = await writePsvReceiptWithConfirmation({
      writer: liarWriter({
        confirmation: {
          confirmedAt: '2026-04-26T03:00:00.000Z',
          confirmedBy: 'demo',
          writerMode: 'demo' as unknown as 'repository',
          persistedRowId: 'row-1',
        },
      }),
      input: validInput(),
    });
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('invalid_writer_confirmation');
  });

  it('writer status mismatched with persisted flag → boundary downgrades', async () => {
    const result = await writePsvReceiptWithConfirmation({
      writer: {
        kind: 'demo',
        async attempt(input) {
          return {
            status: 'deferred',
            persisted: true,
            message: 'inconsistent claim',
            preservedReceipt: input.receipt,
          };
        },
      },
      input: validInput(),
    });
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('invalid_writer_confirmation');
  });

  it('honest repository writer with confirmation → persisted=true', async () => {
    const result = await writePsvReceiptWithConfirmation({
      writer: honestRepoWriter(),
      input: validInput(),
    });
    expect(result.persisted).toBe(true);
    expect(result.status).toBe('persisted');
    expect(result.confirmation?.writerMode).toBe('repository');
  });

  it('default deferred writer through the orchestrator → still deferred', async () => {
    const result = await writePsvReceiptWithConfirmation({
      writer: createDeferredServerPsvReceiptWriter(),
      input: validInput(),
    });
    expect(result.persisted).toBe(false);
    expect(result.status).toBe('deferred');
  });

  it('orchestrator preserves the receipt input verbatim across deferred / failed / persisted', async () => {
    const input = validInput({
      receipt: {
        ...fullReceipt(),
        limitations: [
          { kind: 'partial_confirmation', description: 'Demo partial.' },
        ],
      },
    });
    const deferred = await writePsvReceiptWithConfirmation({
      writer: createDeferredServerPsvReceiptWriter(),
      input,
    });
    expect(deferred.preservedReceipt).toEqual(input.receipt);
    const failed = await writePsvReceiptWithConfirmation({
      writer: liarWriter(),
      input,
    });
    expect(failed.preservedReceipt).toEqual(input.receipt);
    const persisted = await writePsvReceiptWithConfirmation({
      writer: honestRepoWriter(),
      input,
    });
    expect(persisted.preservedReceipt).toEqual(input.receipt);
  });
});

describe('explainServerWriterResult', () => {
  it('produces a non-empty plain-language summary', async () => {
    const result = await createDeferredServerPsvReceiptWriter().attempt(
      validInput(),
    );
    const text = explainServerWriterResult(result);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('deferred');
    expect(text).toContain('persisted=false');
  });
});

describe('asAuditWriteResult', () => {
  it('persisted result maps to mode=repository', async () => {
    const result: ServerPsvReceiptWriteResult = {
      status: 'persisted',
      persisted: true,
      message: 'ok',
      confirmation: {
        confirmedAt: '2026-04-26T03:00:00.000Z',
        confirmedBy: 'real-writer',
        writerMode: 'repository',
        persistedRowId: 'row-1',
      },
      preservedReceipt: fullReceipt(),
    };
    const audit = asAuditWriteResult(result);
    expect(audit.persisted).toBe(true);
    expect(audit.mode).toBe('repository');
    expect(audit.status).toBe('persisted');
  });

  it('deferred result maps to mode=demo and persisted=false', async () => {
    const result = await createDeferredServerPsvReceiptWriter().attempt(
      validInput(),
    );
    const audit = asAuditWriteResult(result);
    expect(audit.persisted).toBe(false);
    expect(audit.mode).toBe('demo');
    expect(audit.status).toBe('pending_not_written');
  });
});

describe('Module purity — no I/O in the writer module', () => {
  it('source contains no fetch/axios/prisma/db/AuditEvent/email/SMS/webhook/node:fs tokens', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/serverPsvReceiptWriter.ts',
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
      'node:fs',
      'node:net',
      'node:http',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });

  it('module does NOT statically import any backend module', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/serverPsvReceiptWriter.ts',
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

describe('Knowledge Trust Graph — BACKEND-2 alignment', () => {
  it('keeps the writer-boundary nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'ServerPsvReceiptWriter',
        'DryRunPersistenceAttempt',
        'FailedPersistenceAttempt',
        'DeferredPersistenceAttempt',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'The ServerPsvReceiptWriter boundary defines the writer contract; the default deferred writer never persists.',
        'A persisted ServerPsvReceiptWriteResult requires a ServerPsvReceiptWriterConfirmation with writerMode in {repository, external}.',
        'The boundary defensively downgrades any persisted=true claim from a writer that did not emit a valid confirmation.',
        'DryRun, deferred, unavailable, and failed write attempts NEVER produce a PersistedAuditRecord.',
        'Client-supplied persisted/confirmation flags are refused by canUseServerPsvReceiptWriter; only a real writer may emit a confirmation.',
        'Forbidden truth-tier fields (decisionGrade, proofTier, globalCredentialTruth) on ServerPsvReceiptWriteInput are refused by the boundary.',
      ]),
    );
  });
});
