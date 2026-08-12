/**
 * Wave 1 Binding B — the tenancy backfill, against a REAL database.
 *
 * Fixing `upsertOrgProfile` only helps employers who sign up from now on. Every
 * organization already created through the real path holds a valid ADMIN
 * membership and a null `User.organizationId`, so those employers stay locked
 * out of their own applications until the column is repaired.
 *
 * This suite executes THE MIGRATION FILE itself, read from disk. A copy of the
 * SQL inlined here would keep passing after the migration was edited, which
 * would prove nothing about what actually ships.
 *
 * What it has to prove is not only that the backfill fills — it is that the
 * backfill REFUSES to guess. A user with active memberships in several
 * organizations has no single answer, and inventing one would fabricate a
 * tenancy binding.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MembershipRole, PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const MIGRATION_SQL_PATH = join(
  __dirname,
  '../../../../prisma/migrations/20260810000000_backfill_user_organization_binding/migration.sql',
);

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

/** Run the real migration, exactly as `prisma migrate deploy` would. */
async function runBackfillMigration(): Promise<void> {
  const sql = readFileSync(MIGRATION_SQL_PATH, 'utf8');
  await prisma.$executeRawUnsafe(sql);
}

async function createOrganization(label: string): Promise<{ organizationId: string; organizationProfileId: string }> {
  const organization = await prisma.organization.create({
    data: { name: `${label} ${suffix}`, slug: `${label}-${suffix}` },
  });
  const profile = await prisma.organizationProfile.create({
    data: { organizationId: organization.id },
  });
  return { organizationId: organization.id, organizationProfileId: profile.id };
}

/**
 * A user in exactly the state self-serve setup used to leave behind: real
 * memberships, null binding.
 */
async function createUserWithMemberships(input: {
  label: string;
  organizationProfileIds: readonly string[];
  organizationId?: string | null;
  active?: boolean;
}): Promise<string> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: `${input.label}-${suffix}`,
      email: `${input.label}-${suffix}@backfill.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
      organizationId: input.organizationId ?? null,
    },
  });

  const personProfile = await prisma.personProfile.create({
    data: { userId: user.id, completeness: 0 },
  });

  for (const organizationProfileId of input.organizationProfileIds) {
    await prisma.workspaceMembership.create({
      data: {
        id: randomUUID(),
        personProfileId: personProfile.id,
        organizationProfileId,
        role: MembershipRole.ADMIN,
        active: input.active ?? true,
      },
    });
  }

  return user.id;
}

async function organizationIdOf(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

let orgA: { organizationId: string; organizationProfileId: string };
let orgB: { organizationId: string; organizationProfileId: string };

let strandedUserId: string;
let ambiguousUserId: string;
let alreadyBoundUserId: string;
let inactiveOnlyUserId: string;
let noMembershipUserId: string;

beforeAll(async () => {
  orgA = await createOrganization('backfill-org-a');
  orgB = await createOrganization('backfill-org-b');

  // The population this migration exists for.
  strandedUserId = await createUserWithMemberships({
    label: 'backfill-stranded',
    organizationProfileIds: [orgA.organizationProfileId],
  });

  // Two active memberships, two organizations, no single right answer.
  ambiguousUserId = await createUserWithMemberships({
    label: 'backfill-ambiguous',
    organizationProfileIds: [orgA.organizationProfileId, orgB.organizationProfileId],
  });

  // Already bound to A, and an active membership in B. Must not be moved.
  alreadyBoundUserId = await createUserWithMemberships({
    label: 'backfill-already-bound',
    organizationProfileIds: [orgB.organizationProfileId],
    organizationId: orgA.organizationId,
  });

  // Membership revoked — not a member, so not a binding.
  inactiveOnlyUserId = await createUserWithMemberships({
    label: 'backfill-inactive',
    organizationProfileIds: [orgB.organizationProfileId],
    active: false,
  });

  noMembershipUserId = await createUserWithMemberships({
    label: 'backfill-no-membership',
    organizationProfileIds: [],
  });

  await runBackfillMigration();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('User.organizationId backfill migration', () => {
  it('binds a stranded employer to the organization they already administer', async () => {
    expect(await organizationIdOf(strandedUserId)).toBe(orgA.organizationId);
  });

  it('leaves an ambiguous user unbound rather than guessing an organization', async () => {
    // Not-found is a finding. Two active memberships means the answer is
    // unknown, and an unknown tenancy must stay null for a human to resolve.
    expect(await organizationIdOf(ambiguousUserId)).toBeNull();
  });

  it('never moves a user who is already bound', async () => {
    expect(await organizationIdOf(alreadyBoundUserId)).toBe(orgA.organizationId);
  });

  it('does not bind on a revoked membership', async () => {
    expect(await organizationIdOf(inactiveOnlyUserId)).toBeNull();
  });

  it('does not bind a user with no membership at all', async () => {
    expect(await organizationIdOf(noMembershipUserId)).toBeNull();
  });

  it('is idempotent — a second run changes nothing', async () => {
    const before = await Promise.all([
      organizationIdOf(strandedUserId),
      organizationIdOf(ambiguousUserId),
      organizationIdOf(alreadyBoundUserId),
      organizationIdOf(inactiveOnlyUserId),
      organizationIdOf(noMembershipUserId),
    ]);

    await runBackfillMigration();

    const after = await Promise.all([
      organizationIdOf(strandedUserId),
      organizationIdOf(ambiguousUserId),
      organizationIdOf(alreadyBoundUserId),
      organizationIdOf(inactiveOnlyUserId),
      organizationIdOf(noMembershipUserId),
    ]);

    expect(after).toEqual(before);
  });
});
