/**
 * Local Prisma client typing shim for packages/domain-identity.
 * Keeps identity models type-safe without generated Prisma types.
 */
declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
  }

  export namespace Prisma {
    type JsonValue = any;
    type InputJsonValue = any;
  }
}
