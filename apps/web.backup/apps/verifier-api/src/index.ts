import './tracing';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createLogger } from '@chai-vc/logging-core';
import oidc4vpRouter from './oidc4vp/routes';
import eudiRouter from './eu/routes';
import verifyCredentialRouter from './routes/verifyCredential';
import verifyCsdRouter from './routes/presentation/verifyCsd';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { requestIdMiddleware } from './middleware/requestId';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'verifier-api',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// B93-SEC-001: Enforce allowed_sinks on all inbound routes (repo-wide)
// Apply middleware to all routes except health checks
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  return allowedSinksEnforcer(req, res, next);
});

// OIDC4VP routes
app.use('/oidc4vp', oidc4vpRouter);

// EUDI routes
app.use('/eu', eudiRouter);

// Credential verification routes (S72-D1-A-008)
app.use('/verify/credential', verifyCredentialRouter);

// Selective disclosure verification (CSD)
app.use('/presentation/csd', verifyCsdRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'verifier-api' });
});

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  log.info('Verifier API listening', { port: PORT });
});

export default app;

import './tracing';
import express, { Request, Response } from 'express';
import cors from 'cors';
import oidc4vpRouter from './oidc4vp/routes';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { requestIdMiddleware } from './middleware/requestId';
import { createLogger } from '@chai-vc/logging-core';
import verifyCsdRouter from './routes/presentation/verifyCsd';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'verifier-api',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// B93-SEC-001: Enforce allowed_sinks on all inbound routes (repo-wide)
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

import passportVerifyRouter from './routes/passportV3/verify';
app.use('/passportV3', passportVerifyRouter);

// Selective disclosure verification (CSD)
app.use('/presentation/csd', verifyCsdRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'verifier-api' });
});

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  log.info('Verifier API listening', { port: PORT });
});

export default app;


