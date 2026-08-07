// apps/web/__tests__/connector-matrix.test.tsx
import { describe, it, expect } from 'vitest';

import {
  CONNECTOR_MATRIX_ROWS,
  type ConnectorRow,
} from '../components/status/ConnectorMatrix';

/**
 * The test `ConnectorMatrix.tsx` has cited since it was written.
 *
 * Its header block says its truth-contract guarantees are "enforced by
 * apps/web/__tests__/connector-matrix.test.tsx". That file did not exist. The
 * guarantees were prose, and two of the six rows had gone stale against
 * production without anything noticing — NPPES claimed
 * "temporarily-unavailable" and OIG claimed results "require an authenticated
 * session", when both return data to an anonymous caller.
 *
 * Measured against production on 2026-07-26 (no session, no cookies):
 *
 *   GET /api/identity/bootstrap/1063495429   200, NPPES-derived fields
 *   GET /api/trust-state/1215930367          NPPES_API  checked
 *                                            OIG_LEIE   checked, "clear"
 *                                            PECOS      pending, "not yet checked"
 *   GET /api/trust-state/1063495429          OIG_LEIE   pending,
 *                                            "gated on an active NPPES identity match"
 *
 * The file's own standing rule cuts both ways and is why the corrections were
 * made rather than left alone: "do not say 'not live' about an adapter that
 * runs. Understating is not a safe default — it published a contradiction."
 */

const row = (needle: string): ConnectorRow => {
  const found = CONNECTOR_MATRIX_ROWS.find((r) => r.connector.includes(needle));
  if (!found) throw new Error(`no connector row matching "${needle}"`);
  return found;
};

describe('connector matrix — measured states', () => {
  it('NPPES is source-backed, not temporarily-unavailable', () => {
    const nppes = row('NPPES');
    expect(nppes.state).toBe('source-backed');
    // The corrected premise, pinned: no session is required.
    expect(nppes.observation).toMatch(/no session required/i);
  });

  it('OIG/LEIE is snapshot-only, and does not claim a session is required', () => {
    const oig = row('OIG');
    expect(oig.state).toBe('snapshot-only');
    expect(oig.observation).not.toMatch(/require.{0,20}(authenticated|session)/i);
    // The real precondition, and the reason the chip is not source-backed.
    expect(oig.observation).toMatch(/identity match/i);
    expect(oig.observation).toMatch(/monthly/i);
  });

  it('OIG never presents a clear result as a clearance', () => {
    expect(row('OIG').interpretation).toMatch(/not a clearance/i);
  });

  it('PECOS stays auth-required — deliberately unverified, not upgraded', () => {
    // PECOS reported `pending / not yet checked` on every anonymous probe,
    // including one with an active identity match. There was no evidence to
    // confirm or correct the session claim, so it was left alone. If a later
    // measurement shows PECOS returning anonymously, correct it then — and
    // this assertion is what will make that a deliberate change.
    expect(row('PECOS').state).toBe('auth-required');
  });

  it('genuinely unwired connectors still say so', () => {
    expect(row('FSMB').state).toBe('connector-not-live');
    expect(row('Nursys').state).toBe('connector-not-live');
    expect(row('State Medical Boards').state).toBe('access-required');
  });
});

describe('connector matrix — standing truth contract', () => {
  it('no row claims a connector is live without evidence recorded here', () => {
    // 'source-backed' is the strongest claim the chip can make. Every row
    // making it must be named in this test, so adding one is a deliberate act
    // that requires writing down what was measured.
    const evidenced = new Set(['NPPES (Federal NPI Registry)']);
    const claiming = CONNECTOR_MATRIX_ROWS
      .filter((r) => r.state === 'source-backed')
      .map((r) => r.connector);
    expect(claiming.filter((c) => !evidenced.has(c))).toEqual([]);
  });

  it('every row carries an observation and an operator interpretation', () => {
    for (const r of CONNECTOR_MATRIX_ROWS) {
      expect(r.observation.trim().length, `${r.connector} observation`).toBeGreaterThan(0);
      expect(r.interpretation.trim().length, `${r.connector} interpretation`).toBeGreaterThan(0);
    }
  });

  it('no row uses the bare word "Verified" as a status', () => {
    for (const r of CONNECTOR_MATRIX_ROWS) {
      expect(r.state).not.toBe('Verified');
      expect(r.observation).not.toMatch(/\bautomatically verified\b/i);
    }
  });
});
