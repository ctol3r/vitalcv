import './tracing';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';
import { startApolloServer } from './graphql/graphql_api_scaffold';
import { npiRouter } from './routes/npi.new';
import { metricsRouter } from './metrics/prom';
import { linkedInAuth } from './routes/auth.linkedin';
import { pubmedRouter } from './routes/pubmed';
import { metricsSummaryRouter } from './routes/metrics-summary';
import { audit } from './routes/audit';
import { fhir } from './routes/fhir';
import settingsRouter from './routes/settings';
import { evidenceRegistryRouter } from './routes/evidence-registry';
import { privilegingRouter } from './routes/privileging';
import { createAllowedSinksEnforcer } from '@vitalcv/messaging-guard';
import demoExecSummaryRouter from './routes/demo/exec/summary';
import inviteAdminRouter from './routes/demo/org/inviteAdmin';
import acceptPolicyRouter from './routes/demo/org/acceptPolicy';
import getPolicyRouter from './routes/demo/policy/getPolicy';

const app = express();
const prisma = new PrismaClient();

// B124C-ALLOW-033: Enforce allowed_sinks on all inbound routes
const allowedSinksEnforcer = createAllowedSinksEnforcer({
  allowedSinks: process.env.BACKEND_ALLOWED_SINKS?.split(',').filter(Boolean) || [
    'svc.backend',
    'svc.router',
  ],
  requireSignature: process.env.MESSAGING_GUARD_REQUIRE_SIGNATURE !== 'false',
  publicKey: process.env.MESSAGING_GUARD_PUBLIC_KEY,
  environment: process.env.NODE_ENV || 'development',
});

// CORS: allow configured origins (supports comma list or "*")
const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || corsOrigins.includes('*')) return cb(null, true);
      const ok = corsOrigins.some((allowed) => {
        if (allowed === origin) return true;
        // wildcard subdomain match like https://*.bolt.host
        if (allowed.includes('*')) {
          const re = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
          return re.test(origin);
        }
        return false;
      });
      return ok ? cb(null, true) : cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  }),
);

// Parse JSON request bodies
app.use(express.json());

// B124C-ALLOW-033: Apply allowed_sinks guard to all routes except health checks
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }
  return allowedSinksEnforcer(req, res, next);
});

// Health check endpoint for quick diagnostics
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'vitalcv-backend', time: new Date().toISOString() });
});

import { assistantRouter } from './routes/assistant/query';

// Register routes
app.use('/api/assistant', assistantRouter); // Task 49.1: AI Assistant
app.use('/api/npi', npiRouter);
app.use('/metrics', metricsRouter);
app.use('/auth/linkedin', linkedInAuth);
app.use('/api/pubmed', pubmedRouter);
app.use('/api/metrics-summary', metricsSummaryRouter);
app.use('/api/audit', audit);
app.use('/api/fhir', fhir);
app.use('/api/settings', settingsRouter);
app.use('/api/evidence/registry', evidenceRegistryRouter);
app.use('/api/org', privilegingRouter); // B134A: Privileging system routes
app.use('/api/privileges', privilegingRouter); // B134A: Privileging system routes
app.use('/api', demoExecSummaryRouter); // S72-D3-C-002: Demo exec summary
app.use('/api', inviteAdminRouter); // S72-D3-A-003: OrgAdmin invite API
app.use('/api', acceptPolicyRouter); // S72-D3-A-005: OrgPolicyAcceptance API
app.use('/api', getPolicyRouter); // S72-D3-A-004: Get policy endpoint

// B248B-PARTNER-018: Partnership engagement API
import partnershipEngagementRouter from '../../services/partners/api/engagementAPI';
app.use('/api/partners', partnershipEngagementRouter);

import { lifecycleRouter } from './routes/lifecycle/[credentialId]';
app.use('/api/lifecycle', lifecycleRouter);

// DC-001, DC-002: OID4VP routes
import oid4vpRouter from './oid4vp/routes';
app.use('/api/oid4vp', oid4vpRouter);

export default app;

export async function startServer() {
  await startApolloServer(app, prisma);
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`);
  });
}

// If this module is executed directly, start the server
if (require.main === module) {
  startServer();
}
