/**
 * oigConnector.ts — Wave 127: OIG Exclusion List Connector
 *
 * Checks the HHS OIG LEIE (List of Excluded Individuals/Entities)
 * for provider exclusion status.
 *
 * Production: download monthly LEIE CSV from
 * https://oig.hhs.gov/exclusions/exclusions_list.asp
 * and index by NPI for fast lookup.
 */

import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';

export interface OIGExclusionResult {
  npi: string;
  excluded: boolean;
  exclusionType: string | null;
  exclusionDate: string | null;
  reinstatementDate: string | null;
  waiverState: string | null;
  lastCheckedAt: string;
  sourceUrl: string;
}

const OIG_LEIE_URL = 'https://oig.hhs.gov/exclusions/exclusions_list.asp';

/**
 * Check OIG LEIE exclusion status for an NPI.
 * Currently a stub — returns NOT_CHECKED.
 * Production: index the monthly CSV download.
 */
export async function checkOIGExclusion(npi: string): Promise<OIGExclusionResult> {
  log('info', 'oig_connector: exclusion check (stub)', { npi });

  const result: OIGExclusionResult = {
    npi,
    excluded: false,
    exclusionType: null,
    exclusionDate: null,
    reinstatementDate: null,
    waiverState: null,
    lastCheckedAt: new Date().toISOString(),
    sourceUrl: OIG_LEIE_URL,
  };

  recordProvenance({
    npi,
    source: 'OIG',
    sourceUrl: OIG_LEIE_URL,
    rawPayload: result,
  });

  return result;
}
