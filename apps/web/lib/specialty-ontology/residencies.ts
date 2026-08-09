/**
 * Entry residency program types — the roots of the training-path DAG.
 * Transcribed from the ACGME block-diagram table and the research doc's
 * residency entry table. Years are standard-track totals; `entry` describes
 * how the program is entered from medical school (categorical = starts PGY-1;
 * advanced = requires a separate preliminary/transitional PGY-1).
 *
 * Recorded gaps: combined residencies (Med-Peds, EM-IM, triple board…) and
 * ONMM/AOA-certified paths are a follow-up pass — absent here on purpose, not
 * forgotten.
 */

import type { ResidencyProgramType } from './types';

export const RESIDENCIES: readonly ResidencyProgramType[] = [
  { id: 'residency-transitional-year', name: 'Transitional Year / Preliminary Year', years: 1, entry: 'categorical', leadsTo: [], note: 'Feeder year for advanced-entry programs; not independently certifiable.' },
  { id: 'residency-family-medicine', name: 'Family Medicine', years: 3, entry: 'categorical', leadsTo: ['family-medicine'] },
  { id: 'residency-internal-medicine', name: 'Internal Medicine', years: 3, entry: 'categorical', leadsTo: ['internal-medicine'] },
  { id: 'residency-pediatrics', name: 'Pediatrics', years: 3, entry: 'categorical', leadsTo: ['pediatrics'] },
  { id: 'residency-emergency-medicine', name: 'Emergency Medicine', years: { min: 3, max: 4 }, entry: 'categorical', leadsTo: ['emergency-medicine'] },
  { id: 'residency-obstetrics-gynecology', name: 'Obstetrics and Gynecology', years: 4, entry: 'categorical', leadsTo: ['obstetrics-gynecology'] },
  { id: 'residency-psychiatry', name: 'Psychiatry', years: 4, entry: 'categorical', leadsTo: ['psychiatry'] },
  { id: 'residency-neurology', name: 'Neurology', years: 4, entry: 'either', leadsTo: ['neurology'] },
  { id: 'residency-child-neurology', name: 'Child Neurology', years: 5, entry: 'either', leadsTo: ['neurology-child'], note: '2 years pediatrics + 3 years child neurology.' },
  { id: 'residency-anesthesiology', name: 'Anesthesiology', years: 4, entry: 'either', leadsTo: ['anesthesiology'] },
  { id: 'residency-dermatology', name: 'Dermatology', years: 4, entry: 'advanced', leadsTo: ['dermatology'], note: '1 preliminary year + 3.' },
  { id: 'residency-ophthalmology', name: 'Ophthalmology', years: 4, entry: 'categorical', leadsTo: ['ophthalmology'], note: 'Integrated PGY-1 since ~2021.' },
  { id: 'residency-otolaryngology', name: 'Otolaryngology–Head and Neck Surgery', years: 5, entry: 'categorical', leadsTo: ['otolaryngology-hns'] },
  { id: 'residency-orthopaedic-surgery', name: 'Orthopaedic Surgery', years: 5, entry: 'categorical', leadsTo: ['orthopaedic-surgery'] },
  { id: 'residency-urology', name: 'Urology', years: 5, entry: 'categorical', leadsTo: ['urology'] },
  { id: 'residency-neurological-surgery', name: 'Neurological Surgery', years: 7, entry: 'categorical', leadsTo: ['neurological-surgery'] },
  { id: 'residency-general-surgery', name: 'General Surgery', years: 5, entry: 'categorical', leadsTo: ['general-surgery'] },
  { id: 'residency-vascular-surgery-integrated', name: 'Vascular Surgery (Integrated)', years: 5, entry: 'categorical', leadsTo: ['vascular-surgery'], note: 'Alternative path: general surgery + 2-year fellowship.' },
  { id: 'residency-thoracic-surgery-integrated', name: 'Thoracic Surgery (Integrated I-6)', years: 6, entry: 'categorical', leadsTo: ['thoracic-cardiac-surgery'], note: 'Alternative path: general surgery + 2–3-year fellowship.' },
  { id: 'residency-plastic-surgery-integrated', name: 'Plastic Surgery (Integrated)', years: 6, entry: 'categorical', leadsTo: ['plastic-surgery'], note: 'Independent path: prior full residency + 3 years.' },
  { id: 'residency-colon-rectal-surgery', name: 'Colon and Rectal Surgery', years: 6, entry: 'fellowship_style', leadsTo: ['colon-rectal-surgery'], note: '5 years general surgery + 1.' },
  { id: 'residency-diagnostic-radiology', name: 'Diagnostic Radiology', years: 5, entry: 'advanced', leadsTo: ['diagnostic-radiology'], note: '1 clinical year + 4.' },
  { id: 'residency-interventional-radiology-integrated', name: 'Interventional Radiology (Integrated)', years: 6, entry: 'advanced', leadsTo: ['interventional-radiology-diagnostic-radiology'], note: 'IR-Independent alternative: diagnostic radiology + 1–2 years.' },
  { id: 'residency-radiation-oncology', name: 'Radiation Oncology', years: 5, entry: 'advanced', leadsTo: ['radiation-oncology'], note: '1 clinical year + 4.' },
  { id: 'residency-nuclear-medicine', name: 'Nuclear Medicine', years: 4, entry: 'advanced', leadsTo: ['nuclear-medicine'], note: 'Many now train via diagnostic radiology + 16-month dual pathway.' },
  { id: 'residency-pathology', name: 'Pathology (AP/CP)', years: 4, entry: 'categorical', leadsTo: ['pathology-anatomic-clinical', 'pathology-anatomic', 'pathology-clinical'], note: 'AP-only or CP-only tracks are 3 years.' },
  { id: 'residency-physical-medicine-rehabilitation', name: 'Physical Medicine and Rehabilitation', years: 4, entry: 'either', leadsTo: ['physical-medicine-rehabilitation'] },
  { id: 'residency-medical-genetics', name: 'Medical Genetics and Genomics', years: 2, entry: 'special', leadsTo: ['clinical-genetics-genomics'], note: 'After ≥2 years of other GME, or a 4-year combined program.' },
  { id: 'residency-aerospace-medicine', name: 'Aerospace Medicine', years: 3, entry: 'advanced', leadsTo: ['aerospace-medicine'], note: '1 clinical year + 2.' },
  { id: 'residency-occupational-environmental-medicine', name: 'Occupational and Environmental Medicine', years: 3, entry: 'advanced', leadsTo: ['occupational-environmental-medicine'], note: '1 clinical year + 2.' },
  { id: 'residency-public-health-general-preventive-medicine', name: 'Public Health and General Preventive Medicine', years: 3, entry: 'advanced', leadsTo: ['public-health-general-preventive-medicine'], note: '1 clinical year + 2.' },
  { id: 'residency-allergy-immunology-fellowship', name: 'Allergy and Immunology Fellowship', years: 2, entry: 'fellowship_style', leadsTo: ['allergy-immunology'], note: 'Dual-parent specialty entered after internal medicine or pediatrics.' },
];
