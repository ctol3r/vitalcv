/**
 * enterpriseWebhookDispatch.test.ts — enterprise revocation webhook hardening.
 *
 * The enterprise outbound path (revocationOutboxWorker → webhookDispatcher)
 * carried the same weakness class as the apply-share path: a resolver that
 * selected non-existent columns (`signingSecret`/`active` vs the real
 * `secret`/`isActive`), an empty-string secret fallback, and an unguarded
 * `fetch` that followed redirects.
 *
 * These are the proof-by-injection tests. Each assertion fails if the
 * corresponding fix is reverted:
 *  - resolver: a non-uuid employer id never reaches the DB;
 *  - resolver: a config with no per-org secret fails closed (null target);
 *  - dispatch: a target with no secret is never signed/sent;
 *  - dispatch: a target resolving to a private/metadata address is blocked
 *    before fetch (SSRF);
 *  - dispatch: a redirect is not followed (redirect: 'manual', non-delivery);
 *  - dispatch: a delivered webhook is signed with the PER-ORG secret.
 *
 * prisma is mocked here (the resolver reshaping logic); the real-schema query is
 * proven against a live Postgres in enterpriseWebhookResolve.db.test.ts.
 */

import { createHmac } from 'node:crypto';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    employerWebhookConfig: { findFirst: jest.fn() },
  },
}));
jest.mock('../../../obs/logger', () => ({ log: jest.fn() }));

import prisma from '../../../graphql/prisma_client';
import {
  dispatchEnterpriseWebhook,
  resolveEnterpriseWebhookTarget,
  type EnterpriseWebhookDispatchTarget,
  type EnterpriseWebhookPayload,
} from '../webhookDispatcher';

const prismaMock = prisma as unknown as {
  employerWebhookConfig: { findFirst: jest.Mock };
};

const EMPLOYER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ACCEPTANCE_ID = 'acceptance-1';
const PUBLIC_IP = '93.184.216.34';
const METADATA_IP = '169.254.169.254';
const PER_ORG_SECRET = 'per-org-enterprise-secret';
const WEBHOOK_URL = 'https://ehr.example.com/hook';

function payloadFixture(): EnterpriseWebhookPayload {
  return {
    schema: 'vitalcv.enterprise.v1',
    event: 'credential.revoked',
    delivery_id: 'delivery-1',
    issued_at: '2026-08-16T00:00:00.000Z',
    credential: {
      artifact_id: 'artifact-1',
      npi_prefix: '1234······',
      source: 'NURSYS',
      changed_at: '2026-08-16T00:00:00.000Z',
      reason: 'manual revoke',
      lifecycle_state: 'revoked',
    },
    cascade: { affected: 1, invalid: 1, at_risk: 0, capsule_ids: ['cap-1'] },
    trust_state: {
      previous_band: 'L3',
      new_band: 'L1',
      snapshot_artifact_id: 'snap-1',
      computed_at: '2026-08-16T00:05:00.000Z',
    },
    employer: { employer_id: EMPLOYER_UUID, acceptance_id: ACCEPTANCE_ID },
  };
}

function targetFixture(overrides?: Partial<EnterpriseWebhookDispatchTarget>): EnterpriseWebhookDispatchTarget {
  return {
    employerId: EMPLOYER_UUID,
    acceptanceId: ACCEPTANCE_ID,
    webhookUrl: WEBHOOK_URL,
    signingSecret: PER_ORG_SECRET,
    ...overrides,
  };
}

function okResponse() {
  return { ok: true, status: 200, statusText: 'OK', type: 'basic' } as unknown as Response;
}
function redirectResponse() {
  return { ok: false, status: 302, statusText: 'Found', type: 'default' } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveEnterpriseWebhookTarget', () => {
  it('returns null and does NOT query for a non-uuid employer id', async () => {
    const target = await resolveEnterpriseWebhookTarget('not-a-uuid', ACCEPTANCE_ID);
    expect(target).toBeNull();
    expect(prismaMock.employerWebhookConfig.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when no active config exists', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue(null);
    expect(await resolveEnterpriseWebhookTarget(EMPLOYER_UUID, ACCEPTANCE_ID)).toBeNull();
  });

  it('fails closed when the config has no per-org secret', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      employerId: EMPLOYER_UUID,
      webhookUrl: WEBHOOK_URL,
      secret: null,
      isActive: true,
    });
    expect(await resolveEnterpriseWebhookTarget(EMPLOYER_UUID, ACCEPTANCE_ID)).toBeNull();
  });

  it('fails closed (returns null) when the query itself errors — never a partial target', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockRejectedValue(new Error('db down'));
    expect(await resolveEnterpriseWebhookTarget(EMPLOYER_UUID, ACCEPTANCE_ID)).toBeNull();
  });

  it('returns the registered url + per-org secret when configured', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      employerId: EMPLOYER_UUID,
      webhookUrl: WEBHOOK_URL,
      secret: PER_ORG_SECRET,
      isActive: true,
    });
    expect(await resolveEnterpriseWebhookTarget(EMPLOYER_UUID, ACCEPTANCE_ID)).toEqual({
      employerId: EMPLOYER_UUID,
      acceptanceId: ACCEPTANCE_ID,
      webhookUrl: WEBHOOK_URL,
      signingSecret: PER_ORG_SECRET,
    });
  });
});

describe('dispatchEnterpriseWebhook', () => {
  it('fails closed (no fetch) when the target has no signing secret', async () => {
    const fetchImpl = jest.fn();
    const resolver = jest.fn(async () => [PUBLIC_IP]);

    await expect(
      dispatchEnterpriseWebhook(targetFixture({ signingSecret: '' }), payloadFixture(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolver,
      }),
    ).rejects.toThrow(/no signing secret/i);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
  });

  it('blocks a registered target that resolves to a private/metadata address (SSRF)', async () => {
    const fetchImpl = jest.fn();

    await expect(
      dispatchEnterpriseWebhook(targetFixture(), payloadFixture(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolver: async () => [METADATA_IP],
      }),
    ).rejects.toBeInstanceOf(Error);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not follow a redirect (redirect: manual, treated as non-delivery)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(redirectResponse());

    await expect(
      dispatchEnterpriseWebhook(targetFixture(), payloadFixture(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolver: async () => [PUBLIC_IP],
      }),
    ).rejects.toThrow(/Redirect blocked/);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const opts = fetchImpl.mock.calls[0][1];
    expect(opts.redirect).toBe('manual');
  });

  it('delivers to a public registered target signed with the PER-ORG secret', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());

    await dispatchEnterpriseWebhook(targetFixture(), payloadFixture(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolver: async () => [PUBLIC_IP],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, opts] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toBe(WEBHOOK_URL);
    expect(opts.redirect).toBe('manual');

    // Recompute the signature and prove the per-org secret was used, not an
    // empty/default constant.
    const header = (opts.headers as Record<string, string>)['X-VitalCV-Signature'];
    const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
    expect(match).not.toBeNull();
    const ts = match![1];
    const sentSig = match![2];
    const body = opts.body as string;
    const expectedWithPerOrg = createHmac('sha256', PER_ORG_SECRET).update(`t=${ts}${body}`).digest('hex');
    const wouldBeWithEmpty = createHmac('sha256', '').update(`t=${ts}${body}`).digest('hex');
    expect(sentSig).toBe(expectedWithPerOrg);
    expect(sentSig).not.toBe(wouldBeWithEmpty);
  });
});
