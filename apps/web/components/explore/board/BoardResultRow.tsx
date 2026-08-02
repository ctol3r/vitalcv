'use client';

/**
 * BoardResultRow — one opportunity, as a ruled row.
 *
 * Deliberately NOT a card: CD-13 retires card grids, and a single ruled column
 * is also what a scanning reader actually wants. Structure comes from a 1px
 * rule between rows, not from shadows or boxes.
 *
 * CD-8 (mono law): every machine fact — state, money, durations, dates, source
 * names — renders mono. Human prose stays sans.
 * CD-2.2: a state is never colour alone. Each carries a glyph AND its word AND
 * the source it came from AND how old that source is.
 */

import Link from 'next/link';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import { HIRING_TYPE_LABEL, READINESS_LABEL } from '@/lib/explore/board-filters';

/** CD-5 glyphs. Shape carries the state; hue only reinforces it. */
const READINESS_GLYPH: Record<string, string> = {
  ready_now: '●',
  needs_review: '▲',
  requirements_missing: '○',
};

const READINESS_INK: Record<string, string> = {
  ready_now: 'var(--ok, #1C5C38)',
  needs_review: 'var(--watch, #7D5A1E)',
  requirements_missing: 'var(--unknown, #3F3D38)',
};

function formatPay(o: OpportunitySummary): string | null {
  if (o.payRange) return o.payRange;
  const min = o.payRangeMin;
  const max = o.payRangeMax;
  if (min == null && max == null) return null;
  const unit = o.payUnit === 'hour' ? '/hr' : o.payUnit === 'shift' ? '/shift' : '';
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}${unit}`;
  return `${fmt((min ?? max) as number)}${unit}`;
}

/** "12 Apr" / "12 Apr 2025" — short, unambiguous, and mono at the call site. */
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const sameYear = parsed.getUTCFullYear() === new Date().getUTCFullYear();
  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

export function BoardResultRow({ opportunity }: { opportunity: OpportunitySummary }) {
  const pay = formatPay(opportunity);
  const placement = opportunity.remote ? 'Remote' : opportunity.state || null;
  const hiringType = HIRING_TYPE_LABEL[opportunity.hiringType] ?? opportunity.hiringType;
  const start = opportunity.startTimeline ?? null;
  const requirements = (opportunity.credentialRequirements ?? []).filter((r) => r.priority !== 'preferred');
  const comparison = opportunity.comparison ?? null;
  const freshness = opportunity.freshness ?? null;
  const sourceLabel = opportunity.source?.label ?? null;
  const isFeedListing = opportunity.isFeedListing === true;
  const sourceUrl = opportunity.source?.url ?? null;
  const updated = formatDate(freshness?.lastUpdatedAt ?? opportunity.updatedAt ?? opportunity.createdAt);

  // Machine facts, in one mono line. Nulls are dropped rather than rendered as
  // "—" so an absent value never reads as a stated one.
  const facts = [placement, pay, hiringType, start].filter(Boolean) as string[];

  return (
    <article
      data-opportunity-id={opportunity.id}
      className="border-t py-5 first:border-t-0"
      style={{ borderColor: 'var(--rule-soft, #DAD5C9)' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="mz-h2" style={{ margin: 0, fontSize: 19, lineHeight: 1.3 }}>
          {/* A feed listing is applied to at its source. Pointing it at a
              VitalCV detail page would imply we can carry an application to an
              employer who has never heard of us. */}
          {isFeedListing && sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="no-underline hover:underline"
              style={{ color: 'var(--vt-text-primary)' }}
            >
              {opportunity.title}
            </a>
          ) : (
            <Link
              href={`/explore/${opportunity.id}`}
              className="no-underline hover:underline"
              style={{ color: 'var(--vt-text-primary)' }}
            >
              {opportunity.title}
            </Link>
          )}
        </h3>
        <p className="mz-small" style={{ margin: 0 }}>
          {opportunity.organizationName}
          {opportunity.employerType ? ` · ${opportunity.employerType}` : ''}
        </p>
      </div>

      {facts.length > 0 && (
        <p
          className="mz-mono"
          style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--vt-text-secondary)' }}
        >
          {facts.join('  ·  ')}
        </p>
      )}

      {opportunity.specialty && (
        <p className="mz-small" style={{ margin: '6px 0 0' }}>
          {opportunity.specialty}
        </p>
      )}

      {requirements.length > 0 && (
        <p
          className="mz-small"
          style={{ margin: '8px 0 0', color: 'var(--vt-text-secondary)' }}
        >
          <span style={{ color: 'var(--vt-text-muted)' }}>Employer requires </span>
          {requirements.map((r) => r.label).join(' · ')}
        </p>
      )}

      {/* Readiness — only when the viewer's credentials actually resolved.
          Anonymous readers get the honest prompt instead of a teaser count. */}
      {comparison ? (
        <p
          className="mz-mono"
          style={{
            margin: '10px 0 0',
            fontSize: 12.5,
            color: READINESS_INK[comparison.status] ?? 'var(--vt-text-secondary)',
            borderLeft: `2px solid ${READINESS_INK[comparison.status] ?? 'var(--rule)'}`,
            paddingLeft: 8,
          }}
        >
          <span aria-hidden="true">{READINESS_GLYPH[comparison.status] ?? '○'}</span>{' '}
          {READINESS_LABEL[comparison.status] ?? comparison.status}
          {comparison.status !== 'ready_now' && comparison.shortestPath
            ? ` — ${comparison.shortestPath}`
            : ''}
        </p>
      ) : null}

      {/* Provenance + age. CD-2.2: the source and its age travel with the claim. */}
      {(sourceLabel || updated) && (
        <p
          className="mz-mono"
          style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--vt-text-muted)' }}
        >
          {sourceLabel}
          {sourceLabel && updated ? ' · ' : ''}
          {updated ? `updated ${updated}` : ''}
          {freshness?.isStale ? ' · may be out of date' : ''}
        </p>
      )}

      {/* Says plainly that this one is not an employer we have a relationship
          with, so a reader never assumes the requirements/readiness machinery
          applies to it. */}
      {isFeedListing && (
        <p className="mz-small" style={{ margin: '6px 0 0', color: 'var(--vt-text-muted)' }}>
          Copied from a public job feed. This employer has not published
          requirements to VitalCV — apply at the original posting.
        </p>
      )}
    </article>
  );
}

export default BoardResultRow;
