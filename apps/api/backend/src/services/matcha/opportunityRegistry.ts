/**
 * Wave 187 — MATCHA: Opportunity Registry
 *
 * Canonical opportunity catalog. Wave 190 migrates this to DB-backed storage
 * with employer-published opportunities. Seed data mirrors employer profiles.
 */

import { randomUUID } from 'crypto';

import type { Opportunity } from './matchaModels';

type OpportunityFilters = {
  specialty?: string;
  state?: string;
  hiringType?: string;
  remote?: boolean;
  employerSlug?: string;
};

type OpportunityInput = Omit<Opportunity, 'id' | 'postedAt' | 'credentialRequirements' | 'minimumTrustBand' | 'urgency'> & {
  id?: string;
  postedAt?: string;
  credentialRequirements?: string[];
  minimumTrustBand?: Opportunity['minimumTrustBand'];
  urgency?: Opportunity['urgency'];
};

function urgencyFromStartUrgency(value: Opportunity['startUrgency']): Opportunity['urgency'] {
  if (value === 'immediate') {
    return 'immediate';
  }
  if (value === 'within_2_weeks' || value === 'within_month') {
    return 'within_30_days';
  }
  return 'within_90_days';
}

function deriveCredentialRequirements(opportunity: Pick<Opportunity, 'requirements'>): string[] {
  return opportunity.requirements.map((requirement) => requirement.label);
}

function normalizeOpportunity(input: OpportunityInput): Opportunity {
  return {
    ...input,
    id: input.id ?? `opp-${randomUUID()}`,
    organization: input.organization ?? input.facility,
    premiumRate: input.premiumRate,
    urgency: input.urgency ?? urgencyFromStartUrgency(input.startUrgency),
    minimumTrustBand: input.minimumTrustBand ?? 'L2',
    credentialRequirements: input.credentialRequirements ?? deriveCredentialRequirements(input),
    postedAt: input.postedAt ?? new Date().toISOString(),
  };
}

const SEEDED_OPPORTUNITIES: OpportunityInput[] = [
  {
    id: 'opp-001',
    title: 'Locums Interventional Cardiologist',
    organization: 'Bay Area Cardiac Group',
    employerSlug: 'bay-area-cardiac-group',
    facility: 'Bay Area Cardiac Group',
    location: 'San Francisco, CA',
    state: 'CA',
    specialty: 'Cardiology',
    department: 'Interventional Cardiology',
    hiringType: 'locums',
    employerType: 'practice',
    startUrgency: 'within_2_weeks',
    payRange: '$310–$380/hr',
    payMin: 310,
    payMax: 380,
    premiumRate: 360,
    remote: false,
    recentHires: 3,
    tags: ['cardiology', 'CA', 'locums', 'interventional'],
    postedAt: '2026-03-01T00:00:00Z',
    active: true,
    urgency: 'within_30_days',
    minimumTrustBand: 'L2',
    credentialRequirements: ['CA Medical License', 'ABIM Cardiology', 'DEA Registration', 'Malpractice Insurance', 'NPI Verified', 'Sanctions Clear'],
    requirements: [
      { key: 'state_license', label: 'CA Medical License', level: 'L3', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'ABIM Cardiology', level: 'L3', priority: 'required', specialty: 'Cardiology' },
      { key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice Insurance', level: 'L2', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
      { key: 'sanctions_clear', label: 'Sanctions Clear', level: 'L3', priority: 'required' },
    ],
  },
  {
    id: 'opp-002',
    title: 'Perm Electrophysiologist',
    organization: 'Bay Area Cardiac Group',
    employerSlug: 'bay-area-cardiac-group',
    facility: 'Bay Area Cardiac Group',
    location: 'Oakland, CA',
    state: 'CA',
    specialty: 'Cardiology',
    department: 'Electrophysiology',
    hiringType: 'perm',
    employerType: 'practice',
    startUrgency: 'within_month',
    payRange: '$420K–$500K',
    payMin: 202,
    payMax: 240,
    premiumRate: 250,
    remote: false,
    recentHires: 1,
    tags: ['EP', 'cardiology', 'CA', 'perm'],
    postedAt: '2026-02-20T00:00:00Z',
    active: true,
    urgency: 'within_30_days',
    minimumTrustBand: 'L2',
    credentialRequirements: ['CA Medical License', 'ABIM Electrophysiology', 'DEA Registration', 'Malpractice Insurance', 'NPI Verified', 'Sanctions Clear'],
    requirements: [
      { key: 'state_license', label: 'CA Medical License', level: 'L3', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'ABIM Electrophysiology', level: 'L3', priority: 'required', specialty: 'Electrophysiology' },
      { key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice Insurance', level: 'L3', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
      { key: 'sanctions_clear', label: 'Sanctions Clear', level: 'L3', priority: 'required' },
    ],
  },
  {
    id: 'opp-003',
    title: 'Telehealth Psychiatrist',
    organization: 'MindBridge Health',
    employerSlug: 'mindbridge-health',
    facility: 'MindBridge Health',
    location: 'Remote — CA licensed',
    state: 'CA',
    specialty: 'Psychiatry',
    hiringType: 'telehealth',
    employerType: 'telehealth',
    startUrgency: 'flexible',
    payRange: '$200–$270/hr',
    payMin: 200,
    payMax: 270,
    premiumRate: 275,
    remote: true,
    recentHires: 8,
    tags: ['psychiatry', 'telehealth', 'remote', 'CA', 'TX', 'FL'],
    postedAt: '2026-03-01T00:00:00Z',
    active: true,
    urgency: 'within_90_days',
    minimumTrustBand: 'L2',
    credentialRequirements: ['State Medical License', 'DEA Registration', 'NPI Verified', 'Board Certification'],
    requirements: [
      { key: 'state_license', label: 'State Medical License', level: 'L3', priority: 'required', state: 'CA' },
      { key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
      { key: 'board_cert', label: 'Board Certification', level: 'L2', priority: 'preferred', specialty: 'Psychiatry' },
    ],
  },
  {
    id: 'opp-004',
    title: 'ICU / Critical Care NP',
    organization: 'Sacramento Medical Center',
    employerSlug: 'sacramento-medical-center',
    facility: 'Sacramento Medical Center',
    location: 'Sacramento, CA',
    state: 'CA',
    specialty: 'Critical Care',
    department: 'ICU',
    hiringType: 'locums',
    employerType: 'hospital',
    startUrgency: 'immediate',
    payRange: '$120–$145/hr',
    payMin: 120,
    payMax: 145,
    premiumRate: 150,
    remote: false,
    recentHires: 1,
    tags: ['ICU', 'critical-care', 'NP', 'CA', 'hospital'],
    postedAt: '2026-03-03T00:00:00Z',
    active: true,
    urgency: 'immediate',
    minimumTrustBand: 'L2',
    credentialRequirements: ['CA NP License', 'AANP / ANCC Certification', 'BLS', 'ACLS', 'NPI Verified', 'Malpractice Insurance'],
    requirements: [
      { key: 'state_license', label: 'CA NP License', level: 'L3', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'AANP / ANCC Certification', level: 'L3', priority: 'required', specialty: 'Critical Care' },
      { key: 'bls', label: 'BLS', level: 'L3', priority: 'required' },
      { key: 'acls', label: 'ACLS', level: 'L3', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice Insurance', level: 'L2', priority: 'required' },
    ],
  },
  {
    id: 'opp-005',
    title: 'Family Medicine Locums — Rural WA',
    organization: 'Northwest Locums Alliance',
    employerSlug: 'northwest-locums-alliance',
    facility: 'Northwest Locums Alliance',
    location: 'Eastern Washington',
    state: 'WA',
    specialty: 'Family Medicine',
    hiringType: 'locums',
    employerType: 'agency',
    startUrgency: 'within_2_weeks',
    payRange: '$180–$220/hr',
    payMin: 180,
    payMax: 220,
    premiumRate: 225,
    remote: false,
    recentHires: 5,
    tags: ['family-medicine', 'WA', 'rural', 'locums'],
    postedAt: '2026-03-04T00:00:00Z',
    active: true,
    urgency: 'within_30_days',
    minimumTrustBand: 'L2',
    credentialRequirements: ['WA Medical License', 'DEA Registration', 'Malpractice Insurance', 'NPI Verified', 'NPDB Clear'],
    requirements: [
      { key: 'state_license', label: 'WA Medical License', level: 'L3', priority: 'required', state: 'WA' },
      { key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice Insurance', level: 'L2', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
      { key: 'sanctions_clear', label: 'NPDB Clear', level: 'L2', priority: 'required' },
    ],
  },
  {
    id: 'opp-006',
    title: 'Staff Internist — Perm',
    organization: 'Kaiser Permanente Northern California',
    employerSlug: 'kaiser-permanente-northern-california',
    facility: 'Kaiser Permanente Northern California',
    location: 'Sacramento, CA',
    state: 'CA',
    specialty: 'Internal Medicine',
    hiringType: 'perm',
    employerType: 'health_system',
    startUrgency: 'within_month',
    remote: false,
    recentHires: 12,
    tags: ['internal-medicine', 'CA', 'perm', 'Kaiser'],
    postedAt: '2026-02-25T00:00:00Z',
    active: true,
    urgency: 'within_30_days',
    minimumTrustBand: 'L2',
    credentialRequirements: ['CA Medical License', 'ABIM Internal Medicine', 'DEA Registration', 'Malpractice History Review', 'NPI Verified', 'NPDB Clear'],
    requirements: [
      { key: 'state_license', label: 'CA Medical License', level: 'L3', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'ABIM Internal Medicine', level: 'L3', priority: 'required', specialty: 'Internal Medicine' },
      { key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice History Review', level: 'L3', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
      { key: 'sanctions_clear', label: 'NPDB Clear', level: 'L3', priority: 'required' },
    ],
  },
  {
    id: 'opp-007',
    title: 'Telepsychiatry — TX & FL',
    organization: 'MindBridge Health',
    employerSlug: 'mindbridge-health',
    facility: 'MindBridge Health',
    location: 'Remote — TX or FL licensed',
    state: 'TX',
    specialty: 'Psychiatry',
    hiringType: 'telehealth',
    employerType: 'telehealth',
    startUrgency: 'flexible',
    payRange: '$200–$270/hr',
    payMin: 200,
    payMax: 270,
    premiumRate: 275,
    remote: true,
    recentHires: 4,
    tags: ['psychiatry', 'telehealth', 'TX', 'FL', 'remote'],
    postedAt: '2026-03-02T00:00:00Z',
    active: true,
    urgency: 'within_90_days',
    minimumTrustBand: 'L2',
    credentialRequirements: ['TX or FL Medical License', 'DEA Registration', 'NPI Verified'],
    requirements: [
      { key: 'state_license', label: 'TX or FL Medical License', level: 'L3', priority: 'required', state: 'TX' },
      { key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' },
      { key: 'npi', label: 'NPI Verified', level: 'L3', priority: 'required' },
    ],
  },
];

export const OPPORTUNITIES: Opportunity[] = SEEDED_OPPORTUNITIES.map((opportunity) => normalizeOpportunity(opportunity));

export function getOpportunity(id: string): Opportunity | undefined {
  return OPPORTUNITIES.find(o => o.id === id);
}

export function listOpportunities(filters?: {
  specialty?: string;
  state?: string;
  hiringType?: string;
  remote?: boolean;
  employerSlug?: string;
}): Opportunity[] {
  let ops = OPPORTUNITIES.filter(o => o.active);
  if (!filters) return ops;

  if (filters.specialty) {
    const sp = filters.specialty.toLowerCase();
    ops = ops.filter(o => o.specialty.toLowerCase().includes(sp) || o.specialty === 'All Specialties');
  }
  if (filters.state) {
    ops = ops.filter(o => o.state === filters.state || o.remote);
  }
  if (filters.hiringType) {
    ops = ops.filter(o => o.hiringType === filters.hiringType);
  }
  if (filters.remote !== undefined) {
    ops = ops.filter(o => o.remote === filters.remote);
  }
  if (filters.employerSlug) {
    ops = ops.filter(o => o.employerSlug === filters.employerSlug);
  }
  return ops;
}

export function listActiveOpportunities(filters?: OpportunityFilters): Opportunity[] {
  return listOpportunities(filters);
}

export function createOpportunity(input: OpportunityInput): Opportunity {
  const opportunity = normalizeOpportunity(input);
  OPPORTUNITIES.unshift(opportunity);
  return opportunity;
}
