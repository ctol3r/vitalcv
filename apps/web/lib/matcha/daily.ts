/**
 * MATCHA daily loop — streak + "what moved" brief.
 *
 * The daily-return habit: each day MATCHA shows what actually changed since the clinician's last
 * visit, and tracks a consecutive-day streak. Everything here is pure and testable; the localStorage
 * plumbing lives in components/matcha/useMatchaDaily.ts.
 *
 * Truth contract: brief items are built ONLY from real deltas (new engine matches, a readiness change,
 * preference edits the clinician made, saved roles). Nothing is invented; if nothing moved, we say so.
 */

// ── Dates (ISO date strings, YYYY-MM-DD) ─────────────────────────────────────

/** Normalize a Date to a YYYY-MM-DD string in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). Positive if b is later. */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00`);
  const tb = Date.parse(`${b}T00:00:00`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return Math.round((tb - ta) / 86_400_000);
}

// ── Streak ───────────────────────────────────────────────────────────────────

export interface StreakState {
  streak: number;
  lastVisit: string | null; // YYYY-MM-DD
}

/**
 * Advance the streak for a visit on `today`.
 *  - same day as last visit → unchanged
 *  - exactly the next day → +1
 *  - a gap (or first ever) → reset to 1
 */
export function advanceStreak(prev: StreakState, today: string): StreakState {
  if (prev.lastVisit === today) return prev;
  const gap = prev.lastVisit ? daysBetween(prev.lastVisit, today) : Infinity;
  if (gap === 1) return { streak: Math.max(1, prev.streak) + 1, lastVisit: today };
  return { streak: 1, lastVisit: today };
}

// ── Brief items ──────────────────────────────────────────────────────────────

export type BriefTone = 'up' | 'neutral' | 'nudge';

export interface BriefItem {
  id: string;
  text: string;
  tone: BriefTone;
}

export interface DailyDelta {
  /** Engine matches not yet acted on. */
  newMatches: number;
  savedMatches: number;
  /** Current readiness 0–100, and change since last visit (null if unknown / first visit). */
  readinessScore: number | null;
  readinessDelta: number | null;
  /** 0–100 profile completeness. */
  completeness: number;
  /** Plain-language notes for preference edits since last visit (from diffPreferences). */
  memoryNotes: string[];
  /** Optional "you're closer to X" nudge, already phrased. */
  gapNudge?: string | null;
}

/**
 * Build the ordered, honest "what moved" list. Only real signals appear. If nothing moved,
 * returns a single calm "still watching" line rather than manufacturing activity.
 */
export function buildBriefItems(d: DailyDelta): BriefItem[] {
  const items: BriefItem[] = [];

  if (d.newMatches > 0) {
    items.push({
      id: 'new-matches',
      text: `${d.newMatches} new role${d.newMatches === 1 ? '' : 's'} entered your sky`,
      tone: 'up',
    });
  }

  if (typeof d.readinessDelta === 'number' && d.readinessDelta !== 0) {
    items.push({
      id: 'readiness',
      text: d.readinessDelta > 0
        ? `Readiness up ${d.readinessDelta} to ${d.readinessScore}/100`
        : `Readiness changed ${d.readinessDelta} to ${d.readinessScore}/100`,
      tone: d.readinessDelta > 0 ? 'up' : 'neutral',
    });
  }

  for (const note of d.memoryNotes.slice(0, 2)) {
    items.push({ id: `mem-${items.length}`, text: note, tone: 'neutral' });
  }

  if (d.savedMatches > 0) {
    items.push({
      id: 'saved',
      text: `${d.savedMatches} saved role${d.savedMatches === 1 ? '' : 's'} waiting for you`,
      tone: 'neutral',
    });
  }

  if (d.gapNudge) {
    items.push({ id: 'gap', text: d.gapNudge, tone: 'nudge' });
  }

  if (items.length === 0) {
    items.push({
      id: 'quiet',
      text: 'Nothing new since your last visit — MATCHA is still watching in the background.',
      tone: 'neutral',
    });
  }

  return items.slice(0, 5);
}

/** A short, honest gap nudge from completeness + a category label, or null if profile is full. */
export function gapNudge(completeness: number, thinnestCategoryLabel: string | null): string | null {
  if (completeness >= 100 || !thinnestCategoryLabel) return null;
  return `A few more ${thinnestCategoryLabel} answers sharpen your matches`;
}
