/**
 * RuntimeChannelFooter — inline render of the current runtime channel.
 *
 * Server component (reads process.env via resolveRuntimeChannel).
 * Drop into a page footer to make the environment unambiguous at a
 * glance. Operators reading the page should never wonder which
 * environment they're looking at.
 *
 * Doctrine:
 *   - Monochrome inline styling (no design-token dep so this PR
 *     stands alone).
 *   - Renders distinctly per channel:
 *       production       → minimal text, no chip
 *       staging          → chip with label
 *       operator_preview → chip with label
 *       local_dev        → chip with label
 *   - The customer-facing 'production' channel is the silent
 *     default — chips only render in pre-release contexts so
 *     production pages don't carry a banner.
 *   - data-runtime-channel attribute for programmatic inspection.
 */

import * as React from 'react';
import {
  RUNTIME_CHANNEL_LABEL,
  isProductionChannel,
  resolveRuntimeChannel,
  type RuntimeChannel,
} from '@/lib/runtime/channel';

interface Props {
  /** Override the resolved channel (used by tests). */
  readonly channel?: RuntimeChannel;
  /** When true, always render the chip — even in production. */
  readonly alwaysRender?: boolean;
}

const PALETTE = {
  inkStrong: '#0a0a0a',
  inkMuted: '#787877',
  border: '#dcdcdb',
  surface: '#ffffff',
} as const;

export function RuntimeChannelFooter({ channel, alwaysRender }: Props): React.ReactElement | null {
  const resolved = channel ?? resolveRuntimeChannel();
  if (isProductionChannel(resolved) && !alwaysRender) {
    return null;
  }
  const label = RUNTIME_CHANNEL_LABEL[resolved];
  return (
    <span
      data-testid="runtime-channel-footer"
      data-runtime-channel={resolved}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.4rem',
        padding: '0.15rem 0.5rem',
        border: `1px solid ${PALETTE.border}`,
        borderRadius: '2px',
        background: PALETTE.surface,
        fontFamily:
          'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: PALETTE.inkMuted,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ color: PALETTE.inkStrong }}>·</span>
      <span data-testid="runtime-channel-footer-label">{label}</span>
    </span>
  );
}
