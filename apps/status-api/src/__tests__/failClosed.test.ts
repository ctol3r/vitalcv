/**
 * FAIL-CLOSED verifier tests — the point of launch blocker #11.
 *
 * Every injected failure mode (unfetchable list, malformed bitstring,
 * wrong credential format, purpose mismatch, index out of range, stale
 * list, malformed entry) MUST yield `unverifiable` with
 * `acceptable === false`. No failure may ever read as `not_revoked`.
 */

import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  LIST_SIZE_BITS,
  LIST_SIZE_BYTES,
  encodeBitstring,
  setBit,
} from '../lib/bitstring';
import { BitstringStatusListCredential } from '../lib/types';
import {
  FetchLike,
  StatusCheckOutcome,
  checkStatusListEntry,
  resolveAndCheckStatus,
} from '../lib/verifyStatus';

const LIST_URL = 'https://status.vitalcv.ai/status-list/bitstring';

// ── Fixtures ───────────────────────────────────────────────────────────────

async function validEncodedList(revokedIndexes: number[] = []): Promise<string> {
  const bits = Buffer.alloc(LIST_SIZE_BYTES, 0);
  for (const index of revokedIndexes) setBit(bits, index, 1);
  return encodeBitstring(bits);
}

async function validCredential(
  revokedIndexes: number[] = [],
): Promise<BitstringStatusListCredential> {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: LIST_URL,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: 'did:web:vitalcv.ai',
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    credentialSubject: {
      id: `${LIST_URL}#list`,
      type: 'BitstringStatusList',
      statusPurpose: 'revocation',
      encodedList: await validEncodedList(revokedIndexes),
    },
  };
}

function entryFor(index: number | string): Record<string, unknown> {
  return {
    id: `${LIST_URL}#${index}`,
    type: 'BitstringStatusListEntry',
    statusPurpose: 'revocation',
    statusListIndex: index,
    statusListCredential: LIST_URL,
  };
}

function expectFailClosed(outcome: StatusCheckOutcome, code?: string): void {
  expect(outcome.status).toBe('unverifiable');
  expect(outcome.acceptable).toBe(false);
  if (code && outcome.status === 'unverifiable') {
    expect(outcome.code).toBe(code);
  }
}

// ── Happy paths (baseline the failure tests are measured against) ─────────

describe('checkStatusListEntry — happy paths', () => {
  it('reads a clear bit as not_revoked (the ONLY acceptable outcome)', async () => {
    const outcome = await checkStatusListEntry(entryFor(7), await validCredential([3]));
    expect(outcome).toEqual({ status: 'not_revoked', acceptable: true, statusListIndex: 7 });
  });

  it('reads a set bit as revoked and not acceptable', async () => {
    const outcome = await checkStatusListEntry(entryFor(3), await validCredential([3]));
    expect(outcome).toEqual({ status: 'revoked', acceptable: false, statusListIndex: 3 });
  });

  it('accepts the spec string form of statusListIndex', async () => {
    const outcome = await checkStatusListEntry(entryFor('3'), await validCredential([3]));
    expect(outcome.status).toBe('revoked');
  });

  it('accepts a Multibase "u"-prefixed encodedList', async () => {
    const credential = await validCredential([5]);
    credential.credentialSubject.encodedList = `u${credential.credentialSubject.encodedList}`;
    const outcome = await checkStatusListEntry(entryFor(5), credential);
    expect(outcome.status).toBe('revoked');
  });
});

// ── Failure mode 1: unfetchable status list ────────────────────────────────

describe('resolveAndCheckStatus — unfetchable list fails closed', () => {
  it('network error → unverifiable, never not_revoked', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    const outcome = await resolveAndCheckStatus(entryFor(7), { fetchImpl });
    expectFailClosed(outcome, 'STATUS_RETRIEVAL_ERROR');
  });

  it('HTTP 404 → unverifiable', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    const outcome = await resolveAndCheckStatus(entryFor(7), { fetchImpl });
    expectFailClosed(outcome, 'STATUS_RETRIEVAL_ERROR');
  });

  it('HTTP 500 → unverifiable', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const outcome = await resolveAndCheckStatus(entryFor(7), { fetchImpl });
    expectFailClosed(outcome, 'STATUS_RETRIEVAL_ERROR');
  });

  it('unparseable JSON body → unverifiable', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });
    const outcome = await resolveAndCheckStatus(entryFor(7), { fetchImpl });
    expectFailClosed(outcome, 'STATUS_RETRIEVAL_ERROR');
  });

  it('fetch resolves with a well-formed list → check proceeds normally', async () => {
    const credential = await validCredential([9]);
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => credential,
    });
    const revoked = await resolveAndCheckStatus(entryFor(9), { fetchImpl });
    expect(revoked.status).toBe('revoked');
    const clear = await resolveAndCheckStatus(entryFor(10), { fetchImpl });
    expect(clear).toEqual({ status: 'not_revoked', acceptable: true, statusListIndex: 10 });
  });
});

// ── Failure mode 2: malformed bitstring ────────────────────────────────────

describe('checkStatusListEntry — malformed bitstring fails closed', () => {
  async function withEncodedList(encodedList: unknown): Promise<StatusCheckOutcome> {
    const credential = await validCredential();
    (credential.credentialSubject as Record<string, unknown>).encodedList = encodedList;
    return checkStatusListEntry(entryFor(0), credential);
  }

  it('base64 padding characters → unverifiable', async () => {
    const credential = await validCredential();
    const padded = `${credential.credentialSubject.encodedList}==`;
    expectFailClosed(await withEncodedList(padded), 'STATUS_LIST_MALFORMED');
  });

  it('standard base64 alphabet (+, /) → unverifiable', async () => {
    expectFailClosed(await withEncodedList('AA+B/CC'), 'STATUS_LIST_MALFORMED');
  });

  it('valid base64url but not GZIP → unverifiable', async () => {
    const notGzip = Buffer.from('junk that is definitely not gzip').toString('base64url');
    expectFailClosed(await withEncodedList(notGzip), 'STATUS_LIST_MALFORMED');
  });

  it('truncated GZIP stream → unverifiable', async () => {
    const compressed = gzipSync(Buffer.alloc(LIST_SIZE_BYTES, 0));
    const truncated = compressed.subarray(0, 20).toString('base64url');
    expectFailClosed(await withEncodedList(truncated), 'STATUS_LIST_MALFORMED');
  });

  it('undersized list (below 16 KiB spec minimum) → unverifiable', async () => {
    const tiny = gzipSync(Buffer.alloc(8, 0)).toString('base64url');
    expectFailClosed(await withEncodedList(tiny), 'STATUS_LIST_MALFORMED');
  });

  it('missing encodedList → unverifiable', async () => {
    expectFailClosed(await withEncodedList(undefined), 'STATUS_LIST_MALFORMED');
  });

  it('non-string encodedList → unverifiable', async () => {
    expectFailClosed(await withEncodedList(12345), 'STATUS_LIST_MALFORMED');
  });
});

// ── Failure mode 3: wrong credential format ────────────────────────────────

describe('checkStatusListEntry — wrong format fails closed', () => {
  it('the retired StatusList2021Credential shape → unverifiable', async () => {
    // Exactly what apps/status-api used to emit before this port.
    const legacy = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/vc/status-list/2021/v1',
      ],
      id: `${LIST_URL.replace('/bitstring', '/2021')}`,
      type: ['VerifiableCredential', 'StatusList2021Credential'],
      issuer: 'did:web:vitalcv.ai',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: `${LIST_URL}#list`,
        type: 'StatusList2021',
        statusPurpose: 'revocation',
        encodedList: await validEncodedList(),
      },
    };
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), legacy),
      'STATUS_LIST_WRONG_FORMAT',
    );
  });

  it('missing BitstringStatusListCredential type → unverifiable', async () => {
    const credential = await validCredential();
    credential.type = ['VerifiableCredential'];
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'STATUS_LIST_WRONG_FORMAT',
    );
  });

  it('missing VC 2.0 context → unverifiable', async () => {
    const credential = await validCredential();
    credential['@context'] = ['https://www.w3.org/2018/credentials/v1'];
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'STATUS_LIST_WRONG_FORMAT',
    );
  });

  it('wrong credentialSubject.type → unverifiable', async () => {
    const credential = await validCredential();
    (credential.credentialSubject as Record<string, unknown>).type = 'StatusList2021';
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'STATUS_LIST_WRONG_FORMAT',
    );
  });

  it('non-object credential (string body) → unverifiable', async () => {
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), 'not a credential'),
      'STATUS_LIST_WRONG_FORMAT',
    );
  });

  it('statusPurpose mismatch (suspension list, revocation entry) → unverifiable', async () => {
    const credential = await validCredential();
    (credential.credentialSubject as Record<string, unknown>).statusPurpose = 'suspension';
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'STATUS_PURPOSE_MISMATCH',
    );
  });

  it('unsupported statusSize → unverifiable instead of misreading bits', async () => {
    const credential = await validCredential();
    (credential.credentialSubject as Record<string, unknown>).statusSize = 2;
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'UNSUPPORTED_STATUS_SIZE',
    );
  });

  it('expired list (validUntil in the past) → unverifiable', async () => {
    const credential = await validCredential();
    credential.validUntil = new Date(Date.now() - 60_000).toISOString();
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'STATUS_LIST_EXPIRED',
    );
  });

  it('not-yet-valid list (validFrom in the future) → unverifiable', async () => {
    const credential = await validCredential();
    credential.validFrom = new Date(Date.now() + 60_000).toISOString();
    expectFailClosed(
      await checkStatusListEntry(entryFor(0), credential),
      'STATUS_LIST_EXPIRED',
    );
  });
});

// ── Failure mode 4: index out of range ─────────────────────────────────────

describe('checkStatusListEntry — index out of range fails closed', () => {
  it('index === list size → unverifiable (RANGE_ERROR)', async () => {
    expectFailClosed(
      await checkStatusListEntry(entryFor(LIST_SIZE_BITS), await validCredential()),
      'RANGE_ERROR',
    );
  });

  it('index far beyond the list → unverifiable', async () => {
    expectFailClosed(
      await checkStatusListEntry(entryFor(10_000_000), await validCredential()),
      'RANGE_ERROR',
    );
  });

  it('negative index → unverifiable (malformed entry)', async () => {
    expectFailClosed(
      await checkStatusListEntry(entryFor(-1), await validCredential()),
      'STATUS_ENTRY_MALFORMED',
    );
  });

  it('non-numeric index → unverifiable (malformed entry)', async () => {
    expectFailClosed(
      await checkStatusListEntry(entryFor('abc'), await validCredential()),
      'STATUS_ENTRY_MALFORMED',
    );
  });
});

// ── Malformed entry ────────────────────────────────────────────────────────

describe('checkStatusListEntry — malformed entry fails closed', () => {
  it('legacy StatusList2021Entry type → unverifiable', async () => {
    const entry = { ...entryFor(0), type: 'StatusList2021Entry' };
    expectFailClosed(
      await checkStatusListEntry(entry, await validCredential()),
      'STATUS_ENTRY_MALFORMED',
    );
  });

  it('missing statusListCredential URL → unverifiable', async () => {
    const entry = entryFor(0);
    delete entry.statusListCredential;
    expectFailClosed(
      await checkStatusListEntry(entry, await validCredential()),
      'STATUS_ENTRY_MALFORMED',
    );
  });

  it('missing statusPurpose → unverifiable', async () => {
    const entry = entryFor(0);
    delete entry.statusPurpose;
    expectFailClosed(
      await checkStatusListEntry(entry, await validCredential()),
      'STATUS_ENTRY_MALFORMED',
    );
  });

  it('null entry → unverifiable', async () => {
    expectFailClosed(
      await checkStatusListEntry(null, await validCredential()),
      'STATUS_ENTRY_MALFORMED',
    );
  });
});

// ── Property sweep: no failure mode may read as not_revoked ────────────────

describe('fail-closed property sweep', () => {
  it('every corrupted input yields acceptable === false', async () => {
    const good = await validCredential();
    const legacyEncoded = await validEncodedList();

    const corruptedCredentials: unknown[] = [
      null,
      'string',
      [],
      {},
      { ...good, type: ['VerifiableCredential'] },
      { ...good, '@context': [] },
      { ...good, credentialSubject: null },
      { ...good, credentialSubject: { ...good.credentialSubject, type: 'StatusList2021' } },
      { ...good, credentialSubject: { ...good.credentialSubject, statusPurpose: 'suspension' } },
      { ...good, credentialSubject: { ...good.credentialSubject, encodedList: 'AA==' } },
      { ...good, credentialSubject: { ...good.credentialSubject, encodedList: undefined } },
      { ...good, validUntil: new Date(0).toISOString() },
      {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'StatusList2021Credential'],
        credentialSubject: {
          type: 'StatusList2021',
          statusPurpose: 'revocation',
          encodedList: legacyEncoded,
        },
      },
    ];

    for (const credential of corruptedCredentials) {
      const outcome = await checkStatusListEntry(entryFor(0), credential);
      expect(outcome.status).toBe('unverifiable');
      expect(outcome.acceptable).toBe(false);
    }

    const corruptedEntries: unknown[] = [
      null,
      42,
      {},
      { ...entryFor(0), type: 'StatusList2021Entry' },
      { ...entryFor(0), statusListIndex: -5 },
      { ...entryFor(0), statusListIndex: 'NaN' },
      { ...entryFor(0), statusListIndex: 1.5 },
      { ...entryFor(0), statusPurpose: '' },
      { ...entryFor(0), statusListCredential: '' },
    ];

    for (const entry of corruptedEntries) {
      const outcome = await checkStatusListEntry(entry, good);
      expect(outcome.status).toBe('unverifiable');
      expect(outcome.acceptable).toBe(false);
    }
  });

  it('acceptable === true occurs ONLY with status not_revoked', async () => {
    const outcomes: StatusCheckOutcome[] = await Promise.all([
      checkStatusListEntry(entryFor(1), await validCredential([1])), // revoked
      checkStatusListEntry(entryFor(2), await validCredential([1])), // not revoked
      checkStatusListEntry(entryFor(1), null), // unverifiable
    ]);
    for (const outcome of outcomes) {
      expect(outcome.acceptable).toBe(outcome.status === 'not_revoked');
    }
  });
});
