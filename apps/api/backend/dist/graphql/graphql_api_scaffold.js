"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startApolloServer = startApolloServer;
const apollo_server_express_1 = require("apollo-server-express");
// Comprehensive GraphQL schema integrating Express Apollo Server with Prisma
const typeDefs = (0, apollo_server_express_1.gql) `
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
const resolvers = {
    Query: {
        credentials: async (_parent, _args, ctx) => {
            return ctx.prisma.credential.findMany();
        },
    },
};
async function startApolloServer(app, prisma) {
    const server = new apollo_server_express_1.ApolloServer({
        typeDefs,
        resolvers,
        context: () => ({ prisma }),
    });
    await server.start();
    server.applyMiddleware({ app });
}
