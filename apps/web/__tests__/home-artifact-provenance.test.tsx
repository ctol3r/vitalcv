import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ILLUSTRATIVE_MODEL } from '@/components/home/film/illustrative';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * Wave 5 / D5 — every artifact on the homepage declares what it is.
 *
 * The page mixes two fundamentally different things: worked examples of how the
 * product behaves, and a ledger reading the real source registry. A reader
 * cannot tell those apart by looking, so each has to say so. The audit:
 *
 *   ILLUSTRATIVE_MODEL     ILLUSTRATIVE  — the worked example the film renders
 *   HomeLaneLedger         LIVE          — reads SOURCE_LANE_OPS
 *   ProofPacketInspector   ILLUSTRATIVE  — self-labels in its header
 *
 * Both directions are defects. An illustration that reads as live invents
 * evidence; a live ledger stamped "illustrative" throws away real evidence the
 * page actually has.
 *
 * `CheckRunArtifact` (an SVG drawing of a lookup, from the deleted
 * `components/home/ask/AskHome`) was removed by the homepage recovery (#1060).
 * The film shows the same idea with the labelled record below instead, and the
 * "is it labelled where the reader can see it" half of that guard now lives in
 * `homepage-truth-contract.test.tsx`.
 */
describe('homepage artifact provenance', () => {
  /**
   * The worked example obeys the two rules that keep it from becoming a claim
   * about a real person (see the header of `components/home/film/illustrative.ts`):
   * no NPI of any kind, and cadences read from the registry rather than typed.
   */
  it('the illustrative record names no NPI and invents no cadence', () => {
    expect(ILLUSTRATIVE_MODEL.npi, 'a well-formed NPI in an illustration is a claim about its holder')
      .not.toMatch(/\d{10}/);

    const registryCadences = new Set(SOURCE_LANE_OPS.map((lane) => lane.cadenceLabel));
    for (const row of ILLUSTRATIVE_MODEL.rows) {
      if (row.cadence === null) continue;
      expect(
        registryCadences.has(row.cadence),
        `${row.id} states a cadence "${row.cadence}" that no real lane declares`,
      ).toBe(true);
    }
  });

  it('the proof-packet inspector labels itself where the reader can see it', () => {
    const html = renderToStaticMarkup(<ProofPacketInspector />);
    // Step 3 does not carry the spine's illustrative flag — it carries its own
    // label instead. That is fine, but only while the label is really there.
    expect(html).toContain('data-proof-illustrative');
    expect(html).toContain('Illustrative — not a live result');
  });

  /**
   * The ledger is the one LIVE artifact among the four. It must keep reading the
   * registry rather than a hardcoded copy — a frozen snapshot would drift from
   * `/api/status` and re-create the stale-lane-truth problem.
   */
  it('the lane ledger reads the real source registry', () => {
    expect(SOURCE_LANE_OPS.length).toBeGreaterThan(0);
    for (const lane of SOURCE_LANE_OPS) {
      expect(lane.laneId, 'a lane must identify itself').toBeTruthy();
      expect(lane.cadenceLabel, `${lane.laneId} must state a cadence`).toBeTruthy();
      expect(lane.lifecycle, `${lane.laneId} must state a lifecycle`).toBeTruthy();
      // The key the public status route joins on — the ledger rows emit it as
      // `data-lane-key`, and the parity contract depends on it.
      expect(lane.statusApiKey, `${lane.laneId} must expose its status key`).toBeTruthy();
    }
  });

  /**
   * A lane that is not connected may not be described as available. This is the
   * ledger's whole job, so it is asserted on the real registry values.
   */
  it('never describes an unconnected lane as available', () => {
    for (const lane of SOURCE_LANE_OPS) {
      if (lane.lifecycle === 'planned' || lane.lifecycle === 'off') {
        expect(
          lane.cadenceLabel.toLowerCase(),
          `${lane.laneId} is ${lane.lifecycle} but its cadence reads as live`,
        ).not.toMatch(/per request|live/);
      }
    }
  });
});
