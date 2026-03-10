/**
 * Wave 196 — Notification Provider Interface
 */

import { log } from '../../obs/logger';

export interface INotificationProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

class StubNotificationProvider implements INotificationProvider {
  async send(to: string, subject: string, body: string): Promise<void> {
    log('info', 'notification_stub_send', { to, subject, bodyPreview: body.slice(0, 100) });
  }
}

let _provider: INotificationProvider | null = null;

export function getNotificationProvider(): INotificationProvider {
  if (_provider) return _provider;
  // TODO: wire SendGrid / Postmark when SENDGRID_API_KEY or POSTMARK_API_KEY is set
  _provider = new StubNotificationProvider();
  return _provider;
}

export function setNotificationProvider(provider: INotificationProvider): void {
  _provider = provider;
}
