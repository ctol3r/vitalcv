/**
 * Wave 186 — Employer Knowledge Layer
 * employerService.ts
 *
 * Provides employer profile retrieval, listing, comparison, and
 * search integration. Seeded with representative stub data until
 * a live employer onboarding flow is wired (Wave 190+).
 */

import { EmployerHiringStatus } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (level: string, event: string, meta?: any) =>
  console.log(JSON.stringify({ level, event, ...meta }));

// Prisma client reserved for Wave 190 DB-backed employer storage
// const prisma = new PrismaClient();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RequirementSpec {
  label: string;
  level: 'L1' | 'L2' | 'L3';
  note?: string;
}

export interface EmployerSummary {
  id: string;
  slug: string;
  name: string;
  facilityType: string;
  tagline: string;
  specialties: string[];
  states: string[];
  openRoles: number;
  trustScore: number;
  hiringStatus: EmployerHiringStatus;
  timeToStart: string;
  verified: boolean;
}

export interface EmployerDetail extends EmployerSummary {
  description: string;
  hiringTypes: string[];
  timeToOnboard: string;
  clearToStartThreshold: string;
  payTransparency: boolean;
  payRange: string | null;
  requirements: RequirementSpec[];
  recentHires: number;
  website: string | null;
  verifiedSince: string | null;
}

export interface EmployerListOptions {
  specialty?: string;
  state?: string;
  hiringStatus?: string;
  hiringType?: string;
  limit?: number;
  offset?: number;
}

export interface EmployerCompareResult {
  employers: EmployerDetail[];
  differentiators: string[];
}

// ── Seed data (representative — Wave 190 wires live onboarding) ───────────────

const SEED_EMPLOYERS: Array<{
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
  requirements: RequirementSpec[];
}> = [
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
    timeToStart: '2–3 weeks',
    timeToOnboard: '~5 business days',
    clearToStartThreshold:
      'Active CA license + ABIM board certification + active DEA + malpractice insurance',
    payTransparency: true,
    payRange: '$310–$380/hr (locums); $420K–$500K (perm)',
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
    timeToOnboard: '3–7 business days',
    clearToStartThreshold:
      'Active state license in target state + DEA (or state CSOS equivalent) + NPI active',
    payTransparency: true,
    payRange: '$200–$270/hr',
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
    tagline: 'Northern California critical care — excellence without compromise.',
    description:
      'Sacramento Medical Center is a 620-bed Level II trauma center. We hire critical care, emergency, and internal medicine physicians and APPs on both locums and permanent tracks.',
    specialties: ['Critical Care', 'Emergency Medicine', 'Internal Medicine', 'Hospitalist'],
    states: ['CA'],
    openRoles: 7,
    trustScore: 88,
    hiringStatus: EmployerHiringStatus.HIRING_NOW,
    hiringTypes: ['Locums', 'Perm', 'PRN'],
    timeToStart: 'Immediate',
    timeToOnboard: '5–10 business days',
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
    timeToStart: '1–2 weeks',
    timeToOnboard: '3–5 business days',
    clearToStartThreshold:
      'Active state license + current DEA + current malpractice coverage',
    payTransparency: true,
    payRange: '$150–$320/hr depending on specialty',
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
    timeToStart: '4–8 weeks',
    timeToOnboard: '10–15 business days',
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

// ── In-memory store (Wave 190 migrates to DB-backed) ─────────────────────────

const EMPLOYER_MAP = new Map(SEED_EMPLOYERS.map(e => [e.slug, e]));

// ── Service functions ─────────────────────────────────────────────────────────

export async function listEmployers(opts: EmployerListOptions = {}): Promise<EmployerSummary[]> {
  let results = SEED_EMPLOYERS;

  if (opts.specialty) {
    const sp = opts.specialty.toLowerCase();
    results = results.filter(e =>
      e.specialties.some(s => s.toLowerCase().includes(sp)),
    );
  }

  if (opts.state) {
    const st = opts.state.toUpperCase();
    results = results.filter(e => e.states.includes(st));
  }

  if (opts.hiringStatus) {
    results = results.filter(e => e.hiringStatus === opts.hiringStatus);
  }

  if (opts.hiringType) {
    const ht = opts.hiringType.toLowerCase();
    results = results.filter(e =>
      e.hiringTypes.some(t => t.toLowerCase() === ht),
    );
  }

  const start = opts.offset ?? 0;
  const end = start + (opts.limit ?? 20);
  const page = results.slice(start, end);

  log('info', 'employer.list', { count: page.length, opts });

  return page.map(toSummary);
}

export async function getEmployerBySlug(slug: string): Promise<EmployerDetail | null> {
  const e = EMPLOYER_MAP.get(slug);
  if (!e) return null;
  log('info', 'employer.view', { slug });
  return toDetail(e);
}

export async function compareEmployers(slugs: string[]): Promise<EmployerCompareResult> {
  const employers: EmployerDetail[] = [];
  for (const slug of slugs.slice(0, 4)) {
    const e = EMPLOYER_MAP.get(slug);
    if (e) employers.push(toDetail(e));
  }

  const differentiators = computeDifferentiators(employers);
  log('info', 'employer.compare', { slugs, count: employers.length });

  return { employers, differentiators };
}

export async function searchEmployers(query: string): Promise<EmployerSummary[]> {
  const q = query.toLowerCase();
  const results = SEED_EMPLOYERS.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.facilityType.toLowerCase().includes(q) ||
    e.specialties.some(s => s.toLowerCase().includes(q)) ||
    e.tagline.toLowerCase().includes(q) ||
    e.states.some(s => s.toLowerCase() === q),
  );
  log('info', 'employer.search', { query, count: results.length });
  return results.map(toSummary);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSummary(e: typeof SEED_EMPLOYERS[0]): EmployerSummary {
  return {
    id: e.slug,
    slug: e.slug,
    name: e.name,
    facilityType: e.facilityType,
    tagline: e.tagline,
    specialties: e.specialties,
    states: e.states,
    openRoles: e.openRoles,
    trustScore: e.trustScore,
    hiringStatus: e.hiringStatus,
    timeToStart: e.timeToStart,
    verified: true,
  };
}

function toDetail(e: typeof SEED_EMPLOYERS[0]): EmployerDetail {
  return {
    ...toSummary(e),
    description: e.description,
    hiringTypes: e.hiringTypes,
    timeToOnboard: e.timeToOnboard,
    clearToStartThreshold: e.clearToStartThreshold,
    payTransparency: e.payTransparency,
    payRange: e.payRange,
    requirements: e.requirements,
    recentHires: e.recentHires,
    website: e.website,
    verifiedSince: e.verifiedSince,
  };
}

function computeDifferentiators(employers: EmployerDetail[]): string[] {
  if (employers.length < 2) return [];
  const diffs: string[] = [];

  const scores = employers.map(e => e.trustScore);
  if (Math.max(...scores) - Math.min(...scores) > 5) {
    const highest = employers.reduce((a, b) => (a.trustScore > b.trustScore ? a : b));
    diffs.push(`${highest.name} has the highest trust score (${highest.trustScore})`);
  }

  const payVisible = employers.filter(e => e.payTransparency);
  if (payVisible.length < employers.length) {
    diffs.push(`${payVisible.map(e => e.name).join(', ')} publish pay ranges; others do not`);
  }

  const fastest = employers.reduce((a, b) =>
    parseStartDays(a.timeToStart) < parseStartDays(b.timeToStart) ? a : b,
  );
  diffs.push(`${fastest.name} offers the fastest start time (${fastest.timeToStart})`);

  return diffs;
}

function parseStartDays(t: string): number {
  const m = t.match(/(\d+)/);
  return m ? parseInt(m[1]) : 99;
}
