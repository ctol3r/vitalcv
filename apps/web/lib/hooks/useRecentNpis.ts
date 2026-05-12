'use client';
/**
 * Recent-NPI session memory hook.
 *
 * The Lane A audit (PR #341/#345 era) flagged that the only durable
 * "what was inspected in this session" surface was the in-process
 * `useIngestStream` state plus a session-storage key
 * (`vitalcv:preview:${npi}`) — neither was rendered to the user.
 *
 * This hook persists a small list (cap=10) of recently-inspected NPIs
 * across page navigations and tabs, so the `<RecentNpis>` primitive
 * can render the replay-chain visibly. Storage is `localStorage` (not
 * sessionStorage) so a verifier returning to the surface after a
 * browser restart still sees the recent inspection lineage.
 *
 * Storage shape (versioned for forward compatibility):
 *   localStorage['vitalcv:recent-npis'] = JSON.stringify({
 *     version: 1,
 *     items: Array<RecentNpiEntry>,  // newest first, cap 10
 *   })
 *
 * Determinism: an existing NPI being re-inspected is moved to the head
 * of the list (not duplicated). The hook surfaces `replayCount` per
 * entry — incremented every time the NPI is re-touched — so the UI
 * can render a "previously checked Nx" replay indicator without
 * client-side rederivation.
 */
import { useCallback, useEffect, useState } from 'react';

export const RECENT_NPIS_STORAGE_KEY = 'vitalcv:recent-npis';
export const RECENT_NPIS_CAP = 10;
export const RECENT_NPIS_VERSION = 1;

export interface RecentNpiEntry {
  /** 10-digit NPI as observed on the surface. */
  npi: string;
  /** Display name from the passport, if known. */
  displayName?: string;
  /** Stable canonical replay key for the subject. */
  lineageKey?: string;
  /** Most recent run id observed for this NPI. */
  runId?: string;
  /** Most recent passport `lastCheckedAt` observed for this NPI. */
  lastCheckedAt?: string;
  /** ISO timestamp of when the user last viewed this NPI in this client. */
  viewedAt: string;
  /** How many times this NPI has been re-touched on this client. */
  replayCount: number;
}

interface StoredShape {
  version: number;
  items: RecentNpiEntry[];
}

function readStorage(): RecentNpiEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_NPIS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredShape>;
    if (!parsed || typeof parsed !== 'object') return [];
    if (parsed.version !== RECENT_NPIS_VERSION) return [];
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isValidEntry);
  } catch {
    return [];
  }
}

function writeStorage(items: RecentNpiEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredShape = { version: RECENT_NPIS_VERSION, items };
    window.localStorage.setItem(RECENT_NPIS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable in some sandboxed contexts.
    // Failing silently is correct here — recent-NPIs is a UX enhancement,
    // not a load-bearing trust signal.
  }
}

function isValidEntry(v: unknown): v is RecentNpiEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.npi === 'string'
    && /^\d{10}$/.test(e.npi)
    && typeof e.viewedAt === 'string'
    && typeof e.replayCount === 'number'
    && Number.isFinite(e.replayCount)
  );
}

export interface RecordRecentNpiInput {
  npi: string;
  displayName?: string;
  lineageKey?: string;
  runId?: string;
  lastCheckedAt?: string;
}

/**
 * Move-to-head + replayCount-increment update. Pure function — extracted
 * so it can be unit-tested independent of the React hook.
 */
export function applyRecentNpiUpdate(
  prior: readonly RecentNpiEntry[],
  input: RecordRecentNpiInput,
  now: Date = new Date(),
): RecentNpiEntry[] {
  if (!/^\d{10}$/.test(input.npi)) return [...prior];
  const existingIndex = prior.findIndex((e) => e.npi === input.npi);
  const viewedAt = now.toISOString();
  let next: RecentNpiEntry;
  if (existingIndex >= 0) {
    const existing = prior[existingIndex];
    next = {
      ...existing,
      displayName: input.displayName ?? existing.displayName,
      lineageKey: input.lineageKey ?? existing.lineageKey,
      runId: input.runId ?? existing.runId,
      lastCheckedAt: input.lastCheckedAt ?? existing.lastCheckedAt,
      viewedAt,
      replayCount: existing.replayCount + 1,
    };
  } else {
    next = {
      npi: input.npi,
      displayName: input.displayName,
      lineageKey: input.lineageKey,
      runId: input.runId,
      lastCheckedAt: input.lastCheckedAt,
      viewedAt,
      replayCount: 1,
    };
  }
  const filtered = prior.filter((e) => e.npi !== input.npi);
  return [next, ...filtered].slice(0, RECENT_NPIS_CAP);
}

export interface UseRecentNpisResult {
  items: RecentNpiEntry[];
  recordRecentNpi: (input: RecordRecentNpiInput) => void;
  clearRecentNpis: () => void;
}

export function useRecentNpis(): UseRecentNpisResult {
  const [items, setItems] = useState<RecentNpiEntry[]>([]);

  // Hydrate from storage on mount only — no SSR storage access.
  useEffect(() => {
    setItems(readStorage());
  }, []);

  const recordRecentNpi = useCallback((input: RecordRecentNpiInput) => {
    setItems((prior) => {
      const next = applyRecentNpiUpdate(prior, input);
      writeStorage(next);
      return next;
    });
  }, []);

  const clearRecentNpis = useCallback(() => {
    setItems([]);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(RECENT_NPIS_STORAGE_KEY);
      } catch {
        // see writeStorage()
      }
    }
  }, []);

  return { items, recordRecentNpi, clearRecentNpis };
}
