/**
 * Wave 196 — Notification Provider Interface
 *
 * Delivery honesty: callers can ask whether a REAL provider is wired
 * (isEmailDeliveryConfigured) so user-facing flows never claim "code sent"
 * when the environment can only log. Production wiring is Resend via
 * RESEND_API_KEY (+ optional NOTIFY_FROM_EMAIL); without it, the stub
 * provider logs and delivery counts as unconfigured.
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

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'VitalCV <no-reply@vitalcv.com>';

class ResendNotificationProvider implements INotificationProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
}

let _provider: INotificationProvider | null = null;
let _configured = false;

export function getNotificationProvider(): INotificationProvider {
  if (_provider) return _provider;
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    _provider = new ResendNotificationProvider(
      resendKey,
      process.env.NOTIFY_FROM_EMAIL?.trim() || DEFAULT_FROM,
    );
    _configured = true;
    log('info', 'notification_provider_configured', { provider: 'resend' });
  } else {
    _provider = new StubNotificationProvider();
    _configured = false;
  }
  return _provider;
}

/** True when a real delivery provider is active (or one was injected). */
export function isEmailDeliveryConfigured(): boolean {
  getNotificationProvider();
  return _configured;
}

export function setNotificationProvider(provider: INotificationProvider): void {
  _provider = provider;
  _configured = true;
}
