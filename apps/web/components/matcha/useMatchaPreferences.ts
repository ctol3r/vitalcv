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

  // Hydrate from storage on mount.
  useEffect(() => {
    setPreferences(loadStoredPreferences());
    setLoaded(true);
  }, []);

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
        return next;
      });
    },
    [pushIntent],
  );

  const reset = useCallback(() => {
    clearStoredPreferences();
    setPreferences({});
    setMemory([]);
  }, []);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    [],
  );

  const derived = useMemo(() => deriveMatchaProfile(preferences), [preferences]);
  const completeness = useMemo(() => completenessPercent(preferences), [preferences]);

  return { preferences, derived, completeness, memory, loaded, setField, reset };
}
