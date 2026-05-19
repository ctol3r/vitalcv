/**
 * VitalCV · Trust Surfaces · Demo fixtures v1
 *
 * Every export from this file is FIXTURE DATA. None of it represents
 * a real credentialing decision, a real clinician, a real customer,
 * or a real cryptographic signature.
 *
 * The full list of items this file MUST NOT emit as factual product
 * copy is enumerated in CLAUDE.md and in the corresponding wave brief
 * (named customer artifacts, cohort sizes, ed25519 fingerprints, key
 * fingerprints from any live registry, security certifications,
 * deletion-receipt claims, SLA claims, BAA-not-required claims, and
 * bare status labels).
 *
 * Every component that consumes a fixture in this file must render
 * the `DEMO_BANNER` near the surface and use the `DESIGN_FIXTURE_SIGNER`
 * label ("design fixture" / "demo signer fixture") for any signer
 * field. The `t-stamp[data-state="preview"]` CSS already makes this
 * visually obvious.
 */

import { lineageWhen } from './format';
import type {
  DegradedRowEntry,
  DemoFixtureMeta,
  FailureModeDescriptor,
  Lineage,
  ReceiptArtifact,
  SignerFixture,
} from './types';

/** Banner copy required on every trust-surface route. */
export const DEMO_BANNER =
  'Demo data — not a real credentialing decision.';

/** Single signer fixture used across receipt/replay/trust pages. */
export const DESIGN_FIXTURE_SIGNER: SignerFixture = {
  label: 'design fixture',
  displayName: 'VitalCV Design Fixture · Signer A',
  fingerprintFixture: 'fixture:demo-signer-a-not-a-real-key',
};

/** Standard demo meta shared across fixtures. */
export const DEMO_META: DemoFixtureMeta = {
  banner: DEMO_BANNER,
  source: 'demo-fixture',
};

/**
 * Stable base time so the fixtures don't drift turn-to-turn in tests.
 * Real surfaces should pass `new Date()` instead.
 */
const BASE_NOW = new Date('2026-05-18T14:00:00.000Z');

function makeLineageBase(
  overrides: Partial<Lineage> = {},
  checkedAtOffsetSec = 90,
): Lineage {
  const checkedAt = new Date(BASE_NOW.getTime() - checkedAtOffsetSec * 1000);
  const when = lineageWhen(checkedAt, BASE_NOW);
  return {
    state: 'preview',
    object: 'Demo passport · MACIE MILLER, PA-C (DEMO)',
    objectSub: 'NPI 1346053246 (demo persona — not a real provider)',
    ownership: 'subject',
    checkedAtIso: when.checkedAtIso,
    checkedAgo: when.checkedAgo,
    channel: 'preview.local.demo',
    replay: 'pending',
    runId: 'run_v1_demo-7a2cb8d3',
    ...overrides,
  };
}

/** Fixture for /passport/[npi]. */
export function passportFixture(npi: string): Lineage {
  return makeLineageBase({
    object: 'Demo passport · MACIE MILLER, PA-C (DEMO)',
    objectSub: `NPI ${npi} (demo persona — not a real provider)`,
    ownership: 'subject',
    channel: 'preview.local.demo',
    replay: 'pending',
  });
}

/** Fixture for /verify/[receipt] — the verifier reading mode. */
export function verifyFixture(receipt: string): Lineage {
  return makeLineageBase(
    {
      state: 'snapshot',
      object: 'Demo readiness packet · MACIE MILLER, PA-C (DEMO)',
      objectSub: `receipt ${receipt} (fixture — not a live receipt)`,
      ownership: 'delegated',
      channel: 'verify.local.demo',
      replay: 'anchored',
      runId: 'run_v1_demo-verifier-5fa1c0',
    },
    60 * 7,
  );
}

/** Fixture for /receipt/[id] — the signed receipt artifact. */
export function receiptFixture(id: string): ReceiptArtifact {
  const lineage = makeLineageBase(
    {
      state: 'signed',
      object: 'Demo signed receipt · readiness packet (DEMO)',
      objectSub: `receipt ${id} (signed fixture — not a real artifact)`,
      ownership: 'delegated',
      channel: 'receipt.local.demo',
      replay: 'anchored',
      runId: 'run_v1_demo-receipt-91c3a4',
    },
    60 * 22,
  );
  return {
    id,
    lineage,
    signer: DESIGN_FIXTURE_SIGNER,
    chain: [
      'rcpt_demo_001',
      'rcpt_demo_002',
      'rcpt_demo_003',
      id,
    ],
    demoMeta: DEMO_META,
  };
}

/** Fixture for /replay — chronological chain visualisation. */
export function replayFixture(): ReadonlyArray<ReceiptArtifact> {
  return [
    receiptFixture('rcpt_demo_001'),
    receiptFixture('rcpt_demo_002'),
    receiptFixture('rcpt_demo_003'),
    receiptFixture('rcpt_demo_004'),
  ];
}

/** Fixture for /trust — the visual register. */
export function trustRegisterFixture(): {
  preview: Lineage;
  snapshot: Lineage;
  signed: Lineage;
} {
  return {
    preview: makeLineageBase(
      { state: 'preview', ownership: 'unbound', channel: 'preview.local.demo' },
      30,
    ),
    snapshot: makeLineageBase(
      { state: 'snapshot', ownership: 'delegated', channel: 'snapshot.local.demo', replay: 'pending' },
      60 * 4,
    ),
    signed: makeLineageBase(
      { state: 'signed', ownership: 'delegated', channel: 'signed.local.demo', replay: 'anchored' },
      60 * 18,
    ),
  };
}

/** Failure modes A–E from the canon. Rendered by /trust. */
export const FAILURE_MODES: ReadonlyArray<FailureModeDescriptor> = [
  {
    mode: 'A',
    title: 'Ambiguous ownership',
    copy:
      'Surface rendered without an explicit ownership state (subject / delegated / unbound). The reader cannot tell who asserted what.',
    refusalCopy: 'Refuse to render. Require ownership to be set before paint.',
  },
  {
    mode: 'B',
    title: 'Stale lineage',
    copy:
      'checked_at is older than the surface\'s freshness budget. Reader may treat the assertion as current when it is not.',
    refusalCopy: 'Mark the row degraded (dashed border). Do not render as success.',
  },
  {
    mode: 'C',
    title: 'Channel mismatch',
    copy:
      'The assertion was made on a channel different from the one the reader is reading on. Continuity is broken.',
    refusalCopy: 'Refuse to merge channels. Display the disagreement explicitly.',
  },
  {
    mode: 'D',
    title: 'Replay disagreement',
    copy:
      'Replay state contradicts the surface state (e.g. signed surface paired with unanchored replay).',
    refusalCopy: 'Refuse to upgrade the surface state. Surface follows the weakest of (state, replay).',
  },
  {
    mode: 'E',
    title: 'Run-id collision',
    copy:
      'Two assertions share a run_id but reach different conclusions. Hash discipline is broken.',
    refusalCopy: 'Quarantine the run. Do not render either assertion until reconciled.',
  },
] as const;

/** Degraded rows shown on /passport and /trust. */
export const DEGRADED_ROWS: ReadonlyArray<DegradedRowEntry> = [
  {
    reason: 'stale',
    laneLabel: 'NPPES (demo)',
    hint: 'Refresh source probe. If stale persists, route to operator review before relying on this lane.',
  },
  {
    reason: 'access_required',
    laneLabel: 'State Board · CA (demo)',
    hint: 'Operator credentials required to query this source. Provision access or route the candidate to manual review.',
  },
  {
    reason: 'review_required',
    laneLabel: 'OIG LEIE (demo)',
    hint: 'Lane signal is ambiguous. Route to operator review before treating it as decision-grade.',
  },
  {
    reason: 'gated',
    laneLabel: 'PECOS (demo)',
    hint: 'Institutional access required. Confirm source agreement or mark lane as access-required before review.',
  },
  {
    reason: 'unavailable',
    laneLabel: 'DEA · current (demo)',
    hint: 'Source unavailable. Do not treat this lane as decision-grade until a fresh check succeeds.',
  },
] as const;
