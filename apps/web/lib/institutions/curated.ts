/**
 * Curated US medical-institution reference data — the seed vocabulary for
 * clinician-profile autocomplete and (when a clinician selects one) nodes in the
 * career knowledge graph.
 *
 * Provenance + honesty: this is a hand-curated reference DIRECTORY of public,
 * well-known institutions. It is NOT a verification, an endorsement, or a claim
 * that any clinician is affiliated with any entry. A clinician selecting an entry
 * is self-reported ("User-entered") until source-backed — same truth contract as
 * the rest of the profile.
 *
 * Coverage (2026-07): specialty boards (ABMS + AOA), major professional
 * societies, associations, honor societies, and accreditors are reasonably
 * complete for the common cases. Medical schools here are the major US MD/DO
 * institutions — a high-signal SUBSET; the full LCME (~157 MD) + AACOM (~40 DO)
 * roster is a bulk-data ingestion follow-up (see docs / the datasets memo), as is
 * the ~13k ACGME residency/fellowship program list and NPPES Type-2 employers.
 * Accuracy over completeness: uncertain entries were omitted, never invented.
 */

export type InstitutionKind =
  | 'med_school_md'
  | 'med_school_do'
  | 'board'
  | 'society'
  | 'association'
  | 'honor_society'
  | 'accreditor';

export interface Institution {
  /** Stable, unique kebab-case slug (safe as a graph node id / form value). */
  id: string;
  name: string;
  kind: InstitutionKind;
  /** Common acronym, where one is widely used. */
  abbrev?: string;
  city?: string;
  /** 2-letter US state / DC. */
  state?: string;
}

export const KIND_LABEL: Record<InstitutionKind, string> = {
  med_school_md: 'Medical school (MD)',
  med_school_do: 'Medical school (DO)',
  board: 'Specialty board',
  society: 'Professional society',
  association: 'Association',
  honor_society: 'Honor society',
  accreditor: 'Accreditor / assessment',
};

export const INSTITUTIONS: readonly Institution[] = [
  // ── ABMS member boards (24) ────────────────────────────────────────────────
  { id: 'abai', name: 'American Board of Allergy and Immunology', kind: 'board', abbrev: 'ABAI' },
  { id: 'aba', name: 'American Board of Anesthesiology', kind: 'board', abbrev: 'ABA' },
  { id: 'abcrs', name: 'American Board of Colon and Rectal Surgery', kind: 'board', abbrev: 'ABCRS' },
  { id: 'abd', name: 'American Board of Dermatology', kind: 'board', abbrev: 'ABD' },
  { id: 'abem', name: 'American Board of Emergency Medicine', kind: 'board', abbrev: 'ABEM' },
  { id: 'abfm', name: 'American Board of Family Medicine', kind: 'board', abbrev: 'ABFM' },
  { id: 'abim', name: 'American Board of Internal Medicine', kind: 'board', abbrev: 'ABIM' },
  { id: 'abmgg', name: 'American Board of Medical Genetics and Genomics', kind: 'board', abbrev: 'ABMGG' },
  { id: 'abns', name: 'American Board of Neurological Surgery', kind: 'board', abbrev: 'ABNS' },
  { id: 'abnm', name: 'American Board of Nuclear Medicine', kind: 'board', abbrev: 'ABNM' },
  { id: 'abog', name: 'American Board of Obstetrics and Gynecology', kind: 'board', abbrev: 'ABOG' },
  { id: 'abo', name: 'American Board of Ophthalmology', kind: 'board', abbrev: 'ABO' },
  { id: 'abos', name: 'American Board of Orthopaedic Surgery', kind: 'board', abbrev: 'ABOS' },
  { id: 'abohns', name: 'American Board of Otolaryngology–Head and Neck Surgery', kind: 'board', abbrev: 'ABOHNS' },
  { id: 'abpath', name: 'American Board of Pathology', kind: 'board', abbrev: 'ABPath' },
  { id: 'abp', name: 'American Board of Pediatrics', kind: 'board', abbrev: 'ABP' },
  { id: 'abpmr', name: 'American Board of Physical Medicine and Rehabilitation', kind: 'board', abbrev: 'ABPMR' },
  { id: 'abplsurg', name: 'American Board of Plastic Surgery', kind: 'board', abbrev: 'ABPS' },
  { id: 'abprevmed', name: 'American Board of Preventive Medicine', kind: 'board', abbrev: 'ABPM' },
  { id: 'abpn', name: 'American Board of Psychiatry and Neurology', kind: 'board', abbrev: 'ABPN' },
  { id: 'abr', name: 'American Board of Radiology', kind: 'board', abbrev: 'ABR' },
  { id: 'abs', name: 'American Board of Surgery', kind: 'board', abbrev: 'ABS' },
  { id: 'abts', name: 'American Board of Thoracic Surgery', kind: 'board', abbrev: 'ABTS' },
  { id: 'abu', name: 'American Board of Urology', kind: 'board', abbrev: 'ABU' },

  // ── AOA osteopathic specialty boards ───────────────────────────────────────
  { id: 'aobim', name: 'American Osteopathic Board of Internal Medicine', kind: 'board', abbrev: 'AOBIM' },
  { id: 'aobfp', name: 'American Osteopathic Board of Family Physicians', kind: 'board', abbrev: 'AOBFP' },
  { id: 'aobem', name: 'American Osteopathic Board of Emergency Medicine', kind: 'board', abbrev: 'AOBEM' },
  { id: 'aobs', name: 'American Osteopathic Board of Surgery', kind: 'board', abbrev: 'AOBS' },
  { id: 'aobp', name: 'American Osteopathic Board of Pediatrics', kind: 'board', abbrev: 'AOBP' },
  { id: 'aoba', name: 'American Osteopathic Board of Anesthesiology', kind: 'board', abbrev: 'AOBA' },
  { id: 'aobr', name: 'American Osteopathic Board of Radiology', kind: 'board', abbrev: 'AOBR' },
  { id: 'aobpa', name: 'American Osteopathic Board of Pathology', kind: 'board', abbrev: 'AOBPa' },
  { id: 'aobd', name: 'American Osteopathic Board of Dermatology', kind: 'board', abbrev: 'AOBD' },
  { id: 'aobog', name: 'American Osteopathic Board of Obstetrics and Gynecology', kind: 'board', abbrev: 'AOBOG' },
  { id: 'aobnp', name: 'American Osteopathic Board of Neurology and Psychiatry', kind: 'board', abbrev: 'AOBNP' },
  { id: 'aobos', name: 'American Osteopathic Board of Orthopedic Surgery', kind: 'board', abbrev: 'AOBOS' },
  { id: 'aoboo', name: 'American Osteopathic Board of Ophthalmology and Otolaryngology', kind: 'board', abbrev: 'AOBOO' },
  { id: 'aobpmr', name: 'American Osteopathic Board of Physical Medicine and Rehabilitation', kind: 'board', abbrev: 'AOBPMR' },
  { id: 'aobprm', name: 'American Osteopathic Board of Preventive Medicine', kind: 'board', abbrev: 'AOBPM' },
  { id: 'aobnmm', name: 'American Osteopathic Board of Neuromusculoskeletal Medicine', kind: 'board', abbrev: 'AOBNMM' },

  // ── Professional societies ─────────────────────────────────────────────────
  { id: 'acp', name: 'American College of Physicians', kind: 'society', abbrev: 'ACP' },
  { id: 'acs', name: 'American College of Surgeons', kind: 'society', abbrev: 'ACS' },
  { id: 'aap', name: 'American Academy of Pediatrics', kind: 'society', abbrev: 'AAP' },
  { id: 'aafp', name: 'American Academy of Family Physicians', kind: 'society', abbrev: 'AAFP' },
  { id: 'acog', name: 'American College of Obstetricians and Gynecologists', kind: 'society', abbrev: 'ACOG' },
  { id: 'acep', name: 'American College of Emergency Physicians', kind: 'society', abbrev: 'ACEP' },
  { id: 'asa', name: 'American Society of Anesthesiologists', kind: 'society', abbrev: 'ASA' },
  { id: 'aaos', name: 'American Academy of Orthopaedic Surgeons', kind: 'society', abbrev: 'AAOS' },
  { id: 'aan', name: 'American Academy of Neurology', kind: 'society', abbrev: 'AAN' },
  { id: 'acc', name: 'American College of Cardiology', kind: 'society', abbrev: 'ACC' },
  { id: 'acr-radiology', name: 'American College of Radiology', kind: 'society', abbrev: 'ACR' },
  { id: 'apa-psychiatry', name: 'American Psychiatric Association', kind: 'society', abbrev: 'APA' },
  { id: 'aad', name: 'American Academy of Dermatology', kind: 'society', abbrev: 'AAD' },
  { id: 'aga', name: 'American Gastroenterological Association', kind: 'society', abbrev: 'AGA' },
  { id: 'asco', name: 'American Society of Clinical Oncology', kind: 'society', abbrev: 'ASCO' },
  { id: 'aua', name: 'American Urological Association', kind: 'society', abbrev: 'AUA' },
  { id: 'aao-ophth', name: 'American Academy of Ophthalmology', kind: 'society', abbrev: 'AAO' },
  { id: 'acr-rheumatology', name: 'American College of Rheumatology', kind: 'society', abbrev: 'ACR' },
  { id: 'ats', name: 'American Thoracic Society', kind: 'society', abbrev: 'ATS' },
  { id: 'asn', name: 'American Society of Nephrology', kind: 'society', abbrev: 'ASN' },
  { id: 'aao-hns', name: 'American Academy of Otolaryngology–Head and Neck Surgery', kind: 'society', abbrev: 'AAO-HNS' },
  { id: 'chest', name: 'American College of Chest Physicians', kind: 'society', abbrev: 'CHEST' },
  { id: 'ash', name: 'American Society of Hematology', kind: 'society', abbrev: 'ASH' },
  { id: 'aans', name: 'American Association of Neurological Surgeons', kind: 'society', abbrev: 'AANS' },
  { id: 'acg', name: 'American College of Gastroenterology', kind: 'society', abbrev: 'ACG' },
  { id: 'sccm', name: 'Society of Critical Care Medicine', kind: 'society', abbrev: 'SCCM' },
  { id: 'aapmr-society', name: 'American Academy of Physical Medicine and Rehabilitation', kind: 'society', abbrev: 'AAPM&R' },
  { id: 'acpm', name: 'American College of Preventive Medicine', kind: 'society', abbrev: 'ACPM' },
  { id: 'idsa', name: 'Infectious Diseases Society of America', kind: 'society', abbrev: 'IDSA' },
  { id: 'endocrine-society', name: 'Endocrine Society', kind: 'society' },
  { id: 'asps', name: 'American Society of Plastic Surgeons', kind: 'society', abbrev: 'ASPS' },
  { id: 'aaaai', name: 'American Academy of Allergy, Asthma & Immunology', kind: 'society', abbrev: 'AAAAI' },
  { id: 'astro', name: 'American Society for Radiation Oncology', kind: 'society', abbrev: 'ASTRO' },
  { id: 'acmg', name: 'American College of Medical Genetics and Genomics', kind: 'society', abbrev: 'ACMG' },
  { id: 'ags', name: 'American Geriatrics Society', kind: 'society', abbrev: 'AGS' },
  { id: 'shm', name: 'Society of Hospital Medicine', kind: 'society', abbrev: 'SHM' },
  { id: 'aahpm', name: 'American Academy of Hospice and Palliative Medicine', kind: 'society', abbrev: 'AAHPM' },
  { id: 'acoem', name: 'American College of Occupational and Environmental Medicine', kind: 'society', abbrev: 'ACOEM' },
  { id: 'smfm', name: 'Society for Maternal-Fetal Medicine', kind: 'society', abbrev: 'SMFM' },
  { id: 'ascrs', name: 'American Society of Colon and Rectal Surgeons', kind: 'society', abbrev: 'ASCRS' },

  // ── Associations ───────────────────────────────────────────────────────────
  { id: 'ama', name: 'American Medical Association', kind: 'association', abbrev: 'AMA' },
  { id: 'aoa-association', name: 'American Osteopathic Association', kind: 'association', abbrev: 'AOA' },
  { id: 'aamc', name: 'Association of American Medical Colleges', kind: 'association', abbrev: 'AAMC' },
  { id: 'ana-nursing', name: 'American Nurses Association', kind: 'association', abbrev: 'ANA' },
  { id: 'aanp', name: 'American Association of Nurse Practitioners', kind: 'association', abbrev: 'AANP' },
  { id: 'aapa', name: 'American Academy of Physician Associates', kind: 'association', abbrev: 'AAPA' },
  { id: 'nma', name: 'National Medical Association', kind: 'association', abbrev: 'NMA' },
  { id: 'ache', name: 'American College of Healthcare Executives', kind: 'association', abbrev: 'ACHE' },
  { id: 'mgma', name: 'Medical Group Management Association', kind: 'association', abbrev: 'MGMA' },

  // ── Honor societies ────────────────────────────────────────────────────────
  { id: 'aoa-honor-society', name: 'Alpha Omega Alpha Honor Medical Society', kind: 'honor_society', abbrev: 'AΩA' },
  { id: 'ghhs', name: 'Gold Humanism Honor Society', kind: 'honor_society', abbrev: 'GHHS' },
  { id: 'stti', name: 'Sigma Theta Tau International Honor Society of Nursing', kind: 'honor_society', abbrev: 'STTI' },

  // ── Accreditors / assessment ───────────────────────────────────────────────
  { id: 'lcme', name: 'Liaison Committee on Medical Education', kind: 'accreditor', abbrev: 'LCME' },
  { id: 'coca', name: 'Commission on Osteopathic College Accreditation', kind: 'accreditor', abbrev: 'COCA' },
  { id: 'acgme', name: 'Accreditation Council for Graduate Medical Education', kind: 'accreditor', abbrev: 'ACGME' },
  { id: 'ecfmg', name: 'Educational Commission for Foreign Medical Graduates', kind: 'accreditor', abbrev: 'ECFMG' },
  { id: 'nbme', name: 'National Board of Medical Examiners', kind: 'accreditor', abbrev: 'NBME' },
  { id: 'nbome', name: 'National Board of Osteopathic Medical Examiners', kind: 'accreditor', abbrev: 'NBOME' },
  { id: 'fsmb', name: 'Federation of State Medical Boards', kind: 'accreditor', abbrev: 'FSMB' },
  { id: 'ccne', name: 'Commission on Collegiate Nursing Education', kind: 'accreditor', abbrev: 'CCNE' },

  // ── Medical schools — MD (major US institutions; full LCME roster pending) ──
  { id: 'harvard-ms', name: 'Harvard Medical School', kind: 'med_school_md', city: 'Boston', state: 'MA' },
  { id: 'jhu-som', name: 'Johns Hopkins University School of Medicine', kind: 'med_school_md', city: 'Baltimore', state: 'MD' },
  { id: 'stanford-som', name: 'Stanford University School of Medicine', kind: 'med_school_md', city: 'Stanford', state: 'CA' },
  { id: 'penn-perelman', name: 'Perelman School of Medicine at the University of Pennsylvania', kind: 'med_school_md', city: 'Philadelphia', state: 'PA' },
  { id: 'mount-sinai-icahn', name: 'Icahn School of Medicine at Mount Sinai', kind: 'med_school_md', city: 'New York', state: 'NY' },
  { id: 'columbia-vps', name: 'Columbia University Vagelos College of Physicians and Surgeons', kind: 'med_school_md', city: 'New York', state: 'NY' },
  { id: 'nyu-grossman', name: 'NYU Grossman School of Medicine', kind: 'med_school_md', city: 'New York', state: 'NY' },
  { id: 'yale-som', name: 'Yale School of Medicine', kind: 'med_school_md', city: 'New Haven', state: 'CT' },
  { id: 'ucsf-som', name: 'UCSF School of Medicine', kind: 'med_school_md', city: 'San Francisco', state: 'CA' },
  { id: 'ucla-geffen', name: 'David Geffen School of Medicine at UCLA', kind: 'med_school_md', city: 'Los Angeles', state: 'CA' },
  { id: 'washu-som', name: 'Washington University School of Medicine in St. Louis', kind: 'med_school_md', city: 'St. Louis', state: 'MO' },
  { id: 'duke-som', name: 'Duke University School of Medicine', kind: 'med_school_md', city: 'Durham', state: 'NC' },
  { id: 'umich-ms', name: 'University of Michigan Medical School', kind: 'med_school_md', city: 'Ann Arbor', state: 'MI' },
  { id: 'northwestern-feinberg', name: 'Northwestern University Feinberg School of Medicine', kind: 'med_school_md', city: 'Chicago', state: 'IL' },
  { id: 'uchicago-pritzker', name: 'University of Chicago Pritzker School of Medicine', kind: 'med_school_md', city: 'Chicago', state: 'IL' },
  { id: 'vanderbilt-som', name: 'Vanderbilt University School of Medicine', kind: 'med_school_md', city: 'Nashville', state: 'TN' },
  { id: 'weill-cornell', name: 'Weill Cornell Medicine', kind: 'med_school_md', city: 'New York', state: 'NY' },
  { id: 'mayo-alix', name: 'Mayo Clinic Alix School of Medicine', kind: 'med_school_md', city: 'Rochester', state: 'MN' },
  { id: 'pitt-som', name: 'University of Pittsburgh School of Medicine', kind: 'med_school_md', city: 'Pittsburgh', state: 'PA' },
  { id: 'baylor-com', name: 'Baylor College of Medicine', kind: 'med_school_md', city: 'Houston', state: 'TX' },
  { id: 'emory-som', name: 'Emory University School of Medicine', kind: 'med_school_md', city: 'Atlanta', state: 'GA' },
  { id: 'uw-som', name: 'University of Washington School of Medicine', kind: 'med_school_md', city: 'Seattle', state: 'WA' },
  { id: 'ucsd-som', name: 'UC San Diego School of Medicine', kind: 'med_school_md', city: 'La Jolla', state: 'CA' },
  { id: 'usc-keck', name: 'Keck School of Medicine of USC', kind: 'med_school_md', city: 'Los Angeles', state: 'CA' },
  { id: 'unc-som', name: 'University of North Carolina School of Medicine', kind: 'med_school_md', city: 'Chapel Hill', state: 'NC' },
  { id: 'ccf-lerner', name: 'Cleveland Clinic Lerner College of Medicine', kind: 'med_school_md', city: 'Cleveland', state: 'OH' },
  { id: 'cwru-som', name: 'Case Western Reserve University School of Medicine', kind: 'med_school_md', city: 'Cleveland', state: 'OH' },
  { id: 'osu-com', name: 'Ohio State University College of Medicine', kind: 'med_school_md', city: 'Columbus', state: 'OH' },
  { id: 'uw-madison-smph', name: 'University of Wisconsin School of Medicine and Public Health', kind: 'med_school_md', city: 'Madison', state: 'WI' },
  { id: 'uva-som', name: 'University of Virginia School of Medicine', kind: 'med_school_md', city: 'Charlottesville', state: 'VA' },
  { id: 'cu-som', name: 'University of Colorado School of Medicine', kind: 'med_school_md', city: 'Aurora', state: 'CO' },
  { id: 'ut-austin-dell', name: 'Dell Medical School at the University of Texas at Austin', kind: 'med_school_md', city: 'Austin', state: 'TX' },
  { id: 'ut-southwestern', name: 'UT Southwestern Medical School', kind: 'med_school_md', city: 'Dallas', state: 'TX' },
  { id: 'umn-ms', name: 'University of Minnesota Medical School', kind: 'med_school_md', city: 'Minneapolis', state: 'MN' },
  { id: 'iu-som', name: 'Indiana University School of Medicine', kind: 'med_school_md', city: 'Indianapolis', state: 'IN' },
  { id: 'uiowa-carver', name: 'University of Iowa Carver College of Medicine', kind: 'med_school_md', city: 'Iowa City', state: 'IA' },
  { id: 'uab-som', name: 'University of Alabama at Birmingham Heersink School of Medicine', kind: 'med_school_md', city: 'Birmingham', state: 'AL' },
  { id: 'ufl-com', name: 'University of Florida College of Medicine', kind: 'med_school_md', city: 'Gainesville', state: 'FL' },
  { id: 'miami-miller', name: 'University of Miami Miller School of Medicine', kind: 'med_school_md', city: 'Miami', state: 'FL' },
  { id: 'bu-cams', name: 'Boston University Chobanian & Avedisian School of Medicine', kind: 'med_school_md', city: 'Boston', state: 'MA' },
  { id: 'tufts-som', name: 'Tufts University School of Medicine', kind: 'med_school_md', city: 'Boston', state: 'MA' },
  { id: 'georgetown-som', name: 'Georgetown University School of Medicine', kind: 'med_school_md', city: 'Washington', state: 'DC' },
  { id: 'umaryland-som', name: 'University of Maryland School of Medicine', kind: 'med_school_md', city: 'Baltimore', state: 'MD' },
  { id: 'einstein-com', name: 'Albert Einstein College of Medicine', kind: 'med_school_md', city: 'Bronx', state: 'NY' },
  { id: 'rutgers-rwj', name: 'Rutgers Robert Wood Johnson Medical School', kind: 'med_school_md', city: 'New Brunswick', state: 'NJ' },

  // ── Medical schools — DO (major US colleges; full AACOM roster pending) ─────
  { id: 'pcom', name: 'Philadelphia College of Osteopathic Medicine', kind: 'med_school_do', city: 'Philadelphia', state: 'PA' },
  { id: 'kcu-com', name: 'Kansas City University College of Osteopathic Medicine', kind: 'med_school_do', city: 'Kansas City', state: 'MO' },
  { id: 'msu-com', name: 'Michigan State University College of Osteopathic Medicine', kind: 'med_school_do', city: 'East Lansing', state: 'MI' },
  { id: 'dmu-com', name: 'Des Moines University College of Osteopathic Medicine', kind: 'med_school_do', city: 'Des Moines', state: 'IA' },
  { id: 'ohio-heritage', name: 'Ohio University Heritage College of Osteopathic Medicine', kind: 'med_school_do', city: 'Athens', state: 'OH' },
  { id: 'nova-com', name: 'Nova Southeastern University College of Osteopathic Medicine', kind: 'med_school_do', city: 'Fort Lauderdale', state: 'FL' },
  { id: 'western-comp', name: 'Western University of Health Sciences College of Osteopathic Medicine of the Pacific', kind: 'med_school_do', city: 'Pomona', state: 'CA' },
  { id: 'atsu-kcom', name: 'A.T. Still University Kirksville College of Osteopathic Medicine', kind: 'med_school_do', city: 'Kirksville', state: 'MO' },
];

/** Group the flat list by kind (memoize at the call site if hot). */
export function institutionsByKind(): Record<InstitutionKind, Institution[]> {
  const out = {
    med_school_md: [] as Institution[],
    med_school_do: [] as Institution[],
    board: [] as Institution[],
    society: [] as Institution[],
    association: [] as Institution[],
    honor_society: [] as Institution[],
    accreditor: [] as Institution[],
  } satisfies Record<InstitutionKind, Institution[]>;
  for (const inst of INSTITUTIONS) out[inst.kind].push(inst);
  return out;
}

/**
 * Case-insensitive prefix/substring search for autocompletes. Ranks name-prefix
 * and abbrev-exact matches first. `kinds` optionally scopes to categories (e.g.
 * a "medical school" field passes ['med_school_md','med_school_do']).
 */
export function searchInstitutions(
  query: string,
  opts?: { kinds?: InstitutionKind[]; limit?: number },
): Institution[] {
  const q = query.trim().toLowerCase();
  const limit = opts?.limit ?? 12;
  const pool = opts?.kinds ? INSTITUTIONS.filter((i) => opts.kinds!.includes(i.kind)) : INSTITUTIONS;
  if (!q) return pool.slice(0, limit);
  const scored: Array<{ inst: Institution; score: number }> = [];
  for (const inst of pool) {
    const name = inst.name.toLowerCase();
    const abbr = inst.abbrev?.toLowerCase();
    let score = -1;
    if (abbr && abbr === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (abbr && abbr.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (inst.city && inst.city.toLowerCase().includes(q)) score = 4;
    if (score >= 0) scored.push({ inst, score });
  }
  scored.sort((a, b) => a.score - b.score || a.inst.name.localeCompare(b.inst.name));
  return scored.slice(0, limit).map((s) => s.inst);
}
