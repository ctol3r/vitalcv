import { startNodeTracing } from '../../../services/observability/nodeTracing';
import { createPrismaInstrumentation } from '../../../backend/db/prismaInstrumentation';
import { createRedisInstrumentation } from '../../../packages/redis-client/tracing';

startNodeTracing({
  serviceName: process.env.SERVICE_NAME || 'verifier-api',
  instrumentations: [createPrismaInstrumentation(), createRedisInstrumentation()],
});

