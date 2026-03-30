export type RoleKey = 'physician' | 'nurse_practitioner' | 'physician_assistant';

export type CredentialKey =
  | 'npi'
  | 'state_license'
  | 'board_cert'
  | 'dea'
  | 'malpractice'
  | 'cv'
  | 'sanctions';

export type CredentialTemplate = {
  key: CredentialKey;
  label: string;
  required: boolean;
  description: string;
};

export const ROLE_TEMPLATES: Record<RoleKey, { label: string; items: CredentialTemplate[] }> = {
  physician: {
    label: 'Physician (MD/DO)',
    items: [
      { key: 'npi', label: 'NPI', required: true, description: 'Identity anchor for registry lookups.' },
      { key: 'state_license', label: 'State Medical License', required: true, description: 'Active + in-good-standing.' },
      { key: 'board_cert', label: 'Board Certification', required: true, description: 'Board status + expiration.' },
      { key: 'dea', label: 'DEA', required: false, description: 'If prescribing controlled substances.' },
      { key: 'malpractice', label: 'Malpractice / Claims', required: true, description: 'Coverage + claims history where applicable.' },
      { key: 'cv', label: 'Curriculum Vitae', required: true, description: 'Employment + training history.' },
      { key: 'sanctions', label: 'Sanctions Check', required: true, description: 'OIG exclusions screening. NPDB requires separate institutional access.' },
    ],
  },
  nurse_practitioner: {
    label: 'Nurse Practitioner (NP)',
    items: [
      { key: 'npi', label: 'NPI', required: true, description: 'Identity anchor for registry lookups.' },
      { key: 'state_license', label: 'State License', required: true, description: 'Active nursing license.' },
      { key: 'board_cert', label: 'National Certification', required: true, description: 'AANP/ANCC status.' },
      { key: 'dea', label: 'DEA', required: false, description: 'If prescribing controlled substances.' },
      { key: 'malpractice', label: 'Malpractice / Claims', required: true, description: 'Coverage + claims history where applicable.' },
      { key: 'cv', label: 'Curriculum Vitae', required: true, description: 'Employment + training history.' },
      { key: 'sanctions', label: 'Sanctions Check', required: true, description: 'OIG / exclusions screening.' },
    ],
  },
  physician_assistant: {
    label: 'Physician Assistant (PA)',
    items: [
      { key: 'npi', label: 'NPI', required: true, description: 'Identity anchor for registry lookups.' },
      { key: 'state_license', label: 'State License', required: true, description: 'Active PA license.' },
      { key: 'board_cert', label: 'NCCPA Certification', required: true, description: 'Certification status + expiration.' },
      { key: 'dea', label: 'DEA', required: false, description: 'If prescribing controlled substances.' },
      { key: 'malpractice', label: 'Malpractice / Claims', required: true, description: 'Coverage + claims history where applicable.' },
      { key: 'cv', label: 'Curriculum Vitae', required: true, description: 'Employment + training history.' },
      { key: 'sanctions', label: 'Sanctions Check', required: true, description: 'OIG / exclusions screening.' },
    ],
  },
};
