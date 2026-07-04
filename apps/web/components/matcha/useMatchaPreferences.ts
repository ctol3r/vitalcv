'use client';

/**
 * useMatchaPreferences — the client binding between the clinician's stated preferences,
 * durable local storage, the derived "MATCHA understands you" profile, and the live engine.
 *
 * Writes go to localStorage immediately (the clinician's data is theirs), and the
 * engine-relevant subset is pushed best-effort to /api/matcha/intent so live matches update.
 * A failed push never loses the answer — local storage is the source of truth.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type MatchaPreferences,
  type PreferenceField,
  ENGINE_BACKED_FIELDS,
  completenessPercent,
  countAnsweredFields,
  sanitizeStoredPreferences,
  toCandidateIntent,
} from '@/lib/matcha/preferences';
import { deriveMatchaProfile, type MatchaDerivedProfile } from '@/lib/matcha/profile';
import {
  type MemoryNote,
  diffPreferences,
  loadStoredPreferences,
  savePreferences,
  clearStoredPreferences,
} from '@/lib/matcha/storage';

const RECENT_MEMORY_LIMIT = 8;

export interface UseMatchaPreferences {
  preferences: MatchaPreferences;
  derived: MatchaDerivedProfile;
  completeness: number;
  /** Grounded "MATCHA remembers" notes from the most recent edits, newest first. */
  memory: MemoryNote[];
  loaded: boolean;
  setField: (field: PreferenceField, value: MatchaPreferences[PreferenceField]) => void;
  reset: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function useMatchaPreferences(npi?: string): UseMatchaPreferences {
  const [preferences, setPreferences] = useState<MatchaPreferences>({});
  const [loaded, setLoaded] = useState(false);
  const [memory, setMemory] = useState<MemoryNote[]>([]);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from local storage on mount (instant, offline-safe).
  useEffect(() => {
    setPreferences(loadStoredPreferences());
    setLoaded(true);
  }, []);

  /**
   * Persist the full preference bag to the durable, auth-scoped server store
   * so it follows the provider across devices. Best-effort: a failed write
   * never loses the answer (local storage remains the fallback). Unauthenticated
   * callers get 401 and simply stay local-only.
   */
  const persistToServer = useCallback((prefs: MatchaPreferences) => {
    void fetch('/api/matcha/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: prefs }),
      keepalive: true,
    }).catch(() => {
      /* best-effort — local storage remains the source of truth */
    });
  }, []);

  // Hydrate from the durable server store once on mount. When signed in and the
  // server holds preferences, the server is the cross-device source of truth;
  // when the server is empty, migrate any existing local preferences up once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/matcha/preferences', { cache: 'no-store' });
        if (cancelled || !res.ok) return; // 401 / degraded → stay local-only
        const body = (await res.json()) as { preferences?: unknown };
        const server = sanitizeStoredPreferences(body?.preferences ?? {});
        if (cancelled) return;
        if (countAnsweredFields(server) > 0) {
          setPreferences(server);
          savePreferences(server, nowIso());
        } else {
          const local = loadStoredPreferences();
          if (countAnsweredFields(local) > 0) persistToServer(local);
        }
      } catch {
        /* stay local-only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistToServer]);

  // Debounced durable persistence so rapid answers collapse into one write.
  const pushPrefs = useCallback(
    (next: MatchaPreferences) => {
      if (prefsTimer.current) clearTimeout(prefsTimer.current);
      prefsTimer.current = setTimeout(() => persistToServer(next), 800);
    },
    [persistToServer],
  );

  const pushIntent = useCallback(
    (next: MatchaPreferences) => {
      if (!npi) return;
      const engineTouched = ENGINE_BACKED_FIELDS.some(
        (f) => next[f] !== undefined && next[f] !== null,
      );
      if (!engineTouched) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      // Debounce so rapid answers collapse into one request.
      pushTimer.current = setTimeout(() => {
        const payload = toCandidateIntent(npi, next, nowIso());
        void fetch('/api/matcha/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          /* best-effort — local storage remains the source of truth */
        });
      }, 600);
    },
    [npi],
  );

  const setField = useCallback(
    (field: PreferenceField, value: MatchaPreferences[PreferenceField]) => {
      setPreferences((prev) => {
        const next: MatchaPreferences = { ...prev, [field]: value };
        const notes = diffPreferences(prev, next, [field]);
        if (notes.length) {
          setMemory((m) => [...notes, ...m].slice(0, RECENT_MEMORY_LIMIT));
        }
        savePreferences(next, nowIso());
        pushIntent(next);
        pushPrefs(next);
        return next;
      });
    },
    [pushIntent, pushPrefs],
  );

  const reset = useCallback(() => {
    clearStoredPreferences();
    setPreferences({});
    setMemory([]);
  }, []);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      if (prefsTimer.current) clearTimeout(prefsTimer.current);
    },
    [],
  );

  const derived = useMemo(() => deriveMatchaProfile(preferences), [preferences]);
  const completeness = useMemo(() => completenessPercent(preferences), [preferences]);

  return { preferences, derived, completeness, memory, loaded, setField, reset };
}
