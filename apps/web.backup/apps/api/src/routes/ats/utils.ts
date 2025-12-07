import crypto from 'node:crypto';

export function normalizeWebhookUrl(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Webhook url is required');
  }

  try {
    const parsed = new URL(input);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error('Webhook url must include http or https protocol');
    }
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook url';
    throw new Error(`Invalid webhook url: ${message}`);
  }
}

export function generateSigningSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}











