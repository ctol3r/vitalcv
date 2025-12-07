import { startNodeTracing } from '../../../../services/observability/nodeTracing';
import { createPrismaInstrumentation } from '../../../../backend/db/prismaInstrumentation';
import { createRedisInstrumentation } from '../../../../packages/redis-client/tracing';

const sdk = startNodeTracing({
  serviceName: process.env.SERVICE_NAME || 'evidence-registry-api',
  instrumentations: [createPrismaInstrumentation(), createRedisInstrumentation()],
});

export default sdk;

