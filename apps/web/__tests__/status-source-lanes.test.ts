/**
 * status-source-lanes.test.ts — /api/status must report source lanes
 * honestly in BOTH directions: live lanes may not read as pending
 * (understating erodes the trust registry the same way overstating does),
 * and gated lanes may never read as live.
 */

import { describe, expect, test } from 'vitest';
import { GET } from '../app/api/status/route';

describe('GET /api/status source_lanes honesty', () => {
  test('live lanes report active/operational; gated lanes stay pending', async () => {
    const response = await GET();
    const body = await response.json();

    const lanes = body.source_lanes;

    // Live today: NPPES lookups, OIG/LEIE sweep + cache, PECOS snapshot.
    expect(lanes.nppes_identity.lifecycle).toBe('active');
    expect(lanes.nppes_identity.status).toBe('operational');
    expect(lanes.oig_exclusions.lifecycle).toBe('active');
    expect(lanes.oig_exclusions.status).toBe('operational');
    expect(lanes.pecos_enrollment.lifecycle).toBe('active');
    expect(lanes.pecos_enrollment.status).toBe('operational');

    // Genuinely not live: state board (board/FSMB access), employment
    // history (demo only), board certification (unintegrated standalone).
    expect(lanes.state_license.status).toBe('pending_integration');
    expect(lanes.employment_history.lifecycle).toBe('demo_only');
    expect(lanes.board_certification.status).toBe('not_implemented');
  });
});
