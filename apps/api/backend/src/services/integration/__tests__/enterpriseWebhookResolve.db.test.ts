/**
 * enterpriseWebhookResolve.db.test.ts — real-schema proof for the resolver.
 *
 * resolveEnterpriseWebhookTarget once selected `signingSecret`/`active` — columns
 * that do not exist on EmployerWebhookConfig (the model is `secret`/`isActive`).
 * A `@ts-nocheck` hid the type error and the query threw at runtime, so the whole
 * enterprise revocation webhook path was dead.
 *
 * A mocked prisma cannot catch that: it never touches the real column set. This
 * suite seeds actual EmployerWebhookConfig rows in the ephemeral Postgres the
 * backend test harness provisions and exercises the real query. Against the
 * pre-fix code the seeded-row lookup throws on the unknown columns (the query is
 * not wrapped to swallow that); the fix reads the real columns and returns the
 * target.
 */

import { randomUUID } from 'node:crypto';
import prisma from '../../../graphql/prisma_client';
import { resolveEnterpriseWebhookTarget } from '../webhookDispatcher';

const CREATED_CONFIG_IDS: string[] = [];

async function makeConfig(input: {
  webhookUrl: string;
  secret: string | null;
  isActive: boolean;
}): Promise<string> {
  const employerId = randomUUID();
  const config = await prisma.employerWebhookConfig.create({
    data: {
      employerId,
      webhookUrl: input.webhookUrl,
      secret: input.secret,
      eventType: 'credential.revoked',
      isActive: input.isActive,
    },
    select: { id: true, employerId: true },
  });
  CREATED_CONFIG_IDS.push(config.id);
  return config.employerId;
}

afterAll(async () => {
  if (CREATED_CONFIG_IDS.length > 0) {
    await prisma.employerWebhookConfig.deleteMany({ where: { id: { in: CREATED_CONFIG_IDS } } });
  }
  await prisma.$disconnect();
});

describe('resolveEnterpriseWebhookTarget — against real Postgres', () => {
  it('reads the real secret/isActive columns and returns the registered target', async () => {
    const employerId = await makeConfig({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: 'per-org-db-secret',
      isActive: true,
    });

    const target = await resolveEnterpriseWebhookTarget(employerId, 'acceptance-db-1');

    expect(target).toEqual({
      employerId,
      acceptanceId: 'acceptance-db-1',
      webhookUrl: 'https://ehr.example.com/hook',
      signingSecret: 'per-org-db-secret',
    });
  });

  it('fails closed against a real row that has no per-org secret', async () => {
    const employerId = await makeConfig({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: null,
      isActive: true,
    });

    expect(await resolveEnterpriseWebhookTarget(employerId, 'acceptance-db-2')).toBeNull();
  });

  it('returns null for an inactive real config', async () => {
    const employerId = await makeConfig({
      webhookUrl: 'https://ehr.example.com/hook',
      secret: 'per-org-db-secret',
      isActive: false,
    });

    expect(await resolveEnterpriseWebhookTarget(employerId, 'acceptance-db-3')).toBeNull();
  });

  it('returns null when no config exists for the employer', async () => {
    expect(await resolveEnterpriseWebhookTarget(randomUUID(), 'acceptance-db-4')).toBeNull();
  });
});
