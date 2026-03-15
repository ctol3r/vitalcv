/**
 * copilot.ts — VitalCV Copilot API
 *
 * Routes:
 *   POST /api/copilot/ask         — Natural language query (main entry point)
 *   GET  /api/copilot/session/:id — Session conversation history
 *   DELETE /api/copilot/session/:id — Clear session
 *   POST /api/copilot/classify    — Classify intent without executing (debug)
 */

import type { Express, Request, Response } from 'express';
import { askCopilot, clearCopilotSession, getCopilotSessionHistory } from '../services/copilot/copilotEngine';
import { classifyIntent } from '../services/copilot/queryRouter';
import { log } from '../obs/logger';

export function registerCopilotRoutes(app: Express): void {

  // ── POST /api/copilot/ask ─────────────────────────────────────────────────
  //
  // Main conversational endpoint. Send a natural language query,
  // get a structured response with answer, data, and suggestions.
  //
  // Body: { query: string, sessionId?: string }
  //
  app.post('/api/copilot/ask', async (req: Request, res: Response) => {
    const { query, sessionId } = req.body as { query?: string; sessionId?: string };

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Body must include query: string',
        example: { query: 'What is the trust score for NPI 1234567890?' },
      });
    }

    if (query.length > 1000) {
      return res.status(400).json({ error: 'Query too long (max 1000 characters)' });
    }

    try {
      const response = await askCopilot(query.trim(), sessionId ?? 'default');
      res.json({
        schema:     'https://vitalcv.com/copilot/v1',
        answer:     response.answer,
        intent:     response.intent,
        confidence: response.query.confidence,
        data:       response.data,
        suggestions: response.suggestions,
        sources:    response.sources,
        timing:     response.timing,
        classification: {
          intent:      response.query.intent,
          confidence:  response.query.confidence,
          npis:        response.query.npis,
          names:       response.query.names,
          filters:     response.query.filters,
          explanation: response.query.explanation,
        },
      });
    } catch (err) {
      log('error', `[Copilot] ask failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Copilot query failed' });
    }
  });

  // ── POST /api/copilot/classify ────────────────────────────────────────────
  //
  // Debug endpoint: classify a query's intent without executing it.
  //
  app.post('/api/copilot/classify', (req: Request, res: Response) => {
    const { query } = req.body as { query?: string };
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Body must include query: string' });
    }
    const classified = classifyIntent(query.trim());
    res.json({ classification: classified });
  });

  // ── GET /api/copilot/session/:id ──────────────────────────────────────────
  //
  // Get conversation history for a session.
  //
  app.get('/api/copilot/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const history = getCopilotSessionHistory(sessionId);
    res.json({
      sessionId,
      turns: history.length,
      history,
    });
  });

  // ── DELETE /api/copilot/session/:id ───────────────────────────────────────
  //
  // Clear a session's conversation context.
  //
  app.delete('/api/copilot/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    clearCopilotSession(sessionId);
    res.json({ cleared: true, sessionId });
  });
}
