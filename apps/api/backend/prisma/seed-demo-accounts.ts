/**
 * seed-demo-accounts.ts
 *
 * Provisions demo user accounts for pilot walkthroughs.
 * Creates one employer admin and one verifier, each linked
 * to a seeded organization via WorkspaceMembership.
 *
 * Run: pnpm exec ts-node -P tsconfig.seed.json prisma/seed-demo-accounts.ts
 *
 * Idempotent — safe to re-run.
 */

import { ActivePersona, MembershipRole, type PrismaClient } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';

interface DemoAccount {
  clerkUserId: string;
  email: string;
  userRole: 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';
  membershipRole: MembershipRole;
  activePersona: ActivePersona;
  organizationSlug: string;
  firstName: string;
  lastName: string;
  label: string;
}

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    clerkUserId: 'seed_employer_demo',
    email: 'employer-demo@vitalcv.example',
    userRole: 'ADMIN',
    membershipRole: MembershipRole.ADMIN,
    activePersona: ActivePersona.CLINICIAN,
    organizationSlug: 'bay-area-cardiac-group',
    firstName: 'Dana',
    lastName: 'Chen',
    label: 'Employer Admin',
  },
  {
    clerkUserId: 'seed_verifier_demo',
    email: 'verifier-demo@vitalcv.example',
    userRole: 'VERIFIER',
    membershipRole: MembershipRole.VERIFIER,
    activePersona: ActivePersona.VERIFIER,
    organizationSlug: 'sacramento-medical-center',
    firstName: 'Jordan',
    lastName: 'Reeves',
    label: 'Verifier / Reviewer',
  },
] as const;

async function seedDemoAccounts(prismaClient: PrismaClient = prisma) {
  let created = 0;
  let updated = 0;

  for (const account of DEMO_ACCOUNTS) {
    // 1. Resolve the target organization
    const organization = await prismaClient.organization.findUnique({
      where: { slug: account.organizationSlug },
      select: {
        id: true,
        organizationProfile: { select: { id: true } },
      },
    });

    if (!organization) {
      console.warn(
        `[skip] Organization "${account.organizationSlug}" not found — run seed:opportunities first.`,
      );
      continue;
    }

    // 2. Upsert the User record
    const user = await prismaClient.user.upsert({
      where: { email: account.email },
      update: {
        clerkUserId: account.clerkUserId,
        role: account.userRole,
        status: 'ACTIVE',
        organizationId: organization.id,
      },
      create: {
        clerkUserId: account.clerkUserId,
        email: account.email,
        role: account.userRole,
        status: 'ACTIVE',
        organizationId: organization.id,
      },
    });

    // 3. Upsert PersonProfile (required for WorkspaceMembership FK)
    const personProfile = await prismaClient.personProfile.upsert({
      where: { userId: user.id },
      update: {
        firstName: account.firstName,
        lastName: account.lastName,
      },
      create: {
        userId: user.id,
        firstName: account.firstName,
        lastName: account.lastName,
      },
    });

    // 4. Upsert WorkspaceMembership (links person → org)
    if (organization.organizationProfile) {
      await prismaClient.workspaceMembership.upsert({
        where: {
          personProfileId_organizationProfileId: {
            personProfileId: personProfile.id,
            organizationProfileId: organization.organizationProfile.id,
          },
        },
        update: {
          role: account.membershipRole,
          active: true,
          acceptedAt: new Date(),
        },
        create: {
          personProfileId: personProfile.id,
          organizationProfileId: organization.organizationProfile.id,
          role: account.membershipRole,
          active: true,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
    }

    // 5. Upsert WorkspacePreference (sets active persona + org)
    await prismaClient.workspacePreference.upsert({
      where: { userId: user.id },
      update: {
        activePersona: account.activePersona,
        activeOrgId: organization.id,
      },
      create: {
        userId: user.id,
        activePersona: account.activePersona,
        activeOrgId: organization.id,
      },
    });

    const existed = await prismaClient.user.findUnique({
      where: { email: account.email },
    });
    if (existed) updated += 1;
    else created += 1;

    console.log(`[ok] ${account.label}: ${account.email} → ${account.organizationSlug}`);
  }

  console.log(`Done. Created ${created}, updated ${updated} demo account(s).`);
}

seedDemoAccounts()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
