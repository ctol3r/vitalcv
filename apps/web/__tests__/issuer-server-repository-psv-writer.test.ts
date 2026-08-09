import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildServerPsvReceiptWriteInput,
  writePsvReceiptWithConfirmation,
} from '../lib/issuer-verification/serverPsvReceiptWriter';
import { createServerRepositoryPsvReceiptWriter } from '../lib/issuer-verification/serverRepositoryPsvReceiptWriter';

vi.mock('server-only', () => ({}));

/**
 * ISSUER-10 — the writer that closes the ISSUER-9 defer.
 *
 * The failure these tests exist to prevent is the one the defer memo was
 * written about: reporting persistence for a write that dropped the truth
 * contract on the floor, or that never happened at all.
 */

const RECEIPT = {
  psvReceiptId: 'psv-receipt-1',
  psvCandidateId: 'psv-cand-1',
  receiptCandidateId: 'cand-1',
  requestId: 'req-1',
  claimId: 'claim-1',
  claimType: 'residency' as const,
  promotedAt: '2026-08-09T03:00:00.000Z',
  promotedBy: {
    actorId: 'reviewer-1',
    displayName: 'A. Reviewer',
    role: 'policy_reviewer' as const,
  },
  sourceBasis: {
    sourceOrganizationName: 'Example GME Office',
    isContractedAgent: true,
    agentName: 'Example Verification Partner',
    agentActsFor: 'Example GME Office',
  },
  attributedResponder: {
    name: 'J. Doe',
    attributedAt: '2026-08-09T02:00:00.000Z',
    attributionMethod: 'directory_match' as const,
  },
  scope: {
    claimType: 'residency' as const,
    covers: 'Completion of the named residency program for the stated dates.',
    doesNotCover: 'Does not confirm licensure, board certification, or malpractice history.',
    sourceOrganizationName: 'Example GME Office',
  },
  limitations: [
    { kind: 'contracted_agent' as const, description: 'Response came via a contracted agent.' },
  ],
  freshness: {
    ttlDays: 365,
    issuedAt: '2026-08-09T03:00:00.000Z',
    staleAfter: '2027-08-09T03:00:00.000Z',
  },
};

function input() {
  return buildServerPsvReceiptWriteInput({ receipt: RECEIPT, correlationId: 'corr-1' });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const ORIGINAL_FLAG = process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
const ORIGINAL_BASE = process.env.BACKEND_API_URL;

beforeEach(() => {
  process.env.BACKEND_API_URL = 'https://api.example.test';
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
  else process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
  if (ORIGINAL_BASE === undefined) delete process.env.BACKEND_API_URL;
  else process.env.BACKEND_API_URL = ORIGINAL_BASE;
});

describe('dual opt-in — persistence is off unless BOTH signals are present', () => {
  it('defers and sends no request when neither signal is set', async () => {
    delete process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
    const fetchImpl = vi.fn();
    const writer = createServerRepositoryPsvReceiptWriter({ fetchImpl: fetchImpl as never });
    const result = await writer.attempt(input());

    expect(result.status).toBe('deferred');
    expect(result.persisted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('defers when the deployment flag is on but the caller did not ask', async () => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
    const fetchImpl = vi.fn();
    const writer = createServerRepositoryPsvReceiptWriter({ fetchImpl: fetchImpl as never });
    const result = await writer.attempt(input());

    expect(result.persisted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('defers when the caller asked but the deployment flag is off', async () => {
    delete process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
    const fetchImpl = vi.fn();
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.persisted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats a non-literal "true" flag value as off', async () => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = '1';
    const fetchImpl = vi.fn();
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.persisted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('enabled — persistence requires a real repository confirmation', () => {
  beforeEach(() => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
  });

  it('reports persisted when the backend confirms a repository row', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'persisted',
        persisted: true,
        confirmation: {
          confirmedAt: '2026-08-09T12:00:00.000Z',
          confirmedBy: 'issuer-psv-receipt-route',
          writerMode: 'repository',
          persistedRowId: 'row-1',
          alreadyPersisted: false,
        },
      }),
    );
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.status).toBe('persisted');
    expect(result.persisted).toBe(true);
    expect(result.confirmation?.writerMode).toBe('repository');
    expect(result.confirmation?.persistedRowId).toBe('row-1');
  });

  it('refuses a backend that claims persistence with no confirmation', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'persisted', persisted: true }));
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.status).toBe('failed');
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('invalid_writer_confirmation');
  });

  it('refuses a confirmation whose writerMode is not repository', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        persisted: true,
        confirmation: {
          confirmedAt: '2026-08-09T12:00:00.000Z',
          writerMode: 'demo',
          persistedRowId: 'row-1',
        },
      }),
    );
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('invalid_writer_confirmation');
  });

  it('treats a 200 with persisted:false as deferred, not success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'deferred', persisted: false }));
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.status).toBe('deferred');
    expect(result.persisted).toBe(false);
  });

  it('reports failed on a 422 contract refusal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          status: 'failed',
          persisted: false,
          field: 'sourceBasis',
          message: 'contracted-agent basis requires agentName and agentActsFor',
        },
        422,
      ),
    );
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.status).toBe('failed');
    expect(result.persisted).toBe(false);
    expect(result.message).toContain('agentName');
  });

  it('reports failed — never silent success — when transport throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.status).toBe('failed');
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('repository_write_failed');
  });

  it('is unavailable — not persisted — when no backend base URL is configured', async () => {
    delete process.env.BACKEND_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchImpl = vi.fn();
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writer.attempt(input());

    expect(result.status).toBe('unavailable');
    expect(result.persisted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('the receipt travels verbatim', () => {
  beforeEach(() => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
  });

  it('sends every contract field, with timestamps untouched', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        persisted: true,
        confirmation: {
          confirmedAt: '2026-08-09T12:00:00.000Z',
          writerMode: 'repository',
          persistedRowId: 'row-1',
        },
      }),
    );
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    await writer.attempt(input());

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as { receipt: typeof RECEIPT };

    expect(sent.receipt.limitations).toEqual(RECEIPT.limitations);
    expect(sent.receipt.sourceBasis).toEqual(RECEIPT.sourceBasis);
    expect(sent.receipt.attributedResponder).toEqual(RECEIPT.attributedResponder);
    expect(sent.receipt.scope).toEqual(RECEIPT.scope);
    // The clock the review observed, never the clock of this request.
    expect(sent.receipt.promotedAt).toBe('2026-08-09T03:00:00.000Z');
    expect(sent.receipt.freshness).toEqual(RECEIPT.freshness);
  });

  it('never sends a truth-tier field', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        persisted: true,
        confirmation: {
          confirmedAt: '2026-08-09T12:00:00.000Z',
          writerMode: 'repository',
          persistedRowId: 'row-1',
        },
      }),
    );
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    await writer.attempt(input());

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as { receipt: Record<string, unknown> };
    expect(sent.receipt).not.toHaveProperty('decisionGrade');
    expect(sent.receipt).not.toHaveProperty('proofTier');
    expect(sent.receipt).not.toHaveProperty('globalCredentialTruth');
  });

  it('preserves the receipt on a refusal as well as a success', async () => {
    delete process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
    const writer = createServerRepositoryPsvReceiptWriter({ enableRepositoryWrites: true });
    const result = await writer.attempt(input());
    expect(result.preservedReceipt.psvReceiptId).toBe('psv-receipt-1');
    expect(result.preservedReceipt.limitations).toEqual(RECEIPT.limitations);
  });
});

describe('the confirmation boundary still governs this writer', () => {
  beforeEach(() => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
  });

  it('writePsvReceiptWithConfirmation passes a genuinely confirmed write', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        persisted: true,
        confirmation: {
          confirmedAt: '2026-08-09T12:00:00.000Z',
          writerMode: 'repository',
          persistedRowId: 'row-1',
        },
      }),
    );
    const writer = createServerRepositoryPsvReceiptWriter({
      enableRepositoryWrites: true,
      fetchImpl: fetchImpl as never,
    });
    const result = await writePsvReceiptWithConfirmation({ writer, input: input() });
    expect(result.persisted).toBe(true);
  });

  it('downgrades a hostile writer that fabricates persisted=true', async () => {
    const hostile = {
      kind: 'repository' as const,
      async attempt() {
        return {
          status: 'persisted' as const,
          persisted: true,
          message: 'trust me',
          preservedReceipt: RECEIPT,
        };
      },
    };
    const result = await writePsvReceiptWithConfirmation({ writer: hostile, input: input() });
    expect(result.persisted).toBe(false);
    expect(result.failureReason).toBe('invalid_writer_confirmation');
  });
});

describe('client/server boundary', () => {
  const src = readFileSync(
    new URL('../lib/issuer-verification/serverRepositoryPsvReceiptWriter.ts', import.meta.url),
    'utf8',
  );

  it("is marked server-only so it can never enter the client bundle", () => {
    expect(src.startsWith("import 'server-only';")).toBe(true);
  });

  it('never imports a backend module, Prisma, or a DB driver', () => {
    const importLines = src.split('\n').filter((line) => /^\s*import\b/.test(line));
    const banned = ['apps/api', 'psvReceipts.repo', 'prisma', '@prisma/client', '@vitalcv/psv', 'pg'];
    for (const token of banned) {
      for (const line of importLines) {
        expect(line.toLowerCase()).not.toContain(token.toLowerCase());
      }
    }
  });

  it('does not dynamic-import a backend module either', () => {
    expect(src).not.toMatch(/import\(\s*['"][^'"]*apps\/api/);
    expect(src).not.toMatch(/import\(\s*['"][^'"]*psvReceipts\.repo/);
  });
});
