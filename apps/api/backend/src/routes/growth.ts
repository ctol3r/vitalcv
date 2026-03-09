/**
 * Wave 193 — Growth Loop Routes
 *
 * GET  /api/notifications/:npi          — Get in-app notifications
 * POST /api/notifications/read          — Mark notification read
 * POST /api/notifications/acted         — Mark notification acted on
 * POST /api/notifications/trigger       — Internal: trigger a notification
 * GET  /api/lifecycle/:npi              — Get lifecycle events
 * GET  /api/growth/analytics            — Growth loop analytics
 */

import type { Express, Request, Response } from 'express';
import {
  triggerInstantOfferNotification,
  triggerClearToStartNotification,
  triggerOnboardingReminder,
  triggerEligibleEmployerNotification,
  getNotificationsForNpi,
  getLifecycleEvents,
  markNotificationRead,
  markNotificationActed,
  recordShareEvent,
  getGrowthAnalytics,
} from '../services/growth/instantOfferService';

export function registerGrowthRoutes(app: Express): void {

  /** GET /api/notifications/:npi */
  app.get('/api/notifications/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    const notifications = getNotificationsForNpi(npi);
    res.json({ notifications, unread: notifications.filter(n => !n.readAt).length });
  });

  /** POST /api/notifications/read — { npi, notificationId } */
  app.post('/api/notifications/read', (req: Request, res: Response) => {
    const { npi, notificationId } = req.body ?? {};
    if (!npi || !notificationId) { res.status(400).json({ error: 'npi and notificationId required' }); return; }
    const ok = markNotificationRead(npi, notificationId);
    res.json({ success: ok });
  });

  /** POST /api/notifications/acted — { npi, notificationId } */
  app.post('/api/notifications/acted', (req: Request, res: Response) => {
    const { npi, notificationId } = req.body ?? {};
    if (!npi || !notificationId) { res.status(400).json({ error: 'npi and notificationId required' }); return; }
    const ok = markNotificationActed(npi, notificationId);
    res.json({ success: ok });
  });

  /** POST /api/notifications/trigger — internal event dispatcher */
  app.post('/api/notifications/trigger', (req: Request, res: Response) => {
    const { type, npi, ...params } = req.body ?? {};
    if (!npi || !type) { res.status(400).json({ error: 'npi and type required' }); return; }

    let notif;
    switch (type) {
      case 'INSTANT_OFFER':
        notif = triggerInstantOfferNotification({ npi, ...params });
        break;
      case 'CLEAR_TO_START':
        notif = triggerClearToStartNotification({ npi, ...params });
        break;
      case 'ONBOARDING_REMINDER':
        notif = triggerOnboardingReminder({ npi, ...params });
        break;
      case 'NEW_ELIGIBLE_EMPLOYER':
        notif = triggerEligibleEmployerNotification({ npi, ...params });
        break;
      default:
        res.status(400).json({ error: `Unknown notification type: ${type}` });
        return;
    }
    res.status(201).json({ notification: notif });
  });

  /** POST /api/growth/share — { npi } */
  app.post('/api/growth/share', (req: Request, res: Response) => {
    const { npi } = req.body ?? {};
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    recordShareEvent(npi);
    res.json({ success: true });
  });

  /** GET /api/lifecycle/:npi */
  app.get('/api/lifecycle/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    const events = getLifecycleEvents(npi);
    res.json({ events });
  });

  /** GET /api/growth/analytics */
  app.get('/api/growth/analytics', (_req: Request, res: Response) => {
    res.json(getGrowthAnalytics());
  });
}
