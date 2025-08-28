import { ApolloServer, gql } from 'apollo-server'
import { resolvers } from './resolvers'

// GraphQL schema definition for Credential
const typeDefs = gql`
  type Credential {
    id: ID!
    name: String!
    issuer: String!
    issuedAt: String!
  }

  type Query {
    credential(id: ID!): Credential
    credentials: [Credential!]!
  }

  type Mutation {
    createCredential(name: String!, issuer: String!): Credential!
    updateCredential(id: ID!, name: String, issuer: String): Credential!
    deleteCredential(id: ID!): Credential!
  }
`

async function startServer() {
  const server = new ApolloServer({ typeDefs, resolvers })
  const { url } = await server.listen({ port: 4000 })
  console.log(`GraphQL API ready at ${url}`)
}

startServer().catch((err) => {
  console.error('Failed to start GraphQL server', err)
})
