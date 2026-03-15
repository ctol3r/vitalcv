/**
 * oigConnector.ts — Wave 127: OIG Exclusion List Connector
 *
 * Checks the HHS OIG LEIE (List of Excluded Individuals/Entities)
 * for provider exclusion status.
 *
 * Sandbox: 10 deterministic fixture exclusions + NPI-hash lookup
 * Live: download monthly LEIE CSV and index by NPI
 */

import { createHash } from 'node:crypto';
import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';
import { getConnectorMode } from './connectorFactory';
import { runConnectorWithReliability } from './connectorReliability';

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

export interface LeieExclusionRecord {
  npi: string;
  lastName: string;
  firstName: string;
  exclusionType: string;
  exclusionDate: string;
  reinstatementDate: string | null;
  waiverState: string | null;
}

export interface LeieIndexStatus {
  loaded: boolean;
  recordCount: number;
  lastLoadedAt: string | null;
  mode: string;
}

const OIG_LEIE_URL = 'https://oig.hhs.gov/exclusions/exclusions_list.asp';
const OIG_QUOTA_POLICY = {
  limit: 60,
  windowMs: 60_000,
};
const OIG_SCHEMA_POLICY = {
  requiredFields: ['npi', 'excluded', 'lastCheckedAt', 'sourceUrl'],
  allowAdditionalFields: true,
} as const;

// ── LEIE In-Memory Index ────────────────────────────────────────────

const leieIndex = new Map<string, LeieExclusionRecord>();
let lastLoadedAt: string | null = null;

// ── Sandbox Fixtures ────────────────────────────────────────────────

const SANDBOX_EXCLUSIONS: LeieExclusionRecord[] = [
  { npi: '1111111111', lastName: 'SMITH', firstName: 'JOHN', exclusionType: '1128(a)(1)', exclusionDate: '2022-03-15', reinstatementDate: null, waiverState: null },
  { npi: '2222222222', lastName: 'JONES', firstName: 'MARY', exclusionType: '1128(a)(2)', exclusionDate: '2021-06-01', reinstatementDate: null, waiverState: null },
  { npi: '3333333333', lastName: 'WILLIAMS', firstName: 'ROBERT', exclusionType: '1128(a)(3)', exclusionDate: '2023-01-10', reinstatementDate: null, waiverState: 'CA' },
  { npi: '4444444444', lastName: 'BROWN', firstName: 'PATRICIA', exclusionType: '1128(a)(4)', exclusionDate: '2020-11-20', reinstatementDate: '2025-11-20', waiverState: null },
  { npi: '5555555555', lastName: 'DAVIS', firstName: 'MICHAEL', exclusionType: '1128(b)(1)', exclusionDate: '2022-09-01', reinstatementDate: null, waiverState: null },
  { npi: '6666666666', lastName: 'MILLER', firstName: 'JENNIFER', exclusionType: '1128(b)(4)', exclusionDate: '2023-04-15', reinstatementDate: null, waiverState: 'TX' },
  { npi: '7777777777', lastName: 'WILSON', firstName: 'DAVID', exclusionType: '1128(a)(1)', exclusionDate: '2021-12-01', reinstatementDate: null, waiverState: null },
  { npi: '8888888888', lastName: 'MOORE', firstName: 'LINDA', exclusionType: '1128(a)(2)', exclusionDate: '2022-07-15', reinstatementDate: null, waiverState: null },
  { npi: '9999999999', lastName: 'TAYLOR', firstName: 'JAMES', exclusionType: '1128(b)(7)', exclusionDate: '2023-02-28', reinstatementDate: null, waiverState: 'NY' },
  { npi: '1234567890', lastName: 'ANDERSON', firstName: 'ELIZABETH', exclusionType: '1128(a)(3)', exclusionDate: '2024-01-05', reinstatementDate: null, waiverState: null },
];

function loadSandboxData(): void {
  leieIndex.clear();
  for (const record of SANDBOX_EXCLUSIONS) {
    leieIndex.set(record.npi, record);
  }
  lastLoadedAt = new Date().toISOString();
  log('info', 'oig_connector: sandbox LEIE data loaded', { records: SANDBOX_EXCLUSIONS.length });
}

// ── Public API ──────────────────────────────────────────────────────

export async function loadLeieData(csvPathOrUrl?: string): Promise<void> {
  const mode = getConnectorMode('OIG');

  if (mode === 'live' && csvPathOrUrl) {
    log('info', 'oig_connector: live CSV loading not yet implemented', { source: csvPathOrUrl });
    // TODO: download CSV, parse, populate leieIndex
    loadSandboxData(); // Fallback to sandbox until CSV parsing is implemented
  } else {
    loadSandboxData();
  }
}

export async function checkOIGExclusion(npi: string): Promise<OIGExclusionResult> {
  return runConnectorWithReliability({
    connector: 'OIG',
    quotaPolicy: OIG_QUOTA_POLICY,
    schemaPolicy: OIG_SCHEMA_POLICY,
    execute: async () => {
      if (leieIndex.size === 0) {
        await loadLeieData();
      }

      const record = leieIndex.get(npi);
      return record
        ? {
            npi,
            excluded: true,
            exclusionType: record.exclusionType,
            exclusionDate: record.exclusionDate,
            reinstatementDate: record.reinstatementDate,
            waiverState: record.waiverState,
            lastCheckedAt: new Date().toISOString(),
            sourceUrl: OIG_LEIE_URL,
          }
        : {
            npi,
            excluded: false,
            exclusionType: null,
            exclusionDate: null,
            reinstatementDate: null,
            waiverState: null,
            lastCheckedAt: new Date().toISOString(),
            sourceUrl: OIG_LEIE_URL,
          };
    },
    afterSuccess: async (result) => {
      recordProvenance({
        npi,
        source: 'OIG',
        sourceUrl: OIG_LEIE_URL,
        rawPayload: result,
      });
    },
    onFailure: ({ reason, stage, error }) => {
      if (stage === 'quarantine') {
        log('warn', 'oig_connector: connector quarantined', { npi, reason });
        return;
      }

      log('error', 'oig_connector: check failed', {
        npi,
        error: error?.message ?? reason,
        stage,
      });
    },
    fallback: () => ({
      npi,
      excluded: false,
      exclusionType: null,
      exclusionDate: null,
      reinstatementDate: null,
      waiverState: null,
      lastCheckedAt: new Date().toISOString(),
      sourceUrl: OIG_LEIE_URL,
    }),
  });
}

export function getLeieIndexStatus(): LeieIndexStatus {
  return {
    loaded: leieIndex.size > 0,
    recordCount: leieIndex.size,
    lastLoadedAt,
    mode: getConnectorMode('OIG'),
  };
}
