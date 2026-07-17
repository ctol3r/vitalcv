/**
 * Interested / Passed workspace model (PR J4) — pure join logic.
 *
 * The clinician's decisions live in the append-only signal log (J2); the full
 * opportunity data + fresh explanation live in the live MATCHA feed (J3). This
 * module joins them into workspace items WITHOUT any I/O, so the join — and
 * especially its honesty rules — is unit-testable:
 *
 *   - a decided role still in the feed is `active`, hydrated with live data;
 *     if the version the clinician saw differs from the live version, it is
 *     `changed` and the item says so.
 *   - a decided role no longer in the feed is `unavailable`: kept in history,
 *     labeled plainly, never silently swapped for a different listing.
 *
 * Interested items are ordered priority-first, then by recency. The live feed
 * is authoritative for opportunity content; the log is authoritative for the
 * decision. No opportunity content is invented for an unavailable role.
 */

import type { DeckRecommendation } from '@/components/matcha-deck/types'
import type { DeckDecisionDetail } from '@/lib/matcha/opportunitySignals'

export type WorkspaceItemStatus = 'active' | 'changed' | 'unavailable'

export interface WorkspaceItem {
  opportunityId: string
  decision: 'interested' | 'priority' | 'passed'
  status: WorkspaceItemStatus
  decidedAt?: string | null
  /** The version the clinician saw when deciding. */
  versionSeen?: string | null
  /** The current live version, when the role is still in the feed. */
  currentVersion?: string | null
  /** Full live recommendation, present for active/changed items only. */
  recommendation?: DeckRecommendation
}

const PRIORITY_RANK: Record<WorkspaceItem['decision'], number> = {
  priority: 0,
  interested: 1,
  passed: 2,
}

/** Build one workspace item by joining a decision with the live feed map. */
export function buildWorkspaceItem(
  detail: DeckDecisionDetail,
  liveById: ReadonlyMap<string, DeckRecommendation>,
): WorkspaceItem {
  const recommendation = liveById.get(detail.opportunityId)
  if (!recommendation) {
    return {
      opportunityId: detail.opportunityId,
      decision: detail.decision,
      status: 'unavailable',
      decidedAt: detail.decidedAt ?? null,
      versionSeen: detail.opportunityVersion ?? null,
    }
  }

  const currentVersion = recommendation.opportunityVersion
  const versionSeen = detail.opportunityVersion ?? null
  // Only claim "changed" when we actually know both versions and they differ —
  // a missing stored version is not evidence of a change.
  const changed = !!versionSeen && !!currentVersion && versionSeen !== currentVersion

  return {
    opportunityId: detail.opportunityId,
    decision: detail.decision,
    status: changed ? 'changed' : 'active',
    decidedAt: detail.decidedAt ?? null,
    versionSeen,
    currentVersion,
    recommendation,
  }
}

/** Recency comparator (newest first); undated items sort last, stably. */
function byRecency(a: WorkspaceItem, b: WorkspaceItem): number {
  const at = a.decidedAt ? Date.parse(a.decidedAt) : NaN
  const bt = b.decidedAt ? Date.parse(b.decidedAt) : NaN
  const av = Number.isFinite(at) ? at : -Infinity
  const bv = Number.isFinite(bt) ? bt : -Infinity
  return bv - av
}

export interface DeckWorkspaces {
  interested: WorkspaceItem[]
  passed: WorkspaceItem[]
}

/**
 * Split decisions into the Interested queue (interested + priority, priority
 * first then newest) and the Passed history (newest first). `details` must
 * already be newest-first (deckDecisionDetails guarantees it).
 */
export function buildDeckWorkspaces(
  details: readonly DeckDecisionDetail[],
  recommendations: readonly DeckRecommendation[],
): DeckWorkspaces {
  const liveById = new Map(recommendations.map((r) => [r.opportunity.opportunityId, r]))
  const items = details.map((d) => buildWorkspaceItem(d, liveById))

  const interested = items
    .filter((i) => i.decision === 'interested' || i.decision === 'priority')
    .sort((a, b) => PRIORITY_RANK[a.decision] - PRIORITY_RANK[b.decision] || byRecency(a, b))

  const passed = items.filter((i) => i.decision === 'passed').sort(byRecency)

  return { interested, passed }
}

/* ------------------------------------------------------------------ */
/* Compare view — the dimensions the Interested queue lays side by side */
/* ------------------------------------------------------------------ */

export interface CompareCell {
  /** Rendered value, or null when the listing did not provide it. */
  value: string | null
}

export interface CompareColumn {
  opportunityId: string
  title: string
  employerName: string
  status: WorkspaceItemStatus
  cells: Record<CompareField, CompareCell>
}

export type CompareField =
  | 'compensation'
  | 'location'
  | 'arrangement'
  | 'employmentType'
  | 'specialty'
  | 'schedule'
  | 'confirmed'
  | 'needsReview'
  | 'unknowns'
  | 'freshness'

export const COMPARE_FIELDS: { key: CompareField; label: string }[] = [
  { key: 'compensation', label: 'Compensation' },
  { key: 'location', label: 'Location' },
  { key: 'arrangement', label: 'Work arrangement' },
  { key: 'employmentType', label: 'Employment type' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'confirmed', label: 'Confirmed fits' },
  { key: 'needsReview', label: 'Needs review' },
  { key: 'unknowns', label: 'Unknowns' },
  { key: 'freshness', label: 'Listing freshness' },
]

function compensationText(rec: DeckRecommendation): string | null {
  const c = rec.opportunity.compensation
  if (!c) return null
  const unit = c.period === 'hour' ? '/hr' : '/yr'
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  if (c.min !== undefined && c.max !== undefined) return `${fmt(c.min)}–${fmt(c.max)}${unit}`
  if (c.min !== undefined) return `From ${fmt(c.min)}${unit}`
  if (c.max !== undefined) return `Up to ${fmt(c.max)}${unit}`
  return null
}

function locationText(rec: DeckRecommendation): string | null {
  const { city, state } = rec.opportunity
  if (city && state) return `${city}, ${state}`
  return state ?? city ?? null
}

const ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: 'Onsite',
  remote: 'Remote',
  hybrid: 'Hybrid',
  multi_site: 'Multi-site',
  unknown: null as unknown as string,
}

/** Build a compare column from an active/changed workspace item. */
export function toCompareColumn(item: WorkspaceItem): CompareColumn | null {
  const rec = item.recommendation
  if (!rec) return null // unavailable roles have no content to compare
  const cell = (value: string | null): CompareCell => ({ value })
  return {
    opportunityId: item.opportunityId,
    title: rec.opportunity.title,
    employerName: rec.opportunity.employerName,
    status: item.status,
    cells: {
      compensation: cell(compensationText(rec)),
      location: cell(locationText(rec)),
      arrangement: cell(ARRANGEMENT_LABEL[rec.opportunity.workArrangement] ?? null),
      employmentType: cell(rec.opportunity.employmentType ?? null),
      specialty: cell(rec.opportunity.specialty ?? null),
      schedule: cell(rec.opportunity.scheduleSummary ?? null),
      confirmed: cell(rec.explanation.confirmed.length ? String(rec.explanation.confirmed.length) : '0'),
      needsReview: cell(
        String(rec.explanation.needsReview.length + rec.explanation.blockers.length),
      ),
      unknowns: cell(String(rec.explanation.unknown.length)),
      freshness: cell(rec.freshness.label),
    },
  }
}
