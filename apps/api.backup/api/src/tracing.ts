import { startNodeTracing } from '../../services/observability/nodeTracing';
import { createPrismaInstrumentation } from '../db/prismaInstrumentation';
import { createRedisInstrumentation } from '../../packages/redis-client/tracing';

startNodeTracing({
  serviceName: process.env.SERVICE_NAME || 'vitalcv-backend',
  instrumentations: [createPrismaInstrumentation(), createRedisInstrumentation()],
});

