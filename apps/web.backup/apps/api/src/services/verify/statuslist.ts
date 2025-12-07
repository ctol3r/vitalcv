import fetch from 'node-fetch';
import type { StatusListPointer } from './types';

const CACHE_TTL_MS = Number(process.env.STATUSLIST_CACHE_TTL_MS || 60_000);

interface CachedStatusList {
  payload: Record<string, any>;
  fetchedAt: number;
}

const statusCache = new Map<string, CachedStatusList>();

export interface StatusCheckResult {
  revoked: boolean;
  pointer?: {
    url: string;
    index?: number;
    credentialId?: string;
  };
  checkedAt: string;
  reason?: string;
}

export async function checkStatusList(
  pointer?: StatusListPointer,
  fallbackUrl?: string,
): Promise<StatusCheckResult> {
  const url = pointer?.statusListCredential ?? fallbackUrl;
  const now = new Date().toISOString();

  if (!url) {
    return {
      revoked: false,
      checkedAt: now,
      reason: 'status_list_pointer_absent',
    };
  }

  try {
    const payload = await loadStatusList(url);
    const pointerIndex = parseIndex(pointer?.statusListIndex);
    const revoked = evaluateRevocation(payload, {
      index: pointerIndex,
      credentialId: pointer?.credentialId,
    });

    return {
      revoked,
      checkedAt: now,
      pointer: {
        url,
        index: pointerIndex ?? undefined,
        credentialId: pointer?.credentialId,
      },
    };
  } catch (error) {
    return {
      revoked: false,
      checkedAt: now,
      pointer: {
        url,
        index: parseIndex(pointer?.statusListIndex) ?? undefined,
        credentialId: pointer?.credentialId,
      },
      reason: error instanceof Error ? error.message : 'status_list_fetch_failed',
    };
  }
}

function evaluateRevocation(
  payload: Record<string, any>,
  context: { index: number | null; credentialId?: string },
): boolean {
  if (Array.isArray(payload.revokedCredentials) && context.credentialId) {
    return payload.revokedCredentials.includes(context.credentialId);
  }

  const encodedList =
    payload.encodedList ??
    payload.credentialSubject?.encodedList ??
    payload.statusListCredential?.credentialSubject?.encodedList;

  if (typeof encodedList === 'string' && typeof context.index === 'number') {
    return readBitFromEncodedList(encodedList, context.index);
  }

  return false;
}

async function loadStatusList(url: string): Promise<Record<string, any>> {
  const cached = statusCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.payload;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`StatusList fetch failed (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, any>;
  statusCache.set(url, {
    payload,
    fetchedAt: Date.now(),
  });
  return payload;
}

function readBitFromEncodedList(encoded: string, index: number): boolean {
  const buffer = decodeBase64Url(encoded);
  const byteIndex = Math.floor(index / 8);
  const bitIndex = 7 - (index % 8);
  if (byteIndex >= buffer.length) {
    return false;
  }
  const byte = buffer[byteIndex];
  return Boolean((byte >> bitIndex) & 1);
}

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function parseIndex(index?: string | number): number | null {
  if (typeof index === 'number' && Number.isFinite(index)) {
    return index;
  }
  if (typeof index === 'string' && index.trim()) {
    const parsed = Number(index);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function clearStatusListCache(): void {
  statusCache.clear();
}











