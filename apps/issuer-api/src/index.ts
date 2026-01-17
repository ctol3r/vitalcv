import { createLogger, serializeError } from '@chai-vc/logging-core';
import { InMemoryIdempotencyStore, idempotencyMiddleware } from '@chai-vc/idempotency';
import { InMemoryRateLimiter, perEndpointRateLimitMiddleware } from '@chai-vc/rate-limiter';
import { tracingMiddleware } from '@chai-vc/tracing';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { requestIdMiddleware } from './middleware/requestId';
import oidc4vciRouter from './oidc4vci/routes';
import revokeRouter from './routes/revoke';
import { getCachedJwks, refreshJwks, startJwksUpdater } from './services/jwksUpdater';
import './tracing';

// Swagger UI for OpenAPI documentation (B114B-OPENAPI-028)
let swaggerUi: any = null;
let swaggerDocument: any = null;

const log = createLogger({
  service: process.env.SERVICE_NAME || 'issuer-api',
});

try {
  // Dynamic import to avoid requiring swagger-ui-express as hard dependency
  swaggerUi = require('swagger-ui-express');
  const YAML = require('yamljs');
  const path = require('path');
  swaggerDocument = YAML.load(path.join(__dirname, '../openapi/openapi.yaml'));
} catch (error) {
  log.warn('Swagger UI not available', { error: serializeError(error) });
}

const app: Express = express();

// Per-endpoint rate limiters (B114B-RATE-001)
const rateLimiters = {
  '/oidc4vci/token': new InMemoryRateLimiter({
    maxRequests: 10,
    windowMs: 60_000, // 1 minute
    keyPrefix: 'rl:issuer:token',
  }),
  '/oidc4vci/credential': new InMemoryRateLimiter({
    maxRequests: 20,
    windowMs: 60_000, // 1 minute
    keyPrefix: 'rl:issuer:credential',
  }),
  '/revoke': new InMemoryRateLimiter({
    maxRequests: 5,
    windowMs: 60_000, // 1 minute
    keyPrefix: 'rl:issuer:revoke',
  }),
};

// CRITICAL MIDDLEWARE ORDER (B114B-TRACE-001):
// 1. Tracing middleware FIRST - generates/extracts trace context
app.use(tracingMiddleware());

// 2. Request ID middleware
app.use(requestIdMiddleware());

// 3. CORS
app.use(cors());

// 4. Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Rate limiting (per-endpoint)
app.use(perEndpointRateLimitMiddleware(rateLimiters));

// 6. Idempotency (24-hour window)
const idempotencyStore = new InMemoryIdempotencyStore();
app.use(idempotencyMiddleware({ store: idempotencyStore, ttlSeconds: 86400 }));

// 7. Security enforcement (B93-SEC-001)
// Apply middleware to all routes except health checks
app.use((req, res, next) => {
  // Skip health checks
  if (req.path === '/health') {
    return next();
  }
  return allowedSinksEnforcer(req, res, next);
});

// OIDC4VCI routes (guard middleware applied within routes)
app.use('/oidc4vci', oidc4vciRouter);

// Revocation endpoint
app.use('/revoke', revokeRouter);

// OpenAPI/Swagger UI documentation (B114B-OPENAPI-028)
if (swaggerUi && swaggerDocument) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'VitalCV Issuer API Documentation',
    }),
  );
  log.info('Swagger UI available', { path: '/api-docs', port: process.env.PORT || 4001 });
}

// JWKS endpoint for verifiers
app.get('/.well-known/jwks.json', async (req: Request, res: Response) => {
  try {
    const refreshParam = req.query?.refresh;
    const refreshRequested =
      typeof refreshParam === 'string' ? ['1', 'true'].includes(refreshParam.toLowerCase()) : false;

    if (refreshRequested) {
      await refreshJwks({ force: true });
    } else if (!getCachedJwks().keys.length) {
      await refreshJwks();
    }

    return res.json(getCachedJwks());
  } catch (error) {
    log.error('Failed to serve JWKS', { error: serializeError(error) });
    return res.status(503).json({
      error: 'jwks_unavailable',
      message: error instanceof Error ? error.message : 'Unable to serve JWKS',
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'issuer-api' });
});

startJwksUpdater().catch((error: unknown) => {
  log.error('Failed to start JWKS updater', { error: serializeError(error) });
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  log.info('Issuer API listening', { port: PORT });
});

export default app;
