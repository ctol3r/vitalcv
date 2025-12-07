import { gql } from 'apollo-server';
import * as credentialController from '../controllers/credential_controller';

export const typeDefs = gql`
  type Credential {
    id: ID!
    data: String
    status: String!
  }

  type Mutation {
    requestCredential(data: String!): Credential!
    verifyCredential(id: ID!): Credential!
    revokeCredential(id: ID!): Credential!
  }

  type Query {
    _empty: String
  }
`;

export const resolvers = {
  Mutation: {
    requestCredential: (_: any, { data }: { data: string }) => {
      return credentialController.requestCredential(data);
    },
    verifyCredential: (_: any, { id }: { id: string }) => {
      return credentialController.verifyCredential(id);
    },
    revokeCredential: (_: any, { id }: { id: string }) => {
      return credentialController.revokeCredential(id);
    }
  }
};
