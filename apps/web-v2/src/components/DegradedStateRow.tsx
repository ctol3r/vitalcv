/**
 * DegradedStateRow — visually distinct renderer for each of the 5
 * mutually-exclusive UI failure modes.
 *
 * Doctrine (inherits #323 design tokens):
 *   - Monochrome. State encoded via glyph + ink density + an
 *     explicit `actionableBy` chip — never via vibrant color.
 *   - `no_adverse_findings` is rendered as a positive (strong ink)
 *     — visually distinguished from the four real failures.
 *   - Each row exposes a `data-degraded-state` attribute matching
 *     the underlying state id, so verifier tooling can inspect the
 *     surface programmatically.
 *
 * Used by result lists where each fact may resolve to a different
 * degraded state per source.
 */

import * as React from 'react';
import { colors, space, type, trustGlyph } from '../lib/design-tokens';
import {
  DEGRADED_STATE_METADATA,
  type ActionableBy,
  type DegradedState,
} from '../lib/degraded-state';

interface Props {
  /** The state to render. */
  readonly state: DegradedState;
  /** Optional context (e.g., source name or fact label). */
  readonly context?: string;
  /** Optional ISO timestamp for "checked at" surfacing. */
  readonly checkedAt?: string | null;
}

const ACTIONABLE_BY_LABEL: Readonly<Record<ActionableBy, string>> = {
  caller: 'Caller can resolve',
  'source-operator': 'External source — wait or escalate to source',
  'vitalcv-ops': 'VitalCV operations',
  'no-action-needed': 'No action — positive result',
};

// Map degraded states to the existing 4-color trust glyph palette.
// no_adverse_findings → ok (strong ink). The 4 failures map to:
//   anonymous_restriction → ambiguous (caller can resolve)
//   source_unreachable    → ambiguous (transient external)
//   infra_outage          → failed (we own it; bad signal)
//   issuer_unavailable    → failed (we own it; bad signal)
const GLYPH_BY_STATE: Readonly<Record<DegradedState, keyof typeof trustGlyph>> = {
  no_adverse_findings: 'ok',
  anonymous_restriction: 'ambiguous',
  source_unreachable: 'ambiguous',
  infra_outage: 'failed',
  issuer_unavailable: 'failed',
};

export function DegradedStateRow({ state, context, checkedAt }: Props): React.ReactElement {
  const meta = DEGRADED_STATE_METADATA[state];
  const glyphState = GLYPH_BY_STATE[state];
  const glyph = trustGlyph[glyphState];

  return (
    <div
      data-testid="degraded-state-row"
      data-degraded-state={state}
      data-is-positive={meta.isPositive ? 'true' : 'false'}
      data-actionable-by={meta.actionableBy}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: space['4'],
        alignItems: 'baseline',
        padding: `${space['3']} 0`,
        borderBottom: `1px solid ${colors.surfaceSub}`,
        fontFamily: type.fontSans,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: glyph.color,
          fontFamily: type.fontMono,
          fontSize: '14px',
          width: '14px',
          display: 'inline-block',
        }}
      >
        {glyph.glyph}
      </span>

      <div>
        <div
          style={{
            color: meta.isPositive ? colors.ink : colors.inkSub,
            fontSize: type.sizeSm,
            fontWeight: meta.isPositive ? type.weightMedium : type.weightRegular,
            lineHeight: type.leadingBody,
          }}
        >
          <span data-testid="degraded-state-label">{meta.label}</span>
          {context && (
            <span style={{ color: colors.inkMuted, marginLeft: space['2'] }}>· {context}</span>
          )}
        </div>
        <div
          style={{
            color: colors.inkMuted,
            fontSize: type.sizeXs,
            lineHeight: type.leadingBody,
            marginTop: space['1'],
            maxWidth: '60ch',
          }}
        >
          {meta.meaning}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: space['1'],
        }}
      >
        <span
          data-testid="degraded-state-actionable-by"
          style={{
            fontFamily: type.fontMono,
            fontSize: type.sizeXxs,
            textTransform: 'uppercase',
            letterSpacing: type.trackingMono,
            color: meta.isPositive ? colors.inkSub : colors.inkMuted,
            padding: `${space['1']} ${space['2']}`,
            border: `1px solid ${colors.border}`,
            borderRadius: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {ACTIONABLE_BY_LABEL[meta.actionableBy]}
        </span>
        {checkedAt && (
          <time
            dateTime={checkedAt}
            style={{
              color: colors.inkMuted,
              fontFamily: type.fontMono,
              fontSize: type.sizeXxs,
            }}
          >
            {checkedAt}
          </time>
        )}
      </div>
    </div>
  );
}
