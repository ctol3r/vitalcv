/**
 * Local Prisma client typing shim for services/privileging.
 */
declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
  }

  export interface AnalyticsEvent {
    eventType: string;
    timestamp: Date;
    [key: string]: any;
  }

  export namespace Prisma {
    type InputJsonValue = any;
  }
}
