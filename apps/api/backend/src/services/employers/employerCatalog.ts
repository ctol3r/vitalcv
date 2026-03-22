import { EmployerHiringStatus } from '@prisma/client';

export interface EmployerRequirementSpec {
  label: string;
  level: 'L1' | 'L2' | 'L3';
  note?: string;
  key?: string;
  priority?: 'required' | 'preferred';
  state?: string;
  specialty?: string;
}

export interface EmployerSeedRecord {
  slug: string;
  name: string;
  facilityType: string;
  tagline: string;
  description: string;
  specialties: string[];
  states: string[];
  openRoles: number;
  trustScore: number;
  hiringStatus: EmployerHiringStatus;
  hiringTypes: string[];
  timeToStart: string;
  timeToOnboard: string;
  clearToStartThreshold: string;
  payTransparency: boolean;
  payRange: string | null;
  recentHires: number;
  website: string | null;
  verifiedSince: string;
  requirements: EmployerRequirementSpec[];
}

export const EMPLOYER_KNOWLEDGE_SEEDS: EmployerSeedRecord[] = [
  {
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    facilityType: 'Specialty Cardiology Practice',
    tagline: "The Bay Area's premier interventional cardiology group.",
    description:
      'Bay Area Cardiac Group operates 4 facilities across San Francisco and the East Bay. We run a locums-friendly practice with rapid credentialing turnaround and a collaborative PA/NP team.',
    specialties: ['Cardiology', 'Electrophysiology', 'Interventional Cardiology'],
    states: ['CA'],
    openRoles: 4,
    trustScore: 94,
    hiringStatus: EmployerHiringStatus.HIRING_NOW,
    hiringTypes: ['Locums', 'Perm', 'Hybrid'],
    timeToStart: '2-3 weeks',
    timeToOnboard: '~5 business days',
    clearToStartThreshold:
      'Active CA license + ABIM board certification + active DEA + malpractice insurance',
    payTransparency: true,
    payRange: '$310-$380/hr (locums); $420K-$500K (perm)',
    recentHires: 6,
    website: 'https://bayareacardiac.example.com',
    verifiedSince: '2023-06-01T00:00:00Z',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, no restrictions' },
      { label: 'Board Certification', level: 'L3', note: 'ABIM Cardiology or equivalent' },
      { label: 'DEA Registration', level: 'L2', note: 'Active in CA' },
      { label: 'Malpractice Insurance', level: 'L2', note: 'Tail or occurrence-based' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Sanctions Clear', level: 'L3' },
    ],
  },
  {
    slug: 'mindbridge-health',
    name: 'MindBridge Health',
    facilityType: 'Telehealth Platform',
    tagline: 'Mental healthcare without geographic limits.',
    description:
      'MindBridge connects psychiatric and behavioral health specialists with patients across 14 states. We handle all credentialing coordination and payer enrollment.',
    specialties: ['Psychiatry', 'Psychology', 'Behavioral Health', 'Addiction Medicine'],
    states: ['CA', 'TX', 'FL', 'NY', 'WA', 'OR', 'CO', 'AZ', 'NV', 'IL', 'GA', 'NC', 'VA', 'MA'],
    openRoles: 12,
    trustScore: 91,
    hiringStatus: EmployerHiringStatus.HIRING_NOW,
    hiringTypes: ['Telehealth', 'Locums', 'Part-time'],
    timeToStart: 'Flexible',
    timeToOnboard: '3-7 business days',
    clearToStartThreshold:
      'Active state license in target state + DEA (or state CSOS equivalent) + NPI active',
    payTransparency: true,
    payRange: '$200-$270/hr',
    recentHires: 23,
    website: 'https://mindbridge.example.com',
    verifiedSince: '2023-09-15T00:00:00Z',
    requirements: [
      { label: 'State Medical License', level: 'L3', note: 'Active in target state' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Board Certification', level: 'L2', note: 'Preferred, not required' },
      { label: 'Telehealth Platform Agreement', level: 'L1' },
    ],
  },
  {
    slug: 'sacramento-medical-center',
    name: 'Sacramento Medical Center',
    facilityType: 'Hospital System',
    tagline: 'Northern California critical care - excellence without compromise.',
    description:
      'Sacramento Medical Center is a 620-bed Level II trauma center. We hire critical care, emergency, and internal medicine physicians and APPs on both locums and permanent tracks.',
    specialties: ['Critical Care', 'Emergency Medicine', 'Internal Medicine', 'Hospitalist'],
    states: ['CA'],
    openRoles: 7,
    trustScore: 88,
    hiringStatus: EmployerHiringStatus.HIRING_NOW,
    hiringTypes: ['Locums', 'Perm', 'PRN'],
    timeToStart: 'Immediate',
    timeToOnboard: '5-10 business days',
    clearToStartThreshold:
      'Active CA license + board certification + BLS/ACLS + credentialing file complete',
    payTransparency: false,
    payRange: null,
    recentHires: 11,
    website: 'https://sacmedcenter.example.com',
    verifiedSince: '2022-11-01T00:00:00Z',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, unrestricted' },
      { label: 'Board Certification', level: 'L3' },
      { label: 'BLS / ACLS', level: 'L3' },
      { label: 'DEA Registration', level: 'L2', note: 'Active in CA' },
      { label: 'Hospital Credentialing File', level: 'L3' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Background Check', level: 'L2' },
    ],
  },
  {
    slug: 'northwest-locums-alliance',
    name: 'Northwest Locums Alliance',
    facilityType: 'Staffing / Locums Agency',
    tagline: 'Connecting credentialed clinicians with Pacific Northwest opportunities.',
    description:
      'NLA places board-certified physicians and APPs in rural and urban facilities across WA, OR, ID, and MT. We specialize in rapid placement with compliant credentialing support.',
    specialties: ['Family Medicine', 'Internal Medicine', 'Emergency Medicine', 'Hospitalist', 'Pediatrics'],
    states: ['WA', 'OR', 'ID', 'MT'],
    openRoles: 19,
    trustScore: 85,
    hiringStatus: EmployerHiringStatus.ACTIVELY_HIRING,
    hiringTypes: ['Locums', 'Short-term'],
    timeToStart: '1-2 weeks',
    timeToOnboard: '3-5 business days',
    clearToStartThreshold: 'Active state license + current DEA + current malpractice coverage',
    payTransparency: true,
    payRange: '$150-$320/hr depending on specialty',
    recentHires: 34,
    website: 'https://nwlocums.example.com',
    verifiedSince: '2024-01-20T00:00:00Z',
    requirements: [
      { label: 'State License (target state)', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'NPDB Clear', level: 'L2' },
    ],
  },
  {
    slug: 'kaiser-permanente-northern-california',
    name: 'Kaiser Permanente Northern California',
    facilityType: 'Integrated Health System',
    tagline: 'Delivering total health for 4.5 million members.',
    description:
      'Kaiser Permanente Northern California operates 21 hospitals and 260+ medical offices. We hire permanent physicians and APPs across all specialties with robust onboarding and credentialing support.',
    specialties: ['All Specialties', 'Primary Care', 'Oncology', 'Surgery', 'Radiology', 'Psychiatry'],
    states: ['CA'],
    openRoles: 38,
    trustScore: 97,
    hiringStatus: EmployerHiringStatus.ACTIVELY_HIRING,
    hiringTypes: ['Perm', 'Part-time'],
    timeToStart: '4-8 weeks',
    timeToOnboard: '10-15 business days',
    clearToStartThreshold:
      'CA license + board certification + malpractice history review + KP privileging complete',
    payTransparency: false,
    payRange: null,
    recentHires: 89,
    website: 'https://kaiserpermanente.org',
    verifiedSince: '2021-03-01T00:00:00Z',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, unrestricted' },
      { label: 'Board Certification', level: 'L3', note: 'Required for all specialties' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice History', level: 'L3', note: 'Reviewed by credentialing committee' },
      { label: 'KP Privileging', level: 'L3', note: 'System-specific process, ~10 days' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'NPDB Clear', level: 'L3' },
    ],
  },
];

const EMPLOYER_ALIAS_TO_SLUG = new Map<string, string>([
  ['bay area cardiac group', 'bay-area-cardiac-group'],
  ['mindbridge health', 'mindbridge-health'],
  ['sacramento medical center', 'sacramento-medical-center'],
  ['northwest locums alliance', 'northwest-locums-alliance'],
  ['kaiser permanente northern california', 'kaiser-permanente-northern-california'],
  ['kaiser permanente', 'kaiser-permanente-northern-california'],
  ['stanford health care', 'stanford-health-care'],
  ['one medical amazon', 'one-medical-amazon'],
  ['one medical', 'one-medical-amazon'],
  ['sutter health', 'sutter-health'],
  ['ucsf medical center', 'ucsf-medical-center'],
]);

function normalizeEmployerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function slugifyEmployerName(name: string): string {
  return normalizeEmployerKey(name).replace(/\s+/g, '-');
}

export function listEmployerSeeds(): EmployerSeedRecord[] {
  return EMPLOYER_KNOWLEDGE_SEEDS.map((seed) => ({ ...seed }));
}

export function getEmployerSeedBySlug(slug: string): EmployerSeedRecord | undefined {
  return EMPLOYER_KNOWLEDGE_SEEDS.find((seed) => seed.slug === slug);
}

export function findEmployerSeedByName(name: string): EmployerSeedRecord | undefined {
  const normalizedName = normalizeEmployerKey(name);
  const aliasSlug = EMPLOYER_ALIAS_TO_SLUG.get(normalizedName);
  if (aliasSlug) {
    return getEmployerSeedBySlug(aliasSlug);
  }

  return EMPLOYER_KNOWLEDGE_SEEDS.find(
    (seed) => normalizeEmployerKey(seed.name) === normalizedName,
  );
}

export function resolveEmployerSlugFromName(name: string): string {
  return findEmployerSeedByName(name)?.slug ?? slugifyEmployerName(name);
}
