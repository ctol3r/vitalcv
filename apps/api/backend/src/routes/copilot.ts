import type { Express, NextFunction, Request, Response } from 'express';
import { invokeAgentModel } from '../llm';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { log } from '../obs/logger';
import { recordCopilotResponseSample } from '../qa/performanceWatchers';
import {
  copilotQueryRequestSchema,
  copilotQueryResponseSchema,
} from '../services/copilot/contracts';
import {
  buildCopilotDocumentFromQueryResponse,
  buildLimitedCopilotResponse,
} from '../services/copilot/documentBuilder';
import { COPILOT_WARMING_MESSAGE } from '../services/copilot/contextualResponse';
import {
  hasRequestedCopilotAnchor,
  loadCopilotContext,
  resolveCopilotContextAnchor,
  shouldWarmCopilot,
} from '../services/copilot/copilotContextService';
import { executeCopilotQuery } from '../services/copilot/copilotQueryService';
import { buildCopilotInvestigationPayload } from '../services/investigation/copilotInvestigationService';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import { HttpError } from '../utils/httpError';
import { validateCopilotStructuredResponse } from '../../../../../core/qa/copilotResponseValidator';
import { prepareCopilotQuery } from '../../../../../core/copilot/copilotEngine';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function isRecoverableCopilotError(error: unknown): boolean {
  return !(error instanceof HttpError && error.status >= 400 && error.status < 500);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
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
      return;
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
      try {
        const preparedQuery = prepareCopilotQuery({
          query: parsedBody.data.query,
          limit: parsedBody.data.limit,
        });
        const anchor = resolveCopilotContextAnchor({
          query: parsedBody.data.query,
          providerId: parsedBody.data.providerId ?? null,
          findingId: parsedBody.data.findingId ?? null,
          storylineId: parsedBody.data.storylineId ?? null,
          context: parsedBody.data.context,
        });
        const resolvedContextScope = parsedBody.data.context?.scope
          ?? (anchor.findingId ? 'finding' : anchor.storylineId ? 'storyline' : anchor.providerId ? 'provider' : 'global');
        const copilotContext = hasRequestedCopilotAnchor(anchor)
          ? await loadCopilotContext(anchor)
          : null;

        if (copilotContext && shouldWarmCopilot(anchor, copilotContext)) {
          const warmResponse = buildLimitedCopilotResponse({
            title: 'System warming',
            message: COPILOT_WARMING_MESSAGE,
            suggestions: [
              'Retry after the provider investigation finishes loading',
              'Open the linked finding or storyline directly',
              'Refresh the current investigation context',
            ],
            context: parsedBody.data.context,
            command: parsedBody.data.command,
          });

          recordCopilotResponseSample({
            latencyMs: Date.now() - startedAt,
            resultCount: 0,
          });

          res.json(copilotQueryResponseSchema.parse(warmResponse));
          return;
        }

        const response = await invokeAgentModel(
          {
            agentName: 'vitalcv-copilot',
            model: 'copilot-deterministic-v1',
            provider: 'vitalcv',
            traceparent: req.header('traceparent') ?? undefined,
            input: {
              queryHash: requestContext.queryHash,
              limit: parsedBody.data.limit,
              aclLevel: requestContext.aclLevel,
              sessionId: parsedBody.data.sessionId ?? null,
              contextScope: resolvedContextScope,
              command: parsedBody.data.command?.name ?? null,
              parsedQuery: {
                intent: preparedQuery.parsedQuery.intent,
                keywordCount: preparedQuery.parsedQuery.keywords.length,
                graphTraversal: preparedQuery.parsedQuery.graphTraversal,
                structuredFilters: preparedQuery.parsedQuery.structuredFilters,
              },
              anchor,
              contextSummary: {
                hasProvider: Boolean(copilotContext?.provider),
                recentFindingCount: copilotContext?.recentFindings.length ?? 0,
                activeStorylineCount: copilotContext?.activeStorylines.length ?? 0,
                hasNetworkSummary: Boolean(copilotContext?.networkSummary),
                riskSignalCount: copilotContext?.riskSignals.length ?? 0,
              },
            },
            attributes: {
              'vitalcv.copilot.intent': 'query',
              'vitalcv.copilot.context_scope': resolvedContextScope,
              'vitalcv.copilot.command': parsedBody.data.command?.name ?? 'none',
            },
          },
          async () => ({
            output: await executeCopilotQuery({
              query: parsedBody.data.query,
              limit: parsedBody.data.limit,
              requestContext,
              preparedQuery,
              anchor,
              context: copilotContext ?? undefined,
            }),
          }),
        );

        const normalizedResponse = {
          ...response,
          answer: response.answer?.trim()
            || response.explanations[0]?.summary
            || response.results[0]?.summary
            || response.graphInsights[0]?.summary
            || 'Copilot could not synthesize a plain-language answer from the current response.',
          sources: uniqueStrings([
            ...(response.sources ?? []),
            ...response.results.flatMap((result) => result.sourceCoverage),
            ...response.explanations.flatMap((explanation) => explanation.verifiedSources),
          ]),
          confidence: clampConfidence(
            response.confidence
              ?? response.results[0]?.scores.total
              ?? response.explanations[0]?.scoring.total
              ?? 0,
          ),
        };

        const decoratedResponse = {
          status: 'ok' as const,
          ...normalizedResponse,
          document: buildCopilotDocumentFromQueryResponse(normalizedResponse, {
            query: parsedBody.data.query,
            context: parsedBody.data.context,
            command: parsedBody.data.command,
          }),
        };

        const validation = validateCopilotStructuredResponse(decoratedResponse, {
          safeParse: (input) => copilotQueryResponseSchema.safeParse(input),
        });
        if (!validation.valid) {
          log('error', 'copilot_structured_output_invalid', {
            event: 'copilot_structured_output_invalid',
            findings: validation.findings,
          });

          const limitedResponse = buildLimitedCopilotResponse({
            title: 'Copilot source unavailable',
            message: 'Copilot could not safely synthesize a structured response from the current live sources.',
            suggestions: [
              'Retry after live sources recover',
              'Inspect the current provider or finding directly',
              'Open the investigation workbench',
            ],
            context: parsedBody.data.context,
            command: parsedBody.data.command,
          });

          recordCopilotResponseSample({
            latencyMs: Date.now() - startedAt,
            resultCount: 0,
          });

          res.json(copilotQueryResponseSchema.parse(limitedResponse));
          return;
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

        res.json(copilotQueryResponseSchema.parse(validation.data ?? decoratedResponse));
        return;
      } catch (error) {
        if (!isRecoverableCopilotError(error)) {
          throw error;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        log('warn', 'copilot_query_limited_fallback', {
          event: 'copilot_query_limited_fallback',
          queryHash: requestContext.queryHash,
          contextScope: parsedBody.data.context?.scope ?? 'global',
          command: parsedBody.data.command?.name ?? 'none',
          reason: message,
        });

        const limitedResponse = buildLimitedCopilotResponse({
          title: 'Copilot source unavailable',
          message: 'Copilot could not safely complete this request because one or more live investigation sources were unavailable.',
          suggestions: [
            'Retry once source health recovers',
            'Open the investigation workbench',
            'Narrow the request to the active provider or finding',
          ],
          context: parsedBody.data.context,
          command: parsedBody.data.command,
        });

        recordCopilotResponseSample({
          latencyMs: Date.now() - startedAt,
          resultCount: 0,
        });

        res.json(copilotQueryResponseSchema.parse(limitedResponse));
        return;
      }
    }),
  );
}
