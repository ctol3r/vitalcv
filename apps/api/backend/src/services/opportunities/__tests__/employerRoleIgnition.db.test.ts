/**
 * Employer role ignition — against a REAL database.
 *
 * Self-serve employers never received `UserRole.VERIFIER`: role inference
 * reads only NpiOwnership (the clinician claim table), and `upsertOrgProfile`
 * set `User.organizationId` without ever touching `user.role`. The web
 * middleware bounces non-VERIFIERs off /employer/*, so a granted self-serve
 * employer was locked out of the surface their grant exists to open.
 *
 * Pins the whole gate, not just the upgrade:
 *  - GRANTED (work-email domain matches the org website) upgrades a default
 *    CLINICIAN to VERIFIER in the same audited grant;
 *  - a REFUSED request (public email provider → manual review) changes
 *    nothing — no role, no organizationId;
 *  - an ADMIN who registers an org is never downgraded;
 *  - the re-run realignment path picks up the role for a legacy user whose
 *    org was granted before ignition existed.
 *
 * Nothing about the grant is mocked — the real service runs the real
 * authority gate against real Prisma constraints (same doctrine as
 * employerSelfServeTenancy.db.test.ts).
 */

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

import { upsertOrgProfile } from '../opportunityService';

const prisma = new PrismaClient();

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

async function createUser(input: {
  clerkUserId: string;
  email: string;
  role: UserRole;
}): Promise<string> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      role: input.role,
      status: UserStatus.ACTIVE,
    },
  });
  return user.id;
}

async function readUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkUserId },
    select: { role: true, organizationId: true },
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('employer role ignition (upsertOrgProfile)', () => {
  it('GRANTED: upgrades the default CLINICIAN to VERIFIER in the org-grant transaction', async () => {
    const clerkUserId = `ignite-clinician-${suffix}`;
    const domain = `ignite-clinic-${suffix}.org`;
    await createUser({ clerkUserId, email: `admin@${domain}`, role: UserRole.CLINICIAN });

    const { organizationId } = await upsertOrgProfile(clerkUserId, {
      name: `Ignite Clinic ${suffix}`,
      website: `https://${domain}`,
      facilityType: 'hospital',
      statesCovered: ['CA'],
      hiringTypes: ['permanent'],
    });

    const user = await readUser(clerkUserId);
    expect(user).toEqual({ role: UserRole.VERIFIER, organizationId });
  });

  it('REFUSED (manual review): role and organizationId are untouched', async () => {
    // A personal-provider email cannot establish authority — the gate routes
    // to manual review and the service throws. Nothing may change until a
    // reviewer grants.
    const clerkUserId = `ignite-refused-${suffix}`;
    await createUser({
      clerkUserId,
      email: `someone-${suffix}@gmail.com`,
      role: UserRole.CLINICIAN,
    });

    await expect(
      upsertOrgProfile(clerkUserId, {
        name: `Refused Clinic ${suffix}`,
        website: `https://refused-clinic-${suffix}.org`,
        facilityType: 'hospital',
      }),
    ).rejects.toMatchObject({ status: 403 });

    const user = await readUser(clerkUserId);
    expect(user).toEqual({ role: UserRole.CLINICIAN, organizationId: null });
  });

  it('never downgrades: an ADMIN who registers an organization stays ADMIN', async () => {
    const clerkUserId = `ignite-admin-${suffix}`;
    const domain = `ignite-admin-clinic-${suffix}.org`;
    await createUser({ clerkUserId, email: `ops@${domain}`, role: UserRole.ADMIN });

    const { organizationId } = await upsertOrgProfile(clerkUserId, {
      name: `Admin Clinic ${suffix}`,
      website: `https://${domain}`,
      facilityType: 'hospital',
    });

    const user = await readUser(clerkUserId);
    expect(user).toEqual({ role: UserRole.ADMIN, organizationId });
  });

  it('re-run realignment: a legacy user with a granted org but the default role picks up VERIFIER', async () => {
    // Simulate a pre-ignition grant: create the org through the real service,
    // then reset the role to the CLINICIAN default the legacy write left
    // behind. Re-running setup takes the existing-membership realignment path
    // and must ignite the role there too.
    const clerkUserId = `ignite-legacy-${suffix}`;
    const domain = `ignite-legacy-clinic-${suffix}.org`;
    await createUser({ clerkUserId, email: `admin@${domain}`, role: UserRole.CLINICIAN });

    const { organizationId } = await upsertOrgProfile(clerkUserId, {
      name: `Legacy Clinic ${suffix}`,
      website: `https://${domain}`,
      facilityType: 'hospital',
    });
    await prisma.user.update({
      where: { clerkUserId },
      data: { role: UserRole.CLINICIAN, organizationId: null },
    });

    const rerun = await upsertOrgProfile(clerkUserId, {
      name: `Legacy Clinic ${suffix}`,
      website: `https://${domain}`,
      facilityType: 'hospital',
    });

    expect(rerun.organizationId).toBe(organizationId);
    const user = await readUser(clerkUserId);
    expect(user).toEqual({ role: UserRole.VERIFIER, organizationId });
  });
});
