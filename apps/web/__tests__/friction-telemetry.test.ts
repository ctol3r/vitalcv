/**
 * MF-WAVE-01 — friction telemetry definitions + pure recorder.
 *
 * Pins the no-PII, stage-only discipline the module inherits from the funnel:
 * a pinned property allowlist, number-or-null values only (no string channel
 * to smuggle an NPI, a name, or credential detail through), unknown staying
 * null rather than becoming zero, and time coming only from the injected
 * clock. Also pins that this wave ships NO emitter: the module must not
 * import posthog-js and must not be a client module.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  FRICTION_PROPERTY_ALLOWLIST,
  FRICTION_STAGES,
  createFrictionRecorder,
} from '@/lib/analytics/frictionTelemetry';

const moduleSource = readFileSync(
  path.join(__dirname, '..', 'lib', 'analytics', 'frictionTelemetry.ts'),
  'utf8',
);

describe('friction telemetry definitions', () => {
  it('pins the property allowlist exactly — widening it is a reviewed decision', () => {
    expect([...FRICTION_PROPERTY_ALLOWLIST]).toEqual([
      'move_index',
      'clinician_actions',
      'sensitive_attributes_collected',
      'documents_requested',
      'disclosed_attributes',
      'source_queries',
      'human_reviews',
      'fields_not_reentered',
      'evidence_not_recollected',
      'source_queries_avoided',
      'documents_not_reuploaded',
      'time_delta_ms',
    ]);
    // No key can carry an identity: nothing NPI-, name-, or credential-shaped.
    for (const key of FRICTION_PROPERTY_ALLOWLIST) {
      expect(key).not.toMatch(/npi|name|credential|license_number/i);
    }
  });

  it('ships no emitter in this wave: no posthog import, not a client module', () => {
    // This asserts an ABSENCE — the closure "MF-WAVE-01 adds definitions and
    // a pure recorder only" — which no runtime behavior can witness. Matches
    // import/require forms only, so the module's own comments (which name
    // posthog to explain the discipline) cannot trip it.
    expect(moduleSource).not.toMatch(/from\s+['"]posthog|require\(\s*['"]posthog|import\s*\(\s*['"]posthog/);
    expect(moduleSource).not.toContain("'use client'");
  });
});

describe('friction recorder (pure)', () => {
  const fixedClock = (values: number[]) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)]!;
  };

  it('rejects properties outside the pinned allowlist', () => {
    const recorder = createFrictionRecorder({ moveIndex: 1, now: () => 0 });
    expect(() =>
      recorder.record(FRICTION_STAGES.QUESTION_PRESENTED, {
        // @ts-expect-error — the key is intentionally not allowlisted
        npi_value: 1234567890,
      }),
    ).toThrowError(/pinned allowlist/);
  });

  it('rejects non-numeric values — there is no string channel for PII', () => {
    const recorder = createFrictionRecorder({ moveIndex: 1, now: () => 0 });
    expect(() =>
      recorder.record(FRICTION_STAGES.QUESTION_PRESENTED, {
        // @ts-expect-error — string values are intentionally untypable
        clinician_actions: 'Dr. Synthetic',
      }),
    ).toThrowError(/finite number or null/);
    expect(() =>
      recorder.record(FRICTION_STAGES.QUESTION_PRESENTED, {
        clinician_actions: Number.NaN,
      }),
    ).toThrowError(/finite number or null/);
  });

  it('unknown stays null and is never imputed to zero; measured zero stays zero', () => {
    const recorder = createFrictionRecorder({ moveIndex: 2, now: () => 0 });
    recorder.record(FRICTION_STAGES.MOVE_STARTED, {
      sensitive_attributes_collected: 0,
    });
    const measurement = recorder.measure();
    // Measured zero is a real measurement…
    expect(measurement.sensitive_attributes_collected).toBe(0);
    // …while never-recorded dimensions stay honestly null.
    expect(measurement.fields_not_reentered).toBeNull();
    expect(measurement.documents_not_reuploaded).toBeNull();
    expect(measurement.time_delta_ms).toBeNull();
    expect(measurement.move_index).toBe(2);
  });

  it('derives time only from the injected clock', () => {
    const recorder = createFrictionRecorder({
      moveIndex: 1,
      now: fixedClock([1000, 5500]),
    });
    recorder.record(FRICTION_STAGES.MOVE_STARTED);
    recorder.record(FRICTION_STAGES.MOVE_COMPLETED);
    expect(recorder.measure().time_delta_ms).toBe(4500);
  });

  it('keeps the recorded event stream intact and in order', () => {
    const recorder = createFrictionRecorder({ moveIndex: 1, now: () => 7 });
    recorder.record(FRICTION_STAGES.QUESTION_SUPPRESSED);
    recorder.record(FRICTION_STAGES.QUESTION_PRESENTED, { clinician_actions: 1 });
    const events = recorder.events();
    expect(events.map((e) => e.stage)).toEqual([
      FRICTION_STAGES.QUESTION_SUPPRESSED,
      FRICTION_STAGES.QUESTION_PRESENTED,
    ]);
    expect(events[1]!.properties.clinician_actions).toBe(1);
  });
});
