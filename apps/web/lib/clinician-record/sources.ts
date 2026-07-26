/**
 * sources.ts — the source descriptors the clinician record renders against.
 *
 * ORIGIN OF TRUTH
 * ---------------
 * `apps/api/backend/src/services/identity/sourceCatalog.ts` is the origin for
 * every source's tier, refresh SLA and decision-grade eligibility. This file
 * is a deliberately tiny web-side mirror of the handful of fields the render
 * layer needs, because `apps/web` cannot import from `apps/api/backend`.
 *
 * A mirror is a liability: lane truth has previously drifted into several
 * copies, with a public surface quietly serving the stale one. So this mirror
 * is pinned against the catalog by `clinician-record-sources.test.ts`, which
 * parses the backend catalog and fails if any value here drifts. If the two
 * ever disagree, THE CATALOG WINS and this file is the thing to fix.
 *
 * Do not add a source here that is not in the catalog.
 */

/**
 * How a value came to be, which is the difference between "CMS stores this"
 * and "someone checked this". Rendering must never blur the two.
 */
export type Confirmation =
  /**
   * The provider told a registry, and the registry stored it verbatim.
   * All of NPPES is this. CMS does not check names, credentials, licence
   * numbers or addresses against any authority before publishing them.
   */
  | 'registry_self_report'
  /** An authority actively asserted this about the provider. */
  | 'source_confirmed'
  /** Computed by VitalCV from other fields on this record. */
  | 'derived'
  /** Entered by the clinician into VitalCV. */
  | 'user_attested';

export interface SourceDescriptor {
  /** Matches `SourceDefinition.id` in the backend catalog. */
  id: string;
  label: string;
  url: string | null;
  /** GOLD | SILVER | BRONZE, per the catalog. */
  tier: 'GOLD' | 'SILVER' | 'BRONZE';
  /** Catalog `refreshSlaHours` — how long before a reading goes stale. */
  freshnessWindowHours: number;
  /**
   * Catalog `decisionGrade`. False means enrichment only: the value may be
   * shown, but must never drive a readiness or employer decision.
   */
  decisionGrade: boolean;
  /**
   * The strongest confirmation this source can produce. NPPES tops out at
   * self-report no matter how authoritative CMS is as a publisher — the
   * registry republishes what the provider submitted.
   */
  maxConfirmation: Confirmation;
  /**
   * One sentence a reader can act on, stating what the source does and does
   * not establish. Rendered next to the data, not buried in a footnote.
   */
  note: string;
}

export const NPPES_SOURCE: SourceDescriptor = {
  id: 'NPPES_API',
  label: 'CMS NPI Registry (NPPES)',
  url: 'https://npiregistry.cms.hhs.gov/',
  tier: 'GOLD',
  freshnessWindowHours: 168,
  decisionGrade: true,
  maxConfirmation: 'registry_self_report',
  note: 'NPPES republishes what the provider submitted to CMS. CMS does not check these details against a licensing board, so this establishes what was filed, not that it is accurate.',
};

export const VITALCV_DERIVED_SOURCE: SourceDescriptor = {
  id: 'VITALCV_DERIVED',
  label: 'Derived by VitalCV',
  url: null,
  tier: 'BRONZE',
  freshnessWindowHours: 168,
  decisionGrade: false,
  maxConfirmation: 'derived',
  note: 'Computed from the record above using published federal reference tables. Carries no more authority than the fields it was computed from.',
};

/**
 * Every source the clinician record can currently cite.
 *
 * Federal connectors (PECOS, OIG LEIE, CMS Doctors & Clinicians) land here as
 * they are wired. Until a connector actually runs, its source must NOT appear
 * — an entry here with no reading behind it would render as coverage we do
 * not have.
 */
export const CLINICIAN_RECORD_SOURCES: Readonly<Record<string, SourceDescriptor>> =
  Object.freeze({
    [NPPES_SOURCE.id]: NPPES_SOURCE,
    [VITALCV_DERIVED_SOURCE.id]: VITALCV_DERIVED_SOURCE,
  });
