import { ApolloServer, gql } from 'apollo-server';
import { PrismaClient } from '@prisma/client';
import { resolvers } from './resolvers';

const prisma = new PrismaClient();

// Comprehensive GraphQL schema for chai-vc-platform API
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
    createUser(name: String!, email: String!): User
    createCredential(name: String!, issuer: String!): Credential!
    updateCredential(id: ID!, name: String, issuer: String): Credential!
    deleteCredential(id: ID!): Credential!
    issueCredential(
      userId: ID!
      name: String!
      issuer: String!
      issuedAt: String
      expiresAt: String
    ): Credential
    postJob(title: String!, description: String, postedBy: ID!): Job
    applyForJob(jobId: ID!, userId: ID!): Job
  }
`;

async function startServer() {
  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    context: () => ({ prisma }),
  });
  const { url } = await server.listen({ port: 4000 });
  console.log(`GraphQL API ready at ${url}`);
}

startServer().catch((err) => {
  console.error('Failed to start GraphQL server', err);
});
