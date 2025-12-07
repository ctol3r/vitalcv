import './tracing';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { authRouter } from './auth/routes';
import { policyRouter } from './auth/policy-routes';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { requestIdMiddleware } from './middleware/requestId';
import { createLogger } from '@chai-vc/logging-core';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'admin-api',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// B117C-ALLOW-033: Enforce allowed_sinks guard on all routes
// Apply middleware to all routes except health checks
app.use((req, res, next) => {
  // Skip health checks
  if (req.path === '/health') {
    return next();
  }
  return allowedSinksEnforcer(req, res, next);
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'admin-api' });
});

// Auth routes (WebAuthn enrollment, authentication)
app.use('/api/auth', authRouter);

// Policy routes (AAL policy management)
app.use('/api/auth/policy', policyRouter);

const PORT = process.env.PORT || 4003;

app.listen(PORT, () => {
  log.info('Admin API listening', { port: PORT });
});

export default app;

