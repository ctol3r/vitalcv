/**
 * sourceCatalog.ts — Authoritative Source Registry
 *
 * Every data source VitalCV ingests, with its trust tier, refresh SLA,
 * schema/parser version, and the claim types it can produce.
 *
 * Trust tiers:
 *   GOLD   — primary authority or official system of record (CMS, Nursys, state board, OIG)
 *   SILVER — near-official or institutional evidence (hospital directory, OpenAlex, ClinicalTrials)
 *   BRONZE — inferred or commercial overlay (contact enrichment, heuristics)
 *            BRONZE data must never be presented as verified truth.
 *
 * Adding a new source: define it here, write a parser in claimEngine.ts,
 * wire to identityIngestionPipeline.ts. That's the entire contract.
 */

export type EvidenceTier = 'GOLD' | 'SILVER' | 'BRONZE';
export type AccessPattern = 'API' | 'BULK_FILE' | 'SEARCH' | 'WEB' | 'LICENSED';
export type RefreshCadence = 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export type ClaimType =
  | 'NPI_IDENTITY'           // NPI number, enumeration type, enumeration date
  | 'PERSONAL_IDENTITY'      // legal name, credential suffix (MD/DO/NP)
  | 'SPECIALTY'              // taxonomy code + description
  | 'PRACTICE_LOCATION'      // physical address, city, state, zip
  | 'MAILING_ADDRESS'        // mailing address
  | 'ENDPOINT'               // Direct messaging, FHIR endpoint
  | 'ENROLLMENT_STATUS'      // Medicare/Medicaid enrollment (PECOS)
  | 'ORDER_REFERRAL'         // eligible to order/refer (PECOS)
  | 'GROUP_AFFILIATION'      // organization/group practice membership
  | 'PRACTICE_PROFILE'       // claims-verified practice details (D&C)
  | 'BOARD_CERT_FLAG'        // board certification flag from CMS D&C
  | 'EXCLUSION_STATUS'       // OIG/LEIE or SAM.gov exclusion
  | 'SANCTION_RECORD'        // specific sanction event
  | 'LICENSE'                // state professional license
  | 'LICENSE_DISCIPLINE'     // disciplinary action on a license
  | 'BOARD_CERTIFICATION'    // specialty board certification (ABMS-style)
  | 'NURSING_LICENSE'        // Nursys nurse licensure
  | 'NURSING_DISCIPLINE'     // Nursys discipline record
  | 'INDUSTRY_PAYMENT'       // Open Payments general payment
  | 'OWNERSHIP_INTEREST'     // Open Payments ownership
  | 'RESEARCH_PAYMENT'       // Open Payments research payment
  | 'PUBLICATION'            // OpenAlex/PubMed authorship
  | 'CITATION_METRIC'        // h-index, citation count (OpenAlex)
  | 'CLINICAL_TRIAL'         // ClinicalTrials.gov investigator role
  | 'INSTITUTION_AFFILIATION'// hospital, faculty, residency program
  | 'DEA_REGISTRATION'       // DEA controlled substance registration
  | 'FEDERAL_EXCLUSION';     // SAM.gov federal exclusion

export interface SourceDefinition {
  id:             string;
  name:           string;
  description:    string;
  tier:           EvidenceTier;
  accessPattern:  AccessPattern;
  baseUrl:        string;
  bulkFileUrl:    string | null;
  refreshCadence: RefreshCadence;
  refreshSlaHours: number;         // alert if not refreshed within N hours
  claimTypes:     ClaimType[];
  parserVersion:  string;          // bump when parser logic changes; triggers re-derivation
  envFlag:        string;          // set to 'true' to enable live calls
  liveAvailable:  boolean;
  notes:          string;
  phase:          0 | 1 | 2 | 3 | 4 | 5;  // which build phase introduces this source
}

// ── Source definitions ─────────────────────────────────────────────────────────

export const SOURCE_CATALOG: Record<string, SourceDefinition> = {

  // ── Phase 0-1: Official Spine ────────────────────────────────────────────────

  NPPES_API: {
    id: 'NPPES_API', name: 'CMS NPI Registry API', phase: 0,
    description: 'On-demand NPI lookup via the official CMS NPI Registry REST API (v2.1)',
    tier: 'GOLD', accessPattern: 'API', refreshCadence: 'WEEKLY', refreshSlaHours: 168,
    baseUrl: 'https://npiregistry.cms.hhs.gov/api/',
    bulkFileUrl: null,
    claimTypes: ['NPI_IDENTITY', 'PERSONAL_IDENTITY', 'SPECIALTY', 'PRACTICE_LOCATION', 'MAILING_ADDRESS', 'ENDPOINT'],
    parserVersion: 'v1.0.0', envFlag: 'NPPES_API_ENABLED', liveAvailable: true,
    notes: 'CMS FOIA-disclosable. NPI issuance does not validate licensure. V2.1 returns addresses, taxonomies, endpoints, identifiers.',
  },

  NPPES_BULK: {
    id: 'NPPES_BULK', name: 'CMS NPPES Monthly Bulk File V2', phase: 1,
    description: 'Monthly full-replacement NPI file (~8M providers) and weekly incremental updates',
    tier: 'GOLD', accessPattern: 'BULK_FILE', refreshCadence: 'MONTHLY', refreshSlaHours: 744,
    baseUrl: 'https://download.cms.gov/nppes/',
    bulkFileUrl: 'https://download.cms.gov/nppes/NPI_Files.html',
    claimTypes: ['NPI_IDENTITY', 'PERSONAL_IDENTITY', 'SPECIALTY', 'PRACTICE_LOCATION', 'MAILING_ADDRESS', 'ENDPOINT'],
    parserVersion: 'v1.0.0', envFlag: 'NPPES_BULK_ENABLED', liveAvailable: true,
    notes: 'Monthly full file + weekly incremental. Primary source for universe-scale NPI coverage.',
  },

  PECOS_PUBLIC: {
    id: 'PECOS_PUBLIC', name: 'CMS Public Provider Enrollment (PECOS)', phase: 1,
    description: 'Publicly available PECOS enrollment data: name, NPI, specialty, enrollment type, limited address',
    tier: 'GOLD', accessPattern: 'API', refreshCadence: 'MONTHLY', refreshSlaHours: 744,
    baseUrl: 'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/',
    bulkFileUrl: 'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/medicare-fee-for-service-public-provider-enrollment',
    claimTypes: ['ENROLLMENT_STATUS', 'ORDER_REFERRAL', 'GROUP_AFFILIATION'],
    parserVersion: 'v1.0.0', envFlag: 'PECOS_ENABLED', liveAvailable: true,
    notes: 'CMS Public Provider Enrollment file — key PECOS enrollment data. Does not include sensitive fields.',
  },

  DOCTORS_CLINICIANS: {
    id: 'DOCTORS_CLINICIANS', name: 'CMS Doctors & Clinicians (Provider Data Catalog)', phase: 1,
    description: 'CMS Physician Compare successor — practice location, group affiliations, claims-verified details, board cert flags',
    tier: 'GOLD', accessPattern: 'API', refreshCadence: 'MONTHLY', refreshSlaHours: 744,
    baseUrl: 'https://data.cms.gov/provider-data/api/1/datastore/query/',
    bulkFileUrl: 'https://data.cms.gov/provider-data/dataset/mj5m-pzi6',
    claimTypes: ['PRACTICE_PROFILE', 'PRACTICE_LOCATION', 'GROUP_AFFILIATION', 'BOARD_CERT_FLAG', 'SPECIALTY'],
    parserVersion: 'v1.0.0', envFlag: 'DOCTORS_CLINICIANS_ENABLED', liveAvailable: true,
    notes: 'General info from PECOS; some details claims-verified; board cert from certifying orgs. Dataset ID: mj5m-pzi6.',
  },

  OIG_LEIE: {
    id: 'OIG_LEIE', name: 'HHS OIG List of Excluded Individuals/Entities (LEIE)', phase: 1,
    description: 'Authoritative federal exclusion list — updated monthly. Must check before any deployment.',
    tier: 'GOLD', accessPattern: 'SEARCH', refreshCadence: 'DAILY', refreshSlaHours: 24,
    baseUrl: 'https://oig.hhs.gov/exclusions/',
    bulkFileUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
    claimTypes: ['EXCLUSION_STATUS', 'SANCTION_RECORD'],
    parserVersion: 'v1.0.0', envFlag: 'OIG_LEIE_ENABLED', liveAvailable: true,
    notes: 'Hard blocker — EXCLUDED status immediately caps trust at L0. Check daily. Bulk CSV updated monthly.',
  },

  // ── Phase 2: Trust Expansion ─────────────────────────────────────────────────

  OPEN_PAYMENTS: {
    id: 'OPEN_PAYMENTS', name: 'CMS Open Payments', phase: 2,
    description: '88M+ records of industry payments to physicians and teaching hospitals, $77B over 7 years',
    tier: 'GOLD', accessPattern: 'API', refreshCadence: 'MONTHLY', refreshSlaHours: 744,
    baseUrl: 'https://openpaymentsdata.cms.gov/api/',
    bulkFileUrl: 'https://openpaymentsdata.cms.gov/datasets',
    claimTypes: ['INDUSTRY_PAYMENT', 'RESEARCH_PAYMENT', 'OWNERSHIP_INTEREST'],
    parserVersion: 'v1.0.0', envFlag: 'OPEN_PAYMENTS_ENABLED', liveAvailable: true,
    notes: 'Requires NPI-to-Covered Recipient ID mapping. General + research + ownership interest records.',
  },

  SAM_GOV: {
    id: 'SAM_GOV', name: 'SAM.gov Federal Exclusions', phase: 2,
    description: 'Government-wide exclusion/debarment registry — broader than OIG (covers all federal programs)',
    tier: 'GOLD', accessPattern: 'API', refreshCadence: 'DAILY', refreshSlaHours: 24,
    baseUrl: 'https://api.sam.gov/entity-information/v3/',
    bulkFileUrl: null,
    claimTypes: ['FEDERAL_EXCLUSION', 'EXCLUSION_STATUS'],
    parserVersion: 'v1.0.0', envFlag: 'SAM_GOV_ENABLED', liveAvailable: false,
    notes: 'Requires SAM.gov API key. Covers debarment, suspension, proposed debarment beyond healthcare.',
  },

  STATE_BOARD: {
    id: 'STATE_BOARD', name: 'State Medical Boards (FSMB + individual)', phase: 2,
    description: 'State-level license status, issue/expiry dates, disciplinary history',
    tier: 'GOLD', accessPattern: 'SEARCH', refreshCadence: 'WEEKLY', refreshSlaHours: 168,
    baseUrl: 'https://www.fsmb.org/licensure/',
    bulkFileUrl: null,
    claimTypes: ['LICENSE', 'LICENSE_DISCIPLINE'],
    parserVersion: 'v1.0.0', envFlag: 'STATE_BOARD_ENABLED', liveAvailable: false,
    notes: 'State-specific implementation required per state. FSMB DocInfo is an aggregator (subscription).',
  },

  // ── Phase 3: Nursing + Cross-Discipline ──────────────────────────────────────

  NURSYS: {
    id: 'NURSYS', name: 'Nursys (NCSBN)', phase: 3,
    description: 'Only national database for nurse licensure verification, discipline, and practice privileges. Covers compact states.',
    tier: 'GOLD', accessPattern: 'SEARCH', refreshCadence: 'WEEKLY', refreshSlaHours: 168,
    baseUrl: 'https://www.nursys.com/',
    bulkFileUrl: null,
    claimTypes: ['NURSING_LICENSE', 'NURSING_DISCIPLINE'],
    parserVersion: 'v1.0.0', envFlag: 'NURSYS_ENABLED', liveAvailable: false,
    notes: 'e-Notify for real-time alerts. Participating jurisdictions only. UNI/NCSBN ID is the canonical nurse identifier.',
  },

  // ── Phase 4: Research + Influence ────────────────────────────────────────────

  OPENALEX: {
    id: 'OPENALEX', name: 'OpenAlex', phase: 4,
    description: 'Open catalog of scholarly works, authors, institutions, concepts. Author disambiguation via OpenAlex author IDs.',
    tier: 'SILVER', accessPattern: 'API', refreshCadence: 'WEEKLY', refreshSlaHours: 168,
    baseUrl: 'https://api.openalex.org/',
    bulkFileUrl: 'https://docs.openalex.org/download-all-data/openalex-snapshot',
    claimTypes: ['PUBLICATION', 'CITATION_METRIC', 'INSTITUTION_AFFILIATION'],
    parserVersion: 'v1.0.0', envFlag: 'OPENALEX_ENABLED', liveAvailable: true,
    notes: 'Free, no API key needed for polite pool. Use email param for higher rate limits. ROR IDs for institution linking.',
  },

  PUBMED: {
    id: 'PUBMED', name: 'PubMed / NCBI', phase: 4,
    description: 'MEDLINE biomedical literature. Author affiliation strings and MeSH terms for KOL profiling.',
    tier: 'SILVER', accessPattern: 'API', refreshCadence: 'WEEKLY', refreshSlaHours: 168,
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    bulkFileUrl: null,
    claimTypes: ['PUBLICATION'],
    parserVersion: 'v1.0.0', envFlag: 'PUBMED_ENABLED', liveAvailable: true,
    notes: 'Free API. Author disambiguation weaker than OpenAlex. Use as corroboration.',
  },

  CLINICAL_TRIALS: {
    id: 'CLINICAL_TRIALS', name: 'ClinicalTrials.gov', phase: 4,
    description: 'Investigators, study sites, sponsors, disease focus, trial activity. API v2 with daily weekday refreshes.',
    tier: 'SILVER', accessPattern: 'API', refreshCadence: 'DAILY', refreshSlaHours: 48,
    baseUrl: 'https://clinicaltrials.gov/api/v2/',
    bulkFileUrl: null,
    claimTypes: ['CLINICAL_TRIAL', 'INSTITUTION_AFFILIATION'],
    parserVersion: 'v1.0.0', envFlag: 'CLINICAL_TRIALS_ENABLED', liveAvailable: true,
    notes: 'API version 2.0.5. dataTimestamp available. Search by investigator name. No auth required.',
  },

  // ── Phase 1.5: CMS Provider Data NDF Bulk ──────────────────────────────────

  CMS_NDF: {
    id: 'CMS_NDF', name: 'CMS National Downloadable File (Provider Data)', phase: 1,
    description: 'Biweekly official bulk file: NPI, credential, medical school, graduation year, specialties, telehealth, Medicare assignment, group affiliation, practice address. Critical Gold-tier bulk backbone.',
    tier: 'GOLD', accessPattern: 'BULK_FILE', refreshCadence: 'MONTHLY', refreshSlaHours: 360,
    baseUrl: 'https://data.cms.gov/provider-data/dataset/mj5m-pzi6',
    bulkFileUrl: 'https://data.cms.gov/provider-data/sites/default/files/resources/',
    claimTypes: ['ENROLLMENT_STATUS', 'SPECIALTY', 'PRACTICE_LOCATION', 'INSTITUTION_AFFILIATION', 'BOARD_CERT_FLAG', 'GROUP_AFFILIATION'],
    parserVersion: 'v1.0.0', envFlag: 'CMS_NDF_ENABLED', liveAvailable: false,
    notes: 'DISTINCT from D&C API — NDF bulk has fields API does not expose (medical school, graduation year, telehealth, assignment). Biweekly refresh. Delta comparison required. This is the Gold-tier bulk backbone.',
  },

  // ── Phase 3.5: Nursys Split ───────────────────────────────────────────────

  NURSYS_ENOTIFY: {
    id: 'NURSYS_ENOTIFY', name: 'Nursys e-Notify (NCSBN)', phase: 3,
    description: 'Push-based real-time monitoring for nurse license status changes. The CORRECT monitoring path for nursing — NOT QuickConfirm scraping.',
    tier: 'GOLD', accessPattern: 'LICENSED', refreshCadence: 'REALTIME', refreshSlaHours: 24,
    baseUrl: 'https://www.nursys.com/EN/ENDefault.aspx',
    bulkFileUrl: null,
    claimTypes: ['NURSING_LICENSE', 'NURSING_DISCIPLINE'],
    parserVersion: 'v1.0.0', envFlag: 'NURSYS_ENOTIFY_ENABLED', liveAvailable: false,
    notes: 'Requires NCSBN institutional enrollment. Push notifications on status changes. This is the path VitalCV should pursue for nursing.',
  },

  // ── Phase 5: Institution Layer ────────────────────────────────────────────────

  HOSPITAL_DIRECTORY: {
    id: 'HOSPITAL_DIRECTORY', name: 'Hospital & Health System Directories', phase: 5,
    description: 'Current employer, title, department from hospital web directories',
    tier: 'SILVER', accessPattern: 'WEB', refreshCadence: 'MONTHLY', refreshSlaHours: 720,
    baseUrl: '', bulkFileUrl: null,
    claimTypes: ['INSTITUTION_AFFILIATION'],
    parserVersion: 'v1.0.0', envFlag: 'HOSPITAL_DIR_ENABLED', liveAvailable: false,
    notes: 'Low priority. Requires per-institution scrape pipelines. Silver tier only. Build AFTER all Gold sources are solid.',
  },

  // ── Phase 6: Research Identity Layer ─────────────────────────────────────
  // RESERVED — not yet built. Schema and types exist. Build for AMC/research market.

  ORCID: {
    id: 'ORCID', name: 'ORCID', phase: 6 as unknown as 5,
    description: 'Open Researcher and Contributor ID — persistent digital identifier for researchers',
    tier: 'SILVER', accessPattern: 'API', refreshCadence: 'MONTHLY', refreshSlaHours: 720,
    baseUrl: 'https://pub.orcid.org/v3.0',
    bulkFileUrl: 'https://orcid.org/organizations/integrators/API',
    claimTypes: ['PUBLICATION', 'CITATION_METRIC', 'CLINICAL_TRIAL', 'INSTITUTION_AFFILIATION'],
    parserVersion: 'v0.0.0', envFlag: 'ORCID_ENABLED', liveAvailable: false,
    notes: 'RESERVED for Wave M6. ORCID public API is free. Creates moat for AMC/research customers. Requires NPI→ORCID linking heuristic (name + affiliation match). Priority after all healthcare Gold sources stable.',
  },

  NIH_REPORTER: {
    id: 'NIH_REPORTER', name: 'NIH RePORTER', phase: 6 as unknown as 5,
    description: 'NIH Research Portfolio Online Reporting Tools — federal grant awards, PIs, institutions',
    tier: 'GOLD', accessPattern: 'API', refreshCadence: 'WEEKLY', refreshSlaHours: 168,
    baseUrl: 'https://api.reporter.nih.gov/v2',
    bulkFileUrl: 'https://reporter.nih.gov/exporter',
    claimTypes: ['CLINICAL_TRIAL', 'INSTITUTION_AFFILIATION', 'CITATION_METRIC'],
    parserVersion: 'v0.0.0', envFlag: 'NIH_REPORTER_ENABLED', liveAvailable: false,
    notes: 'RESERVED for Wave M6. Free public API. Gold tier — direct government source. Key for research-active clinicians at AMCs. Enables: funded investigator claims, federal funding disclosure, PI verification.',
  },
};

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getSource(id: string): SourceDefinition | null {
  return SOURCE_CATALOG[id] ?? null;
}

export function getSourcesByPhase(phase: 0 | 1 | 2 | 3 | 4 | 5): SourceDefinition[] {
  return Object.values(SOURCE_CATALOG).filter(s => s.phase <= phase);
}

export function getSourcesByTier(tier: EvidenceTier): SourceDefinition[] {
  return Object.values(SOURCE_CATALOG).filter(s => s.tier === tier);
}

export function getSourcesByClaimType(claimType: ClaimType): SourceDefinition[] {
  return Object.values(SOURCE_CATALOG).filter(s => s.claimTypes.includes(claimType));
}

export function getActiveSources(): SourceDefinition[] {
  return Object.values(SOURCE_CATALOG).filter(s => process.env[s.envFlag] === 'true' || s.liveAvailable);
}

export function listSources(): SourceDefinition[] {
  return Object.values(SOURCE_CATALOG).sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name));
}

/**
 * Get sources safe for automated production use (green risk, allowed automation).
 */
export function getAutomationSafeSources(): SourceDefinition[] {
  // Import avoided for circular-dep safety; inline the check
  const safeIds = ['NPPES_API', 'NPPES_BULK', 'PECOS_PUBLIC', 'DOCTORS_CLINICIANS', 'CMS_NDF', 'OIG_LEIE', 'OPEN_PAYMENTS', 'OPENALEX', 'PUBMED', 'CLINICAL_TRIALS'];
  return Object.values(SOURCE_CATALOG).filter(s => safeIds.includes(s.id));
}
