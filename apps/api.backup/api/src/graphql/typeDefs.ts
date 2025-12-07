import { gql } from 'apollo-server';

export const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String
    organization: Organization
    credentials: [Credential!]!
    jobs: [Job!]!
  }

  type Credential {
    id: ID!
    type: String!
    value: String!
    user: User!
  }

  type Organization {
    id: ID!
    name: String!
    users: [User!]!
    jobs: [Job!]!
  }

  type Job {
    id: ID!
    title: String!
    description: String
    organization: Organization!
    user: User
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
    credentials: [Credential!]!
    credential(id: ID!): Credential
    organizations: [Organization!]!
    organization(id: ID!): Organization
    jobs: [Job!]!
    job(id: ID!): Job
  }

  type Mutation {
    createUser(email: String!, name: String, organizationId: Int): User!
    updateUser(id: ID!, email: String, name: String, organizationId: Int): User
    deleteUser(id: ID!): User

    createCredential(userId: Int!, type: String!, value: String!): Credential!
    updateCredential(id: ID!, type: String, value: String): Credential
    deleteCredential(id: ID!): Credential

    createOrganization(name: String!): Organization!
    updateOrganization(id: ID!, name: String): Organization
    deleteOrganization(id: ID!): Organization

    createJob(title: String!, description: String, organizationId: Int!, userId: Int): Job!
    updateJob(id: ID!, title: String, description: String, organizationId: Int, userId: Int): Job
    deleteJob(id: ID!): Job
  }
`;
