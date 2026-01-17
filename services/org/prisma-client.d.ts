/**
 * Local Prisma client typing shim for services/org.
 * Keeps org service tests type-safe without relying on generated Prisma types.
 */
declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
  }

  export enum OrgMembershipRole {
    ADMIN = 'ADMIN',
    REVIEWER = 'REVIEWER',
    VIEWER = 'VIEWER',
  }

  export enum OrgMembershipV2Status {
    INVITED = 'INVITED',
    PENDING = 'PENDING',
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
  }

  export enum OrgOnboardingRequestStatus {
    PENDING = 'PENDING',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED',
    DECLINED = 'DECLINED',
    CANCELLED = 'CANCELLED',
  }

  export namespace Prisma {
    type JsonValue = any;
    type InputJsonValue = any;
  }
}
