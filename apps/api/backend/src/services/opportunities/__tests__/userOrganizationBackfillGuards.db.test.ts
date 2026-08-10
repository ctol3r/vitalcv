/**
 * Wave 1 Binding B — proof that the backfill's safety clauses are load-bearing.
 *
 * `userOrganizationBackfill.db.test.ts` shows the migration behaves correctly.
 * A passing test is not evidence on its own: both of those safety assertions
 * would also pass against a migration that simply matched nothing, and would
 * keep passing if someone deleted the clause that produces the behaviour.
 *
 * So this suite injects the defect each clause claims to prevent — deriving the
 * broken SQL from the real migration file in memory, never touching what ships
 * — and proves the broken version does the harmful thing the real one refuses
 * to do. If a clause is ever removed, the derivation stops changing the SQL and
 * these tests go red.
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

const AMBIGUITY_GUARD = '  HAVING COUNT(DISTINCT op."organization_id") = 1\n';
const NULL_GUARD = '\n  AND u."organizationId" IS NULL';

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

function migrationSql(): string {
  return readFileSync(MIGRATION_SQL_PATH, 'utf8');
}

/**
 * Remove a clause and assert the removal actually did something. Without this
 * assertion a renamed or reformatted clause would make the "defective" SQL
 * identical to the real SQL, and the injection would silently prove nothing.
 */
function withoutClause(sql: string, clause: string): string {
  const mutated = sql.replace(clause, '');
  if (mutated === sql) {
    throw new Error(
      `Injection failed: the backfill migration no longer contains the clause under test:\n${clause}`,
    );
  }
  return mutated;
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

async function createUserWithMemberships(input: {
  label: string;
  organizationProfileIds: readonly string[];
  organizationId?: string | null;
}): Promise<string> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: `${input.label}-${suffix}`,
      email: `${input.label}-${suffix}@backfill-guard.test`,
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
        active: true,
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

async function setBinding(userId: string, organizationId: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { organizationId } });
}

let orgA: { organizationId: string; organizationProfileId: string };
let orgB: { organizationId: string; organizationProfileId: string };
let ambiguousUserId: string;
let boundUserId: string;

beforeAll(async () => {
  orgA = await createOrganization('guard-org-a');
  orgB = await createOrganization('guard-org-b');

  ambiguousUserId = await createUserWithMemberships({
    label: 'guard-ambiguous',
    organizationProfileIds: [orgA.organizationProfileId, orgB.organizationProfileId],
  });

  // Bound to A, actively a member of B — the row a missing NULL guard moves.
  boundUserId = await createUserWithMemberships({
    label: 'guard-bound',
    organizationProfileIds: [orgB.organizationProfileId],
    organizationId: orgA.organizationId,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('backfill ambiguity guard', () => {
  it('WOULD invent a tenancy for a multi-org user if the guard were removed', async () => {
    await setBinding(ambiguousUserId, null);
    await prisma.$executeRawUnsafe(withoutClause(migrationSql(), AMBIGUITY_GUARD));

    // The defect the guard exists to prevent: a user whose memberships give no
    // single answer is handed one anyway.
    const guessed = await organizationIdOf(ambiguousUserId);
    expect(guessed).not.toBeNull();
    expect([orgA.organizationId, orgB.organizationId]).toContain(guessed);
  });

  it('leaves that same user unbound under the migration that actually ships', async () => {
    await setBinding(ambiguousUserId, null);
    await prisma.$executeRawUnsafe(migrationSql());

    expect(await organizationIdOf(ambiguousUserId)).toBeNull();
  });
});

describe('backfill null guard', () => {
  it('WOULD move an already-bound user to a different org if the guard were removed', async () => {
    await setBinding(boundUserId, orgA.organizationId);
    await prisma.$executeRawUnsafe(withoutClause(migrationSql(), NULL_GUARD));

    // The defect: an existing tenancy binding silently overwritten.
    expect(await organizationIdOf(boundUserId)).toBe(orgB.organizationId);
  });

  it('leaves that same user where they were under the migration that actually ships', async () => {
    await setBinding(boundUserId, orgA.organizationId);
    await prisma.$executeRawUnsafe(migrationSql());

    expect(await organizationIdOf(boundUserId)).toBe(orgA.organizationId);
  });
});
