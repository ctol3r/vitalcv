import express from 'express';
import { PrismaClient } from '@prisma/client';
import { startApolloServer } from './graphql/graphql_api_scaffold';

const app = express();
const prisma = new PrismaClient();

// Parse JSON request bodies
app.use(express.json());

export default app;

export async function startServer() {
  await startApolloServer(app, prisma);
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`);
  });
}

// If this module is executed directly, start the server
if (require.main === module) {
  startServer();
}
