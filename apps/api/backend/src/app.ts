import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import type { Express, Request, Response } from 'express';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { emitVerificationAuditEvent } from '../../verification/audit';
import { registerIngestRoutes } from '../../routes/ingest';
import { registerWedgeRoutes } from '../routes/wedge';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth, trustStateRateLimit } from './middleware/publicSafety';
import { requestObservability } from './middleware/requestObservability';
import { invokeAgentModel } from './llm';
import { estimateTokenCount } from './telemetry';
import { withToolSpan } from './tools/tracing';
import { requestLatencyMetrics } from './observability/requestMetrics';
import prisma from './graphql/prisma_client';
import openApiSpec from './openapi';

type VerificationLane = 'PUBLIC' | 'PARTNER' | 'MANUAL';
const VALID_LANES: readonly VerificationLane[] = ['PUBLIC', 'PARTNER', 'MANUAL'] as const;

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function parseLane(value: unknown): VerificationLane {
  const normalized = parseRequiredString(value, 'lane').toUpperCase();
  if (!VALID_LANES.includes(normalized as VerificationLane)) {
    throw new Error('lane must be one of PUBLIC | PARTNER | MANUAL');
  }
  return normalized as VerificationLane;
}

function registerHealthRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      metrics: requestLatencyMetrics.snapshot(),
    });
  });

  app.get('/readyz', (_req, res) => {
    prisma
      .$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({
          status: 'ready',
          service: 'api',
        });
      })
      .catch(() => {
        res.status(503).json({
          status: 'not_ready',
          service: 'api',
        });
      });
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'VitalCV API',
      version: 'mvp',
    });
  });
}

function registerVerificationRoutes(app: Express): void {
  app.post('/verification/request', apiKeyAuth, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const correlationId =
      typeof res.locals.request_id === 'string' && res.locals.request_id.trim().length > 0
        ? res.locals.request_id.trim()
        : crypto.randomUUID();

    const reference_id = crypto.randomUUID();
    let clinician_id = 'clinician:unknown';
    const model = process.env.VITALCV_AGENT_MODEL || 'vitalcv-trust-observer-v1';
    const agentName = process.env.VITALCV_AGENT_NAME || 'trust-observer';
    const traceparent =
      typeof req.get('traceparent') === 'string' ? req.get('traceparent') ?? undefined : undefined;

    try {
      const responsePayload = await invokeAgentModel(
        {
          agentName,
          model,
          input: body,
          traceparent,
        },
        async () => {
          clinician_id = parseRequiredString(body.clinician_id, 'clinician_id');
          const lane = parseLane(body.lane);
          const subject = parseRequiredString(body.subject, 'subject');

          const response = {
            request_id: reference_id,
            clinician_id,
            lane,
            subject,
            status: 'PENDING' as const,
          };

          await withToolSpan(
            {
              toolName: 'emit_verification_audit',
              input: {
                type: 'VERIFICATION_REQUESTED',
                clinician_id,
                lane,
                subject,
                correlation_id: correlationId,
              },
            },
            async () =>
              emitVerificationAuditEvent({
                type: 'VERIFICATION_REQUESTED',
                clinician_id,
                reference_id,
                metadata: {
                  lane,
                  subject,
                  status: 'PENDING',
                  correlation_id: correlationId,
                },
              }),
          );

          return {
            output: response,
            usage: {
              inputTokens: estimateTokenCount(body),
              outputTokens: estimateTokenCount(response),
            },
          };
        },
      );

      return res.status(200).json(responsePayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process verification request';

      try {
        await withToolSpan(
          {
            toolName: 'emit_verification_failed_audit',
            input: {
              clinician_id,
              reason: message,
              correlation_id: correlationId,
            },
            traceparent,
          },
          async () =>
            emitVerificationAuditEvent({
              type: 'VERIFICATION_FAILED',
              clinician_id,
              reference_id,
              metadata: {
                reason: message,
                correlation_id: correlationId,
              },
            }),
        );
      } catch (auditError) {
        console.error('verification audit emission error:', auditError);
      }

      return res.status(400).json({ error: message });
    }
  });
}

function registerTrustStateRoutes(app: Express): void {
  // Trust-state is read-only and rate-limited (no API key required)
  app.get('/trust-state/:clinician_id', trustStateRateLimit, (req: Request, res: Response, next) => {
    const clinician_id =
      typeof req.params.clinician_id === 'string' ? req.params.clinician_id.trim() : '';
    if (!clinician_id) {
      return res.status(400).json({ error: 'clinician_id is required' });
    }

    const queryIndex = req.url.indexOf('?');
    const rawQuery = queryIndex >= 0 ? req.url.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(rawQuery);
    params.set('clinician_id', clinician_id);
    (req as Request & { query: Record<string, unknown> }).query = {
      ...(req.query as Record<string, unknown>),
      clinician_id,
    };
    req.url = `/trust-state?${params.toString()}`;
    return next();
  });
}

// ─── Express Application ────────────────────────────────────

const app = express();

// Security headers
app.use(helmet());

// CORS
const corsOrigin = process.env.CORS_ORIGIN?.trim() || '*';
if (process.env.NODE_ENV === 'production' && corsOrigin === '*') {
  throw new Error('CORS_ORIGIN must not be "*" in production');
}
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
    credentials: corsOrigin !== '*',
  }),
);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Observability
app.use(requestObservability);

// Routes
registerHealthRoutes(app);
registerIngestRoutes(app);
registerVerificationRoutes(app);
registerTrustStateRoutes(app);
registerWedgeRoutes(app);

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

// Error handler (must be last)
app.use(errorHandler);

export default app;
