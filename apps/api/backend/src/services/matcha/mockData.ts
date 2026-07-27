/**
 * MATCHA Mock Data
 *
 * Hardcoded clinician profile + job postings for the demo.
 * Designed to produce a natural spread: 2 CLEAR, 2 PARTIAL, 1 INELIGIBLE.
 *
 * The default profile intentionally omits malpractice insurance so that
 * jobs requiring it fall to PARTIAL, demonstrating the "Add Credential" flow.
 */

import type { ClinicianProfile } from './matchaModels';
import type { JobPosting } from './eligibility';
import { resolveEmployerSlugFromName } from '../employers/employerCatalog';

/* ------------------------------------------------------------------ */
/*  Clinician Profile                                                  */
/* ------------------------------------------------------------------ */

/**
 * The demo NPI must FAIL the NPI check digit (Luhn over "80840" + the first 9
 * digits) so it cannot collide with a registrant, and the name must be obviously
 * synthetic. `1003000126` / "Dr. Sarah Chen" sat here until 2026-07-27: that NPI
 * belongs to a real physician, and this profile asserted an active DEA
 * registration, a California licence and a board certification for him that no
 * source had reported.
 */
const DEFAULT_PROFILE: ClinicianProfile = {
  npi: '1558395516',
  name: 'Example Clinician A, MD',
  specialty: 'Internal Medicine',
  states: ['CA'],
  credentials: [
    {
      key: 'npi',
      status: 'active',
      claimLevel: 'L3',
      issuer: 'CMS NPPES',
    },
    {
      key: 'state_license',
      status: 'active',
      claimLevel: 'L3',
      issuer: 'California Medical Board',
      state: 'CA',
      expiresAt: '2026-12-31',
    },
    {
      key: 'board_cert',
      status: 'active',
      claimLevel: 'L3',
      issuer: 'American Board of Internal Medicine',
      specialty: 'Internal Medicine',
      expiresAt: '2027-06-30',
    },
    {
      key: 'dea',
      status: 'active',
      claimLevel: 'L3',
      issuer: 'DEA',
    },
    {
      key: 'sanctions_clear',
      status: 'active',
      claimLevel: 'L3',
      issuer: 'OIG / NPDB',
    },
    // Intentionally MISSING: malpractice — drives partial matches
  ],
};

/**
 * Returns the demo profile for the known demo NPI, or null.
 *
 * This deliberately does NOT stamp the requested NPI onto the profile. Until
 * 2026-07-27 it did (`{ ...DEFAULT_PROFILE, npi }`), which turned any NPI handed
 * to it — including a real registrant's — into a fabricated set of active
 * credentials attributed to that person. An unknown NPI is a not-found, not a cue
 * to relabel someone else's profile.
 */
export function getMockProfile(npi: string): ClinicianProfile | null {
  return npi === DEFAULT_PROFILE.npi ? { ...DEFAULT_PROFILE } : null;
}

/* ------------------------------------------------------------------ */
/*  Job Postings                                                       */
/* ------------------------------------------------------------------ */

export const MOCK_JOBS: JobPosting[] = [
  // Job 1 — 100% CLEAR (all required, no preferred)
  {
    id: 'matcha-job-1',
    title: 'Staff Internist',
    facility: 'Stanford Health Care',
    employerSlug: resolveEmployerSlugFromName('Stanford Health Care'),
    employer: {
      slug: resolveEmployerSlugFromName('Stanford Health Care'),
      name: 'Stanford Health Care',
    },
    askContext: {
      employerSlug: resolveEmployerSlugFromName('Stanford Health Care'),
      employerName: 'Stanford Health Care',
      opportunityId: 'matcha-job-1',
    },
    location: 'Palo Alto, CA',
    department: 'Internal Medicine',
    compensation: '$280k – $350k',
    startDate: '2026-04-15',
    postedAt: '2026-02-20T00:00:00Z',
    requirements: [
      { key: 'state_license', label: 'Active CA Medical License', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'ABIM Board Certification', priority: 'required', specialty: 'Internal Medicine' },
      { key: 'dea', label: 'DEA Registration', priority: 'required' },
      { key: 'sanctions_clear', label: 'Clean Sanctions Record', priority: 'required' },
      { key: 'npi', label: 'Active NPI', priority: 'required' },
    ],
  },

  // Job 2 — CLEAR (~95%, all required met, preferred malpractice missing)
  {
    id: 'matcha-job-2',
    title: 'Hospitalist — Night Shift',
    facility: 'Kaiser Permanente',
    employerSlug: resolveEmployerSlugFromName('Kaiser Permanente'),
    employer: {
      slug: resolveEmployerSlugFromName('Kaiser Permanente'),
      name: 'Kaiser Permanente',
    },
    askContext: {
      employerSlug: resolveEmployerSlugFromName('Kaiser Permanente'),
      employerName: 'Kaiser Permanente',
      opportunityId: 'matcha-job-2',
    },
    location: 'Oakland, CA',
    department: 'Hospital Medicine',
    compensation: '$310k – $380k + Night Differential',
    startDate: '2026-05-01',
    postedAt: '2026-02-18T00:00:00Z',
    requirements: [
      { key: 'state_license', label: 'Active CA Medical License', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'ABIM Board Certification', priority: 'required', specialty: 'Internal Medicine' },
      { key: 'dea', label: 'DEA Registration', priority: 'required' },
      { key: 'sanctions_clear', label: 'Clean Sanctions Record', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice Insurance', priority: 'preferred' },
    ],
  },

  // Job 3 — PARTIAL (malpractice is REQUIRED here)
  {
    id: 'matcha-job-3',
    title: 'Primary Care Physician',
    facility: 'One Medical (Amazon)',
    employerSlug: resolveEmployerSlugFromName('One Medical Amazon'),
    employer: {
      slug: resolveEmployerSlugFromName('One Medical Amazon'),
      name: 'One Medical (Amazon)',
    },
    askContext: {
      employerSlug: resolveEmployerSlugFromName('One Medical Amazon'),
      employerName: 'One Medical (Amazon)',
      opportunityId: 'matcha-job-3',
    },
    location: 'San Francisco, CA',
    department: 'Primary Care',
    compensation: '$250k – $300k + Equity',
    startDate: '2026-03-01',
    postedAt: '2026-02-22T00:00:00Z',
    requirements: [
      { key: 'state_license', label: 'Active CA Medical License', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'Board Certification (IM or FM)', priority: 'required', specialty: 'Internal Medicine' },
      { key: 'npi', label: 'Active NPI', priority: 'required' },
      { key: 'malpractice', label: 'Malpractice Coverage', priority: 'required' },
      { key: 'sanctions_clear', label: 'Clean Sanctions Record', priority: 'required' },
    ],
  },

  // Job 4 — CLEAR (~80%, required met, preferred board cert + malpractice missing)
  {
    id: 'matcha-job-4',
    title: 'Urgent Care Physician',
    facility: 'Sutter Health',
    employerSlug: resolveEmployerSlugFromName('Sutter Health'),
    employer: {
      slug: resolveEmployerSlugFromName('Sutter Health'),
      name: 'Sutter Health',
    },
    askContext: {
      employerSlug: resolveEmployerSlugFromName('Sutter Health'),
      employerName: 'Sutter Health',
      opportunityId: 'matcha-job-4',
    },
    location: 'Sacramento, CA',
    department: 'Urgent Care',
    compensation: '$260k – $320k',
    startDate: '2026-06-01',
    postedAt: '2026-02-15T00:00:00Z',
    requirements: [
      { key: 'state_license', label: 'Active CA Medical License', priority: 'required', state: 'CA' },
      { key: 'dea', label: 'DEA Registration', priority: 'required' },
      { key: 'npi', label: 'Active NPI', priority: 'required' },
      { key: 'board_cert', label: 'Board Certification', priority: 'preferred', specialty: 'Internal Medicine' },
      { key: 'malpractice', label: 'Malpractice Insurance', priority: 'preferred' },
    ],
  },

  // Job 5 — INELIGIBLE (specialty mismatch: requires Cardiology, clinician has Internal Medicine)
  {
    id: 'matcha-job-5',
    title: 'Interventional Cardiologist',
    facility: 'UCSF Medical Center',
    employerSlug: resolveEmployerSlugFromName('UCSF Medical Center'),
    employer: {
      slug: resolveEmployerSlugFromName('UCSF Medical Center'),
      name: 'UCSF Medical Center',
    },
    askContext: {
      employerSlug: resolveEmployerSlugFromName('UCSF Medical Center'),
      employerName: 'UCSF Medical Center',
      opportunityId: 'matcha-job-5',
    },
    location: 'San Francisco, CA',
    department: 'Cardiology',
    compensation: '$400k – $500k',
    startDate: '2026-07-01',
    postedAt: '2026-02-25T00:00:00Z',
    requirements: [
      { key: 'state_license', label: 'Active CA Medical License', priority: 'required', state: 'CA' },
      { key: 'board_cert', label: 'Cardiology Board Certification', priority: 'required', specialty: 'Cardiology' },
      { key: 'dea', label: 'DEA Registration', priority: 'required' },
      { key: 'sanctions_clear', label: 'Clean Sanctions Record', priority: 'required' },
    ],
  },
];
