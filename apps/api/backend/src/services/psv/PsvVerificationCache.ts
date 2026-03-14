import type { NormalizedCredentialPayload } from '../../../adapters/types';
import type { CredentialType } from '../../../types/psv';

export type PsvSourceName =
  | 'NPPES'
  | 'OIG_LEIE'
  | 'NURSYS'
  | 'STATE_BOARD'
  | 'DEA';

export interface PsvCacheEntry {
  npi: string;
  source: PsvSourceName;
  credentialType: CredentialType;
  payload: NormalizedCredentialPayload | null;
  fetchedAt: string;
  expiresAt: string;
}

const TTL_MS_BY_SOURCE: Record<PsvSourceName, number> = {
  NPPES: 7 * 24 * 60 * 60 * 1000,
  OIG_LEIE: 24 * 60 * 60 * 1000,
  NURSYS: 7 * 24 * 60 * 60 * 1000,
  STATE_BOARD: 30 * 24 * 60 * 60 * 1000,
  DEA: 30 * 24 * 60 * 60 * 1000,
};

export class PsvVerificationCache {
  private readonly store = new Map<string, PsvCacheEntry>();

  set(key: string, entry: PsvCacheEntry): void {
    this.store.set(key, entry);
  }

  get(key: string): PsvCacheEntry | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.parse(entry.expiresAt) <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  invalidate(npi: string): number {
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.npi === npi || key.startsWith(`${npi}:`)) {
        this.store.delete(key);
        removed += 1;
      }
    }

    return removed;
  }

  stats(): {
    size: number;
    entriesBySource: Record<PsvSourceName, number>;
    oldestFetchedAt?: string;
    soonestExpirationAt?: string;
  } {
    this.sweepExpired();

    const entries = [...this.store.values()];
    const entriesBySource: Record<PsvSourceName, number> = {
      NPPES: 0,
      OIG_LEIE: 0,
      NURSYS: 0,
      STATE_BOARD: 0,
      DEA: 0,
    };

    for (const entry of entries) {
      entriesBySource[entry.source] += 1;
    }

    const sortedByFetchedAt = [...entries].sort((left, right) =>
      left.fetchedAt.localeCompare(right.fetchedAt),
    );
    const sortedByExpiration = [...entries].sort((left, right) =>
      left.expiresAt.localeCompare(right.expiresAt),
    );

    return {
      size: this.store.size,
      entriesBySource,
      oldestFetchedAt: sortedByFetchedAt[0]?.fetchedAt,
      soonestExpirationAt: sortedByExpiration[0]?.expiresAt,
    };
  }

  createEntry(params: {
    npi: string;
    source: PsvSourceName;
    credentialType: CredentialType;
    payload: NormalizedCredentialPayload | null;
    fetchedAt?: string;
  }): PsvCacheEntry {
    const fetchedAt = params.fetchedAt ?? new Date().toISOString();
    const ttlMs = TTL_MS_BY_SOURCE[params.source];

    return {
      npi: params.npi,
      source: params.source,
      credentialType: params.credentialType,
      payload: params.payload,
      fetchedAt,
      expiresAt: new Date(Date.parse(fetchedAt) + ttlMs).toISOString(),
    };
  }

  private sweepExpired(): void {
    const nowMs = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (Date.parse(entry.expiresAt) <= nowMs) {
        this.store.delete(key);
      }
    }
  }
}

let cacheInstance: PsvVerificationCache | null = null;

export function getPsvCacheInstance(): PsvVerificationCache {
  if (!cacheInstance) {
    cacheInstance = new PsvVerificationCache();
  }

  return cacheInstance;
}
