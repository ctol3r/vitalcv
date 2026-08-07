/**
 * taxonomy.ts — turning a bare NPPES taxonomy code into something readable.
 *
 * NPPES gives a provider's specialty as a 10-character code (363A00000X) plus
 * a short description. Two things a reader actually wants are absent from the
 * NPPES payload itself and have to come from the reference tables:
 *
 *   - where the specialty sits in the NUCC hierarchy (grouping →
 *     classification → specialization), and what the code formally means
 *   - the CMS Medicare specialty code(s) it maps to
 *
 * Both reference tables are pinned, generated files. See
 * scripts/generate-provider-reference-data.ts.
 */

import {
  lookupTaxonomy,
  NUCC_TAXONOMY_VERSION,
  type NuccTaxonomyEntry,
} from './nucc-taxonomy.generated';
import {
  lookupMedicareSpecialties,
  type MedicareSpecialtyMapping,
} from './medicare-crosswalk.generated';

export type { NuccTaxonomyEntry, MedicareSpecialtyMapping };

/**
 * Wording for the licence number that rides along on an NPPES taxonomy.
 *
 * The `license` field is the number the provider typed when enumerating.
 * NPPES carries no status for it — not active, not expired, not disciplined.
 * Presenting it as a licence *check* would be false; it is a self-reported
 * number and nothing more until a board lane confirms it.
 */
export const TAXONOMY_LICENSE_PROVENANCE_NOTE =
  'Licence numbers shown here are self-reported to CMS during NPI enumeration. NPPES carries no status for them, so this is not a check of whether a licence is current.';

export interface DescribedTaxonomy {
  /** The raw NUCC code, e.g. "363A00000X" */
  code: string;
  /** Description as NPPES supplied it (may differ slightly from NUCC). */
  nppesDescription: string;
  /** True when this is the provider's primary taxonomy. */
  primary: boolean;
  /** Licence number as self-reported to CMS; empty when not supplied. */
  license: string;
  /** State the licence was reported under; empty when not supplied. */
  state: string;
  /** NUCC taxonomy grouping code + label, when NPPES supplied one. */
  taxonomyGroup: string;

  // ── Resolved from the NUCC table (null when the code is unknown) ──────
  nucc: NuccTaxonomyEntry | null;
  /** "Physician Assistants & Advanced Practice Nursing Providers" */
  grouping: string;
  /** "Physician Assistant" */
  classification: string;
  /** "" when the code is not a sub-specialisation */
  specialization: string;
  /** Short human label, preferring the NUCC display name. */
  displayName: string;
  /** Formal NUCC definition; empty when unavailable. */
  definition: string;
  /** "Individual" | "Non-Individual" | "" */
  section: string;

  // ── Resolved from the CMS crosswalk ──────────────────────────────────
  /**
   * Every Medicare specialty this code maps to. Empty when the taxonomy is
   * not Medicare-enrollable — which is normal, not an error.
   */
  medicareSpecialties: readonly MedicareSpecialtyMapping[];
}

export interface TaxonomyInput {
  code: string;
  desc?: string;
  primary?: boolean;
  license?: string;
  state?: string;
  taxonomy_group?: string;
}

/**
 * Resolve one taxonomy against the reference tables.
 *
 * An unknown code degrades rather than throws: the NPPES-supplied description
 * is kept and the NUCC-derived fields stay empty. NPPES occasionally carries
 * codes retired from the current NUCC vintage, and blanking the specialty
 * entirely would be worse than showing what CMS said.
 */
export function describeTaxonomy(input: TaxonomyInput): DescribedTaxonomy {
  const code = (input.code ?? '').trim();
  const nucc = lookupTaxonomy(code);
  const nppesDescription = (input.desc ?? '').trim();

  return {
    code,
    nppesDescription,
    primary: input.primary === true,
    license: (input.license ?? '').trim(),
    state: (input.state ?? '').trim(),
    taxonomyGroup: (input.taxonomy_group ?? '').trim(),

    nucc,
    grouping: nucc?.grouping ?? '',
    classification: nucc?.classification ?? '',
    specialization: nucc?.specialization ?? '',
    displayName: nucc?.displayName || nppesDescription || code,
    definition: nucc?.definition ?? '',
    section: nucc?.section ?? '',

    medicareSpecialties: lookupMedicareSpecialties(code),
  };
}

/**
 * Describe a provider's full taxonomy list, primary first.
 *
 * NPPES does not guarantee the primary taxonomy is first in the array, and
 * some records flag none as primary at all.
 */
export function describeTaxonomies(
  inputs: readonly TaxonomyInput[],
): DescribedTaxonomy[] {
  return inputs
    .map(describeTaxonomy)
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

/**
 * The states a provider self-reported a licence number under.
 *
 * This is the honest answer to "where does this provider say they are
 * licensed?" — distinct from "where are they licensed?", which NPPES cannot
 * answer. A taxonomy row with a state but no licence number is excluded,
 * since a state alone carries no licence claim.
 */
export function selfReportedLicenseStates(
  taxonomies: readonly DescribedTaxonomy[],
): string[] {
  const states = taxonomies
    .filter((t) => t.license.length > 0 && t.state.length > 0)
    .map((t) => t.state.toUpperCase());
  return [...new Set(states)].sort();
}

export const TAXONOMY_REFERENCE_VERSION = NUCC_TAXONOMY_VERSION;
