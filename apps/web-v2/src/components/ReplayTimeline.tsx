/**
 * ReplayTimeline — append-only event trace visualization.
 *
 * Renders a vertical timeline of ingest events (matching the
 * ReplayLineage shape from #312 / #313). Doctrine:
 *   - Timeline-first, top-to-bottom, oldest at top.
 *   - Append-only visual semantics — no event re-ordering, no
 *     visual "edit" affordance.
 *   - Monochrome ink + glyph encoding; no color hue.
 *   - One-line-per-event default; expanded detail is opt-in.
 */

import * as React from 'react';
import { colors, space, type, trustGlyph } from '../lib/design-tokens';

export interface TimelineEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly observedAt: string;
  readonly sourceId: string | null;
}

export interface ReplayTimelineProps {
  readonly events: readonly TimelineEvent[];
  /** Optional digest of the event sequence (shown in the header). */
  readonly digest: string | null;
  /** Whether the lineage covers every claimed source. */
  readonly comprehensive: boolean;
}

function eventGlyph(type: string): { glyph: string; tone: 'ok' | 'ambiguous' } {
  // source_complete, claim_update, passport_ready, done → ok
  // source_start, error, anything_else → ambiguous (mid-flight or unknown)
  if (/_complete$/.test(type) || type === 'passport_ready' || type === 'done') {
    return { glyph: '■', tone: 'ok' };
  }
  return { glyph: '◐', tone: 'ambiguous' };
}

export function ReplayTimeline(props: ReplayTimelineProps): React.ReactElement {
  return (
    <section
      data-testid="replay-timeline"
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        padding: space['5'],
        fontFamily: type.fontSans,
      }}
    >
      <header style={{ marginBottom: space['4'] }}>
        <h2
          style={{
            fontFamily: type.fontSans,
            fontSize: type.sizeLg,
            fontWeight: type.weightSemibold,
            letterSpacing: type.trackingTight,
            margin: 0,
            color: colors.ink,
          }}
        >
          Replay lineage
        </h2>
        <div style={{ marginTop: space['2'], color: colors.inkMuted, fontSize: type.sizeXs }}>
          <span
            style={{
              fontFamily: type.fontMono,
              textTransform: 'uppercase',
              letterSpacing: type.trackingMono,
            }}
          >
            Digest
          </span>{' '}
          <span style={{ fontFamily: type.fontMono, color: colors.ink, fontSize: type.sizeSm }}>
            {props.digest ? props.digest.slice(0, 16) + '…' : '—'}
          </span>
          <span style={{ margin: `0 ${space['3']}` }}>·</span>
          <span style={{ color: props.comprehensive ? colors.stateOk : colors.stateAmbiguous }}>
            {props.comprehensive ? 'Comprehensive coverage' : 'Partial coverage'}
          </span>
        </div>
      </header>

      {props.events.length === 0 ? (
        <p
          style={{
            color: colors.inkMuted,
            fontSize: type.sizeSm,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          No events recorded. Lineage is empty — verifiers should treat this passport as
          unattributable until an ingest run completes.
        </p>
      ) : (
        <ol
          data-testid="timeline-list"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            borderLeft: `1px solid ${colors.border}`,
            paddingLeft: space['5'],
          }}
        >
          {props.events.map((e, i) => {
            const g = eventGlyph(e.eventType);
            const tone = trustGlyph[g.tone];
            return (
              <li
                key={e.eventId}
                data-testid="timeline-event"
                data-event-type={e.eventType}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: space['4'],
                  alignItems: 'baseline',
                  padding: `${space['2']} 0`,
                  borderBottom:
                    i < props.events.length - 1 ? `1px solid ${colors.surfaceSub}` : 'none',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ color: tone.color, fontFamily: type.fontMono, fontSize: '12px' }}
                >
                  {g.glyph}
                </span>
                <span style={{ color: colors.ink, fontSize: type.sizeSm }}>
                  <span
                    style={{
                      fontFamily: type.fontMono,
                      fontSize: type.sizeXs,
                      textTransform: 'uppercase',
                      letterSpacing: type.trackingMono,
                      color: colors.inkSub,
                      marginRight: space['3'],
                    }}
                  >
                    {e.eventType}
                  </span>
                  {e.sourceId && (
                    <span style={{ color: colors.inkMuted, fontFamily: type.fontMono, fontSize: type.sizeXs }}>
                      {e.sourceId}
                    </span>
                  )}
                </span>
                <time
                  dateTime={e.observedAt}
                  style={{
                    color: colors.inkMuted,
                    fontFamily: type.fontMono,
                    fontSize: type.sizeXs,
                  }}
                >
                  {e.observedAt}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
