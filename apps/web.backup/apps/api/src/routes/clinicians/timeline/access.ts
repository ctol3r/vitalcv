import { AuthenticatedRequest } from '../../../../../../backend/src/middleware/accessGuards';

const ADMIN_ROLES = new Set(['ORG_ADMIN', 'INTERNAL_ADMIN']);

export function canAccessTimeline(user: AuthenticatedRequest['user'], clinicianOwnerId: string) {
  if (!user) {
    return false;
  }
  const isAdmin = user.roles?.some((role) => ADMIN_ROLES.has(role));
  const isSelf = user.id != null && user.id.toString() === clinicianOwnerId;
  return Boolean(isAdmin || isSelf);
}


