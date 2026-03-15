import type { Express, NextFunction, Request, Response } from 'express';
import { invokeAgentModel } from '../llm';
import { publicApiRateLimit } from '../middleware/publicSafety';
import {
  copilotQueryRequestSchema,
  copilotQueryResponseSchema,
} from '../services/copilot/contracts';
import { executeCopilotQuery } from '../services/copilot/copilotQueryService';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import { HttpError } from '../utils/httpError';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerCopilotRoutes(app: Express): void {
  app.post(
    '/api/copilot/query',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
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

      res.json(copilotQueryResponseSchema.parse(response));
    }),
  );
}
