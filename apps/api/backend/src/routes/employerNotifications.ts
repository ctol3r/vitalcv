/**
 * employerNotifications.ts — Employer notification routes.
 *
 * Assimilated from vitalcv-ai-sandbox server.ts. Uses in-memory store for now.
 *
 * Routes:
 *   GET    /api/employer/notifications        — List notifications
 *   POST   /api/employer/notifications/read   — Mark notifications as read
 *   DELETE /api/employer/notifications         — Clear all notifications
 *
 * Auth: Clerk session header (x-clerk-user-id).
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { log } from '../obs/logger';
import { HttpError } from '../utils/httpError';

// ── Types ────────────────────────────────────────────────────────

export interface EmployerNotification {
  id: string;
  type: 'NEW_PACKET' | 'STATUS_CHANGE';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  npi?: string;
}

// ── In-memory store (TODO: migrate to Prisma) ────────────────────

const notificationsByUser = new Map<string, EmployerNotification[]>();

function getNotifications(userId: string): EmployerNotification[] {
  return notificationsByUser.get(userId) ?? [];
}

// ── Helpers ──────────────────────────────────────────────────────

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

// ── Route registration ───────────────────────────────────────────

export function registerEmployerNotificationRoutes(app: Express): void {
  app.get(
    '/api/employer/notifications',
    asyncHandler(async (req, res) => {
      const userId = requireClerkUserId(req);
      const notifications = getNotifications(userId);
      return void res.json({ notifications });
    }),
  );

  app.post(
    '/api/employer/notifications/read',
    asyncHandler(async (req, res) => {
      const userId = requireClerkUserId(req);
      const { notificationIds } = req.body ?? {};

      if (!Array.isArray(notificationIds)) {
        throw new HttpError(400, 'notificationIds must be an array.');
      }

      const notifications = getNotifications(userId);
      for (const n of notifications) {
        if (notificationIds.includes(n.id)) {
          n.read = true;
        }
      }

      return void res.json({ ok: true });
    }),
  );

  app.delete(
    '/api/employer/notifications',
    asyncHandler(async (req, res) => {
      const userId = requireClerkUserId(req);
      notificationsByUser.set(userId, []);
      return void res.json({ ok: true });
    }),
  );

  log('info', 'employer_notification_routes_registered', {
    routes: [
      'GET    /api/employer/notifications',
      'POST   /api/employer/notifications/read',
      'DELETE /api/employer/notifications',
    ],
  });
}
