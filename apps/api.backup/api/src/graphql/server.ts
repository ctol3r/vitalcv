import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import { readFileSync } from 'fs';
import { resolvers } from './resolvers';
import prisma from './prisma_client';
import path from 'path';

export interface Context {
  prisma: typeof prisma;
}

export async function createGraphQLServer(httpServer: http.Server) {
  const typeDefs = readFileSync(path.resolve(__dirname, './schema.graphql'), { encoding: 'utf-8' });

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  return expressMiddleware(server, {
    context: async ({ req }) => ({ prisma }),
  });
}














