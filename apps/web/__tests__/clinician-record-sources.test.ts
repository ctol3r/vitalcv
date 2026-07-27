/**
 * clinician-record-sources.test.ts — the anti-drift gate.
 *
 * `apps/web/lib/clinician-record/sources.ts` mirrors a few fields from
 * `apps/api/backend/src/services/identity/sourceCatalog.ts` because apps/web
 * cannot import from apps/api/backend.
 *
 * Mirrors rot. Lane truth has already been through a version of this failure,
 * where several copies of the same fact existed and a public surface served
 * the stale one. This test parses the backend catalog as text and fails the
 * build if the web mirror drifts from it.
 *
 * If this test fails: the catalog is the origin of truth. Fix the mirror,
 * not the catalog, unless you genuinely intended to change the source policy.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLINICIAN_RECORD_SOURCES,
  NPPES_SOURCE,
  CMS_CLINICIANS_SOURCE,
} from '@/lib/clinician-record/sources';

const CATALOG_PATH = join(
  process.cwd(),
  '../../apps/api/backend/src/services/identity/sourceCatalog.ts',
);

/**
 * Pull one source's block out of the catalog and read a numeric/boolean field.
 * Deliberately text-based: importing the catalog would drag the backend's
 * module graph into the web test run.
 */
function readCatalogEntry(sourceId: string): {
  tier: string;
  refreshSlaHours: number;
  decisionGrade: boolean;
} {
  const src = readFileSync(CATALOG_PATH, 'utf8');
  const idIdx = src.indexOf(`id: '${sourceId}'`);
  if (idIdx === -1) {
    throw new Error(`Source ${sourceId} not found in the backend catalog`);
  }

  // The entry runs from its id to the start of the next entry.
  const nextIdx = src.indexOf("id: '", idIdx + 10);
  const block = src.slice(idIdx, nextIdx === -1 ? src.length : nextIdx);

  const tier = /tier:\s*'([A-Z]+)'/.exec(block)?.[1];
  const sla = /refreshSlaHours:\s*(\d+)/.exec(block)?.[1];
  const dg = /decisionGrade:\s*(true|false)/.exec(block)?.[1];

  if (!tier || !sla || !dg) {
    throw new Error(
      `Could not parse catalog entry for ${sourceId} — the catalog format changed, so this guard is no longer reading what it thinks it is.`,
    );
  }

  return {
    tier,
    refreshSlaHours: Number(sla),
    decisionGrade: dg === 'true',
  };
}

describe('clinician-record source mirror', () => {
  it('matches the backend catalog for NPPES', () => {
    const catalog = readCatalogEntry('NPPES_API');
    expect(NPPES_SOURCE.tier).toBe(catalog.tier);
    expect(NPPES_SOURCE.freshnessWindowHours).toBe(catalog.refreshSlaHours);
    expect(NPPES_SOURCE.decisionGrade).toBe(catalog.decisionGrade);
  });

  it('matches the backend catalog for CMS Doctors & Clinicians', () => {
    const catalog = readCatalogEntry('DOCTORS_CLINICIANS');
    expect(CMS_CLINICIANS_SOURCE.tier).toBe(catalog.tier);
    expect(CMS_CLINICIANS_SOURCE.freshnessWindowHours).toBe(catalog.refreshSlaHours);
    expect(CMS_CLINICIANS_SOURCE.decisionGrade).toBe(catalog.decisionGrade);
  });

  it('keeps CMS Doctors & Clinicians out of decision grade', () => {
    // The catalog rules this enrichment-only. If it ever flips true here
    // without the catalog agreeing, an enrollment listing starts gating
    // readiness -- and enrollment is not licensure.
    expect(CMS_CLINICIANS_SOURCE.decisionGrade).toBe(false);
  });

  it('only mirrors sources that exist in the catalog', () => {
    const src = readFileSync(CATALOG_PATH, 'utf8');
    for (const source of Object.values(CLINICIAN_RECORD_SOURCES)) {
      // VITALCV_DERIVED is ours, not a federal source, so it is exempt.
      if (source.id === 'VITALCV_DERIVED') continue;
      expect(
        src.includes(`id: '${source.id}'`),
        `${source.id} is cited by the clinician record but absent from the source catalog`,
      ).toBe(true);
    }
  });

  it('never lets NPPES claim more than self-report', () => {
    // The single most important line in the mirror. CMS is an authoritative
    // publisher of what providers filed — it is not a checker of it. If this
    // ever flips to source_confirmed, every NPPES field on every surface
    // silently starts reading as verified.
    expect(NPPES_SOURCE.maxConfirmation).toBe('registry_self_report');
  });

  it('states the limits of each source in reader-facing terms', () => {
    for (const source of Object.values(CLINICIAN_RECORD_SOURCES)) {
      expect(source.note.length).toBeGreaterThan(40);
    }
    expect(NPPES_SOURCE.note).toMatch(/does not check|not check/i);
  });

  it('cites no source that has no reading behind it', () => {
    // Federal connectors get added here only when they actually run. An
    // entry with no connector would render as coverage we do not have.
    expect(Object.keys(CLINICIAN_RECORD_SOURCES).sort()).toEqual([
      'DOCTORS_CLINICIANS',
      'NPPES_API',
      'VITALCV_DERIVED',
    ]);
  });
});
