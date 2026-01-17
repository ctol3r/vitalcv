import { startNodeTracing } from '../../../services/observability/nodeTracing';
import { createPrismaInstrumentation } from '../../../backend/db/prismaInstrumentation';
import { createRedisInstrumentation } from '../../../packages/redis-client/tracing.js';

startNodeTracing({
  serviceName: process.env.SERVICE_NAME || 'router-api',
  instrumentations: [createPrismaInstrumentation(), createRedisInstrumentation()],
});

