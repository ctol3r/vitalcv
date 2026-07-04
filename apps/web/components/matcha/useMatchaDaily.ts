'use client';

/**
 * useMatchaDaily — the daily-return loop's state.
 *
 * On the first render once data is `ready`, it reads the persisted baseline (last visit, streak,
 * last readiness, last preference snapshot), computes today's streak and the real deltas since the
 * clinician's last visit, then rolls the baseline forward. Honest by construction: deltas come from
 * stored real values, not from anything invented.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceStreak, toISODate } from '@/lib/matcha/daily';
import { ALL_PREFERENCE_FIELDS, type MatchaPreferences } from '@/lib/matcha/preferences';
import { diffPreferences } from '@/lib/matcha/storage';

const KEY = 'vitalcv.matcha.daily';

interface Stored {
  streak: number;
  lastVisit: string | null;
  lastReadiness: number | null;
  lastPrefs: MatchaPreferences | null;
  lastBriefDate: string | null;
}

interface DailyResult {
  loaded: boolean;
  streak: number;
  /** True until the clinician has seen today's brief. */
  isNewDay: boolean;
  readinessDelta: number | null;
  memoryNotes: string[];
  markBriefSeen: () => void;
}

function read(): Stored {
  try {
    if (typeof window === 'undefined' || !window.localStorage) throw new Error('no ls');
    const raw = window.localStorage.getItem(KEY);
    if (!raw) throw new Error('empty');
    const p = JSON.parse(raw) as Partial<Stored>;
    return {
      streak: typeof p.streak === 'number' ? p.streak : 0,
      lastVisit: p.lastVisit ?? null,
      lastReadiness: typeof p.lastReadiness === 'number' ? p.lastReadiness : null,
      lastPrefs: p.lastPrefs ?? null,
      lastBriefDate: p.lastBriefDate ?? null,
    };
  } catch {
    return { streak: 0, lastVisit: null, lastReadiness: null, lastPrefs: null, lastBriefDate: null };
  }
}

function write(s: Stored) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* no-op */
  }
}

export function useMatchaDaily(input: {
  ready: boolean;
  readinessScore: number | null;
  preferences: MatchaPreferences;
}): DailyResult {
  const [state, setState] = useState<DailyResult>({
    loaded: false,
    streak: 0,
    isNewDay: false,
    readinessDelta: null,
    memoryNotes: [],
    markBriefSeen: () => {},
  });
  const done = useRef(false);
  const todayRef = useRef<string>('');

  useEffect(() => {
    if (!input.ready || done.current) return;
    done.current = true;

    const prev = read();
    const today = toISODate(new Date());
    todayRef.current = today;

    const nextStreak = advanceStreak({ streak: prev.streak, lastVisit: prev.lastVisit }, today);

    const readinessDelta =
      prev.lastReadiness !== null && input.readinessScore !== null
        ? input.readinessScore - prev.lastReadiness
        : null;

    const memoryNotes = prev.lastPrefs
      ? diffPreferences(prev.lastPrefs, input.preferences, ALL_PREFERENCE_FIELDS).map((n) => n.message)
      : [];

    const isNewDay = prev.lastBriefDate !== today;

    // Roll the baseline forward (but keep lastBriefDate until the brief is seen).
    write({
      streak: nextStreak.streak,
      lastVisit: today,
      lastReadiness: input.readinessScore,
      lastPrefs: input.preferences,
      lastBriefDate: prev.lastBriefDate,
    });

    setState((s) => ({
      ...s,
      loaded: true,
      streak: nextStreak.streak,
      isNewDay,
      readinessDelta,
      memoryNotes,
    }));
  }, [input.ready, input.readinessScore, input.preferences]);

  const markBriefSeen = useCallback(() => {
    const cur = read();
    write({ ...cur, lastBriefDate: todayRef.current || toISODate(new Date()) });
    setState((s) => ({ ...s, isNewDay: false }));
  }, []);

  return { ...state, markBriefSeen };
}
