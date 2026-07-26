/**
 * MATCHA client persistence + memory diffing.
 *
 * Preferences are the clinician's own data, so the durable home base is the browser
 * (localStorage), with a best-effort push of the engine-relevant subset to the MATCHA
 * intent endpoint. This module is pure and SSR-safe — no React, guards on `window`.
 *
 * {@link diffPreferences} powers Wave 10 ("MATCHA remembers") by turning two preference
 * snapshots into plain-language memory notes. Every note is grounded in a real change, so
 * MATCHA only ever "remembers" something the clinician actually did.
 */

import {
  type MatchaPreferences,
  type PreferenceField,
  isFieldAnswered,
} from './preferences';

export const PREFERENCES_STORAGE_KEY = 'vitalcv.matcha.preferences';
export const PREFERENCES_UPDATED_KEY = 'vitalcv.matcha.preferences.updatedAt';

interface StoredEnvelope {
  version: 1;
  updatedAt: string;
  preferences: MatchaPreferences;
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredPreferences(): MatchaPreferences {
  const ls = safeLocalStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredEnvelope | MatchaPreferences;
    if (parsed && typeof parsed === 'object' && 'preferences' in parsed) {
      return (parsed as StoredEnvelope).preferences ?? {};
    }
    return (parsed as MatchaPreferences) ?? {};
  } catch {
    return {};
  }
}

export function savePreferences(prefs: MatchaPreferences, at: string): boolean {
  const ls = safeLocalStorage();
  if (!ls) return false;
  try {
    const envelope: StoredEnvelope = { version: 1, updatedAt: at, preferences: prefs };
    ls.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(envelope));
    ls.setItem(PREFERENCES_UPDATED_KEY, at);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredPreferences(): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(PREFERENCES_STORAGE_KEY);
    ls.removeItem(PREFERENCES_UPDATED_KEY);
  } catch {
    /* no-op */
  }
}

// ── Memory diffing (Wave 10) ────────────────────────────────────────────────

export type MemoryChangeKind = 'added' | 'updated' | 'removed';

export interface MemoryNote {
  field: PreferenceField;
  kind: MemoryChangeKind;
  /** Plain-language note, e.g. "I remember you added California." */
  message: string;
}

const FIELD_LABELS: Partial<Record<PreferenceField, string>> = {
  preferredStates: 'where you want to work',
  desiredSpecialties: 'the specialties you want to move toward',
  currentSpecialties: 'what you practice',
  minimumSalary: 'your minimum compensation',
  desiredSalary: 'your target compensation',
  remoteInterest: 'your interest in remote work',
  employmentTypes: 'the arrangements that work for you',
  startUrgency: 'how soon you want to start',
  leadershipAspiration: 'your leadership goals',
  workLifeBalanceImportance: 'how much work–life balance matters',
};

function readable(field: PreferenceField): string {
  return FIELD_LABELS[field] ?? String(field).replace(/([A-Z])/g, ' $1').toLowerCase();
}

function describeValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return null;
}

/**
 * Compare two preference snapshots and return grounded memory notes.
 * Only fields that genuinely changed produce a note.
 */
export function diffPreferences(
  before: MatchaPreferences,
  after: MatchaPreferences,
  fields: readonly PreferenceField[],
): MemoryNote[] {
  const notes: MemoryNote[] = [];
  for (const field of fields) {
    const b = before[field];
    const a = after[field];
    const hadBefore = isFieldAnswered(b);
    const hasAfter = isFieldAnswered(a);
    if (!hadBefore && !hasAfter) continue;
    if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;

    if (!hadBefore && hasAfter) {
      const v = describeValue(a);
      notes.push({
        field,
        kind: 'added',
        message: v
          ? `I noted ${readable(field)}: ${v}.`
          : `I noted ${readable(field)}.`,
      });
    } else if (hadBefore && !hasAfter) {
      notes.push({ field, kind: 'removed', message: `You cleared ${readable(field)}.` });
    } else {
      const v = describeValue(a);
      notes.push({
        field,
        kind: 'updated',
        message: v
          ? `You updated ${readable(field)} to ${v}.`
          : `You updated ${readable(field)}.`,
      });
    }
  }
  return notes;
}
