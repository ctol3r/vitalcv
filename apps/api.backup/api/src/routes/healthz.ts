/**
 * Composite Health Check Endpoint
 * B133C-HEALTH-005
 *
 * Checks health of all critical system components:
 * - Database (PostgreSQL)
 * - Queue (Redis/BullMQ)
 * - Blockchain/Chain
 * - TEFCA services
 * - FHIR gateway
 * - ATS integrations
 *
 * Returns overall status: OK, DEGRADED, or FAIL
 * Used by uptime monitors and K8s probes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { getReadonlyModeHealthStatus } from '../config/readonlyMode';

const router = Router();
const prisma = new PrismaClient();

export type HealthStatus = 'OK' | 'DEGRADED' | 'FAIL';

export interface ComponentHealth {
  status: HealthStatus;
  latency?: number; // milliseconds
  message?: string;
  lastChecked: string;
}

export interface HealthCheckResponse {
  overall: HealthStatus;
  timestamp: string;
  version: string;
  components: {
    database: ComponentHealth;
    queue: ComponentHealth;
    chain: ComponentHealth;
    tefca: ComponentHealth;
    fhir: ComponentHealth;
    ats: ComponentHealth;
  };
  readonlyMode?: boolean;
  readonlyMessage?: string;
}

/**
 * Check database health
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - start;
    return {
      status: latency < 1000 ? 'OK' : 'DEGRADED',
      latency,
      message: latency < 1000 ? 'Database responsive' : 'Database slow',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'FAIL',
      latency: Date.now() - start,
      message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check queue/Redis health
 */
async function checkQueue(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url: redisUrl });

    await client.connect();
    await client.ping();
    await client.disconnect();

    const latency = Date.now() - start;
    return {
      status: latency < 500 ? 'OK' : 'DEGRADED',
      latency,
      message: 'Queue responsive',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'FAIL',
      latency: Date.now() - start,
      message: `Queue error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check blockchain/chain health
 */
async function checkChain(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const chainRpcUrl = process.env.CHAIN_RPC_URL || process.env.SUBSTRATE_RPC_URL;

    if (!chainRpcUrl) {
      return {
        status: 'DEGRADED',
        message: 'Chain RPC URL not configured',
        lastChecked: new Date().toISOString(),
      };
    }

    // Simple HTTP check to chain RPC
    const response = await fetch(chainRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'chain_getBlockHash',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latency = Date.now() - start;

    if (response.ok) {
      return {
        status: latency < 2000 ? 'OK' : 'DEGRADED',
        latency,
        message: 'Chain responsive',
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: 'FAIL',
        latency,
        message: `Chain returned ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: 'FAIL',
      latency: Date.now() - start,
      message: `Chain error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check TEFCA services health
 */
async function checkTEFCA(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const tefcaEndpoint = process.env.TEFCA_ENDPOINT;

    if (!tefcaEndpoint) {
      return {
        status: 'DEGRADED',
        message: 'TEFCA endpoint not configured',
        lastChecked: new Date().toISOString(),
      };
    }

    // Ping TEFCA health endpoint
    const response = await fetch(`${tefcaEndpoint}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (response.ok) {
      return {
        status: latency < 2000 ? 'OK' : 'DEGRADED',
        latency,
        message: 'TEFCA responsive',
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: 'DEGRADED',
        latency,
        message: `TEFCA returned ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: 'DEGRADED', // TEFCA is optional, so degraded not fail
      latency: Date.now() - start,
      message: `TEFCA error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check FHIR gateway health
 */
async function checkFHIR(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const fhirEndpoint = process.env.FHIR_ENDPOINT;

    if (!fhirEndpoint) {
      return {
        status: 'DEGRADED',
        message: 'FHIR endpoint not configured',
        lastChecked: new Date().toISOString(),
      };
    }

    // Check FHIR metadata endpoint
    const response = await fetch(`${fhirEndpoint}/metadata`, {
      method: 'GET',
      headers: { 'Accept': 'application/fhir+json' },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (response.ok) {
      return {
        status: latency < 2000 ? 'OK' : 'DEGRADED',
        latency,
        message: 'FHIR responsive',
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: 'DEGRADED',
        latency,
        message: `FHIR returned ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: 'DEGRADED', // FHIR is optional
      latency: Date.now() - start,
      message: `FHIR error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check ATS integrations health
 */
async function checkATS(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Check if ATS webhook configuration exists and is reachable
    const activePartners = await prisma.partnerConfig.count({
      where: {
        isActive: true,
        atsWebhookUrl: { not: null },
      },
    });

    const latency = Date.now() - start;

    return {
      status: 'OK',
      latency,
      message: `${activePartners} active ATS partners configured`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'DEGRADED',
      latency: Date.now() - start,
      message: `ATS check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Determine overall health from component statuses
 */
function determineOverallHealth(components: HealthCheckResponse['components']): HealthStatus {
  const statuses = Object.values(components).map(c => c.status);

  // If any critical component (DB, Queue) is FAIL, overall is FAIL
  if (components.database.status === 'FAIL' || components.queue.status === 'FAIL') {
    return 'FAIL';
  }

  // If any component is FAIL, overall is FAIL
  if (statuses.includes('FAIL')) {
    return 'FAIL';
  }

  // If any component is DEGRADED, overall is DEGRADED
  if (statuses.includes('DEGRADED')) {
    return 'DEGRADED';
  }

  // All components OK
  return 'OK';
}

/**
 * GET /healthz
 *
 * Comprehensive health check of all system components
 *
 * Returns:
 * - 200: System healthy or degraded
 * - 503: System failing
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Run all health checks in parallel
    const [database, queue, chain, tefca, fhir, ats] = await Promise.all([
      checkDatabase(),
      checkQueue(),
      checkChain(),
      checkTEFCA(),
      checkFHIR(),
      checkATS(),
    ]);

    const components = {
      database,
      queue,
      chain,
      tefca,
      fhir,
      ats,
    };

    const overall = determineOverallHealth(components);

    const readonlyStatus = getReadonlyModeHealthStatus();

    const response: HealthCheckResponse = {
      overall,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      components,
      ...(readonlyStatus.readonlyMode && {
        readonlyMode: true,
        readonlyMessage: readonlyStatus.message,
      }),
    };

    // Return 503 for FAIL, 200 for OK or DEGRADED
    const statusCode = overall === 'FAIL' ? 503 : 200;

    return res.status(statusCode).json(response);
  } catch (error) {
    console.error('[HealthCheck] Error:', error);

    return res.status(503).json({
      overall: 'FAIL',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      error: error instanceof Error ? error.message : 'Unknown error',
      components: {
        database: { status: 'FAIL', message: 'Health check failed', lastChecked: new Date().toISOString() },
        queue: { status: 'FAIL', message: 'Health check failed', lastChecked: new Date().toISOString() },
        chain: { status: 'FAIL', message: 'Health check failed', lastChecked: new Date().toISOString() },
        tefca: { status: 'FAIL', message: 'Health check failed', lastChecked: new Date().toISOString() },
        fhir: { status: 'FAIL', message: 'Health check failed', lastChecked: new Date().toISOString() },
        ats: { status: 'FAIL', message: 'Health check failed', lastChecked: new Date().toISOString() },
      },
    } as HealthCheckResponse);
  }
});

/**
 * GET /healthz/liveness
 *
 * Simple liveness probe for K8s
 * Just checks if the process is running
 */
router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /healthz/readiness
 *
 * Readiness probe for K8s
 * Checks if the service is ready to accept traffic (DB + Queue must be healthy)
 */
const readinessHandler = async (req: Request, res: Response) => {
  try {
    const [database, queue] = await Promise.all([
      checkDatabase(),
      checkQueue(),
    ]);

    const isReady = database.status !== 'FAIL' && queue.status !== 'FAIL';

    if (isReady) {
      return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        components: { database, queue },
      });
    } else {
      return res.status(503).json({
        status: 'NOT_READY',
        timestamp: new Date().toISOString(),
        components: { database, queue },
      });
    }
  } catch (error) {
    return res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

router.get('/readiness', readinessHandler);

export const readyzRouter = Router();
readyzRouter.get('/', readinessHandler);

export default router;

