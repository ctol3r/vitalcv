/**
 * Credential issuers — the entities that award degrees, licenses,
 * certifications, and fellowship honors. Issuers are first-class rows because
 * acronyms collide (two AANs, two ACRs, two FAAO-awarding academies…);
 * a credential's identity is (token, issuer), never the token alone.
 *
 * `institutionId` links to lib/institutions/curated.ts where the issuer is
 * already in the curated directory (referential integrity is test-enforced).
 */

import type { CredentialIssuer } from './types';

export const CREDENTIAL_ISSUERS: readonly CredentialIssuer[] = [
  // Generic issuers (degrees and state licensure have no single national body)
  { id: 'academic-institution', name: 'Accredited academic institution' },
  { id: 'state-licensing-board', name: 'State licensing board' },

  // Nursing certification bodies
  { id: 'ancc', name: 'American Nurses Credentialing Center', abbrev: 'ANCC' },
  { id: 'aanpcb', name: 'American Academy of Nurse Practitioners Certification Board', abbrev: 'AANPCB' },
  { id: 'nbcrna', name: 'National Board of Certification and Recertification for Nurse Anesthetists', abbrev: 'NBCRNA' },
  { id: 'amcb', name: 'American Midwifery Certification Board', abbrev: 'AMCB' },
  { id: 'aacn-certcorp', name: 'AACN Certification Corporation', abbrev: 'AACN Cert Corp' },
  { id: 'bcen', name: 'Board of Certification for Emergency Nursing', abbrev: 'BCEN' },
  { id: 'ncc-nursing', name: 'National Certification Corporation', abbrev: 'NCC' },
  { id: 'pncb', name: 'Pediatric Nursing Certification Board', abbrev: 'PNCB' },
  { id: 'oncc', name: 'Oncology Nursing Certification Corporation', abbrev: 'ONCC' },
  { id: 'msncb', name: 'Medical-Surgical Nursing Certification Board', abbrev: 'MSNCB' },
  { id: 'cci-nursing', name: 'Competency & Credentialing Institute', abbrev: 'CCI' },
  { id: 'wocncb', name: 'Wound, Ostomy and Continence Nursing Certification Board', abbrev: 'WOCNCB' },
  { id: 'abnn', name: 'American Board of Neuroscience Nursing', abbrev: 'ABNN' },
  { id: 'hpcc', name: 'Hospice and Palliative Credentialing Center', abbrev: 'HPCC' },
  { id: 'arn', name: 'Association of Rehabilitation Nurses', abbrev: 'ARN' },
  { id: 'iblce', name: 'International Board of Lactation Consultant Examiners', abbrev: 'IBLCE' },
  { id: 'cbdce', name: 'Certification Board for Diabetes Care and Education', abbrev: 'CBDCE' },

  // PA / allied certification bodies
  { id: 'nccpa', name: 'National Commission on Certification of Physician Assistants', abbrev: 'NCCPA' },
  { id: 'bps', name: 'Board of Pharmacy Specialties', abbrev: 'BPS' },
  { id: 'abpts', name: 'American Board of Physical Therapy Specialties', abbrev: 'ABPTS' },
  { id: 'nbcot', name: 'National Board for Certification in Occupational Therapy', abbrev: 'NBCOT' },
  { id: 'asha', name: 'American Speech-Language-Hearing Association', abbrev: 'ASHA' },
  { id: 'cdr', name: 'Commission on Dietetic Registration', abbrev: 'CDR' },
  { id: 'nbrc', name: 'National Board for Respiratory Care', abbrev: 'NBRC' },
  { id: 'arrt', name: 'American Registry of Radiologic Technologists', abbrev: 'ARRT' },
  { id: 'ascp-boc', name: 'American Society for Clinical Pathology Board of Certification', abbrev: 'ASCP BOC', institutionId: 'ascp-pathology' },
  { id: 'nremt', name: 'National Registry of Emergency Medical Technicians', abbrev: 'NREMT' },
  { id: 'boc-at', name: 'Board of Certification for the Athletic Trainer', abbrev: 'BOC' },
  { id: 'bacb', name: 'Behavior Analyst Certification Board', abbrev: 'BACB' },
  { id: 'abpp', name: 'American Board of Professional Psychology', abbrev: 'ABPP' },

  // Fellowship-honor awarding colleges / academies / societies
  { id: 'acp', name: 'American College of Physicians', abbrev: 'ACP', institutionId: 'acp' },
  { id: 'acs-surgeons', name: 'American College of Surgeons', abbrev: 'ACS', institutionId: 'acs' },
  { id: 'acc-cardiology', name: 'American College of Cardiology', abbrev: 'ACC', institutionId: 'acc' },
  { id: 'aap-pediatrics', name: 'American Academy of Pediatrics', abbrev: 'AAP', institutionId: 'aap' },
  { id: 'acog-obgyn', name: 'American College of Obstetricians and Gynecologists', abbrev: 'ACOG', institutionId: 'acog' },
  { id: 'aan-neurology', name: 'American Academy of Neurology', abbrev: 'AAN', institutionId: 'aan' },
  { id: 'aan-nursing', name: 'American Academy of Nursing', abbrev: 'AAN' },
  { id: 'acep-em', name: 'American College of Emergency Physicians', abbrev: 'ACEP', institutionId: 'acep' },
  { id: 'aafp-fm', name: 'American Academy of Family Physicians', abbrev: 'AAFP', institutionId: 'aafp' },
  { id: 'asco-oncology', name: 'American Society of Clinical Oncology', abbrev: 'ASCO', institutionId: 'asco' },
  { id: 'idsa-id', name: 'Infectious Diseases Society of America', abbrev: 'IDSA', institutionId: 'idsa' },
  { id: 'chest-pulm', name: 'American College of Chest Physicians', abbrev: 'CHEST', institutionId: 'chest' },
  { id: 'accp-pharmacy', name: 'American College of Clinical Pharmacy', abbrev: 'ACCP' },
  { id: 'sccm-accm', name: 'American College of Critical Care Medicine (SCCM)', abbrev: 'ACCM', institutionId: 'sccm' },
  { id: 'asn-nephrology', name: 'American Society of Nephrology', abbrev: 'ASN', institutionId: 'asn' },
  { id: 'aha-heart', name: 'American Heart Association', abbrev: 'AHA' },
  { id: 'hrs-ep', name: 'Heart Rhythm Society', abbrev: 'HRS' },
  { id: 'scai-interventional', name: 'Society for Cardiovascular Angiography and Interventions', abbrev: 'SCAI' },
  { id: 'ase-echocardiography', name: 'American Society of Echocardiography', abbrev: 'ASE', institutionId: 'ase-echo' },
  { id: 'acr-radiology', name: 'American College of Radiology', abbrev: 'ACR', institutionId: 'acr-radiology' },
  { id: 'aans-neurosurgery', name: 'American Association of Neurological Surgeons', abbrev: 'AANS', institutionId: 'aans' },
  { id: 'aanp-np', name: 'American Association of Nurse Practitioners', abbrev: 'AANP', institutionId: 'aanp' },
  { id: 'aapa-pa', name: 'American Academy of Physician Associates', abbrev: 'AAPA', institutionId: 'aapa' },
  { id: 'ashp-pharmacy', name: 'American Society of Health-System Pharmacists', abbrev: 'ASHP' },
  { id: 'aao-optometry', name: 'American Academy of Optometry', abbrev: 'AAO' },
  { id: 'aao-osteopathy', name: 'American Academy of Osteopathy', abbrev: 'AAO' },
  { id: 'aad-dermatology', name: 'American Academy of Dermatology', abbrev: 'AAD', institutionId: 'aad' },
  { id: 'aaos-ortho', name: 'American Academy of Orthopaedic Surgeons', abbrev: 'AAOS', institutionId: 'aaos' },
  { id: 'acg-gastro', name: 'American College of Gastroenterology', abbrev: 'ACG', institutionId: 'acg' },
  { id: 'aga-gastro', name: 'American Gastroenterological Association', abbrev: 'AGA', institutionId: 'aga' },
  { id: 'asge-endoscopy', name: 'American Society for Gastrointestinal Endoscopy', abbrev: 'ASGE', institutionId: 'asge' },
  { id: 'asa-anesthesiology', name: 'American Society of Anesthesiologists', abbrev: 'ASA', institutionId: 'asa' },
  { id: 'apa-psychiatry', name: 'American Psychiatric Association', abbrev: 'APA', institutionId: 'apa-psychiatry' },
  { id: 'asam-addiction', name: 'American Society of Addiction Medicine', abbrev: 'ASAM', institutionId: 'asam' },
  { id: 'aahpm-palliative', name: 'American Academy of Hospice and Palliative Medicine', abbrev: 'AAHPM', institutionId: 'aahpm' },
  { id: 'acmg-genetics', name: 'American College of Medical Genetics and Genomics', abbrev: 'ACMG', institutionId: 'acmg' },
  { id: 'cap-pathology', name: 'College of American Pathologists', abbrev: 'CAP', institutionId: 'cap-pathologists' },
  { id: 'aaem-em', name: 'American Academy of Emergency Medicine', abbrev: 'AAEM' },
  { id: 'acpm-preventive', name: 'American College of Preventive Medicine', abbrev: 'ACPM', institutionId: 'acpm' },
  { id: 'acsm-sportsmed', name: 'American College of Sports Medicine', abbrev: 'ACSM' },
  { id: 'ache-healthcare-execs', name: 'American College of Healthcare Executives', abbrev: 'ACHE' },
  { id: 'amia-informatics', name: 'American Medical Informatics Association', abbrev: 'AMIA', institutionId: 'amia' },
  { id: 'aota', name: 'American Occupational Therapy Association', abbrev: 'AOTA' },
  { id: 'apta', name: 'American Physical Therapy Association', abbrev: 'APTA' },
  { id: 'royal-college-physicians-uk', name: 'Royal College of Physicians (UK)', abbrev: 'RCP' },
  { id: 'royal-college-surgeons', name: 'Royal Colleges of Surgeons (UK/Ireland)', abbrev: 'RCS' },
];
