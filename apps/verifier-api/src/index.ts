import { createLogger } from '@chai-vc/logging-core';
import { InMemoryIdempotencyStore, idempotencyMiddleware } from '@chai-vc/idempotency';
import { InMemoryRateLimiter, perEndpointRateLimitMiddleware } from '@chai-vc/rate-limiter';
import { tracingMiddleware } from '@chai-vc/tracing';
import cors from 'cors';
import express, { type Express, Request, Response } from 'express';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { requestIdMiddleware } from './middleware/requestId';
import oidc4vpRouter from './oidc4vp/routes';
import './tracing';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'verifier-api',
});

const app: Express = express();

// Per-endpoint rate limiters (B114B-RATE-001)
const rateLimiters = {
  '/verify/credential': new InMemoryRateLimiter({
    maxRequests: 50,
    windowMs: 60_000, // 1 minute
    keyPrefix: 'rl:verifier:credential',
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

// OIDC4VP routes
app.use('/oidc4vp', oidc4vpRouter);

// EUDI routes
import eudiRouter from './eu/routes';
app.use('/eu', eudiRouter);

// Credential verification routes (S72-D1-A-008)
import verifyCredentialRouter from './routes/verifyCredential';
app.use('/verify/credential', verifyCredentialRouter);

// CRS routes
import crsRouter from './routes/crs';
app.use('/crs', crsRouter);

// Dashboard routes
import dashboardRouter from './routes/dashboard';
app.use('/dashboard', dashboardRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'verifier-api' });
});

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  log.info('Verifier API listening', { port: PORT });
});

export default app;
