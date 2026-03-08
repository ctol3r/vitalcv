import prisma from '../../graphql/prisma_client';

export async function getDualRoleUserRate(): Promise<{
  total: number;
  dualRole: number;
  rate: number;
}> {
  const users = await prisma.user.findMany({
    where: {
      personProfile: {
        isNot: null,
      },
    },
    select: {
      id: true,
      personProfile: {
        select: {
          memberships: {
            where: {
              active: true,
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const total = users.length;
  const dualRole = users.filter(
    (user) => (user.personProfile?.memberships.length ?? 0) > 0,
  ).length;

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
