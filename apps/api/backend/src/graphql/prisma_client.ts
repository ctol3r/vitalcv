import { Prisma, PrismaClient } from '@prisma/client';

type AuditEventCreateDataWithLooseJson =
  | (Omit<Prisma.AuditEventCreateInput, 'metadata'> & {
      metadata?: Prisma.InputJsonValue | Record<string, unknown> | null;
    })
  | (Omit<Prisma.AuditEventUncheckedCreateInput, 'metadata'> & {
      metadata?: Prisma.InputJsonValue | Record<string, unknown> | null;
    });

type AuditEventCreateArgsWithLooseJson = Omit<Prisma.AuditEventCreateArgs, 'data'> & {
  data: AuditEventCreateDataWithLooseJson;
};

type PrismaClientWithLooseAuditJson = Omit<PrismaClient, 'auditEvent'> & {
  auditEvent: Omit<PrismaClient['auditEvent'], 'create'> & {
    create(args: AuditEventCreateArgsWithLooseJson): ReturnType<PrismaClient['auditEvent']['create']>;
  };
};

// Singleton Prisma client instance.
const prismaClient = new PrismaClient();
const prisma = prismaClient as unknown as PrismaClientWithLooseAuditJson;

export default prisma;
