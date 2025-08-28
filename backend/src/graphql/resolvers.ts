import prisma from './prisma_client'

export const resolvers = {
  Query: {
    credential: (_: unknown, args: { id: string }) => {
      return prisma.credential.findUnique({ where: { id: args.id } })
    },
    credentials: () => {
      return prisma.credential.findMany()
    },
  },
  Mutation: {
    createCredential: (_: unknown, args: { name: string; issuer: string }) => {
      return prisma.credential.create({
        data: {
          name: args.name,
          issuer: args.issuer,
        },
      })
    },
    updateCredential: (
      _: unknown,
      args: { id: string; name?: string; issuer?: string }
    ) => {
      return prisma.credential.update({
        where: { id: args.id },
        data: {
          name: args.name,
          issuer: args.issuer,
        },
      })
    },
    deleteCredential: (_: unknown, args: { id: string }) => {
      return prisma.credential.delete({ where: { id: args.id } })
    },
  },
}
