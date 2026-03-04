/**
 * regulatoryContacts.ts — Wave 65: Regulatory Contact Directory
 *
 * State medical boards, DEA offices, and credentialing bodies.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface RegulatoryContact {
  id: string;
  name: string;
  type: 'medical_board' | 'dea' | 'credentialing_body' | 'specialty_board';
  state?: string;
  phone?: string;
  email?: string;
  website: string;
}

// ── Directory ─────────────────────────────────────────────────────────────

const CONTACTS: RegulatoryContact[] = [
  // State Medical Boards (sample)
  { id: 'mb-ca', name: 'Medical Board of California', type: 'medical_board', state: 'CA', phone: '(916) 263-2382', website: 'https://mbc.ca.gov' },
  { id: 'mb-ny', name: 'New York State Education Dept — Medicine', type: 'medical_board', state: 'NY', phone: '(518) 474-3817', website: 'https://op.nysed.gov' },
  { id: 'mb-tx', name: 'Texas Medical Board', type: 'medical_board', state: 'TX', phone: '(512) 305-7010', website: 'https://tmb.state.tx.us' },
  { id: 'mb-fl', name: 'Florida Board of Medicine', type: 'medical_board', state: 'FL', phone: '(850) 245-4131', website: 'https://flboardofmedicine.gov' },
  { id: 'mb-il', name: 'Illinois DFPR — Medicine', type: 'medical_board', state: 'IL', phone: '(217) 785-0800', website: 'https://idfpr.illinois.gov' },
  { id: 'mb-pa', name: 'Pennsylvania State Board of Medicine', type: 'medical_board', state: 'PA', phone: '(717) 783-1400', website: 'https://dos.pa.gov/med' },
  { id: 'mb-oh', name: 'State Medical Board of Ohio', type: 'medical_board', state: 'OH', phone: '(614) 466-3934', website: 'https://med.ohio.gov' },
  { id: 'mb-az', name: 'Arizona Medical Board', type: 'medical_board', state: 'AZ', phone: '(480) 551-2700', website: 'https://azmd.gov' },
  { id: 'mb-wa', name: 'Washington Medical Commission', type: 'medical_board', state: 'WA', phone: '(360) 236-2750', website: 'https://wmc.wa.gov' },
  { id: 'mb-co', name: 'Colorado Medical Board', type: 'medical_board', state: 'CO', phone: '(303) 894-7800', website: 'https://dora.colorado.gov' },

  // DEA
  { id: 'dea-hq', name: 'DEA Diversion Control Division', type: 'dea', phone: '(202) 307-7165', website: 'https://deadiversion.usdoj.gov' },
  { id: 'dea-reg', name: 'DEA Registration', type: 'dea', phone: '(800) 882-9539', email: 'dea.registration@usdoj.gov', website: 'https://apps.deadiversion.usdoj.gov' },

  // Credentialing Bodies
  { id: 'ncqa', name: 'NCQA (National Committee for Quality Assurance)', type: 'credentialing_body', phone: '(888) 275-7585', website: 'https://ncqa.org' },
  { id: 'jc', name: 'The Joint Commission', type: 'credentialing_body', phone: '(630) 792-5000', website: 'https://jointcommission.org' },
  { id: 'npdb', name: 'National Practitioner Data Bank', type: 'credentialing_body', phone: '(800) 767-6732', website: 'https://npdb.hrsa.gov' },
  { id: 'npi-reg', name: 'NPI Registry (NPPES)', type: 'credentialing_body', website: 'https://npiregistry.cms.hhs.gov' },

  // Specialty Boards
  { id: 'abms', name: 'American Board of Medical Specialties', type: 'specialty_board', phone: '(312) 436-2600', website: 'https://abms.org' },
  { id: 'abim', name: 'American Board of Internal Medicine', type: 'specialty_board', phone: '(800) 441-2246', website: 'https://abim.org' },
  { id: 'abem', name: 'American Board of Emergency Medicine', type: 'specialty_board', phone: '(517) 332-4800', website: 'https://abem.org' },
  { id: 'abs', name: 'American Board of Surgery', type: 'specialty_board', phone: '(215) 568-4000', website: 'https://absurgery.org' },
  { id: 'abfm', name: 'American Board of Family Medicine', type: 'specialty_board', phone: '(877) 223-7437', website: 'https://theabfm.org' },
];

// ── Lookup ────────────────────────────────────────────────────────────────

export function getAllContacts(): RegulatoryContact[] {
  return CONTACTS;
}

export function getContactsByState(state: string): RegulatoryContact[] {
  const upper = state.toUpperCase();
  return CONTACTS.filter((c) => c.state === upper || !c.state);
}

export function getContactsByType(type: RegulatoryContact['type']): RegulatoryContact[] {
  return CONTACTS.filter((c) => c.type === type);
}

export function getContact(id: string): RegulatoryContact | undefined {
  return CONTACTS.find((c) => c.id === id);
}
