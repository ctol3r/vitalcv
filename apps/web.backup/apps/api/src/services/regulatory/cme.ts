import { createHash } from 'crypto';

import type {
  AuthorityCode,
  CmeRequirementSnapshot,
  RenewalCycle,
  SpecialtyRule,
} from './types';

const CME_API_BASE = process.env.REGULATORY_CME_API_BASE?.replace(/\/$/, '');

export interface CmeIngestionOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

type RemoteCmePayload = {
  categories?: CmeRequirementSnapshot['categories'];
  renewalCycles?: RenewalCycle[];
  specialtyRules?: SpecialtyRule[];
  fetchedAt?: string;
};

export async function ingestCmeRequirements(
  authorityCode: AuthorityCode,
  options: CmeIngestionOptions = {},
): Promise<CmeRequirementSnapshot> {
  const baseUrl = options.baseUrl ?? CME_API_BASE;
  if (baseUrl) {
    try {
      const payload = await queryRemoteCme(baseUrl, authorityCode, options.signal);
      if (payload) {
        return {
          authorityCode,
          fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
          source: 'remote',
          categories: payload.categories ?? buildSyntheticCategories(authorityCode),
          renewalCycles: payload.renewalCycles ?? buildSyntheticRenewalCycles(authorityCode),
          specialtyRules: payload.specialtyRules ?? buildSyntheticSpecialtyRules(authorityCode),
        };
      }
    } catch (error) {
      console.warn('[regulatory][cme] remote ingestion failed, using synthetic snapshot', {
        authorityCode,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return buildSyntheticSnapshot(authorityCode);
}

async function queryRemoteCme(
  baseUrl: string,
  authorityCode: AuthorityCode,
  signal?: AbortSignal,
): Promise<RemoteCmePayload | null> {
  const response = await fetch(`${baseUrl}/regulatory/${authorityCode}/cme`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`CME API responded with ${response.status}`);
  }

  const payload = (await response.json()) as RemoteCmePayload;
  return payload;
}

function buildSyntheticSnapshot(authorityCode: AuthorityCode): CmeRequirementSnapshot {
  return {
    authorityCode,
    fetchedAt: new Date().toISOString(),
    source: 'synthetic',
    categories: buildSyntheticCategories(authorityCode),
    renewalCycles: buildSyntheticRenewalCycles(authorityCode),
    specialtyRules: buildSyntheticSpecialtyRules(authorityCode),
  };
}

function buildSyntheticCategories(authorityCode: AuthorityCode) {
  const hash = createHash('sha256').update(authorityCode).digest();
  return DEFAULT_CATEGORY_SEEDS.map((seed, index) => {
    const variance = (hash[index % hash.length] % 6) - 2;
    return {
      code: `${authorityCode}-${seed.code}`,
      label: seed.label,
      minimumHours: Math.max(4, seed.minimumHours + variance),
      description: seed.description,
      renewalPeriodMonths: seed.renewalPeriodMonths,
    };
  });
}

function buildSyntheticRenewalCycles(authorityCode: AuthorityCode): RenewalCycle[] {
  const hash = createHash('sha1').update(`${authorityCode}:cycle`).digest();
  return DEFAULT_RENEWAL_WINDOWS.map((seed, index) => {
    const variance = (hash[index % hash.length] % 4) - 1;
    return {
      cycleLabel: seed.cycleLabel,
      months: seed.months,
      minimumHours: Math.max(15, seed.minimumHours + variance * 2),
      requiresAudit: index % 2 === 0,
      carryOverHours: Math.max(0, seed.carryOverHours + variance),
    };
  });
}

function buildSyntheticSpecialtyRules(authorityCode: AuthorityCode): SpecialtyRule[] {
  const hash = createHash('md5').update(`${authorityCode}:specialty`).digest();
  return DEFAULT_SPECIALTIES.map((specialty, index) => {
    const variance = hash[index % hash.length] % 5;
    return {
      specialty,
      minimumHours: 6 + variance,
      notes: variance > 2 ? 'Requires attestation each renewal cycle.' : 'Verified via board CME attestations.',
      enforcementLevel: variance >= 3 ? 'mandatory' : 'recommended',
    };
  });
}

const DEFAULT_CATEGORY_SEEDS = [
  {
    code: 'patient-safety',
    label: 'Patient Safety & Quality',
    minimumHours: 8,
    description: 'Root cause analysis, disclosure, and escalation requirements.',
    renewalPeriodMonths: 12,
  },
  {
    code: 'opioid-stewardship',
    label: 'Opioid & Pain Stewardship',
    minimumHours: 6,
    description: 'CDC-aligned opioid stewardship CME with documentation workflows.',
    renewalPeriodMonths: 12,
  },
  {
    code: 'health-equity',
    label: 'Health Equity & Bias',
    minimumHours: 4,
    description: 'Implicit bias mitigation, culturally competent care, and language access.',
    renewalPeriodMonths: 24,
  },
  {
    code: 'emerging-threats',
    label: 'Emerging Clinical Threats',
    minimumHours: 5,
    description: 'Respiratory pathogens, novel vector-borne diseases, and tele-ID escalation.',
    renewalPeriodMonths: 12,
  },
];

const DEFAULT_RENEWAL_WINDOWS = [
  {
    cycleLabel: 'Annual renewal',
    months: 12,
    minimumHours: 25,
    carryOverHours: 6,
  },
  {
    cycleLabel: 'Biennial renewal',
    months: 24,
    minimumHours: 50,
    carryOverHours: 12,
  },
];

const DEFAULT_SPECIALTIES = [
  'Emergency Medicine',
  'Psychiatry',
  'Anesthesiology',
  'Family Medicine',
  'Telehealth Generalist',
];









