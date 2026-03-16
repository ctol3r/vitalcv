import type { Express, NextFunction, Request, Response } from 'express';
import { invokeAgentModel } from '../llm';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { log } from '../obs/logger';
import { recordCopilotResponseSample } from '../qa/performanceWatchers';
import {
  copilotQueryRequestSchema,
  copilotQueryResponseSchema,
} from '../services/copilot/contracts';
import { executeCopilotQuery } from '../services/copilot/copilotQueryService';
import { buildCopilotInvestigationPayload } from '../services/investigation/copilotInvestigationService';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import { HttpError } from '../utils/httpError';
import { validateCopilotStructuredResponse } from '../../../../../core/qa/copilotResponseValidator';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerCopilotRoutes(app: Express): void {
  app.post(
    '/api/copilot/investigation',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const providerId = typeof req.body?.providerId === 'string' ? req.body.providerId : null;
      const storylineId = typeof req.body?.storylineId === 'string' ? req.body.storylineId : null;
      const objective = typeof req.body?.objective === 'string' ? req.body.objective : null;

      if (!providerId && !storylineId) {
        throw new HttpError(400, 'providerId or storylineId is required.');
      }

      const response = await buildCopilotInvestigationPayload({
        providerId,
        storylineId,
        objective,
      });

      res.json({
        schema: 'https://vitalcv.com/copilot/investigation/v1',
        ...response,
      });
    }),
  );

  app.post(
    '/api/copilot/query',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const startedAt = Date.now();
      const parsedBody = copilotQueryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new HttpError(400, parsedBody.error.issues[0]?.message ?? 'Invalid copilot query payload.');
      }

      const requestContext = await resolveSearchRequestContext(req, parsedBody.data.query);
      const response = await invokeAgentModel(
        {
          agentName: 'vitalcv-copilot',
          model: 'copilot-deterministic-v1',
          provider: 'vitalcv',
          traceparent: req.header('traceparent') ?? undefined,
          input: {
            query: parsedBody.data.query,
            limit: parsedBody.data.limit,
            aclLevel: requestContext.aclLevel,
          },
          attributes: {
            'vitalcv.copilot.intent': 'query',
          },
        },
        async () => ({
          output: await executeCopilotQuery({
            query: parsedBody.data.query,
            limit: parsedBody.data.limit,
            requestContext,
          }),
        }),
      );

      const validation = validateCopilotStructuredResponse(response, {
        safeParse: (input) => copilotQueryResponseSchema.safeParse(input),
      });
      if (!validation.valid) {
        log('error', 'copilot_structured_output_invalid', {
          event: 'copilot_structured_output_invalid',
          findings: validation.findings,
        });
        throw new HttpError(502, 'Copilot response failed structured output validation.');
      }

      if (validation.findings.length > 0) {
        log('warn', 'copilot_structured_output_warnings', {
          event: 'copilot_structured_output_warnings',
          findings: validation.findings,
        });
      }

      recordCopilotResponseSample({
        latencyMs: Date.now() - startedAt,
        resultCount: validation.data?.results.length ?? 0,
      });

      res.json(copilotQueryResponseSchema.parse(validation.data ?? response));
    }),
  );
}
