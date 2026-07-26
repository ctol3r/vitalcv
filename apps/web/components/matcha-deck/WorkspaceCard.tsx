'use client'

import Link from 'next/link'

import { overallLabelText } from './deckMachine'
import type { WorkspaceItem } from '@/lib/matcha-deck/workspace'

function compensationText(item: WorkspaceItem): string | null {
  const c = item.recommendation?.opportunity.compensation
  if (!c) return null
  const unit = c.period === 'hour' ? '/hr' : '/yr'
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  if (c.min !== undefined && c.max !== undefined) return `${fmt(c.min)}–${fmt(c.max)}${unit}`
  if (c.min !== undefined) return `From ${fmt(c.min)}${unit}`
  if (c.max !== undefined) return `Up to ${fmt(c.max)}${unit}`
  return null
}

function locationText(item: WorkspaceItem): string | null {
  const opp = item.recommendation?.opportunity
  if (!opp) return null
  if (opp.city && opp.state) return `${opp.city}, ${opp.state}`
  return opp.state ?? opp.city ?? null
}

export interface WorkspaceCardProps {
  item: WorkspaceItem
  /** 'interested' shows Begin application + Remove; 'passed' shows Restore. */
  mode: 'interested' | 'passed'
  onRestore: (opportunityId: string, version?: string | null) => void
  pending: boolean
  errored: boolean
}

export function WorkspaceCard({ item, mode, onRestore, pending, errored }: WorkspaceCardProps) {
  const rec = item.recommendation
  const title = rec?.opportunity.title ?? 'Role no longer listed'
  const employer = rec?.opportunity.employerName ?? 'Employer not available'
  const comp = compensationText(item)
  const location = locationText(item)
  const confirmed = rec?.explanation.confirmed.length ?? 0
  const review = (rec?.explanation.needsReview.length ?? 0) + (rec?.explanation.blockers.length ?? 0)
  const unknowns = rec?.explanation.unknown ?? []

  return (
    <article
      className="mdk-ws-card"
      data-status={item.status}
      data-decision={item.decision}
      aria-label={`${title} at ${employer}`}
    >
      <div className="mdk-ws-card-head">
        <div>
          <p className="mdk-ws-employer">{employer}</p>
          <h3 className="mdk-ws-role">{title}</h3>
        </div>
        <div className="mdk-ws-badges">
          {item.decision === 'priority' ? (
            <span className="mdk-chip mdk-chip--strong">★ Priority</span>
          ) : null}
          {item.status === 'changed' ? (
            <span className="mdk-chip mdk-chip--watch" data-mdk-changed>
              Changed since you saved it
            </span>
          ) : null}
          {item.status === 'unavailable' ? (
            <span className="mdk-chip mdk-chip--limited">No longer in your matches</span>
          ) : null}
        </div>
      </div>

      {rec ? (
        <ul className="mdk-ws-meta">
          {location ? <li>{location}</li> : null}
          {comp ? <li className="mdk-comp">{comp}</li> : <li className="mdk-unknown-text">Compensation not provided</li>}
          {rec.opportunity.employmentType ? <li>{rec.opportunity.employmentType}</li> : null}
          <li>{overallLabelText(rec)}</li>
        </ul>
      ) : (
        <p className="mdk-ws-unavailable-note">
          This role is no longer in your active matches. It stays here in your history — VitalCV never
          swaps it for a different listing.
        </p>
      )}

      {rec ? (
        <div className="mdk-ws-readiness">
          <span className="mdk-ws-stat" data-tone="ok">
            {confirmed} confirmed {confirmed === 1 ? 'fit' : 'fits'}
          </span>
          <span className="mdk-ws-stat" data-tone="watch">
            {review} to review
          </span>
          {unknowns.length > 0 ? (
            <span className="mdk-ws-stat" data-tone="unknown">
              {unknowns.length} unknown
            </span>
          ) : null}
        </div>
      ) : null}

      {unknowns.length > 0 ? (
        <details className="mdk-ws-unknowns">
          <summary>Unresolved unknowns</summary>
          <ul>
            {unknowns.map((u) => (
              <li key={u.id}>{u.label}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mdk-ws-actions">
        {mode === 'interested' && rec && rec.actions.canApply ? (
          <Link className="mdk-btn mdk-btn--interested" href={`/holder/opportunities/${item.opportunityId}`}>
            Begin application
          </Link>
        ) : null}
        {mode === 'interested' && rec && !rec.actions.canApply ? (
          <Link className="mdk-btn" href={`/holder/opportunities/${item.opportunityId}`}>
            Review what’s needed
          </Link>
        ) : null}
        {rec ? (
          <Link className="mdk-btn" href={`/holder/opportunities/${item.opportunityId}`}>
            View details
          </Link>
        ) : null}
        <button
          type="button"
          className="mdk-btn"
          onClick={() => onRestore(item.opportunityId, item.versionSeen)}
          disabled={pending}
        >
          {pending ? 'Working…' : mode === 'interested' ? 'Remove' : 'Restore to deck'}
        </button>
      </div>

      {errored ? (
        <p className="mdk-ws-error" role="status">
          That didn’t save. Your decision is unchanged — try again.
        </p>
      ) : null}
    </article>
  )
}
