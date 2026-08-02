import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CheckRunArtifact } from '@/components/home/ask/AskHome';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * Wave 5 / D5 — every artifact on the homepage declares what it is.
 *
 * The four moments mix two fundamentally different things: drawings of how the
 * product works, and a ledger reading the real source registry. A reader cannot
 * tell those apart by looking, so each has to say so. The audit:
 *
 *   step 1  CheckRunArtifact       ILLUSTRATIVE  — an SVG of a lookup
 *   step 2  HomeLaneLedger         LIVE          — reads SOURCE_LANE_OPS
 *   step 3  ProofPacketInspector   ILLUSTRATIVE  — self-labels in its header
 *   step 4  PacketArtifact         ILLUSTRATIVE  — an SVG of a packet
 *
 * Both directions are defects. An illustration that reads as live invents
 * evidence; a live ledger stamped "illustrative" throws away real evidence the
 * page actually has.
 */
describe('homepage artifact provenance', () => {
  it('the check-run drawing claims no source result', () => {
    const html = renderToStaticMarkup(<CheckRunArtifact />).toLowerCase();
    // It may name the parts of a lookup; it may not report on any of them.
    for (const outcome of ['confirmed', 'verified', 'clear', 'enrolled', 'excluded', 'passed']) {
      expect(html, `"${outcome}" is an outcome an illustration cannot know`).not.toContain(outcome);
    }
    expect(html).not.toMatch(/\d+\s*%/);
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
