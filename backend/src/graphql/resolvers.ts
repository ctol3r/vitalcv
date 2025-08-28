import { PrismaClient } from '@prisma/client';

type Context = {
  prisma: PrismaClient;
};

export const resolvers = {
  Query: {
    credentials: (_parent: unknown, _args: unknown, context: Context) => context.prisma.credential.findMany(),
    credential: (_parent: unknown, args: { id: string }, context: Context) =>
      context.prisma.credential.findUnique({ where: { id: args.id } }),
  },
  Mutation: {
    createCredential: (_parent: unknown, args: { name: string; issuer: string }, context: Context) =>
      context.prisma.credential.create({
        data: {
          name: args.name,
          issuer: args.issuer,
          issuedAt: new Date().toISOString(),
        },
      }),

    updateCredential: (
      _parent: unknown,
      args: { id: string; name?: string; issuer?: string },
      context: Context
    ) =>
      context.prisma.credential.update({
        where: { id: args.id },
        data: {
          name: args.name,
          issuer: args.issuer,
        },
      }),

    deleteCredential: (_parent: unknown, args: { id: string }, context: Context) =>
      context.prisma.credential.delete({ where: { id: args.id } }),
  },
};
