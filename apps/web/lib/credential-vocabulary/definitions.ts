/**
 * Credential definitions — the curated core of the post-nominal vocabulary.
 *
 * Coverage (honest): the CLOSED lists are complete per their certifying bodies
 * (APRN roles, ABPTS, core BPS, NREMT); the OPEN lists (nursing certifications
 * ~180+, fellowship honorifics in the hundreds, 50-state license-title
 * matrices) ship as this high-frequency core — the fail-closed rule is that an
 * unknown token never renders, it enters a curation queue. State-variant
 * license titles (LSW/LISW/LMSW tier chaos) are a dedicated later pass.
 *
 * Tokens carry the OFFICIAL citation form (ASCP's 'MLS(ASCP)', ARRT's
 * 'R.T.(R)(ARRT)'). Sources: ANCC display standard + certification pages,
 * NCCPA, NBRC, ARRT, ASCP BOC, BPS, NREMT, ABPTS, ASHA, and the awarding
 * colleges' fellowship pages — catalogued in the research doc §D2.
 */

import type { CredentialDef } from './types';

export const CREDENTIAL_DEFS: readonly CredentialDef[] = [
  // ── Degrees: clinical doctorates (rank 300s render before other degrees) ───
  { id: 'md', token: 'MD', name: 'Doctor of Medicine', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physician'], field: 'medicine', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'do', token: 'DO', name: 'Doctor of Osteopathic Medicine', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physician'], field: 'medicine', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'mbbs', token: 'MBBS', name: 'Bachelor of Medicine, Bachelor of Surgery', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physician'], field: 'medicine', rank: 300, verifiability: 'on_request', status: 'active', note: 'International medical degree — rendered as earned, never silently converted to MD.' },
  { id: 'dpm', token: 'DPM', name: 'Doctor of Podiatric Medicine', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physician'], field: 'podiatric medicine', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'dds', token: 'DDS', name: 'Doctor of Dental Surgery', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'dentistry', rank: 300, verifiability: 'on_request', status: 'active', note: 'DDS and DMD are the identical degree; the school chooses the name.' },
  { id: 'dmd', token: 'DMD', name: 'Doctor of Dental Medicine', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'dentistry', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'od-degree', token: 'OD', name: 'Doctor of Optometry', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'optometry', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'pharmd', token: 'PharmD', name: 'Doctor of Pharmacy', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['pharmacist'], field: 'pharmacy', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'dpt', token: 'DPT', name: 'Doctor of Physical Therapy', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physical_therapist'], field: 'physical therapy', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'otd', token: 'OTD', name: 'Doctor of Occupational Therapy', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['occupational_therapist'], field: 'occupational therapy', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'aud', token: 'AuD', name: 'Doctor of Audiology', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['slp_audiology'], field: 'audiology', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'dnp', token: 'DNP', name: 'Doctor of Nursing Practice', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['nurse'], field: 'nursing', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'phd', token: 'PhD', name: 'Doctor of Philosophy', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'research', rank: 290, verifiability: 'on_request', status: 'active' },
  { id: 'psyd', token: 'PsyD', name: 'Doctor of Psychology', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['behavioral_health'], field: 'psychology', rank: 300, verifiability: 'on_request', status: 'active' },
  { id: 'drph', token: 'DrPH', name: 'Doctor of Public Health', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'public health', rank: 290, verifiability: 'on_request', status: 'active' },
  { id: 'dmsc', token: 'DMSc', name: 'Doctor of Medical Science', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physician_associate'], field: 'medical science', rank: 290, verifiability: 'on_request', status: 'active' },
  { id: 'dsw', token: 'DSW', name: 'Doctor of Social Work', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['behavioral_health'], field: 'social work', rank: 300, verifiability: 'on_request', status: 'active' },

  // ── Degrees: masters and bachelors (rank orders within-field dedup) ────────
  { id: 'mph', token: 'MPH', name: 'Master of Public Health', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'public health', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'mba', token: 'MBA', name: 'Master of Business Administration', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'business', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'mha', token: 'MHA', name: 'Master of Health Administration', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'health administration', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'ms', token: 'MS', name: 'Master of Science', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['any'], field: 'science', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'msn', token: 'MSN', name: 'Master of Science in Nursing', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['nurse'], field: 'nursing', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'msw', token: 'MSW', name: 'Master of Social Work', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['behavioral_health'], field: 'social work', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'mpas', token: 'MPAS', name: 'Master of Physician Assistant Studies', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['physician_associate'], field: 'pa studies', rank: 200, verifiability: 'on_request', status: 'active' },
  { id: 'bsn', token: 'BSN', name: 'Bachelor of Science in Nursing', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['nurse'], field: 'nursing', rank: 100, verifiability: 'on_request', status: 'active' },
  { id: 'adn', token: 'ADN', name: 'Associate Degree in Nursing', issuerId: 'academic-institution', kind: 'degree', professionScopes: ['nurse'], field: 'nursing', rank: 50, verifiability: 'on_request', status: 'active' },

  // ── Licenses (state boards; physicians by convention render no license) ────
  { id: 'rn', token: 'RN', name: 'Registered Nurse', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['nurse'], rank: 200, verifiability: 'public_registry', verifyUrl: 'https://www.nursys.com', status: 'active' },
  { id: 'lpn', token: 'LPN', name: 'Licensed Practical Nurse', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['nurse'], rank: 100, verifiability: 'public_registry', verifyUrl: 'https://www.nursys.com', status: 'active' },
  { id: 'lvn', token: 'LVN', name: 'Licensed Vocational Nurse', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['nurse'], rank: 100, verifiability: 'public_registry', verifyUrl: 'https://www.nursys.com', status: 'active', note: 'California and Texas title for the LPN license.' },
  { id: 'pt-license', token: 'PT', name: 'Physical Therapist (licensed)', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['physical_therapist'], rank: 200, verifiability: 'public_registry', status: 'active', note: 'APTA convention renders the license FIRST: "PT, DPT, OCS".' },
  { id: 'pta-license', token: 'PTA', name: 'Physical Therapist Assistant (licensed)', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['physical_therapist'], rank: 100, verifiability: 'public_registry', status: 'active' },
  { id: 'otr-l', token: 'OTR/L', name: 'Occupational Therapist, Registered and Licensed', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['occupational_therapist'], rank: 200, verifiability: 'public_registry', verifyUrl: 'https://www.nbcot.org', status: 'active', note: 'NBCOT registration (OTR) + state licensure (/L) in the conventional combined form.' },
  { id: 'rph', token: 'RPh', name: 'Registered Pharmacist', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['pharmacist'], rank: 200, verifiability: 'public_registry', status: 'active' },
  { id: 'lcsw', token: 'LCSW', name: 'Licensed Clinical Social Worker', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['behavioral_health'], rank: 200, verifiability: 'none', status: 'active', note: 'Clinical-tier title varies by state (LICSW/LISW/LCSW-C…) — state matrix is a later pass.' },
  { id: 'lmft', token: 'LMFT', name: 'Licensed Marriage and Family Therapist', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['behavioral_health'], rank: 200, verifiability: 'none', status: 'active' },
  { id: 'lpc', token: 'LPC', name: 'Licensed Professional Counselor', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['behavioral_health'], rank: 200, verifiability: 'none', status: 'active', note: 'Title varies by state (LMHC/LCPC/LCMHC…) — state matrix is a later pass.' },
  { id: 'rdh', token: 'RDH', name: 'Registered Dental Hygienist', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['any'], rank: 100, verifiability: 'none', status: 'active' },
  { id: 'lat', token: 'LAT', name: 'Licensed Athletic Trainer', issuerId: 'state-licensing-board', kind: 'license', professionScopes: ['athletic_training'], rank: 100, verifiability: 'none', status: 'active' },

  // ── State designations (APRN role designators; titles vary by state) ───────
  { id: 'aprn', token: 'APRN', name: 'Advanced Practice Registered Nurse', issuerId: 'state-licensing-board', kind: 'state_designation', professionScopes: ['nurse'], rank: 200, verifiability: 'public_registry', verifyUrl: 'https://www.nursys.com', status: 'active', note: 'Consensus-Model umbrella for the four APRN roles (NP, CNS, CRNA, CNM); designator spelling varies by state (ARNP, APN, CRNP, APNP).' },
  { id: 'np-designation', token: 'NP', name: 'Nurse Practitioner (state designation)', issuerId: 'state-licensing-board', kind: 'state_designation', professionScopes: ['nurse'], rank: 190, verifiability: 'public_registry', status: 'active' },

  // ── National certifications: APRN (issuer identity is load-bearing) ────────
  { id: 'fnp-bc', token: 'FNP-BC', name: 'Family Nurse Practitioner — Board Certified', issuerId: 'ancc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', verifyUrl: 'https://www.nursingworld.org/certification/verification/', status: 'active', note: 'ANCC award. Never normalize FNP-C↔FNP-BC — same role, different certifying body.' },
  { id: 'fnp-c', token: 'FNP-C', name: 'Family Nurse Practitioner — Certified', issuerId: 'aanpcb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', verifyUrl: 'https://www.aanpcert.org', status: 'active', note: 'AANPCB award.' },
  { id: 'agacnp-bc', token: 'AGACNP-BC', name: 'Adult-Gerontology Acute Care Nurse Practitioner — Board Certified', issuerId: 'ancc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', status: 'active' },
  { id: 'agpcnp-bc', token: 'AGPCNP-BC', name: 'Adult-Gerontology Primary Care Nurse Practitioner — Board Certified', issuerId: 'ancc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', status: 'active' },
  { id: 'agnp-c', token: 'A-GNP', name: 'Adult-Gerontology Nurse Practitioner — Certified', issuerId: 'aanpcb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', status: 'active' },
  { id: 'pmhnp-bc', token: 'PMHNP-BC', name: 'Psychiatric-Mental Health Nurse Practitioner — Board Certified', issuerId: 'ancc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', status: 'active' },
  { id: 'nnp-bc', token: 'NNP-BC', name: 'Neonatal Nurse Practitioner — Board Certified', issuerId: 'ncc-nursing', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'whnp-bc', token: 'WHNP-BC', name: "Women's Health Nurse Practitioner — Board Certified", issuerId: 'ncc-nursing', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cpnp-pc', token: 'CPNP-PC', name: 'Certified Pediatric Nurse Practitioner — Primary Care', issuerId: 'pncb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cpnp-ac', token: 'CPNP-AC', name: 'Certified Pediatric Nurse Practitioner — Acute Care', issuerId: 'pncb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'crna', token: 'CRNA', name: 'Certified Registered Nurse Anesthetist', issuerId: 'nbcrna', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cnm', token: 'CNM', name: 'Certified Nurse-Midwife', issuerId: 'amcb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },

  // ── National certifications: RN specialty (curated high-frequency core) ────
  { id: 'ccrn', token: 'CCRN', name: 'Critical Care Registered Nurse', issuerId: 'aacn-certcorp', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'pccn', token: 'PCCN', name: 'Progressive Care Certified Nurse', issuerId: 'aacn-certcorp', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cen', token: 'CEN', name: 'Certified Emergency Nurse', issuerId: 'bcen', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cpen', token: 'CPEN', name: 'Certified Pediatric Emergency Nurse', issuerId: 'bcen', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cfrn', token: 'CFRN', name: 'Certified Flight Registered Nurse', issuerId: 'bcen', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'tcrn', token: 'TCRN', name: 'Trauma Certified Registered Nurse', issuerId: 'bcen', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'rnc-ob', token: 'RNC-OB', name: 'Registered Nurse Certified — Inpatient Obstetric Nursing', issuerId: 'ncc-nursing', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'rnc-nic', token: 'RNC-NIC', name: 'Registered Nurse Certified — Neonatal Intensive Care', issuerId: 'ncc-nursing', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cpn', token: 'CPN', name: 'Certified Pediatric Nurse', issuerId: 'pncb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'ocn', token: 'OCN', name: 'Oncology Certified Nurse', issuerId: 'oncc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'aocnp', token: 'AOCNP', name: 'Advanced Oncology Certified Nurse Practitioner', issuerId: 'oncc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cmsrn', token: 'CMSRN', name: 'Certified Medical-Surgical Registered Nurse', issuerId: 'msncb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cnor', token: 'CNOR', name: 'Certified Perioperative Nurse', issuerId: 'cci-nursing', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cwocn', token: 'CWOCN', name: 'Certified Wound, Ostomy and Continence Nurse', issuerId: 'wocncb', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'cnrn', token: 'CNRN', name: 'Certified Neuroscience Registered Nurse', issuerId: 'abnn', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'scrn', token: 'SCRN', name: 'Stroke Certified Registered Nurse', issuerId: 'abnn', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'chpn', token: 'CHPN', name: 'Certified Hospice and Palliative Nurse', issuerId: 'hpcc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'crrn', token: 'CRRN', name: 'Certified Rehabilitation Registered Nurse', issuerId: 'arn', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'on_request', status: 'active' },
  { id: 'ibclc', token: 'IBCLC', name: 'International Board Certified Lactation Consultant', issuerId: 'iblce', kind: 'national_certification', professionScopes: ['nurse', 'any'], verifiability: 'public_registry', status: 'active' },
  { id: 'cdces', token: 'CDCES', name: 'Certified Diabetes Care and Education Specialist', issuerId: 'cbdce', kind: 'national_certification', professionScopes: ['any'], verifiability: 'on_request', status: 'active' },
  { id: 'medsurg-bc', token: 'MEDSURG-BC', name: 'Medical-Surgical Nursing — Board Certified', issuerId: 'ancc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', status: 'active' },
  { id: 'rn-bc-legacy', token: 'RN-BC', name: 'Registered Nurse — Board Certified (legacy ANCC style)', issuerId: 'ancc', kind: 'national_certification', professionScopes: ['nurse'], verifiability: 'public_registry', status: 'legacy', renamedToId: 'medsurg-bc', note: 'ANCC renamed the RN-BC family to specialty-BC style (e.g. MEDSURG-BC).' },

  // ── National certifications: PA / pharmacy / therapy / allied ──────────────
  { id: 'pa-c', token: 'PA-C', name: 'Physician Assistant — Certified', issuerId: 'nccpa', kind: 'national_certification', professionScopes: ['physician_associate'], verifiability: 'public_registry', verifyUrl: 'https://portal.nccpa.net/verifypac', status: 'active', note: 'Real-time public primary-source verification — rare in this space.' },
  { id: 'caq-em', token: 'CAQ-EM', name: 'Certificate of Added Qualifications in Emergency Medicine', issuerId: 'nccpa', kind: 'national_certification', professionScopes: ['physician_associate'], verifiability: 'public_registry', status: 'active', note: 'Holder must maintain PA-C.' },
  { id: 'caq-psychiatry', token: 'CAQ-Psychiatry', name: 'Certificate of Added Qualifications in Psychiatry', issuerId: 'nccpa', kind: 'national_certification', professionScopes: ['physician_associate'], verifiability: 'public_registry', status: 'active' },
  { id: 'bcps', token: 'BCPS', name: 'Board Certified Pharmacotherapy Specialist', issuerId: 'bps', kind: 'national_certification', professionScopes: ['pharmacist'], verifiability: 'public_registry', verifyUrl: 'https://www.bpsweb.org', status: 'active' },
  { id: 'bcacp', token: 'BCACP', name: 'Board Certified Ambulatory Care Pharmacist', issuerId: 'bps', kind: 'national_certification', professionScopes: ['pharmacist'], verifiability: 'public_registry', status: 'active' },
  { id: 'bcccp', token: 'BCCCP', name: 'Board Certified Critical Care Pharmacist', issuerId: 'bps', kind: 'national_certification', professionScopes: ['pharmacist'], verifiability: 'public_registry', status: 'active' },
  { id: 'bcop', token: 'BCOP', name: 'Board Certified Oncology Pharmacist', issuerId: 'bps', kind: 'national_certification', professionScopes: ['pharmacist'], verifiability: 'public_registry', status: 'active' },
  { id: 'bcpp', token: 'BCPP', name: 'Board Certified Psychiatric Pharmacist', issuerId: 'bps', kind: 'national_certification', professionScopes: ['pharmacist'], verifiability: 'public_registry', status: 'active' },
  { id: 'bcgp', token: 'BCGP', name: 'Board Certified Geriatric Pharmacist', issuerId: 'bps', kind: 'national_certification', professionScopes: ['pharmacist'], verifiability: 'public_registry', status: 'active' },
  { id: 'ocs', token: 'OCS', name: 'Orthopaedic Clinical Specialist', issuerId: 'abpts', kind: 'national_certification', professionScopes: ['physical_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'scs', token: 'SCS', name: 'Sports Clinical Specialist', issuerId: 'abpts', kind: 'national_certification', professionScopes: ['physical_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'ncs', token: 'NCS', name: 'Neurologic Clinical Specialist', issuerId: 'abpts', kind: 'national_certification', professionScopes: ['physical_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'gcs', token: 'GCS', name: 'Geriatric Clinical Specialist', issuerId: 'abpts', kind: 'national_certification', professionScopes: ['physical_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'pcs-pt', token: 'PCS', name: 'Pediatric Clinical Specialist', issuerId: 'abpts', kind: 'national_certification', professionScopes: ['physical_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'ccc-slp', token: 'CCC-SLP', name: 'Certificate of Clinical Competence in Speech-Language Pathology', issuerId: 'asha', kind: 'national_certification', professionScopes: ['slp_audiology'], verifiability: 'public_registry', verifyUrl: 'https://www.asha.org/certification/', status: 'active' },
  { id: 'ccc-a', token: 'CCC-A', name: 'Certificate of Clinical Competence in Audiology', issuerId: 'asha', kind: 'national_certification', professionScopes: ['slp_audiology'], verifiability: 'public_registry', status: 'active' },
  { id: 'rd', token: 'RD', name: 'Registered Dietitian', issuerId: 'cdr', kind: 'national_certification', professionScopes: ['dietetics'], verifiability: 'public_registry', verifyUrl: 'https://www.cdrnet.org', status: 'active', note: 'RD and RDN are interchangeable per CDR; render the holder\'s preference.' },
  { id: 'rdn', token: 'RDN', name: 'Registered Dietitian Nutritionist', issuerId: 'cdr', kind: 'national_certification', professionScopes: ['dietetics'], verifiability: 'public_registry', status: 'active' },
  { id: 'rrt', token: 'RRT', name: 'Registered Respiratory Therapist', issuerId: 'nbrc', kind: 'national_certification', professionScopes: ['respiratory_care'], verifiability: 'public_registry', status: 'active' },
  { id: 'crt', token: 'CRT', name: 'Certified Respiratory Therapist', issuerId: 'nbrc', kind: 'national_certification', professionScopes: ['respiratory_care'], verifiability: 'public_registry', status: 'active' },
  { id: 'rt-r-arrt', token: 'R.T.(R)(ARRT)', name: 'Registered Technologist — Radiography', issuerId: 'arrt', kind: 'national_certification', professionScopes: ['radiologic_technology'], verifiability: 'public_registry', verifyUrl: 'https://www.arrt.org', status: 'active', note: 'ARRT official multi-credential format: R.T.(R)(CT)(ARRT).' },
  { id: 'mls-ascp', token: 'MLS(ASCP)', name: 'Medical Laboratory Scientist', issuerId: 'ascp-boc', kind: 'national_certification', professionScopes: ['laboratory'], verifiability: 'public_registry', status: 'active', note: 'ASCP citation form; superscript CM marks maintained certification. Legacy MT/CLS tokens map here.' },
  { id: 'mt-ascp-legacy', token: 'MT(ASCP)', name: 'Medical Technologist (legacy ASCP credential)', issuerId: 'ascp-boc', kind: 'national_certification', professionScopes: ['laboratory'], verifiability: 'public_registry', status: 'legacy', renamedToId: 'mls-ascp' },
  { id: 'nrp-nremt', token: 'NRP', name: 'Nationally Registered Paramedic', issuerId: 'nremt', kind: 'national_certification', professionScopes: ['emergency_services'], verifiability: 'public_registry', verifyUrl: 'https://www.nremt.org', status: 'active', note: 'NREMT credential. The Neonatal Resuscitation Program COURSE also abbreviates NRP — a course completion, blocked from this vocabulary.' },
  { id: 'nremt', token: 'NREMT', name: 'Nationally Registered Emergency Medical Technician', issuerId: 'nremt', kind: 'national_certification', professionScopes: ['emergency_services'], verifiability: 'public_registry', status: 'active' },
  { id: 'atc', token: 'ATC', name: 'Certified Athletic Trainer', issuerId: 'boc-at', kind: 'national_certification', professionScopes: ['athletic_training'], verifiability: 'public_registry', status: 'active', note: 'Rendered "LAT, ATC" where state licensure exists.' },
  { id: 'bcba', token: 'BCBA', name: 'Board Certified Behavior Analyst', issuerId: 'bacb', kind: 'national_certification', professionScopes: ['behavioral_health'], verifiability: 'public_registry', verifyUrl: 'https://www.bacb.com', status: 'active' },
  { id: 'abpp-cert', token: 'ABPP', name: 'Board Certified, American Board of Professional Psychology', issuerId: 'abpp', kind: 'national_certification', professionScopes: ['behavioral_health'], verifiability: 'public_registry', status: 'active', note: 'Renders as a true suffix: "PhD, ABPP". 15 specialty boards.' },

  // ── Fellowship honors (peer-elected; least verifiable class — see research) ─
  { id: 'facp', token: 'FACP', name: 'Fellow of the American College of Physicians', issuerId: 'acp', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'macp', token: 'MACP', name: 'Master of the American College of Physicians', issuerId: 'acp', kind: 'fellowship_honor', professionScopes: ['physician'], rank: 10, verifiability: 'roster', status: 'active' },
  { id: 'facs', token: 'FACS', name: 'Fellow of the American College of Surgeons', issuerId: 'acs-surgeons', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'public_registry', verifyUrl: 'https://www.facs.org/find-a-surgeon/', status: 'active', note: 'Use is contingent on membership in good standing.' },
  { id: 'facc', token: 'FACC', name: 'Fellow of the American College of Cardiology', issuerId: 'acc-cardiology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'faap', token: 'FAAP', name: 'Fellow of the American Academy of Pediatrics', issuerId: 'aap-pediatrics', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'facog', token: 'FACOG', name: 'Fellow of the American College of Obstetricians and Gynecologists', issuerId: 'acog-obgyn', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'faan-neurology', token: 'FAAN', name: 'Fellow of the American Academy of Neurology', issuerId: 'aan-neurology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active', note: 'Token collision with the American Academy of Nursing FAAN — issuer disambiguates.' },
  { id: 'faan-nursing', token: 'FAAN', name: 'Fellow of the American Academy of Nursing', issuerId: 'aan-nursing', kind: 'fellowship_honor', professionScopes: ['nurse'], verifiability: 'public_registry', verifyUrl: 'https://www.aannet.org', status: 'active' },
  { id: 'facep', token: 'FACEP', name: 'Fellow of the American College of Emergency Physicians', issuerId: 'acep-em', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'faafp', token: 'FAAFP', name: 'Fellow of the American Academy of Family Physicians', issuerId: 'aafp-fm', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'fasco', token: 'FASCO', name: 'Fellow of the American Society of Clinical Oncology', issuerId: 'asco-oncology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fidsa', token: 'FIDSA', name: 'Fellow of the Infectious Diseases Society of America', issuerId: 'idsa-id', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fccp-chest', token: 'FCCP', name: 'Fellow of the American College of Chest Physicians', issuerId: 'chest-pulm', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active', note: 'Token collision with the American College of Clinical Pharmacy FCCP.' },
  { id: 'fccp-pharmacy', token: 'FCCP', name: 'Fellow of the American College of Clinical Pharmacy', issuerId: 'accp-pharmacy', kind: 'fellowship_honor', professionScopes: ['pharmacist'], verifiability: 'roster', status: 'active' },
  { id: 'fccm', token: 'FCCM', name: 'Fellow of the American College of Critical Care Medicine', issuerId: 'sccm-accm', kind: 'fellowship_honor', professionScopes: ['physician', 'nurse', 'pharmacist'], verifiability: 'roster', status: 'active', note: 'Multiprofessional college.' },
  { id: 'fasn', token: 'FASN', name: 'Fellow of the American Society of Nephrology', issuerId: 'asn-nephrology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'faha', token: 'FAHA', name: 'Fellow of the American Heart Association', issuerId: 'aha-heart', kind: 'fellowship_honor', professionScopes: ['physician', 'any'], verifiability: 'roster', status: 'active' },
  { id: 'fhrs', token: 'FHRS', name: 'Fellow of the Heart Rhythm Society', issuerId: 'hrs-ep', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fscai', token: 'FSCAI', name: 'Fellow of the Society for Cardiovascular Angiography and Interventions', issuerId: 'scai-interventional', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fase', token: 'FASE', name: 'Fellow of the American Society of Echocardiography', issuerId: 'ase-echocardiography', kind: 'fellowship_honor', professionScopes: ['physician', 'any'], verifiability: 'roster', status: 'active' },
  { id: 'facr-radiology', token: 'FACR', name: 'Fellow of the American College of Radiology', issuerId: 'acr-radiology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active', note: 'Org-acronym caution: the American College of Rheumatology honor is MACR, not FACR.' },
  { id: 'faans', token: 'FAANS', name: 'Fellow of the American Association of Neurological Surgeons', issuerId: 'aans-neurosurgery', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'faanp', token: 'FAANP', name: 'Fellow of the American Association of Nurse Practitioners', issuerId: 'aanp-np', kind: 'fellowship_honor', professionScopes: ['nurse'], verifiability: 'roster', verifyUrl: 'https://www.aanp.org/membership/fellows-program', status: 'active' },
  { id: 'dfaapa', token: 'DFAAPA', name: 'Distinguished Fellow of the American Academy of Physician Associates', issuerId: 'aapa-pa', kind: 'fellowship_honor', professionScopes: ['physician_associate'], verifiability: 'roster', status: 'active' },
  { id: 'fashp', token: 'FASHP', name: 'Fellow of the American Society of Health-System Pharmacists', issuerId: 'ashp-pharmacy', kind: 'fellowship_honor', professionScopes: ['pharmacist'], verifiability: 'roster', status: 'active' },
  { id: 'faao-optometry', token: 'FAAO', name: 'Fellow of the American Academy of Optometry', issuerId: 'aao-optometry', kind: 'fellowship_honor', professionScopes: ['any'], verifiability: 'roster', status: 'active', note: 'Token collision with the American Academy of Osteopathy FAAO.' },
  { id: 'faao-osteopathy', token: 'FAAO', name: 'Fellow of the American Academy of Osteopathy', issuerId: 'aao-osteopathy', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'faad', token: 'FAAD', name: 'Fellow of the American Academy of Dermatology', issuerId: 'aad-dermatology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
  { id: 'faaos', token: 'FAAOS', name: 'Fellow of the American Academy of Orthopaedic Surgeons', issuerId: 'aaos-ortho', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active', note: 'Post-nominal adopted 2020.' },
  { id: 'facg', token: 'FACG', name: 'Fellow of the American College of Gastroenterology', issuerId: 'acg-gastro', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'agaf', token: 'AGAF', name: 'Fellow of the American Gastroenterological Association', issuerId: 'aga-gastro', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fasge', token: 'FASGE', name: 'Fellow of the American Society for Gastrointestinal Endoscopy', issuerId: 'asge-endoscopy', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fasa', token: 'FASA', name: 'Fellow of the American Society of Anesthesiologists', issuerId: 'asa-anesthesiology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'fapa', token: 'FAPA', name: 'Fellow of the American Psychiatric Association', issuerId: 'apa-psychiatry', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active', note: 'The American Psychological Association fellows also informally render FAPA.' },
  { id: 'fasam', token: 'FASAM', name: 'Fellow of the American Society of Addiction Medicine', issuerId: 'asam-addiction', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'faahpm', token: 'FAAHPM', name: 'Fellow of the American Academy of Hospice and Palliative Medicine', issuerId: 'aahpm-palliative', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'facmg', token: 'FACMG', name: 'Fellow of the American College of Medical Genetics and Genomics', issuerId: 'acmg-genetics', kind: 'fellowship_honor', professionScopes: ['physician', 'any'], verifiability: 'roster', status: 'active' },
  { id: 'fcap', token: 'FCAP', name: 'Fellow of the College of American Pathologists', issuerId: 'cap-pathology', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'faaem', token: 'FAAEM', name: 'Fellow of the American Academy of Emergency Medicine', issuerId: 'aaem-em', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'facpm', token: 'FACPM', name: 'Fellow of the American College of Preventive Medicine', issuerId: 'acpm-preventive', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'roster', status: 'active' },
  { id: 'facsm', token: 'FACSM', name: 'Fellow of the American College of Sports Medicine', issuerId: 'acsm-sportsmed', kind: 'fellowship_honor', professionScopes: ['physician', 'any'], verifiability: 'roster', status: 'active' },
  { id: 'fache', token: 'FACHE', name: 'Fellow of the American College of Healthcare Executives', issuerId: 'ache-healthcare-execs', kind: 'fellowship_honor', professionScopes: ['healthcare_admin'], verifiability: 'public_registry', status: 'active' },
  { id: 'famia', token: 'FAMIA', name: 'Fellow of the American Medical Informatics Association', issuerId: 'amia-informatics', kind: 'fellowship_honor', professionScopes: ['informatics', 'any'], verifiability: 'roster', status: 'active' },
  { id: 'faota', token: 'FAOTA', name: 'Fellow of the American Occupational Therapy Association', issuerId: 'aota', kind: 'fellowship_honor', professionScopes: ['occupational_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'fapta', token: 'FAPTA', name: 'Catherine Worthingham Fellow of the American Physical Therapy Association', issuerId: 'apta', kind: 'fellowship_honor', professionScopes: ['physical_therapist'], verifiability: 'roster', status: 'active' },
  { id: 'frcp', token: 'FRCP', name: 'Fellow of the Royal College of Physicians', issuerId: 'royal-college-physicians-uk', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active', note: 'U.S. clinicians legitimately hold UK/Commonwealth college post-nominals.' },
  { id: 'mrcp', token: 'MRCP', name: 'Member of the Royal College of Physicians', issuerId: 'royal-college-physicians-uk', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active', note: 'Exam-earned membership (unlike elected fellowships).' },
  { id: 'frcs', token: 'FRCS', name: 'Fellow of the Royal College of Surgeons', issuerId: 'royal-college-surgeons', kind: 'fellowship_honor', professionScopes: ['physician'], verifiability: 'on_request', status: 'active' },
];

/**
 * Course completions that masquerade as credentials — never renderable as
 * post-nominals, never admissible to CREDENTIAL_DEFS as tokens.
 * (NRP the NREMT paramedic credential IS in the vocabulary; NRP the Neonatal
 * Resuscitation Program course is what this blocks — kind-level blocklist by
 * exact token for the unambiguous course-only cases.)
 */
export const COURSE_COMPLETION_BLOCKLIST: readonly string[] = ['BLS', 'ACLS', 'PALS', 'ATLS', 'NRP-course'];
