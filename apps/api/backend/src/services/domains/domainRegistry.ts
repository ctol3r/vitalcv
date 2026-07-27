/**
 * domainRegistry.ts — Universal Professional Authority Domain Registry
 *
 * Each domain defines:
 *   - Who the professional is (subjectIdLabel, subjectIdPattern)
 *   - What credentials prove authority (credentialTypes)
 *   - Where those credentials come from (verificationSources)
 *   - How to score trust (scoringWeights)
 *   - What gaps look like (requiredCredentials)
 *
 * Trust bands are universal across domains:
 *   L0 — unverified / blocked
 *   L1 — identity confirmed, credentials incomplete
 *   L2 — core credentials verified, deployable
 *   L3 — fully verified, all credentials current
 *
 * Activation:
 *   Each verification source has an envFlag. When that env var is set to "true",
 *   the source goes live. Otherwise it uses a deterministic stub that exercises
 *   the full pipeline without external calls.
 */

export type DomainId =
  | 'healthcare'
  | 'engineering'
  | 'legal'
  | 'infrastructure'
  | 'ai-safety';

// ── Core interfaces ────────────────────────────────────────────────────────────

export interface CredentialTypeSpec {
  id: string;
  label: string;
  description: string;
  required: boolean;         // required for L2
  requiredForL3: boolean;    // required for L3
  scoreContribution: number; // max points this credential type can add
}

export interface VerificationSourceSpec {
  id: string;
  label: string;
  url: string;
  credentialTypes: string[];  // which credential types this source verifies
  envFlag: string;            // env var to set to activate live calls
  liveCallAvailable: boolean; // whether a real API exists
  stubBehavior: 'PASS' | 'UNKNOWN';
}

export interface ScoringWeights {
  identity:       number;  // sum must equal 100
  primaryLicense: number;
  sanctions:      number;
  certifications: number;
  continuingEd:   number;
}

export interface DomainDefinition {
  id:              DomainId;
  name:            string;
  description:     string;
  status:          'ACTIVE' | 'PILOT' | 'PLANNED';
  version:         string;
  subjectIdLabel:  string;        // "NPI", "PE License Number", "Bar Number", etc.
  subjectIdPattern: RegExp;
  subjectIdExample: string;
  authorityBody:   string;        // "State Medical Board", "NCEES", "State Bar"
  regulatoryRef:   string;
  credentialTypes: CredentialTypeSpec[];
  sources:         VerificationSourceSpec[];
  scoringWeights:  ScoringWeights;
  requiredForDeployment: string[]; // credential type IDs
  hardBlockers:    string[];       // sources/conditions that immediately cap at L0
  trustBandLabels: Record<'L0'|'L1'|'L2'|'L3', string>;
}

// ── Domain definitions ────────────────────────────────────────────────────────

const HEALTHCARE: DomainDefinition = {
  id: 'healthcare', name: 'Healthcare / Medicine',
  description: 'Physicians, nurses, allied health — clinical workforce authority verification.',
  status: 'ACTIVE', version: '1.0.0',
  subjectIdLabel: 'NPI', subjectIdPattern: /^\d{10}$/, subjectIdExample: '1558395516',
  authorityBody: 'State Medical Boards / NPPES / OIG', regulatoryRef: 'HIPAA § 164, Joint Commission',
  credentialTypes: [
    { id: 'NPI_IDENTITY',        label: 'NPI Registration',       description: 'Active NPI in NPPES',                     required: true,  requiredForL3: true,  scoreContribution: 20 },
    { id: 'STATE_LICENSE',       label: 'State Medical License',  description: 'Active license in jurisdiction',           required: true,  requiredForL3: true,  scoreContribution: 30 },
    { id: 'SANCTION_CLEAR',      label: 'OIG/LEIE Clear',         description: 'No federal exclusion',                     required: true,  requiredForL3: true,  scoreContribution: 25 },
    { id: 'BOARD_CERTIFICATION', label: 'Board Certification',    description: 'ABIM/ABFM/ABEM or equivalent',             required: false, requiredForL3: true,  scoreContribution: 15 },
    { id: 'TRAINING_RECORD',     label: 'Training / Residency',   description: 'ACGME-accredited training verified',       required: false, requiredForL3: true,  scoreContribution: 10 },
  ],
  sources: [
    { id: 'NPPES',     label: 'CMS NPI Registry',        url: 'https://npiregistry.cms.hhs.gov/api/',   credentialTypes: ['NPI_IDENTITY'],        envFlag: 'NPPES_ENABLED',   liveCallAvailable: true,  stubBehavior: 'PASS'    },
    { id: 'OIG_LEIE',  label: 'OIG Exclusion Registry',  url: 'https://oig.hhs.gov/exclusions/api',    credentialTypes: ['SANCTION_CLEAR'],      envFlag: 'OIG_LEIE_ENABLED', liveCallAvailable: true, stubBehavior: 'UNKNOWN' },
    { id: 'STATE_BOARD',label: 'State Medical Boards',   url: 'https://www.fsmb.org/licensure/',       credentialTypes: ['STATE_LICENSE'],       envFlag: 'STATE_BOARD_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'NURSYS',    label: 'Nursys Nursing Compact',  url: 'https://www.nursys.com/',               credentialTypes: ['STATE_LICENSE'],       envFlag: 'REAL_NURSYS_ENABLED',  liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'ABIM',      label: 'ABIM Certification',      url: 'https://www.abim.org/',                 credentialTypes: ['BOARD_CERTIFICATION'], envFlag: 'ABIM_ENABLED',    liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
  ],
  scoringWeights:         { identity: 20, primaryLicense: 30, sanctions: 25, certifications: 15, continuingEd: 10 },
  requiredForDeployment:  ['NPI_IDENTITY', 'STATE_LICENSE', 'SANCTION_CLEAR'],
  hardBlockers:           ['OIG_LEIE_EXCLUSION'],
  trustBandLabels: { L0: 'Unverified / Excluded', L1: 'Identity Confirmed', L2: 'Licensed & Clear', L3: 'Board Certified & Fully Verified' },
};

const ENGINEERING: DomainDefinition = {
  id: 'engineering', name: 'Professional Engineering',
  description: 'Licensed Professional Engineers — civil, mechanical, electrical, structural.',
  status: 'PILOT', version: '0.9.0',
  subjectIdLabel: 'PE License Number', subjectIdPattern: /^[A-Z]{2}-PE-\d{4,8}$|^\d{5,10}$/, subjectIdExample: 'CA-PE-12345',
  authorityBody: 'NCEES / State Engineering Boards', regulatoryRef: 'Model Law for Professional Engineers (NCEES)',
  credentialTypes: [
    { id: 'IDENTITY',        label: 'Professional Identity',   description: 'Name + license number confirmed',              required: true,  requiredForL3: true,  scoreContribution: 20 },
    { id: 'PE_LICENSE',      label: 'PE License',              description: 'Active Professional Engineer license',         required: true,  requiredForL3: true,  scoreContribution: 35 },
    { id: 'DISCIPLINE_CERT', label: 'Discipline Certification',description: 'Specialty certification (structural, etc.)',   required: false, requiredForL3: true,  scoreContribution: 25 },
    { id: 'PDH_CREDITS',     label: 'PDH Continuing Education',description: 'Professional development hours current',       required: false, requiredForL3: true,  scoreContribution: 20 },
  ],
  sources: [
    { id: 'NCEES',        label: 'NCEES License Verification',   url: 'https://account.ncees.org/license-verification/', credentialTypes: ['PE_LICENSE', 'IDENTITY'],  envFlag: 'NCEES_ENABLED',  liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'STATE_ENG_BOARD', label: 'State Engineering Board',   url: 'https://www.nspe.org/resources/licensure/find-your-state-board', credentialTypes: ['PE_LICENSE'], envFlag: 'STATE_ENG_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'IEEE',         label: 'IEEE Membership',              url: 'https://www.ieee.org/',                            credentialTypes: ['DISCIPLINE_CERT'],         envFlag: 'IEEE_ENABLED',   liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'OSHA_CERT',    label: 'OSHA Safety Certification',    url: 'https://www.osha.gov/',                            credentialTypes: ['DISCIPLINE_CERT'],         envFlag: 'OSHA_ENABLED',   liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
  ],
  scoringWeights:         { identity: 20, primaryLicense: 35, sanctions: 0, certifications: 25, continuingEd: 20 },
  requiredForDeployment:  ['IDENTITY', 'PE_LICENSE'],
  hardBlockers:           ['LICENSE_REVOKED', 'LICENSE_SUSPENDED'],
  trustBandLabels: { L0: 'Unlicensed', L1: 'Identity Confirmed', L2: 'PE Licensed', L3: 'Licensed & Specialty Certified' },
};

const LEGAL: DomainDefinition = {
  id: 'legal', name: 'Legal / Law',
  description: 'Attorneys, barristers, and legal professionals — bar admission and good standing.',
  status: 'PILOT', version: '0.9.0',
  subjectIdLabel: 'Bar Number', subjectIdPattern: /^\d{5,9}$|^[A-Z]{2}\d{5,9}$/, subjectIdExample: '12345678',
  authorityBody: 'State Bar Associations / ABA', regulatoryRef: 'ABA Model Rules of Professional Conduct',
  credentialTypes: [
    { id: 'IDENTITY',        label: 'Attorney Identity',        description: 'Name + bar number confirmed',                 required: true,  requiredForL3: true,  scoreContribution: 20 },
    { id: 'BAR_ADMISSION',   label: 'Bar Admission',            description: 'Active admission in jurisdiction',            required: true,  requiredForL3: true,  scoreContribution: 40 },
    { id: 'GOOD_STANDING',   label: 'Good Standing',            description: 'No disciplinary actions',                     required: true,  requiredForL3: true,  scoreContribution: 30 },
    { id: 'COURT_ADMISSION', label: 'Court Admissions',         description: 'Federal / specialty court admissions',        required: false, requiredForL3: true,  scoreContribution: 10 },
  ],
  sources: [
    { id: 'STATE_BAR',    label: 'State Bar Association',     url: 'https://www.americanbar.org/groups/bar_services/resources/', credentialTypes: ['BAR_ADMISSION', 'GOOD_STANDING', 'IDENTITY'], envFlag: 'STATE_BAR_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'CA_BAR',       label: 'California State Bar',      url: 'https://apps.calbar.ca.gov/attorney/', credentialTypes: ['BAR_ADMISSION', 'GOOD_STANDING'], envFlag: 'CA_BAR_ENABLED', liveCallAvailable: true, stubBehavior: 'UNKNOWN' },
    { id: 'PACER',        label: 'PACER Federal Court',       url: 'https://pacer.uscourts.gov/',          credentialTypes: ['COURT_ADMISSION'],                envFlag: 'PACER_ENABLED',  liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'DISCIPLINARY', label: 'Bar Disciplinary Records',  url: 'https://www.americanbar.org/groups/professional_responsibility/', credentialTypes: ['GOOD_STANDING'], envFlag: 'BAR_DISC_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
  ],
  scoringWeights:         { identity: 20, primaryLicense: 40, sanctions: 30, certifications: 0, continuingEd: 10 },
  requiredForDeployment:  ['IDENTITY', 'BAR_ADMISSION', 'GOOD_STANDING'],
  hardBlockers:           ['DISBARRED', 'SUSPENDED'],
  trustBandLabels: { L0: 'Not Admitted / Disbarred', L1: 'Identity Confirmed', L2: 'Admitted & In Good Standing', L3: 'Multi-Jurisdiction / Specialty Admitted' },
};

const INFRASTRUCTURE: DomainDefinition = {
  id: 'infrastructure', name: 'Cyber & Infrastructure Security',
  description: 'CISSP, CISA, CISM, cloud architects — critical infrastructure authority.',
  status: 'PILOT', version: '0.9.0',
  subjectIdLabel: 'Certification ID', subjectIdPattern: /^\d{6,12}$|^[A-Z]+-\d{6,12}$/, subjectIdExample: '543210',
  authorityBody: '(ISC)² / ISACA / CompTIA', regulatoryRef: 'NIST SP 800-181, DoD 8570.01-M',
  credentialTypes: [
    { id: 'IDENTITY',         label: 'Professional Identity',   description: 'Name + certification ID confirmed',            required: true,  requiredForL3: true,  scoreContribution: 20 },
    { id: 'PRIMARY_CERT',     label: 'Primary Certification',   description: 'CISSP, CISA, CISM, or equivalent',             required: true,  requiredForL3: true,  scoreContribution: 35 },
    { id: 'SECONDARY_CERT',   label: 'Secondary Certification', description: 'CompTIA, cloud, specialty certs',              required: false, requiredForL3: true,  scoreContribution: 25 },
    { id: 'CPE_CREDITS',      label: 'CPE Continuing Education','description': 'CPE hours current per cert body',             required: false, requiredForL3: true,  scoreContribution: 20 },
  ],
  sources: [
    { id: 'ISC2',        label: '(ISC)² CISSP/CCSP Registry',    url: 'https://www.isc2.org/verify',              credentialTypes: ['PRIMARY_CERT', 'IDENTITY'],   envFlag: 'ISC2_ENABLED',     liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'ISACA',       label: 'ISACA CISA/CISM Registry',       url: 'https://www.isaca.org/credentialing',      credentialTypes: ['PRIMARY_CERT'],               envFlag: 'ISACA_ENABLED',    liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'COMPTIA',     label: 'CompTIA Certification',          url: 'https://verification.comptia.org/',        credentialTypes: ['SECONDARY_CERT', 'IDENTITY'], envFlag: 'COMPTIA_ENABLED',  liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'AWS_CERT',    label: 'AWS Certification',              url: 'https://aws.amazon.com/certification/certification-prep/', credentialTypes: ['SECONDARY_CERT'], envFlag: 'AWS_CERT_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'AZURE_CERT',  label: 'Microsoft Azure Certification',  url: 'https://learn.microsoft.com/en-us/credentials/', credentialTypes: ['SECONDARY_CERT'],     envFlag: 'AZURE_CERT_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
  ],
  scoringWeights:         { identity: 20, primaryLicense: 35, sanctions: 0, certifications: 25, continuingEd: 20 },
  requiredForDeployment:  ['IDENTITY', 'PRIMARY_CERT'],
  hardBlockers:           ['CERT_REVOKED'],
  trustBandLabels: { L0: 'Uncertified', L1: 'Identity Confirmed', L2: 'Certified', L3: 'Multi-Certified & CPE Current' },
};

const AI_SAFETY: DomainDefinition = {
  id: 'ai-safety', name: 'AI Safety & Governance',
  description: 'AI safety auditors, alignment researchers, governance specialists — an emerging authority domain.',
  status: 'PILOT', version: '0.8.0',
  subjectIdLabel: 'Auditor ID', subjectIdPattern: /^AIS-\d{6,10}$|^\d{6,10}$/, subjectIdExample: 'AIS-000123',
  authorityBody: 'Emerging — CAIS / AI Safety Institute / IEEE', regulatoryRef: 'EU AI Act Art. 43, NIST AI RMF 1.0',
  credentialTypes: [
    { id: 'IDENTITY',           label: 'Professional Identity',     description: 'Name + auditor ID confirmed',                  required: true,  requiredForL3: true,  scoreContribution: 20 },
    { id: 'ACADEMIC_CREDENTIAL',label: 'Academic Qualification',    description: 'Relevant graduate degree (CS/ML/ethics/law)',   required: false, requiredForL3: true,  scoreContribution: 30 },
    { id: 'AI_SAFETY_CERT',     label: 'AI Safety Certification',   description: 'Recognized AI safety/governance certification', required: false, requiredForL3: true,  scoreContribution: 25 },
    { id: 'AUDIT_QUALIFICATION','label': 'AI Audit Qualification',  description: 'Completed AI system audit qualification',       required: false, requiredForL3: true,  scoreContribution: 15 },
    { id: 'RISK_ASSESSMENT',    label: 'Risk Assessment Track Record','description': 'Documented AI risk assessments',            required: false, requiredForL3: false, scoreContribution: 10 },
  ],
  sources: [
    { id: 'CAIS',           label: 'Center for AI Safety',          url: 'https://www.safe.ai/',              credentialTypes: ['AI_SAFETY_CERT', 'IDENTITY'], envFlag: 'CAIS_ENABLED',       liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'AI_SAFETY_INST', label: 'AI Safety Institute (AISI)',    url: 'https://www.gov.uk/government/organisations/ai-safety-institute', credentialTypes: ['AUDIT_QUALIFICATION'], envFlag: 'AISI_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'IEEE_CS',        label: 'IEEE Computer Society',         url: 'https://www.computer.org/education/certificates', credentialTypes: ['AI_SAFETY_CERT'],   envFlag: 'IEEE_CS_ENABLED',    liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'ACADEMIC_REG',   label: 'Academic Credential Registry',  url: 'https://www.credential.net/',      credentialTypes: ['ACADEMIC_CREDENTIAL'],        envFlag: 'ACADEMIC_REG_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
    { id: 'NIST_RMF',       label: 'NIST AI RMF Registry',          url: 'https://airc.nist.gov/',           credentialTypes: ['AUDIT_QUALIFICATION', 'RISK_ASSESSMENT'], envFlag: 'NIST_RMF_ENABLED', liveCallAvailable: false, stubBehavior: 'UNKNOWN' },
  ],
  scoringWeights:         { identity: 20, primaryLicense: 0, sanctions: 0, certifications: 55, continuingEd: 25 },
  requiredForDeployment:  ['IDENTITY'],
  hardBlockers:           ['FRAUD_FINDING', 'ETHICAL_VIOLATION'],
  trustBandLabels: { L0: 'Unverified', L1: 'Identity Confirmed', L2: 'Credentialed', L3: 'Multi-Credentialed & Track Record Verified' },
};

// ── Registry ──────────────────────────────────────────────────────────────────

const BUILT_IN: DomainDefinition[] = [HEALTHCARE, ENGINEERING, LEGAL, INFRASTRUCTURE, AI_SAFETY];
const registry = new Map<DomainId | string, DomainDefinition>(
  BUILT_IN.map(d => [d.id, d])
);

export function getDomain(id: string): DomainDefinition | null {
  return registry.get(id) ?? null;
}

export function listDomains(): DomainDefinition[] {
  return Array.from(registry.values());
}

export function registerCustomDomain(domain: DomainDefinition): void {
  registry.set(domain.id, domain);
}
