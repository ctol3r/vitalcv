/**
 * ABMS specialty and subspecialty certificates — one node per certificate,
 * with multi-board issuance modeled as edges (the ABMS structural reality that
 * Doximity-style flat specialty lists cannot represent).
 *
 * Transcribed from the ABMS Guide to Medical Specialties 2026 and the ABMS
 * "Requirements for Initial Certification — Subspecialty" table (2025-06).
 * Board ids reference lib/institutions/curated.ts entries of kind 'board'.
 *
 * Recorded gaps (deliberate, per accuracy-over-completeness):
 * - AOA (osteopathic) certificates are not yet modeled; AOA boards exist in the
 *   institutions directory but their 24 primary / 48 subspecialty certificates
 *   await a dedicated curation pass.
 * - Non-ABMS certification (UCNS, AABIP, ASOPRS, ABOM, CAST…) is out of scope
 *   here; those attach to training-only fellowship types in a later wave.
 * - Medical Physics is one entry here; ABMS counts its three disciplines
 *   (Diagnostic / Nuclear / Therapeutic) separately, which is why published
 *   primary-certificate counts vary (36 nodes here ↔ "38 specialty" at ABMS).
 * - `admin` flags are set only where the requirements table names the
 *   administering board; co-sponsored certificates without a documented admin
 *   board carry none rather than a guess.
 */

import type { SpecialtyCertificate } from './types';

export const CERTIFICATES: readonly SpecialtyCertificate[] = [
  // ── Primary certificates ───────────────────────────────────────────────────
  { id: 'allergy-immunology', name: 'Allergy and Immunology', level: 'primary', issuingBoards: [{ boardId: 'abai' }], prerequisiteNote: 'Entered via a 2-year fellowship after internal medicine or pediatrics (dual-parent specialty).' },
  { id: 'anesthesiology', name: 'Anesthesiology', level: 'primary', issuingBoards: [{ boardId: 'aba' }] },
  { id: 'colon-rectal-surgery', name: 'Colon and Rectal Surgery', level: 'primary', issuingBoards: [{ boardId: 'abcrs' }], prerequisites: ['general-surgery'], note: 'Entered after a general surgery residency (+1 year).' },
  { id: 'dermatology', name: 'Dermatology', level: 'primary', issuingBoards: [{ boardId: 'abd' }] },
  { id: 'emergency-medicine', name: 'Emergency Medicine', level: 'primary', issuingBoards: [{ boardId: 'abem' }] },
  { id: 'family-medicine', name: 'Family Medicine', level: 'primary', issuingBoards: [{ boardId: 'abfm' }] },
  { id: 'internal-medicine', name: 'Internal Medicine', level: 'primary', issuingBoards: [{ boardId: 'abim' }] },
  { id: 'clinical-biochemical-genetics', name: 'Clinical Biochemical Genetics', level: 'primary', issuingBoards: [{ boardId: 'abmgg' }] },
  { id: 'clinical-genetics-genomics', name: 'Clinical Genetics and Genomics (MD)', level: 'primary', issuingBoards: [{ boardId: 'abmgg' }] },
  { id: 'laboratory-genetics-genomics', name: 'Laboratory Genetics and Genomics', level: 'primary', issuingBoards: [{ boardId: 'abmgg' }] },
  { id: 'neurological-surgery', name: 'Neurological Surgery', level: 'primary', issuingBoards: [{ boardId: 'abns' }] },
  { id: 'nuclear-medicine', name: 'Nuclear Medicine', level: 'primary', issuingBoards: [{ boardId: 'abnm' }] },
  { id: 'obstetrics-gynecology', name: 'Obstetrics and Gynecology', level: 'primary', issuingBoards: [{ boardId: 'abog' }] },
  { id: 'ophthalmology', name: 'Ophthalmology', level: 'primary', issuingBoards: [{ boardId: 'abo' }] },
  { id: 'orthopaedic-surgery', name: 'Orthopaedic Surgery', level: 'primary', issuingBoards: [{ boardId: 'abos' }] },
  { id: 'otolaryngology-hns', name: 'Otolaryngology–Head and Neck Surgery', level: 'primary', issuingBoards: [{ boardId: 'abohns' }] },
  { id: 'pathology-anatomic-clinical', name: 'Pathology–Anatomic/Clinical', level: 'primary', issuingBoards: [{ boardId: 'abpath' }] },
  { id: 'pathology-anatomic', name: 'Pathology–Anatomic', level: 'primary', issuingBoards: [{ boardId: 'abpath' }] },
  { id: 'pathology-clinical', name: 'Pathology–Clinical', level: 'primary', issuingBoards: [{ boardId: 'abpath' }] },
  { id: 'pediatrics', name: 'Pediatrics', level: 'primary', issuingBoards: [{ boardId: 'abp' }] },
  { id: 'physical-medicine-rehabilitation', name: 'Physical Medicine and Rehabilitation', level: 'primary', issuingBoards: [{ boardId: 'abpmr' }] },
  { id: 'plastic-surgery', name: 'Plastic Surgery', level: 'primary', issuingBoards: [{ boardId: 'abplsurg' }] },
  { id: 'aerospace-medicine', name: 'Aerospace Medicine', level: 'primary', issuingBoards: [{ boardId: 'abprevmed' }] },
  { id: 'occupational-environmental-medicine', name: 'Occupational and Environmental Medicine', level: 'primary', issuingBoards: [{ boardId: 'abprevmed' }] },
  { id: 'public-health-general-preventive-medicine', name: 'Public Health and General Preventive Medicine', level: 'primary', issuingBoards: [{ boardId: 'abprevmed' }] },
  { id: 'psychiatry', name: 'Psychiatry', level: 'primary', issuingBoards: [{ boardId: 'abpn' }] },
  { id: 'neurology', name: 'Neurology', level: 'primary', issuingBoards: [{ boardId: 'abpn' }] },
  { id: 'neurology-child', name: 'Neurology with Special Qualification in Child Neurology', level: 'primary', issuingBoards: [{ boardId: 'abpn' }] },
  { id: 'diagnostic-radiology', name: 'Diagnostic Radiology', level: 'primary', issuingBoards: [{ boardId: 'abr' }] },
  { id: 'interventional-radiology-diagnostic-radiology', name: 'Interventional Radiology and Diagnostic Radiology', level: 'primary', issuingBoards: [{ boardId: 'abr' }] },
  { id: 'radiation-oncology', name: 'Radiation Oncology', level: 'primary', issuingBoards: [{ boardId: 'abr' }] },
  { id: 'medical-physics', name: 'Medical Physics', level: 'primary', issuingBoards: [{ boardId: 'abr' }], note: 'Three disciplines (Diagnostic / Nuclear / Therapeutic); ABMS counts them separately.' },
  { id: 'general-surgery', name: 'General Surgery', level: 'primary', issuingBoards: [{ boardId: 'abs' }] },
  { id: 'vascular-surgery', name: 'Vascular Surgery', level: 'primary', issuingBoards: [{ boardId: 'abs' }], note: 'Integrated 0+5 residency, or 5-year general surgery + 2-year fellowship.' },
  { id: 'thoracic-cardiac-surgery', name: 'Thoracic and Cardiac Surgery', level: 'primary', issuingBoards: [{ boardId: 'abts' }], note: 'Integrated I-6 residency, or general surgery + 2–3-year fellowship.' },
  { id: 'urology', name: 'Urology', level: 'primary', issuingBoards: [{ boardId: 'abu' }] },

  // ── Internal-medicine subspecialty tree ────────────────────────────────────
  { id: 'cardiovascular-disease', name: 'Cardiovascular Disease', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 3 },
  { id: 'interventional-cardiology', name: 'Interventional Cardiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['cardiovascular-disease'], fellowshipYears: 1 },
  { id: 'clinical-cardiac-electrophysiology', name: 'Clinical Cardiac Electrophysiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['cardiovascular-disease'], fellowshipYears: 2 },
  { id: 'adult-congenital-heart-disease', name: 'Adult Congenital Heart Disease', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['cardiovascular-disease'], fellowshipYears: 2 },
  { id: 'advanced-heart-failure-transplant-cardiology', name: 'Advanced Heart Failure and Transplant Cardiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['cardiovascular-disease'], fellowshipYears: 1 },
  { id: 'gastroenterology', name: 'Gastroenterology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 3 },
  { id: 'transplant-hepatology', name: 'Transplant Hepatology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['gastroenterology'], fellowshipYears: 1 },
  { id: 'pulmonary-disease', name: 'Pulmonary Disease', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2, note: 'Combined pulmonary/critical-care fellowships (3 years) lead to two certificates.' },
  { id: 'hematology', name: 'Hematology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2, note: 'Combined hematology/medical-oncology fellowships (3 years) lead to two certificates.' },
  { id: 'medical-oncology', name: 'Medical Oncology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2 },
  { id: 'endocrinology-diabetes-metabolism', name: 'Endocrinology, Diabetes and Metabolism', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2 },
  { id: 'infectious-disease', name: 'Infectious Disease', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2 },
  { id: 'nephrology', name: 'Nephrology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2 },
  { id: 'rheumatology', name: 'Rheumatology', level: 'subspecialty', issuingBoards: [{ boardId: 'abim' }], prerequisites: ['internal-medicine'], fellowshipYears: 2 },

  // ── Pediatrics subspecialty tree ───────────────────────────────────────────
  { id: 'neonatal-perinatal-medicine', name: 'Neonatal-Perinatal Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-cardiology', name: 'Pediatric Cardiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-critical-care-medicine', name: 'Pediatric Critical Care Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-endocrinology', name: 'Pediatric Endocrinology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-gastroenterology', name: 'Pediatric Gastroenterology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-hematology-oncology', name: 'Pediatric Hematology-Oncology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-infectious-diseases', name: 'Pediatric Infectious Diseases', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-nephrology', name: 'Pediatric Nephrology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-pulmonology', name: 'Pediatric Pulmonology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-rheumatology', name: 'Pediatric Rheumatology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'child-abuse-pediatrics', name: 'Child Abuse Pediatrics', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'developmental-behavioral-pediatrics', name: 'Developmental-Behavioral Pediatrics', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 3 },
  { id: 'pediatric-hospital-medicine', name: 'Pediatric Hospital Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatrics'], fellowshipYears: 2, emerging: true },
  { id: 'pediatric-transplant-hepatology', name: 'Pediatric Transplant Hepatology', level: 'subspecialty', issuingBoards: [{ boardId: 'abp' }], prerequisites: ['pediatric-gastroenterology'], fellowshipYears: 1 },

  // ── Psychiatry & neurology subspecialty trees ──────────────────────────────
  { id: 'child-adolescent-psychiatry', name: 'Child and Adolescent Psychiatry', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['psychiatry'], fellowshipYears: 2 },
  { id: 'addiction-psychiatry', name: 'Addiction Psychiatry', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['psychiatry'], fellowshipYears: 1 },
  { id: 'forensic-psychiatry', name: 'Forensic Psychiatry', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['psychiatry'], fellowshipYears: 1 },
  { id: 'geriatric-psychiatry', name: 'Geriatric Psychiatry', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['psychiatry'], fellowshipYears: 1 },
  { id: 'consultation-liaison-psychiatry', name: 'Consultation-Liaison Psychiatry', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['psychiatry'], fellowshipYears: 1 },
  { id: 'vascular-neurology', name: 'Vascular Neurology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['neurology'], fellowshipYears: 1 },
  { id: 'clinical-neurophysiology', name: 'Clinical Neurophysiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['neurology'], fellowshipYears: 1 },
  { id: 'epilepsy', name: 'Epilepsy', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisites: ['neurology'], fellowshipYears: 1 },
  { id: 'neuromuscular-medicine', name: 'Neuromuscular Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }, { boardId: 'abpmr' }], prerequisites: ['neurology', 'physical-medicine-rehabilitation'], fellowshipYears: 1 },
  { id: 'neurodevelopmental-disabilities', name: 'Neurodevelopmental Disabilities', level: 'subspecialty', issuingBoards: [{ boardId: 'abpn' }], prerequisiteNote: 'Six-year combined pathway (2 years pediatrics + 4).' },

  // ── Radiology subspecialty tree ────────────────────────────────────────────
  { id: 'neuroradiology', name: 'Neuroradiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abr' }], prerequisites: ['diagnostic-radiology', 'interventional-radiology-diagnostic-radiology'], fellowshipYears: 1 },
  { id: 'nuclear-radiology', name: 'Nuclear Radiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abr' }], prerequisites: ['diagnostic-radiology'], fellowshipYears: 1 },
  { id: 'pediatric-radiology', name: 'Pediatric Radiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abr' }], prerequisites: ['diagnostic-radiology'], fellowshipYears: 1 },

  // ── Pathology subspecialty tree ────────────────────────────────────────────
  { id: 'blood-banking-transfusion-medicine', name: 'Blood Banking/Transfusion Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-clinical'], fellowshipYears: 1 },
  { id: 'cytopathology', name: 'Cytopathology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-anatomic'], fellowshipYears: 1 },
  { id: 'forensic-pathology', name: 'Forensic Pathology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-anatomic'], fellowshipYears: 1 },
  { id: 'hematopathology', name: 'Hematopathology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-clinical'], fellowshipYears: 1 },
  { id: 'chemical-pathology', name: 'Chemical Pathology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-clinical'], fellowshipYears: 1 },
  { id: 'medical-microbiology-pathology', name: 'Medical Microbiology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-clinical'], fellowshipYears: 1 },
  { id: 'pediatric-pathology', name: 'Pediatric Pathology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-anatomic'], fellowshipYears: 1 },
  { id: 'neuropathology', name: 'Neuropathology', level: 'subspecialty', issuingBoards: [{ boardId: 'abpath' }], prerequisites: ['pathology-anatomic-clinical', 'pathology-anatomic'], fellowshipYears: 2 },

  // ── OB/GYN subspecialty tree ───────────────────────────────────────────────
  { id: 'gynecologic-oncology', name: 'Gynecologic Oncology', level: 'subspecialty', issuingBoards: [{ boardId: 'abog' }], prerequisites: ['obstetrics-gynecology'], fellowshipYears: 3 },
  { id: 'maternal-fetal-medicine', name: 'Maternal-Fetal Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abog' }], prerequisites: ['obstetrics-gynecology'], fellowshipYears: 3 },
  { id: 'reproductive-endocrinology-infertility', name: 'Reproductive Endocrinology and Infertility', level: 'subspecialty', issuingBoards: [{ boardId: 'abog' }], prerequisites: ['obstetrics-gynecology'], fellowshipYears: 3 },
  { id: 'complex-family-planning', name: 'Complex Family Planning', level: 'subspecialty', issuingBoards: [{ boardId: 'abog' }], prerequisites: ['obstetrics-gynecology'], fellowshipYears: 2, emerging: true },

  // ── Surgery subspecialty tree ──────────────────────────────────────────────
  { id: 'surgical-critical-care', name: 'Surgical Critical Care', level: 'subspecialty', issuingBoards: [{ boardId: 'abs' }], prerequisites: ['general-surgery', 'vascular-surgery'], fellowshipYears: 1 },
  { id: 'pediatric-surgery', name: 'Pediatric Surgery', level: 'subspecialty', issuingBoards: [{ boardId: 'abs' }], prerequisites: ['general-surgery'], fellowshipYears: 2 },
  { id: 'complex-general-surgical-oncology', name: 'Complex General Surgical Oncology', level: 'subspecialty', issuingBoards: [{ boardId: 'abs' }], prerequisites: ['general-surgery'], fellowshipYears: 2 },

  // ── ENT / derm / anesthesiology / MGG / thoracic / urology trees ───────────
  { id: 'neurotology', name: 'Neurotology', level: 'subspecialty', issuingBoards: [{ boardId: 'abohns' }], prerequisites: ['otolaryngology-hns'], fellowshipYears: 2 },
  { id: 'complex-pediatric-otolaryngology', name: 'Complex Pediatric Otolaryngology', level: 'subspecialty', issuingBoards: [{ boardId: 'abohns' }], prerequisites: ['otolaryngology-hns'], fellowshipYears: 1, emerging: true },
  { id: 'plastic-surgery-head-neck', name: 'Plastic Surgery within the Head and Neck', level: 'subspecialty', issuingBoards: [{ boardId: 'abohns' }, { boardId: 'abplsurg' }], prerequisites: ['otolaryngology-hns', 'plastic-surgery'] },
  { id: 'micrographic-dermatologic-surgery', name: 'Micrographic Dermatologic Surgery', level: 'subspecialty', issuingBoards: [{ boardId: 'abd' }], prerequisites: ['dermatology'], fellowshipYears: { min: 1, max: 2 }, emerging: true },
  { id: 'pediatric-dermatology', name: 'Pediatric Dermatology', level: 'subspecialty', issuingBoards: [{ boardId: 'abd' }], prerequisites: ['dermatology'], fellowshipYears: { min: 1, max: 2 } },
  { id: 'adult-cardiac-anesthesiology', name: 'Adult Cardiac Anesthesiology', level: 'subspecialty', issuingBoards: [{ boardId: 'aba' }], prerequisites: ['anesthesiology'], fellowshipYears: 1, emerging: true },
  { id: 'pediatric-anesthesiology', name: 'Pediatric Anesthesiology', level: 'subspecialty', issuingBoards: [{ boardId: 'aba' }], prerequisites: ['anesthesiology'], fellowshipYears: 1 },
  { id: 'medical-biochemical-genetics', name: 'Medical Biochemical Genetics', level: 'subspecialty', issuingBoards: [{ boardId: 'abmgg' }], prerequisites: ['clinical-genetics-genomics'], fellowshipYears: 1 },
  { id: 'congenital-cardiac-surgery', name: 'Congenital Cardiac Surgery', level: 'subspecialty', issuingBoards: [{ boardId: 'abts' }], prerequisites: ['thoracic-cardiac-surgery'], fellowshipYears: 2 },
  { id: 'pediatric-urology', name: 'Pediatric Urology', level: 'subspecialty', issuingBoards: [{ boardId: 'abu' }], prerequisites: ['urology'], fellowshipYears: 2 },
  { id: 'spinal-cord-injury-medicine', name: 'Spinal Cord Injury Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abpmr' }], prerequisites: ['physical-medicine-rehabilitation'], fellowshipYears: 1 },
  { id: 'pediatric-rehabilitation-medicine', name: 'Pediatric Rehabilitation Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abpmr' }], prerequisites: ['physical-medicine-rehabilitation'] },
  { id: 'orthopaedic-sports-medicine', name: 'Orthopaedic Sports Medicine', level: 'subspecialty', issuingBoards: [{ boardId: 'abos' }], prerequisites: ['orthopaedic-surgery'], fellowshipYears: 1 },

  // ── Co-sponsored / multi-board certificates (one node, many issuers) ───────
  {
    id: 'sports-medicine',
    name: 'Sports Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abfm', admin: true }, { boardId: 'abem' }, { boardId: 'abim' }, { boardId: 'abp' }, { boardId: 'abpmr' }],
    prerequisites: ['family-medicine', 'emergency-medicine', 'internal-medicine', 'pediatrics', 'physical-medicine-rehabilitation'],
    fellowshipYears: 1,
  },
  {
    id: 'hospice-palliative-medicine',
    name: 'Hospice and Palliative Medicine',
    level: 'subspecialty',
    issuingBoards: [
      { boardId: 'abim', admin: true }, { boardId: 'aba' }, { boardId: 'abem' }, { boardId: 'abfm' },
      { boardId: 'abog' }, { boardId: 'abp' }, { boardId: 'abpmr' }, { boardId: 'abpn' },
      { boardId: 'abr' }, { boardId: 'abs' },
    ],
    prerequisiteNote: 'Underlying certificate accepted from 14 co-sponsoring ABMS boards (ABMS subspecialty requirements table, 2025-06).',
    fellowshipYears: 1,
  },
  {
    id: 'pain-medicine',
    name: 'Pain Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'aba', admin: true }, { boardId: 'abem' }, { boardId: 'abfm' }, { boardId: 'abpmr' }, { boardId: 'abpn' }, { boardId: 'abr' }],
    prerequisites: ['anesthesiology', 'emergency-medicine', 'family-medicine', 'physical-medicine-rehabilitation', 'psychiatry', 'neurology', 'diagnostic-radiology'],
    fellowshipYears: 1,
  },
  {
    id: 'sleep-medicine',
    name: 'Sleep Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abim', admin: true }, { boardId: 'aba' }, { boardId: 'abfm' }, { boardId: 'abohns' }, { boardId: 'abp' }, { boardId: 'abpn' }],
    prerequisites: ['internal-medicine', 'anesthesiology', 'family-medicine', 'otolaryngology-hns', 'pediatrics', 'psychiatry', 'neurology'],
    fellowshipYears: 1,
  },
  {
    id: 'critical-care-medicine-anesthesiology',
    name: 'Critical Care Medicine (Anesthesiology)',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'aba', admin: true }, { boardId: 'abem' }, { boardId: 'abog' }],
    prerequisites: ['anesthesiology', 'emergency-medicine', 'obstetrics-gynecology'],
    fellowshipYears: { min: 1, max: 2 },
  },
  {
    id: 'critical-care-medicine-internal-medicine',
    name: 'Critical Care Medicine (Internal Medicine)',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abim', admin: true }, { boardId: 'abem' }],
    prerequisites: ['internal-medicine', 'emergency-medicine'],
    fellowshipYears: 2,
  },
  {
    id: 'neurocritical-care',
    name: 'Neurocritical Care',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abpn', admin: true }, { boardId: 'aba' }, { boardId: 'abem' }, { boardId: 'abim' }, { boardId: 'abns' }, { boardId: 'abs' }],
    prerequisiteNote: 'Underlying certificate from a co-sponsoring board.',
    fellowshipYears: { min: 1, max: 2 },
    emerging: true,
  },
  {
    id: 'addiction-medicine',
    name: 'Addiction Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abprevmed' }],
    prerequisiteNote: 'Open to diplomates of any ABMS member board.',
    fellowshipYears: 1,
  },
  {
    id: 'clinical-informatics',
    name: 'Clinical Informatics',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abprevmed', admin: true }, { boardId: 'abpath' }],
    prerequisiteNote: 'Open to diplomates of any ABMS member board (ABPM route); ABPath route for pathologists.',
    fellowshipYears: 2,
  },
  {
    id: 'medical-toxicology',
    name: 'Medical Toxicology',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abem', admin: true }, { boardId: 'abp' }, { boardId: 'abprevmed' }],
    prerequisites: ['emergency-medicine', 'pediatrics', 'aerospace-medicine', 'occupational-environmental-medicine', 'public-health-general-preventive-medicine'],
    fellowshipYears: 2,
  },
  {
    id: 'undersea-hyperbaric-medicine',
    name: 'Undersea and Hyperbaric Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abem', admin: true }, { boardId: 'abprevmed' }],
    prerequisites: ['emergency-medicine', 'aerospace-medicine', 'occupational-environmental-medicine', 'public-health-general-preventive-medicine'],
    fellowshipYears: 1,
  },
  {
    id: 'emergency-medical-services',
    name: 'Emergency Medical Services',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abem', admin: true }],
    prerequisiteNote: 'Any ABMS certificate accepted.',
    fellowshipYears: 1,
  },
  {
    id: 'health-care-administration-leadership-management',
    name: 'Health Care Administration, Leadership and Management',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'aba' }, { boardId: 'abem' }, { boardId: 'abfm' }, { boardId: 'abprevmed' }],
    prerequisiteNote: 'Underlying certificate from a co-sponsoring board; ACGME institution-based fellowship.',
    fellowshipYears: 1,
    emerging: true,
  },
  {
    id: 'brain-injury-medicine',
    name: 'Brain Injury Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abpmr', admin: true }, { boardId: 'abpn' }],
    prerequisites: ['physical-medicine-rehabilitation', 'psychiatry', 'neurology', 'neurology-child'],
    fellowshipYears: 1,
  },
  {
    id: 'adolescent-medicine',
    name: 'Adolescent Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abp', admin: true }, { boardId: 'abfm' }, { boardId: 'abim' }],
    prerequisites: ['pediatrics', 'family-medicine', 'internal-medicine'],
    fellowshipYears: { min: 2, max: 3 },
  },
  {
    id: 'pediatric-emergency-medicine',
    name: 'Pediatric Emergency Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abp', admin: true }, { boardId: 'abem' }],
    prerequisites: ['pediatrics', 'emergency-medicine'],
    fellowshipYears: { min: 2, max: 3 },
  },
  {
    id: 'surgery-of-the-hand',
    name: 'Surgery of the Hand',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abos', admin: true }, { boardId: 'abplsurg' }],
    prerequisites: ['orthopaedic-surgery', 'plastic-surgery'],
    fellowshipYears: 1,
  },
  {
    id: 'dermatopathology',
    name: 'Dermatopathology',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abpath', admin: true }, { boardId: 'abd' }],
    prerequisites: ['dermatology', 'pathology-anatomic-clinical', 'pathology-anatomic'],
    fellowshipYears: { min: 1, max: 2 },
  },
  {
    id: 'urogynecology-reconstructive-pelvic-surgery',
    name: 'Urogynecology and Reconstructive Pelvic Surgery',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abog' }, { boardId: 'abu' }],
    prerequisites: ['obstetrics-gynecology', 'urology'],
    fellowshipYears: { min: 2, max: 3 },
    emerging: true,
    note: 'Jointly issued; 3 years from OB/GYN, 2 from urology.',
  },
  {
    id: 'molecular-genetic-pathology',
    name: 'Molecular Genetic Pathology',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abpath', admin: true }, { boardId: 'abmgg' }],
    prerequisites: ['pathology-anatomic-clinical', 'pathology-anatomic', 'pathology-clinical', 'clinical-genetics-genomics', 'laboratory-genetics-genomics'],
    fellowshipYears: 1,
  },
  {
    id: 'geriatric-medicine',
    name: 'Geriatric Medicine',
    level: 'subspecialty',
    issuingBoards: [{ boardId: 'abim' }, { boardId: 'abfm' }],
    prerequisites: ['internal-medicine', 'family-medicine'],
    fellowshipYears: 1,
  },
];
