/**
 * applyWebhookDispatch.test.ts — outbound webhook dispatch hardening.
 *
 * Proves, at the dispatch boundary:
 *  - the caller-supplied callback_url / a non-uuid org never reaches fetch()
 *    (only a registered, uuid-keyed EmployerWebhookConfig is a target);
 *  - a registered config with NO per-org secret fails closed — no fetch, no
 *    signing with a default constant;
 *  - a registered target resolving to a private/metadata address is blocked
 *    before fetch (SSRF);
 *  - a redirect response is not followed (redirect: 'manual', treated as
 *    non-delivery);
 *  - a successful dispatch signs with the PER-ORG secret, never a default.
 *
 * Each assertion fails against the pre-fix code (which dispatched the
 * client callback_url signed with 'vcv-default-secret' and had no egress guard).
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
  dispatchToOrganization,
  resolveRegisteredWebhookTarget,
  type OrganizationContext,
} from '../applyShareService';
import type { ApplyBundle } from '../applyBundle';

const prismaMock = prisma as unknown as {
  employerWebhookConfig: { findFirst: jest.Mock };
};

const ORG_UUID = '550e8400-e29b-41d4-a716-446655440000';
const PUBLIC_IP = '93.184.216.34';
const PER_ORG_SECRET = 'per-org-secret-value';
const OLD_DEFAULT_SECRET = 'vcv-default-secret';

function bundleFixture(): ApplyBundle {
  return {
    bundleId: '11111111-1111-4111-8111-111111111111',
    npi: '1003000126',
    clinicianName: 'Dr. Jane Doe',
    trustState: {
      readiness_level: 'L2',
      readiness_score: 78,
      readiness_status: 'PARTIAL',
      computed_at: '2026-08-16T00:00:00.000Z',
    },
    credentials: [],
    issuerProvenance: [],
    monitoringStatus: 'partial',
    profileUrl: 'https://vitalcv.com/p/1003000126',
    generatedAt: '2026-08-16T00:00:00.000Z',
    expiresAt: '2026-08-17T00:00:00.000Z',
    signature: 'sha256deadbeef',
  };
}

const ORG_CTX: OrganizationContext = {
  organization_id: ORG_UUID,
  name: 'Mercy General',
  purpose_of_use: 'Credentialing review',
  callback_url: 'https://ehr.attacker.example/collect',
};

function okResponse() {
  return { ok: true, status: 200, statusText: 'OK', type: 'basic' } as unknown as Response;
}
function redirectResponse() {
  return { ok: false, status: 302, statusText: 'Found', type: 'default' } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveRegisteredWebhookTarget', () => {
  it('returns null and does NOT query for a non-uuid org id (a client slug)', async () => {
    const target = await resolveRegisteredWebhookTarget('stanford-health-001');
    expect(target).toBeNull();
    expect(prismaMock.employerWebhookConfig.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when no active config exists', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue(null);
    expect(await resolveRegisteredWebhookTarget(ORG_UUID)).toBeNull();
  });

  it('fails closed when the config has no per-org secret', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: null,
      isActive: true,
    });
    expect(await resolveRegisteredWebhookTarget(ORG_UUID)).toBeNull();
  });

  it('returns the registered url + per-org secret when configured', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: PER_ORG_SECRET,
      isActive: true,
    });
    expect(await resolveRegisteredWebhookTarget(ORG_UUID)).toEqual({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: PER_ORG_SECRET,
    });
  });
});

describe('dispatchToOrganization', () => {
  it('does NOT dispatch the client callback_url when no config is registered', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue(null);
    const fetchImpl = jest.fn();

    const result = await dispatchToOrganization(ORG_UUID, bundleFixture(), ORG_CTX, 'share-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolver: async () => [PUBLIC_IP],
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.delivered).toBe(false);
    expect(result.webhookUrl).toBeNull();
    expect(result.error).toBeNull();
  });

  it('fails closed (no fetch, no default-secret signing) when the config has no secret', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: null,
      isActive: true,
    });
    const fetchImpl = jest.fn();

    const result = await dispatchToOrganization(ORG_UUID, bundleFixture(), ORG_CTX, 'share-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolver: async () => [PUBLIC_IP],
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.delivered).toBe(false);
  });

  it('blocks a registered target that resolves to a private/metadata address (SSRF)', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: PER_ORG_SECRET,
      isActive: true,
    });
    const fetchImpl = jest.fn();

    const result = await dispatchToOrganization(ORG_UUID, bundleFixture(), ORG_CTX, 'share-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolver: async () => ['169.254.169.254'],
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.delivered).toBe(false);
    expect(result.error).toMatch(/^blocked_egress:/);
  });

  it('does not follow a redirect (redirect: manual, treated as non-delivery)', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: PER_ORG_SECRET,
      isActive: true,
    });
    const fetchImpl = jest.fn().mockResolvedValue(redirectResponse());

    const result = await dispatchToOrganization(ORG_UUID, bundleFixture(), ORG_CTX, 'share-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolver: async () => [PUBLIC_IP],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const opts = fetchImpl.mock.calls[0][1];
    expect(opts.redirect).toBe('manual');
    expect(result.delivered).toBe(false);
    expect(result.error).toMatch(/^redirect_blocked:/);
  });

  it('delivers to a public registered target signed with the PER-ORG secret (not a default)', async () => {
    prismaMock.employerWebhookConfig.findFirst.mockResolvedValue({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: PER_ORG_SECRET,
      isActive: true,
    });
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());

    const result = await dispatchToOrganization(ORG_UUID, bundleFixture(), ORG_CTX, 'share-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolver: async () => [PUBLIC_IP],
    });

    expect(result.delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [calledUrl, opts] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toBe('https://ehr.example.com/hook');
    expect(opts.redirect).toBe('manual');

    // Recompute the signature and prove the per-org secret was used, not the
    // old public default constant.
    const header = (opts.headers as Record<string, string>)['X-VitalCV-Signature'];
    const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
    expect(match).not.toBeNull();
    const ts = match![1];
    const sentSig = match![2];
    const body = opts.body as string;
    const expectedWithPerOrg = createHmac('sha256', PER_ORG_SECRET).update(`t=${ts}${body}`).digest('hex');
    const wouldBeWithDefault = createHmac('sha256', OLD_DEFAULT_SECRET).update(`t=${ts}${body}`).digest('hex');
    expect(sentSig).toBe(expectedWithPerOrg);
    expect(sentSig).not.toBe(wouldBeWithDefault);
  });
});
