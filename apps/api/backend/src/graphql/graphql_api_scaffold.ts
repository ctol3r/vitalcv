import { PrismaClient } from '@prisma/client';
import { ApolloServer, gql } from 'apollo-server-express';
import { Express } from 'express';

// Comprehensive GraphQL schema integrating Express Apollo Server with Prisma
const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String!
    credentials: [Credential!]
    jobs: [Job!]
  }

  type Credential {
    id: ID!
    name: String!
    issuer: String!
    issuedAt: String!
    expiresAt: String
    user: User
  }

  type Job {
    id: ID!
    title: String!
    description: String
    postedBy: User
    applicants: [User!]
  }

  type Query {
    users: [User!]
    user(id: ID!): User
    credentials: [Credential!]!
    credential(id: ID!): Credential
    jobs: [Job!]
    job(id: ID!): Job
  }

  type Mutation {
    _empty: String
  }
`;

const resolvers = {
  Query: {
    credentials: async (_parent: unknown, _args: unknown, ctx: { prisma: PrismaClient }) => {
      return ctx.prisma.credential.findMany();
    },
  },
};

export async function startApolloServer(app: Express, prisma: PrismaClient) {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: () => ({ prisma }),
  });
  await server.start();
  server.applyMiddleware({ app });
}
