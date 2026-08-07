import { randomUUID } from 'node:crypto';
import prisma from '../../../graphql/prisma_client';
import { upsertOrgProfile } from '../../opportunities/opportunityService';
import { recordOrganizationAccessRequest } from '../organizationAccessGovernance';

/**
 * Organization access governance — against a REAL Postgres.
 *
 * These are negative authorization tests: the thing being asserted is what does
 * NOT happen in the database when authority is absent. A mocked prisma cannot
 * make that claim — it would only prove which methods were called, not that no
 * membership row exists. Every assertion below reads the database back.
 *
 * The invariant with teeth: an organization NPI is a federal identifier for a
 * specific organization, and the domain check compares the account's email to a
 * website the CALLER supplied. So a domain match is a fact about the domain and
 * no evidence at all about the NPI. If a work-domain grant bound the NPI, any
 * operator with an address at their own domain could send a hospital's real
 * Type 2 NPI and take the hospital's identifier with them.
 */

const RUN = randomUUID().slice(0, 8);

/** A real, check-digit-valid Type 2 NPI shape — the value under contest. */
const CONTESTED_NPI = '1720082779';

async function seedAccount(email: string): Promise<{ clerkUserId: string; userId: string }> {
  const clerkUserId = `user_${RUN}_${randomUUID().slice(0, 8)}`;
  const user = await prisma.user.create({
    data: { clerkUserId, email },
    select: { id: true },
  });
  await prisma.personProfile.create({ data: { userId: user.id, completeness: 0 } });
  return { clerkUserId, userId: user.id };
}

async function membershipCountFor(userId: string): Promise<number> {
  const profile = await prisma.personProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return 0;
  return prisma.workspaceMembership.count({ where: { personProfileId: profile.id } });
}

const createdUserIds: string[] = [];

afterAll(async () => {
  // Scoped cleanup only — an unscoped deleteMany would race the other suites
  // sharing this database.
  const profiles = await prisma.personProfile.findMany({
    where: { userId: { in: createdUserIds } },
    select: { id: true },
  });
  await prisma.workspaceMembership.deleteMany({
    where: { personProfileId: { in: profiles.map((p) => p.id) } },
  });
  await prisma.organizationAccessRequest.deleteMany({ where: { clerkUserId: { contains: RUN } } });
  await prisma.personProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe('a refused request grants nothing, and is not silently discarded', () => {
  it('personal-email caller: no organization, no membership, one PENDING_REVIEW row', async () => {
    const { clerkUserId, userId } = await seedAccount(`someone+${RUN}@gmail.com`);
    createdUserIds.push(userId);
    const name = `Refused Personal ${RUN}`;

    await expect(
      upsertOrgProfile(clerkUserId, { name, npi: CONTESTED_NPI, website: `https://refused-${RUN}.org` }),
    ).rejects.toThrow(/personal email address can’t establish authority|manual review/i);

    // The database is the assertion, not the thrown error.
    expect(await membershipCountFor(userId)).toBe(0);
    expect(await prisma.organization.count({ where: { name } })).toBe(0);

    const requests = await prisma.organizationAccessRequest.findMany({ where: { clerkUserId } });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe('PENDING_REVIEW');
    expect(requests[0].authorityReason).toBe('public_email_provider');
    expect(requests[0].organizationId).toBeNull();
    expect(requests[0].npiBindingGranted).toBe(false);
    // The refusal is now a queue item — the promise the copy makes.
    expect(requests[0].requestedNpi).toBe(CONTESTED_NPI);
  });

  it('domain-mismatch caller: refused, recorded, and the NPI stays unbound anywhere', async () => {
    const { clerkUserId, userId } = await seedAccount(`ops+${RUN}@unrelated-${RUN}.com`);
    createdUserIds.push(userId);

    await expect(
      upsertOrgProfile(clerkUserId, {
        name: `Mismatch Health ${RUN}`,
        npi: CONTESTED_NPI,
        website: `https://mismatch-${RUN}.org`,
      }),
    ).rejects.toThrow(/doesn’t match|manual review|reviewer/i);

    expect(await membershipCountFor(userId)).toBe(0);
    const rows = await prisma.organizationAccessRequest.findMany({ where: { clerkUserId } });
    expect(rows[0].status).toBe('PENDING_REVIEW');
    expect(rows[0].authorityReason).toBe('domain_mismatch');
    // Nothing, anywhere, took the contested NPI on the strength of a refusal.
    expect(
      await prisma.organizationProfile.count({ where: { npi: CONTESTED_NPI } }),
    ).toBe(0);
  });

  it('no website supplied: refused as no_org_domain rather than defaulting open', async () => {
    const { clerkUserId, userId } = await seedAccount(`ops+${RUN}@nowebsite-${RUN}.org`);
    createdUserIds.push(userId);

    await expect(
      upsertOrgProfile(clerkUserId, { name: `No Website ${RUN}`, npi: CONTESTED_NPI }),
    ).rejects.toThrow();

    expect(await membershipCountFor(userId)).toBe(0);
    const rows = await prisma.organizationAccessRequest.findMany({ where: { clerkUserId } });
    expect(rows[0].authorityReason).toBe('no_org_domain');
    expect(rows[0].status).toBe('PENDING_REVIEW');
  });
});

describe('an automatic grant never carries the NPI with it', () => {
  it('work-domain match creates the org and membership, but leaves the NPI unbound', async () => {
    const domain = `granted-${RUN}.org`;
    const { clerkUserId, userId } = await seedAccount(`ops@${domain}`);
    createdUserIds.push(userId);

    const result = await upsertOrgProfile(clerkUserId, {
      name: `Granted Health ${RUN}`,
      npi: CONTESTED_NPI,
      website: `https://${domain}`,
    });

    expect(result.organizationId).toBeTruthy();
    expect(await membershipCountFor(userId)).toBe(1);

    // THE INVARIANT. The caller supplied both the NPI and the website; the
    // domain match speaks only to the domain. Binding the NPI here would let
    // anyone with a work address take any organization's federal identifier.
    const profile = await prisma.organizationProfile.findUnique({
      where: { organizationId: result.organizationId },
      select: { npi: true, website: true },
    });
    expect(profile?.npi ?? null).toBeNull();
    expect(profile?.website).toContain(domain);

    const rows = await prisma.organizationAccessRequest.findMany({ where: { clerkUserId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('GRANTED');
    expect(rows[0].authorityReason).toBe('work_domain_match');
    expect(rows[0].npiBindingGranted).toBe(false);
    // The record points at what it produced.
    expect(rows[0].organizationId).toBe(result.organizationId);
    // The NPI that was asked for is still on the record, awaiting review.
    expect(rows[0].requestedNpi).toBe(CONTESTED_NPI);
  });

  it('a second account at an unrelated domain cannot take the contested NPI either', async () => {
    const domain = `opportunist-${RUN}.com`;
    const { clerkUserId, userId } = await seedAccount(`admin@${domain}`);
    createdUserIds.push(userId);

    // Authorized for ITS OWN domain — and still gets no NPI.
    const result = await upsertOrgProfile(clerkUserId, {
      name: `Opportunist Group ${RUN}`,
      npi: CONTESTED_NPI,
      website: `https://${domain}`,
    });

    const profile = await prisma.organizationProfile.findUnique({
      where: { organizationId: result.organizationId },
      select: { npi: true },
    });
    expect(profile?.npi ?? null).toBeNull();
    expect(await prisma.organizationProfile.count({ where: { npi: CONTESTED_NPI } })).toBe(0);
  });
});

describe('every decision leaves an audit trail and an outbox event', () => {
  it('writes an audit event and an outbox event for a grant', async () => {
    const domain = `audited-${RUN}.org`;
    const { clerkUserId, userId } = await seedAccount(`ops@${domain}`);
    createdUserIds.push(userId);

    const decision = await recordOrganizationAccessRequest({
      clerkUserId,
      accountEmail: `ops@${domain}`,
      requestedName: `Audited Health ${RUN}`,
      requestedNpi: CONTESTED_NPI,
      requestedWebsite: `https://${domain}`,
      organizationDomain: domain,
    });

    expect(decision.authorized).toBe(true);
    expect(decision.npiBindingGranted).toBe(false);

    const audit = await prisma.auditEvent.findFirst({ where: { referenceId: decision.requestId } });
    expect(audit?.type).toBe('ORGANIZATION_ACCESS_GRANTED');
    expect(audit?.hash).toMatch(/^[0-9a-f]{64}$/);

    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: decision.requestId },
    });
    expect(outbox?.eventType).toBe('ORGANIZATION_ACCESS_GRANTED');
    expect(outbox?.aggregateType).toBe('ORGANIZATION_ACCESS_REQUEST');
    expect(outbox?.status).toBe('PENDING');
    expect((outbox?.payload as { npiBindingGranted?: boolean })?.npiBindingGranted).toBe(false);

    await prisma.auditEvent.deleteMany({ where: { referenceId: decision.requestId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: decision.requestId } });
  });

  it('writes them for a REFUSAL too — an attempted takeover is worth recording', async () => {
    const { clerkUserId, userId } = await seedAccount(`someone+r${RUN}@gmail.com`);
    createdUserIds.push(userId);

    const decision = await recordOrganizationAccessRequest({
      clerkUserId,
      accountEmail: `someone+r${RUN}@gmail.com`,
      requestedName: `Refused Audited ${RUN}`,
      requestedNpi: CONTESTED_NPI,
      requestedWebsite: 'https://some-hospital.org',
      organizationDomain: 'some-hospital.org',
    });

    expect(decision.authorized).toBe(false);
    expect(decision.status).toBe('PENDING_REVIEW');
    expect(decision.refusal).toBeTruthy();

    const audit = await prisma.auditEvent.findFirst({ where: { referenceId: decision.requestId } });
    expect(audit?.type).toBe('ORGANIZATION_ACCESS_PENDING_REVIEW');

    const outbox = await prisma.outboxEvent.findFirst({ where: { aggregateId: decision.requestId } });
    expect(outbox?.eventType).toBe('ORGANIZATION_ACCESS_PENDING_REVIEW');

    await prisma.auditEvent.deleteMany({ where: { referenceId: decision.requestId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: decision.requestId } });
  });
});

describe('authority cannot be asserted by the caller', () => {
  it('ignores caller-supplied status, organizationId and npiBindingGranted', async () => {
    const domain = `spoof-${RUN}.org`;
    const { clerkUserId, userId } = await seedAccount(`someone+s${RUN}@gmail.com`);
    createdUserIds.push(userId);

    // A hostile payload asserting its own outcome. The signature has no field
    // for any of it; the decision reads the SERVER-held account email instead.
    const hostile = {
      clerkUserId,
      accountEmail: `someone+s${RUN}@gmail.com`,
      requestedName: `Spoof Health ${RUN}`,
      requestedNpi: CONTESTED_NPI,
      requestedWebsite: `https://${domain}`,
      organizationDomain: domain,
      status: 'GRANTED',
      authorized: true,
      npiBindingGranted: true,
      organizationId: randomUUID(),
    } as unknown as Parameters<typeof recordOrganizationAccessRequest>[0];

    const decision = await recordOrganizationAccessRequest(hostile);

    expect(decision.authorized).toBe(false);
    expect(decision.status).toBe('PENDING_REVIEW');
    expect(decision.npiBindingGranted).toBe(false);

    const row = await prisma.organizationAccessRequest.findUnique({ where: { id: decision.requestId } });
    expect(row?.status).toBe('PENDING_REVIEW');
    expect(row?.organizationId).toBeNull();
    expect(row?.npiBindingGranted).toBe(false);

    await prisma.auditEvent.deleteMany({ where: { referenceId: decision.requestId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: decision.requestId } });
  });
});
