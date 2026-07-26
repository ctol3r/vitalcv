/**
 * NPPES API version guard — Wave 0 (god-mode re-baseline, 2026-07-04).
 *
 * CMS sunset the NPPES V1 dissemination files and v1 API on 2026-03-03;
 * the supported surface is API v2.1 + V2 bulk files. Every NPPES endpoint
 * constant this backend fetches from must pin `version=2.1` explicitly.
 * This module asserts that at startup so a drifted constant fails the boot
 * loudly instead of silently degrading NPI enrichment.
 *
 * The check runs against the real constants imported from the adapter
 * modules (not copies), so it cannot drift from what the fetchers use.
 */
import { CMS_NPPES_ENDPOINT } from '../../modules/identity/nppes.service';
import { NPPES_API_URL } from '../../engine/adapters/nppesAdapter';
import { NPPES_ENDPOINT } from '../../../adapters/NppesAdapter';

export const REQUIRED_NPPES_API_VERSION = '2.1';

const VERSION_PARAM = /[?&]version=2\.1(?:&|$)/;

/** Every NPPES endpoint constant the backend fetches from, by owning module. */
export const NPPES_ENDPOINTS: ReadonlyArray<{ owner: string; url: string }> = [
  { owner: 'modules/identity/nppes.service', url: CMS_NPPES_ENDPOINT },
  { owner: 'engine/adapters/nppesAdapter', url: NPPES_API_URL },
  { owner: 'adapters/NppesAdapter', url: NPPES_ENDPOINT },
];

/**
 * Throws when any NPPES endpoint constant is not pinned to API v2.1.
 * Returns the endpoint report for the startup log line.
 */
export function assertNppesApiVersion(): {
  version: string;
  endpoints: string[];
} {
  const offenders = NPPES_ENDPOINTS.filter((e) => !VERSION_PARAM.test(e.url));
  if (offenders.length > 0) {
    throw new Error(
      `NPPES API version assertion failed — endpoint(s) not pinned to v${REQUIRED_NPPES_API_VERSION} ` +
        `(V1 sunset 2026-03-03): ${offenders.map((o) => `${o.owner} -> ${o.url}`).join('; ')}`,
    );
  }
  return {
    version: REQUIRED_NPPES_API_VERSION,
    endpoints: NPPES_ENDPOINTS.map((e) => e.owner),
  };
}
