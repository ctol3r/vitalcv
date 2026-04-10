import type { Express, Request, Response } from 'express';
import {
  getLatestRevenueValidationKpis,
  listDeals,
  listValidationEvents,
  recordValidationEvent,
  storeRevenueValidationKpis,
  trackDeal,
  type Deal,
  type RevenueValidationKpi,
  type ValidationEventName,
} from '../services/revenue/revenueValidationService';
import { log } from '../obs/logger';

const VALIDATION_EVENT_NAMES = new Set<ValidationEventName>([
  'bundle_generated',
  'bundle_shared',
  'employer_viewed',
  'employer_feedback',
  'time_saved_confirmed',
]);

function parseLimit(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 200);
}

function readRequiredString(
  body: Record<string, unknown>,
  key: string,
): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRequiredNumber(
  body: Record<string, unknown>,
  key: string,
): number | null {
  const value = body[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isValidationEventName(value: unknown): value is ValidationEventName {
  return typeof value === 'string' && VALIDATION_EVENT_NAMES.has(value as ValidationEventName);
}

export function registerRevenueValidationRoutes(app: Express): void {
  app.post('/api/revenue-validation/deals', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const deal: Deal = {
        orgName: readRequiredString(body, 'orgName') ?? '',
        contact: readRequiredString(body, 'contact') ?? '',
        status: readRequiredString(body, 'status') ?? '',
        lastContacted: readRequiredString(body, 'lastContacted') ?? '',
        nextStep: readRequiredString(body, 'nextStep') ?? '',
        value: readRequiredNumber(body, 'value') ?? Number.NaN,
        notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      };

      if (
        !deal.orgName
        || !deal.contact
        || !deal.status
        || !deal.lastContacted
        || !deal.nextStep
        || !Number.isFinite(deal.value)
      ) {
        return res.status(400).json({ error: 'orgName, contact, status, lastContacted, nextStep, and value are required.' });
      }

      const created = await trackDeal(deal);
      res.status(201).json(created);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to track deal.';
      log('error', 'revenue_validation.deal_create_failed', { error: detail });
      res.status(500).json({ error: detail });
    }
  });

  app.get('/api/revenue-validation/deals', async (req: Request, res: Response) => {
    try {
      const deals = await listDeals(parseLimit(req.query.limit, 50));
      res.json({ deals });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to load deals.';
      log('error', 'revenue_validation.deal_list_failed', { error: detail });
      res.status(500).json({ error: detail });
    }
  });

  app.post('/api/revenue-validation/events', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!isValidationEventName(body.eventName)) {
        return res.status(400).json({ error: 'eventName must be a supported validation event.' });
      }

      const created = await recordValidationEvent({
        eventName: body.eventName,
        bundleId: typeof body.bundleId === 'string' ? body.bundleId : undefined,
        npi: typeof body.npi === 'string' ? body.npi : undefined,
        organizationId: typeof body.organizationId === 'string' ? body.organizationId : undefined,
        orgName: typeof body.orgName === 'string' ? body.orgName : undefined,
        contact: typeof body.contact === 'string' ? body.contact : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        value: typeof body.value === 'number' ? body.value : undefined,
        time_saved_days: typeof body.time_saved_days === 'number' ? body.time_saved_days : undefined,
        metadata:
          body.metadata !== null && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });

      res.status(201).json(created);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to record validation event.';
      log('error', 'revenue_validation.event_create_failed', { error: detail });
      res.status(500).json({ error: detail });
    }
  });

  app.get('/api/revenue-validation/events', async (req: Request, res: Response) => {
    try {
      const eventName = isValidationEventName(req.query.eventName) ? req.query.eventName : undefined;
      const events = await listValidationEvents({
        eventName,
        limit: parseLimit(req.query.limit, 50),
      });
      res.json({ events });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to load validation events.';
      log('error', 'revenue_validation.event_list_failed', { error: detail });
      res.status(500).json({ error: detail });
    }
  });

  app.post('/api/revenue-validation/kpis', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const kpis: RevenueValidationKpi = {
        time_saved_days: readRequiredNumber(body, 'time_saved_days') ?? Number.NaN,
        conversion_rate: readRequiredNumber(body, 'conversion_rate') ?? Number.NaN,
        pilot_interest_rate: readRequiredNumber(body, 'pilot_interest_rate') ?? Number.NaN,
      };

      if (
        !Number.isFinite(kpis.time_saved_days)
        || !Number.isFinite(kpis.conversion_rate)
        || !Number.isFinite(kpis.pilot_interest_rate)
      ) {
        return res.status(400).json({ error: 'time_saved_days, conversion_rate, and pilot_interest_rate are required.' });
      }

      const created = await storeRevenueValidationKpis({
        ...kpis,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
      });

      res.status(201).json(created);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to store KPI snapshot.';
      log('error', 'revenue_validation.kpi_create_failed', { error: detail });
      res.status(500).json({ error: detail });
    }
  });

  app.get('/api/revenue-validation/kpis/latest', async (_req: Request, res: Response) => {
    try {
      const kpis = await getLatestRevenueValidationKpis();
      if (!kpis) {
        return res.status(404).json({ error: 'No KPI snapshot found.' });
      }
      res.json(kpis);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to load KPI snapshot.';
      log('error', 'revenue_validation.kpi_latest_failed', { error: detail });
      res.status(500).json({ error: detail });
    }
  });
}
