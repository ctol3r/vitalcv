/**
 * specialtyRequirements.ts — Wave 65: Specialty Credential Database
 *
 * Credential requirements by medical specialty. Used by the
 * Intelligence Engine to identify missing credentials.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface SpecialtyRequirement {
  name: string;
  aliases: string[];
  required: boolean;
  description: string;
}

// ── Database ──────────────────────────────────────────────────────────────

const REQUIREMENTS: Record<string, SpecialtyRequirement[]> = {
  'Cardiology': [
    { name: 'ABIM Board Certification (Cardiovascular Disease)', aliases: ['abim', 'board cert', 'cardiovascular'], required: true, description: 'Required for independent practice in cardiology.' },
    { name: 'Active State Medical License', aliases: ['medical license', 'state license'], required: true, description: 'Required in each state of practice.' },
    { name: 'DEA Registration', aliases: ['dea'], required: true, description: 'Required for prescribing controlled substances.' },
    { name: 'Hospital Privileges', aliases: ['privileges', 'hospital'], required: true, description: 'Required for inpatient and procedural practice.' },
    { name: 'BLS/ACLS Certification', aliases: ['bls', 'acls'], required: true, description: 'Advanced cardiac life support required for interventional work.' },
    { name: 'CME Compliance (25+ hours/year)', aliases: ['cme', 'continuing education'], required: true, description: 'Ongoing education required for license maintenance.' },
    { name: 'Malpractice Insurance', aliases: ['malpractice', 'liability'], required: true, description: 'Professional liability coverage required by most employers.' },
  ],
  'Internal Medicine': [
    { name: 'ABIM Board Certification (Internal Medicine)', aliases: ['abim', 'board cert', 'internal medicine'], required: true, description: 'Required for board-certified internists.' },
    { name: 'Active State Medical License', aliases: ['medical license', 'state license'], required: true, description: 'Required in each state of practice.' },
    { name: 'DEA Registration', aliases: ['dea'], required: true, description: 'Required for prescribing controlled substances.' },
    { name: 'BLS Certification', aliases: ['bls'], required: true, description: 'Basic life support certification.' },
    { name: 'CME Compliance', aliases: ['cme', 'continuing education'], required: true, description: 'State-specific CME requirements.' },
    { name: 'Malpractice Insurance', aliases: ['malpractice', 'liability'], required: true, description: 'Professional liability coverage.' },
  ],
  'Emergency Medicine': [
    { name: 'ABEM Board Certification', aliases: ['abem', 'board cert', 'emergency'], required: true, description: 'American Board of Emergency Medicine certification.' },
    { name: 'Active State Medical License', aliases: ['medical license', 'state license'], required: true, description: 'Required in each state of practice.' },
    { name: 'DEA Registration', aliases: ['dea'], required: true, description: 'Required for prescribing controlled substances.' },
    { name: 'ATLS Certification', aliases: ['atls', 'trauma'], required: true, description: 'Advanced Trauma Life Support.' },
    { name: 'BLS/ACLS/PALS Certification', aliases: ['bls', 'acls', 'pals'], required: true, description: 'Full resuscitation suite required.' },
    { name: 'CME Compliance', aliases: ['cme'], required: true, description: 'CME hours per state requirements.' },
  ],
  'Family Medicine': [
    { name: 'ABFM Board Certification', aliases: ['abfm', 'board cert', 'family'], required: true, description: 'American Board of Family Medicine certification.' },
    { name: 'Active State Medical License', aliases: ['medical license', 'state license'], required: true, description: 'Required in each state of practice.' },
    { name: 'DEA Registration', aliases: ['dea'], required: true, description: 'Required for prescribing.' },
    { name: 'BLS Certification', aliases: ['bls'], required: true, description: 'Basic life support.' },
    { name: 'CME Compliance', aliases: ['cme'], required: true, description: 'State-specific CME requirements.' },
  ],
  'Surgery': [
    { name: 'ABS Board Certification', aliases: ['abs', 'board cert', 'surgery'], required: true, description: 'American Board of Surgery certification.' },
    { name: 'Active State Medical License', aliases: ['medical license', 'state license'], required: true, description: 'Required in each state of practice.' },
    { name: 'DEA Registration', aliases: ['dea'], required: true, description: 'Required for prescribing.' },
    { name: 'Hospital Privileges', aliases: ['privileges', 'hospital'], required: true, description: 'Required for surgical procedures.' },
    { name: 'ATLS Certification', aliases: ['atls', 'trauma'], required: true, description: 'Trauma certification for surgical specialties.' },
    { name: 'BLS/ACLS Certification', aliases: ['bls', 'acls'], required: true, description: 'Required for operative care.' },
  ],
};

// Default for unlisted specialties
const DEFAULT_REQUIREMENTS: SpecialtyRequirement[] = [
  { name: 'Active State Medical License', aliases: ['medical license', 'state license'], required: true, description: 'Required in each state of practice.' },
  { name: 'DEA Registration', aliases: ['dea'], required: true, description: 'Required for prescribing controlled substances.' },
  { name: 'Board Certification', aliases: ['board cert'], required: false, description: 'Board certification recommended for specialty practice.' },
  { name: 'BLS Certification', aliases: ['bls'], required: true, description: 'Basic life support certification.' },
  { name: 'CME Compliance', aliases: ['cme'], required: true, description: 'Continuing medical education requirements.' },
];

// ── Lookup ────────────────────────────────────────────────────────────────

export function getSpecialtyRequirements(specialty: string): SpecialtyRequirement[] {
  // Try exact match, then case-insensitive
  if (REQUIREMENTS[specialty]) return REQUIREMENTS[specialty];
  const key = Object.keys(REQUIREMENTS).find(
    (k) => k.toLowerCase() === specialty.toLowerCase(),
  );
  return key ? REQUIREMENTS[key] : DEFAULT_REQUIREMENTS;
}

export function listSpecialties(): string[] {
  return Object.keys(REQUIREMENTS);
}
