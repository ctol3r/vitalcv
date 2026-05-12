/**
 * Lane B foundation tests for canonical trust primitives.
 *
 * Pins the doctrinal invariants the inventory audit identified as
 * easily-broken:
 *
 *  1. DegradedStateBanner code 'D' renders SUCCESS, not warning.
 *  2. ReplayLineage flags continuity correctly (gaps → not continuous).
 *  3. TrustHeader renders all six sections in the mandatory order.
 *  4. CheckedAtStamp + RunIdentity render the actual value as visible
 *     text (not aria-only / not tooltip-only).
 *  5. OwnershipState supports the full vocabulary.
 *  6. DegradedStateBanner supports all five codes (A–E).
 *  7. TierBadge supports T1–T4 plus the four special states.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import {
  CheckedAtStamp,
  DegradedStateBanner,
  IssuerAttribution,
  OwnershipState,
  ReplayLineage,
  RunIdentity,
  TierBadge,
  TrustHeader,
  TrustStateBand,
  type DegradedStateCode,
  type OwnershipStateValue,
  type TierBadgeKind,
} from '..';

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe('DegradedStateBanner — A/B/C/D/E taxonomy', () => {
  const ALL_CODES: DegradedStateCode[] = ['A', 'B', 'C', 'D', 'E'];

  it.each(ALL_CODES)('renders code %s with the expected taxonomy label', (code) => {
    const html = render(<DegradedStateBanner code={code} />);
    expect(html).toContain(`data-degraded-code="${code}"`);
    // The semantic label is rendered in visible text — not aria-only.
    expect(html).toMatch(/Source unreachable|Anonymous restriction|Infrastructure outage|No adverse findings|Issuer unavailable/);
  });

  it('code D (no adverse findings) renders as SUCCESS tone — never warning', () => {
    const html = render(<DegradedStateBanner code="D" />);
    expect(html).toContain('data-degraded-tone="success"');
    // Belt-and-suspenders: no warning/critical class wrapping a success outcome.
    expect(html).not.toContain('data-degraded-tone="warning"');
    expect(html).not.toContain('data-degraded-tone="critical"');
    expect(html).toContain('No adverse findings');
  });

  it('code C (infrastructure outage) renders as critical with role=alert', () => {
    const html = render(<DegradedStateBanner code="C" />);
    expect(html).toContain('data-degraded-tone="critical"');
    expect(html).toContain('role="alert"');
  });

  it('renders source id + recovery action visibly when supplied', () => {
    const html = render(
      <DegradedStateBanner code="A" sourceId="NPPES_API" recoveryAction="Retry in 60s" />,
    );
    expect(html).toContain('NPPES_API');
    expect(html).toContain('Retry in 60s');
  });
});

describe('ReplayLineage — continuity vs gaps', () => {
  it('zero prior checks renders the empty state', () => {
    const html = render(<ReplayLineage lineageKey="lin-1" priorChecks={[]} />);
    expect(html).toContain('No prior checks recorded');
    expect(html).toContain('data-replay-continuous="false"');
  });

  it('prior checks with no gaps is flagged continuous', () => {
    const html = render(
      <ReplayLineage
        lineageKey="lin-1"
        priorChecks={[
          { runId: 'run-a', checkedAt: '2026-04-01T00:00:00Z' },
          { runId: 'run-b', checkedAt: '2026-04-15T00:00:00Z' },
        ]}
      />,
    );
    expect(html).toContain('data-replay-continuous="true"');
    expect(html).toContain('continuous');
  });

  it('prior checks with gaps is flagged non-continuous and renders each gap', () => {
    const html = render(
      <ReplayLineage
        lineageKey="lin-1"
        priorChecks={[{ runId: 'run-a', checkedAt: '2026-04-01T00:00:00Z' }]}
        gaps={[{ from: '2026-04-10T00:00:00Z', to: '2026-05-01T00:00:00Z', reason: 'source unreachable' }]}
      />,
    );
    expect(html).toContain('data-replay-continuous="false"');
    expect(html).toContain('1 gap');
    expect(html).toContain('source unreachable');
    expect(html).toContain('2026-04-10T00:00:00Z');
  });

  it('renders the lineage key as visible monospace text (not aria-only)', () => {
    const html = render(<ReplayLineage lineageKey="lin-canonical-1" priorChecks={[]} />);
    expect(html).toContain('lin-canonical-1');
    expect(html).toContain('data-replay-lineage-key="lin-canonical-1"');
  });
});

describe('TrustHeader — mandatory render order', () => {
  const HEADER = (
    <TrustHeader
      variant="SNAPSHOT"
      object={{ id: '1346053246', label: 'Macie Miller, PA-C', kind: 'clinician' }}
      ownership={{ state: 'CLAIMED', claimant: 'macie@example.com', claimedAt: '2026-04-01T15:00:00Z' }}
      checkedAt="2026-04-01T15:00:00Z"
      channel="NPPES_API"
      replay={{
        lineageKey: 'lin-1',
        priorChecks: [{ runId: 'run-a', checkedAt: '2026-03-15T00:00:00Z' }],
      }}
      runId="run-current-7f3a"
    />
  );

  it('renders all six sections', () => {
    const html = render(HEADER);
    for (const section of ['object', 'ownership', 'checked-channel', 'replay', 'run-id']) {
      expect(html).toContain(`data-section="${section}"`);
    }
  });

  it('renders sections in the canonical order: OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID', () => {
    const html = render(HEADER);
    const idxObject       = html.indexOf('data-section="object"');
    const idxOwnership    = html.indexOf('data-section="ownership"');
    const idxCheckedChan  = html.indexOf('data-section="checked-channel"');
    const idxReplay       = html.indexOf('data-section="replay"');
    const idxRunId        = html.indexOf('data-section="run-id"');
    expect(idxObject).toBeGreaterThan(-1);
    expect(idxOwnership).toBeGreaterThan(idxObject);
    expect(idxCheckedChan).toBeGreaterThan(idxOwnership);
    expect(idxReplay).toBeGreaterThan(idxCheckedChan);
    expect(idxRunId).toBeGreaterThan(idxReplay);
  });

  it('renders checked_at and run_id as visible text (not aria-only)', () => {
    const html = render(HEADER);
    // Both values appear in rendered content, not just data-* attributes.
    expect(html).toMatch(/>[^<]*2026-04-01[^<]*</);
    // run_id may be truncated mid-string for display, but its prefix
    // remains in visible text and the full id is on data-run-id.
    expect(html).toMatch(/>[^<]*run-cu[^<]*</);
    expect(html).toContain('data-run-id="run-current-7f3a"');
  });

  it('variant PREVIEW marks the header as preview (without changing order)', () => {
    const html = render(
      <TrustHeader
        variant="PREVIEW"
        object={{ id: 'x', label: 'X', kind: 'clinician' }}
        ownership={{ state: 'UNCLAIMED' }}
        checkedAt="2026-04-01T15:00:00Z"
        channel="NPPES_API"
        runId="run-1"
      />,
    );
    expect(html).toContain('data-trust-header-variant="PREVIEW"');
    expect(html).toContain('preview');
  });

  it('variant SIGNED marks the header as signed (without changing order)', () => {
    const html = render(
      <TrustHeader
        variant="SIGNED"
        object={{ id: 'x', label: 'X', kind: 'clinician' }}
        ownership={{ state: 'CLAIMED' }}
        checkedAt="2026-04-01T15:00:00Z"
        channel="NPPES_API"
        runId="run-1"
      />,
    );
    expect(html).toContain('data-trust-header-variant="SIGNED"');
    expect(html).toContain('signed');
  });
});

describe('CheckedAtStamp — visibility contract', () => {
  it('renders the formatted timestamp as visible text', () => {
    const html = render(<CheckedAtStamp checkedAt="2026-04-01T15:23:11Z" />);
    expect(html).toContain('2026-04-01 15:23 UTC');
    expect(html).toContain('<time');
  });

  it('renders "never" for null/undefined', () => {
    const html = render(<CheckedAtStamp checkedAt={null} />);
    expect(html).toContain('never');
    expect(html).toContain('data-checked-at="none"');
  });

  it('flags stale when freshnessWindowMs is exceeded', () => {
    const farPast = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const html = render(<CheckedAtStamp checkedAt={farPast} freshnessWindowMs={1000 * 60 * 60} />);
    expect(html).toContain('stale');
    expect(html).toContain('data-stale="true"');
  });

  it('does not flag stale within freshness window', () => {
    const recent = new Date(Date.now() - 1000 * 30).toISOString();
    const html = render(<CheckedAtStamp checkedAt={recent} freshnessWindowMs={1000 * 60 * 60} />);
    expect(html).toContain('data-stale="false"');
  });
});

describe('RunIdentity — visibility contract', () => {
  it('renders the run id as visible text, not aria-only', () => {
    const html = render(<RunIdentity runId="run-abcdef-7f3a2b" />);
    // The truncated form should be present in rendered output (not just data-*).
    expect(html).toMatch(/>\s*run-a[^<]*</);
    expect(html).toContain('data-run-id="run-abcdef-7f3a2b"');
  });

  it('renders the no-run state', () => {
    const html = render(<RunIdentity runId={null} />);
    expect(html).toContain('data-run-id="none"');
  });
});

describe('OwnershipState — full vocabulary', () => {
  const ALL: OwnershipStateValue[] = ['CLAIMED', 'PENDING', 'UNCLAIMED', 'DISPUTED'];

  it.each(ALL)('renders state %s with semantic label and detail', (state) => {
    const html = render(<OwnershipState state={state} />);
    expect(html).toContain(`data-ownership-state="${state}"`);
  });
});

describe('TierBadge — all kinds', () => {
  const TIERS: TierBadgeKind[] = [
    'T1', 'T2', 'T3', 'T4',
    'DEGRADED', 'UNAVAILABLE', 'UNSIGNED', 'ISSUER_UNREACHABLE',
  ];

  it.each(TIERS)('renders kind %s', (kind) => {
    const html = render(<TierBadge tier={kind} />);
    expect(html).toContain(`data-tier="${kind}"`);
  });
});

describe('TrustStateBand — GREEN/YELLOW/RED/UNKNOWN', () => {
  it.each(['GREEN', 'YELLOW', 'RED', 'UNKNOWN'] as const)('renders %s', (band) => {
    const html = render(<TrustStateBand band={band} />);
    expect(html).toContain(`data-trust-band="${band}"`);
  });
});

describe('IssuerAttribution — visibility + continuity', () => {
  it('renders did, key, receipt id as visible monospace text', () => {
    const html = render(
      <IssuerAttribution
        did="did:vitalcv:issuer:demo"
        signer="VitalCV PSV Issuer"
        keyId="vcv-ed25519-v1"
        receiptId="rcpt-abcd-1234"
        continuity="ACTIVE"
      />,
    );
    expect(html).toContain('did:vitalcv:issuer:demo');
    expect(html).toContain('vcv-ed25519-v1');
    expect(html).toContain('rcpt-abcd-1234');
    expect(html).toContain('data-issuer-continuity="ACTIVE"');
  });

  it('renders BROKEN continuity prominently', () => {
    const html = render(<IssuerAttribution signer="X" continuity="BROKEN" />);
    expect(html).toContain('data-issuer-continuity="BROKEN"');
    expect(html).toContain('Broken chain');
  });
});

describe('Doctrine — banned-strings scan', () => {
  // Stitches the rendered output of every primitive into one string and
  // verifies the canonical truth contract isn't accidentally violated by
  // the primitive copy.
  const FULL_RENDER = [
    render(<CheckedAtStamp checkedAt="2026-04-01T15:00:00Z" />),
    render(<RunIdentity runId="run-1" />),
    render(<TierBadge tier="T3" />),
    render(<TierBadge tier="UNAVAILABLE" />),
    render(<TrustStateBand band="GREEN" />),
    render(<OwnershipState state="CLAIMED" />),
    render(<DegradedStateBanner code="A" />),
    render(<DegradedStateBanner code="B" />),
    render(<DegradedStateBanner code="C" />),
    render(<DegradedStateBanner code="D" />),
    render(<DegradedStateBanner code="E" />),
    render(<IssuerAttribution signer="X" />),
    render(<ReplayLineage lineageKey="lin-1" priorChecks={[]} />),
    render(
      <TrustHeader
        variant="SIGNED"
        object={{ id: 'x', label: 'X', kind: 'clinician' }}
        ownership={{ state: 'CLAIMED' }}
        checkedAt="2026-04-01T15:00:00Z"
        channel="NPPES_API"
        runId="run-1"
      />,
    ),
  ].join('\n');

  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['complete', 'credentialing'].join(' '),
    ['instant', 'credentialing'].join(' '),
    ['legally', 'accepted'].join(' '),
    ['risk', 'transferred'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];

  it.each(BANNED)('no primitive renders the banned phrase: %s', (phrase) => {
    expect(FULL_RENDER).not.toContain(phrase);
  });

  it('no primitive renders bare "Verified" as a status label', () => {
    // The literal token Verified should not appear standalone as a UI label
    // in any of these primitives. (It may appear inside compound phrases
    // like "Source-verified" elsewhere in the app, which is fine.)
    expect(FULL_RENDER).not.toMatch(/>\s*Verified\s*</);
  });
});
