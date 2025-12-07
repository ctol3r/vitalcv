import express from 'express';
import { PrismaClient } from '@prisma/client';
import { startApolloServer } from './graphql/graphql_api_scaffold';
import app from './app';

const prisma = new PrismaClient();

async function main() {
  await startApolloServer(app, prisma);

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
