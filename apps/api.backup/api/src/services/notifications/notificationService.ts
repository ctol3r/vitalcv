/**
 * B148B-NOTIF-001: Notification service for creating and managing notifications
 */

import { OrgMembershipRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNotificationParams {
  userId: string;
  orgId?: string;
  type: string;
  payload: Record<string, any>;
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      orgId: params.orgId,
      type: params.type,
      payload: params.payload,
      read: false,
    },
  });
}

/**
 * Create notifications for multiple users (e.g., all org admins)
 */
export async function createNotificationsForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      createNotification({
        ...params,
        userId,
      })
    )
  );
}

/**
 * Get org admin user IDs for an organization
 * For demo purposes, returns users with 'org_admin' role or isOrgAdmin flag
 */
export async function getOrgAdminUserIds(orgId: string): Promise<string[]> {
  // Find users linked to this org with admin role
  const userLinks = await prisma.orgMembership.findMany({
    where: {
      orgId,
      role: OrgMembershipRole.ADMIN,
    },
    select: {
      userId: true,
    },
  });

  // Also find users with 'org_admin' platform role fallback
  const usersWithRole = await prisma.user.findMany({
    where: {
      roles: {
        has: 'org_admin',
      },
    },
    select: {
      id: true,
    },
  });

  // Combine and deduplicate
  const userIds = new Set<string>();
  userLinks.forEach((link) => userIds.add(link.userId));
  usersWithRole.forEach((user) => userIds.add(user.id));

  return Array.from(userIds);
}

