/**
 * Registry + route tests for the VC 2.0 Bitstring Status List service.
 * Includes an end-to-end loop: revoke via the API surface → serve the
 * credential → verify the bit through the fail-closed verifier.
 */

import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIST_SIZE_BITS, LIST_SIZE_BYTES, decodeBitstring } from '../lib/bitstring';
import {
  STATUS_LIST_CREDENTIAL_URL,
  buildStatusListCredential,
  buildStatusListEntry,
  ensureEntry,
  resetRegistryForTests,
  restore,
  revoke,
  summary,
} from '../lib/statusListRegistry';
import { checkStatusListEntry, resolveAndCheckStatus } from '../lib/verifyStatus';
import routes from '../routes/statusList';

beforeEach(() => {
  resetRegistryForTests();
});

// ── Minimal express stubs ──────────────────────────────────────────────────

interface MockResponse extends Partial<Response> {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

function mockRes(): MockResponse {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(key: string, value: string) {
      res.headers[key.toLowerCase()] = value;
      return res;
    },
  };
  return res as unknown as MockResponse;
}

function reqWith(body?: unknown, params?: Record<string, string>): Request {
  return { body, params: params ?? {} } as unknown as Request;
}

// ── Registry ───────────────────────────────────────────────────────────────

describe('statusListRegistry', () => {
  it('assigns stable, distinct indexes per credential id', () => {
    const a = ensureEntry('cred-a');
    const b = ensureEntry('cred-b');
    expect(a.statusListIndex).toBe(0);
    expect(b.statusListIndex).toBe(1);
    // Idempotent — re-registering never moves the index.
    expect(ensureEntry('cred-a').statusListIndex).toBe(0);
  });

  it('revoke is idempotent and restore clears the bit', async () => {
    revoke('cred-a', 'compromised key');
    revoke('cred-a');
    const index = ensureEntry('cred-a').statusListIndex;

    let credential = await buildStatusListCredential();
    let outcome = await checkStatusListEntry(
      buildStatusListEntry('cred-a'),
      credential,
    );
    expect(outcome).toMatchObject({ status: 'revoked', statusListIndex: index });

    restore('cred-a');
    credential = await buildStatusListCredential();
    outcome = await checkStatusListEntry(buildStatusListEntry('cred-a'), credential);
    expect(outcome).toMatchObject({ status: 'not_revoked', acceptable: true });
  });

  it('summary counts entries and revocations', () => {
    ensureEntry('cred-a');
    revoke('cred-b');
    expect(summary()).toEqual({
      entry_count: 2,
      revoked_count: 1,
      list_size_bits: LIST_SIZE_BITS,
    });
  });
});

// ── Credential shape (VC 2.0 pinning) ─────────────────────────────────────

describe('buildStatusListCredential', () => {
  it('emits the W3C VC 2.0 BitstringStatusListCredential shape', async () => {
    const credential = await buildStatusListCredential();
    expect(credential['@context']).toContain('https://www.w3.org/ns/credentials/v2');
    expect(credential.type).toEqual([
      'VerifiableCredential',
      'BitstringStatusListCredential',
    ]);
    expect(credential.credentialSubject.type).toBe('BitstringStatusList');
    expect(credential.credentialSubject.statusPurpose).toBe('revocation');
    expect(typeof credential.validFrom).toBe('string');
    // VC 2.0, not VC 1.1: no issuanceDate, no 2018 context, no 2021 types.
    expect(credential).not.toHaveProperty('issuanceDate');
    expect(JSON.stringify(credential)).not.toContain('StatusList2021');
    expect(JSON.stringify(credential)).not.toContain('2018/credentials');
  });

  it('encodedList is unpadded base64url of a GZIP list at spec-minimum size', async () => {
    const { encodedList } = (await buildStatusListCredential()).credentialSubject;
    expect(encodedList).toMatch(/^[A-Za-z0-9_-]+$/);
    const bits = await decodeBitstring(encodedList);
    expect(bits.length).toBe(LIST_SIZE_BYTES);
  });

  it('buildStatusListEntry emits a BitstringStatusListEntry pointing at the list', () => {
    const entry = buildStatusListEntry('cred-a');
    expect(entry.type).toBe('BitstringStatusListEntry');
    expect(entry.statusPurpose).toBe('revocation');
    expect(entry.statusListCredential).toBe(STATUS_LIST_CREDENTIAL_URL);
    expect(entry.statusListIndex).toBe(0);
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────

describe('routes', () => {
  it('revoke requires credential_id', () => {
    const res = mockRes();
    routes.revokeCredential(reqWith({}), res as unknown as Response);
    expect(res.statusCode).toBe(400);
  });

  it('revoke → status endpoint reports revoked with its index', () => {
    const res = mockRes();
    routes.revokeCredential(
      reqWith({ credential_id: 'cred-a', reason: 'issuer request' }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      revoked: true,
      status_list_index: 0,
      reason: 'issuer request',
    });

    const statusRes = mockRes();
    routes.checkCredentialStatus(
      reqWith(undefined, { credential_id: 'cred-a' }),
      statusRes as unknown as Response,
    );
    expect(statusRes.body).toMatchObject({
      known: true,
      revoked: true,
      status: 'revoked',
      status_list_index: 0,
    });
  });

  it('restore of an unknown credential is 404', () => {
    const res = mockRes();
    routes.restoreCredential(reqWith({ credential_id: 'ghost' }), res as unknown as Response);
    expect(res.statusCode).toBe(404);
  });

  it('status of an unregistered credential is unknown, not not_revoked', () => {
    const res = mockRes();
    routes.checkCredentialStatus(
      reqWith(undefined, { credential_id: 'ghost' }),
      res as unknown as Response,
    );
    expect(res.body).toMatchObject({ known: false, status: 'unknown' });
  });

  it('GET /status-list/bitstring serves the credential as application/vc+ld+json', async () => {
    const res = mockRes();
    await routes.getStatusListVC(reqWith(), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/vc+ld+json');
    const credential = JSON.parse(res.body as string);
    expect(credential.type).toContain('BitstringStatusListCredential');
  });

  it('end-to-end: revoke via route → serve credential → fail-closed verifier reads revoked', async () => {
    routes.revokeCredential(reqWith({ credential_id: 'cred-e2e' }), mockRes() as unknown as Response);

    const vcRes = mockRes();
    await routes.getStatusListVC(reqWith(), vcRes as unknown as Response);
    const served = JSON.parse(vcRes.body as string);

    const entryRes = mockRes();
    routes.getStatusListEntry(
      reqWith(undefined, { credential_id: 'cred-e2e' }),
      entryRes as unknown as Response,
    );

    const outcome = await resolveAndCheckStatus(entryRes.body, {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => served }),
    });
    expect(outcome).toMatchObject({ status: 'revoked', acceptable: false });

    // And an unrelated credential on the same list reads not_revoked.
    const otherEntryRes = mockRes();
    routes.getStatusListEntry(
      reqWith(undefined, { credential_id: 'cred-other' }),
      otherEntryRes as unknown as Response,
    );
    const otherOutcome = await checkStatusListEntry(otherEntryRes.body, served);
    expect(otherOutcome).toMatchObject({ status: 'not_revoked', acceptable: true });
  });
});
