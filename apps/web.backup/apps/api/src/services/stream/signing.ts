import { createHmac } from 'crypto';

export const STREAM_SIGNATURE_HEADER = 'x-vital-stream-signature';
export const STREAM_TIMESTAMP_HEADER = 'x-vital-stream-timestamp';

export function signStreamPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}










