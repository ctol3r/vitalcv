import prisma from '../../graphql/prisma_client';

// The Prisma schema declares NO relations between User, PersonProfile and
// WorkspaceMembership (plain FK columns), so relation-style filters/selects
// (`personProfile: { isNot: null }`, nested `memberships`) throw P2009 at
// runtime. Fetch the real tables and compose in JS instead (see
// hydrateWorkspaceUser in workspaceService.ts).
export async function getDualRoleUserRate(): Promise<{
  total: number;
  dualRole: number;
  rate: number;
}> {
  // PersonProfile.userId is unique + required, so profiles stand in 1:1 for
  // users that have one.
  const personProfiles = await prisma.personProfile.findMany({
    select: { id: true },
  });

  const total = personProfiles.length;
  if (total === 0) {
    return { total: 0, dualRole: 0, rate: 0 };
  }

  const activeMemberships = await prisma.workspaceMembership.findMany({
    where: { active: true },
    select: { personProfileId: true },
  });

  const profileIds = new Set(personProfiles.map((profile) => profile.id));
  const dualRoleProfileIds = new Set(
    activeMemberships
      .map((membership) => membership.personProfileId)
      .filter((personProfileId) => profileIds.has(personProfileId)),
  );
  const dualRole = dualRoleProfileIds.size;

  return {
    total,
    dualRole,
    rate: total > 0 ? Math.round((dualRole / total) * 1000) / 10 : 0,
  };
}

export async function getWorkspaceSwitchCount(since: Date): Promise<number> {
  return prisma.auditEvent.count({
    where: {
      type: 'workspace_switched',
      createdAt: {
        gte: since,
      },
    },
  });
}
