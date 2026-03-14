import { base64url } from 'jose';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeJson(value: unknown): string {
  return base64url.encode(encoder.encode(JSON.stringify(value)));
}

export function decodeJson<T>(value: string): T {
  return JSON.parse(decoder.decode(base64url.decode(value))) as T;
}

export function chunkString(value: string, maxLength: number): string[] {
  if (maxLength <= 0) {
    throw new Error('maxLength must be positive');
  }

  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }

  return chunks.length > 0 ? chunks : [''];
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64url.encode(new Uint8Array(digest));
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function addDays(source: Date, days: number): Date {
  return new Date(source.getTime() + days * 86_400_000);
}
