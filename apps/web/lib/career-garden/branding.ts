/**
 * Workbench naming — the copy flag for CC-04 / WB-01.
 *
 * The founder decision (2026-08-08, recorded in the Experience Constitution
 * EC-24 and docs/architecture/workbench-baseline.md) renames the
 * customer-facing product from "Career Garden" to "VitalCV Workbench".
 * This module is the single place that decision lives:
 *
 *  - Customer-facing strings and page metadata read from these exports.
 *  - Routes (/holder/garden), the `career-garden` technical namespace, API
 *    paths (/api/profile/garden/*), and database tables are deliberately
 *    unchanged — compatibility until a controlled migration wave.
 *  - Flipping WORKBENCH_NAMING_ROLLOUT to false restores the Garden name
 *    everywhere without touching any other file.
 *
 * "Workbench" also names the ops-facing investigation workbench
 * (app/api/investigation/workbench). That surface is never reachable from
 * clinician navigation; the two names must never appear in one nav.
 */

export const WORKBENCH_NAMING_ROLLOUT = true;

interface ProductNaming {
  /** Full product name for first mentions and the workspace eyebrow. */
  productName: string;
  /** Short name for nav items and running copy. */
  shortName: string;
  /** aria-label for the section navigation. */
  sectionsNavLabel: string;
  /** Breadcrumb ownership label ("<name> · private"). */
  breadcrumbLabel: string;
  /** Subject noun for storage-unavailable notices. */
  storageName: string;
  /** Base document title. */
  titleBase: string;
}

const WORKBENCH: ProductNaming = {
  productName: 'VitalCV Workbench',
  shortName: 'Workbench',
  sectionsNavLabel: 'Workbench sections',
  breadcrumbLabel: 'Workbench · private',
  storageName: 'Workbench storage',
  titleBase: 'Workbench · VitalCV',
};

const GARDEN: ProductNaming = {
  productName: 'Career Garden',
  shortName: 'Garden',
  sectionsNavLabel: 'Career Garden sections',
  breadcrumbLabel: 'Garden · private',
  storageName: 'Garden storage',
  titleBase: 'Career Garden · VitalCV',
};

export const WORKBENCH_BRANDING: ProductNaming = WORKBENCH_NAMING_ROLLOUT ? WORKBENCH : GARDEN;

/** Document title for a workspace section page. */
export function workbenchSectionTitle(section: string): string {
  return `${section} · ${WORKBENCH_BRANDING.titleBase}`;
}
