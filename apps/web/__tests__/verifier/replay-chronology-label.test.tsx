/**
 * ReplayChronologyPanel status-label truth contract.
 *
 * CLAUDE.md bans the bare word "Verified" as a status label. The panel's
 * verified lane state must render with the ProvenanceStrip vocabulary
 * ('SOURCE-BACKED'), never as bare 'VERIFIED'. The banned-verified-label
 * sweep only catches the exact-case literal 'Verified', so this pins the
 * all-caps render site directly.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReplayChronologyPanel } from '../../components/verifier/ReplayChronologyPanel';

describe('ReplayChronologyPanel status labels', () => {
  it('renders verified lanes as SOURCE-BACKED, never the bare VERIFIED label', () => {
    const html = renderToStaticMarkup(
      <ReplayChronologyPanel
        lanes={[
          {
            laneId: 'NPPES_API',
            status: 'verified',
            checkedAt: Date.UTC(2026, 5, 30, 12, 0, 0),
            source: 'https://npiregistry.cms.hhs.gov',
            receiptId: 'rcpt-12345678',
          },
        ]}
      />,
    );

    expect(html).toContain('SOURCE-BACKED');
    expect(html).not.toMatch(/·\s*VERIFIED/);
    expect(html).not.toMatch(/>\s*VERIFIED\s*</);
  });
});
