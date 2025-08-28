import { ApolloServer } from 'apollo-server';
import { typeDefs, resolvers } from './graphql/schema';

export async function startServer() {
  const server = new ApolloServer({ typeDefs, resolvers });
  const { url } = await server.listen({ port: 4000 });
  console.log(`Server ready at ${url}`);
}

if (require.main === module) {
  startServer();
}
