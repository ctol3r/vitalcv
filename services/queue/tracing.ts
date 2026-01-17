import { startNodeTracing } from '../observability/nodeTracing';
import { createPrismaInstrumentation } from '../../backend/db/prismaInstrumentation';
import { createRedisInstrumentation } from '../../packages/redis-client/tracing.js';

startNodeTracing({
  serviceName: process.env.SERVICE_NAME || 'queue-worker',
  instrumentations: [createPrismaInstrumentation(), createRedisInstrumentation()],
});

