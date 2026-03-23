/**
 * sourceGovernance.ts — Source Access Policy & Competitive Intelligence
 *
 * Hard rules governing how each source may be accessed, what risk level
 * its automation carries, and what the system must do before using it.
 *
 * This file is the operating system for source governance. It encodes:
 *   1. Access-boundary enforcement (what can/cannot be automated)
 *   2. Terms-of-service risk classification
 *   3. Connector complexity and maintenance burden
 *   4. Feasibility and leverage scoring
 *   5. Competitive positioning intelligence
 *   6. Build priority sequencing
 *
 * RED sources cannot be treated as normal automated connectors.
 * YELLOW sources require explicit policy acknowledgment.
 * GREEN sources are preferred in scheduling and product surfaces.
 */

// ── Source governance types ───────────────────────────────────────────────────

export type SourceType =
  | 'api'                    // structured REST/GraphQL API
  | 'bulk'                   // downloadable bulk file (CSV/JSON)
  | 'search_portal'          // web-based lookup form
  | 'monitoring_service'     // push/webhook notification system
  | 'institutional_service'  // requires org-level contract/account
  | 'mixed';                 // combination of above

export type AccessBoundary =
  | 'public'                 // no auth, no TOS issues
  | 'registration_required'  // free API key needed
  | 'institutional'          // org-level account/contract required
  | 'gated'                  // approval process or paid subscription
  | 'human_lookup_only';     // scraping/automation prohibited

export type ConnectorComplexity = 'low' | 'medium' | 'high' | 'very_high';
export type TermsRiskLevel = 'green' | 'yellow' | 'red';
export type MonitoringMode = 'pull' | 'push' | 'none';

export type AutomationPolicy =
  | 'allowed'                // safe to automate at scale
  | 'limited'                // rate-limited or quota-constrained
  | 'investigate'            // needs legal/business review before automating
  | 'disallowed';            // do not automate — human-only or TOS-prohibited

export type BuildStatus =
  | 'live'                   // connector built and operational
  | 'stub'                   // connector exists but uses simulated/fallback data
  | 'planned'                // in roadmap, not yet built
  | 'investigating'          // feasibility under review
  | 'deferred';              // explicitly deprioritized

// ── Source governance record ──────────────────────────────────────────────────

export interface SourceGovernance {
  sourceId:                string;

  // Classification
  sourceType:              SourceType;
  accessBoundary:          AccessBoundary;
  connectorComplexity:     ConnectorComplexity;
  termsRiskLevel:          TermsRiskLevel;
  automationPolicy:        AutomationPolicy;
  monitoringMode:          MonitoringMode;
  primaryIdentityKeys:     string[];          // NPI, name, license number, etc.

  // Scoring (1-10)
  feasibilityScore:        number;            // how easy to build/maintain
  leverageScore:           number;            // how much trust value it provides
  maintenanceBurden:       number;            // ongoing maintenance cost (1=low, 10=high)

  // Policy
  recommendedConfidence:   string;            // policy for confidence scoring
  recommendedRefresh:      string;            // refresh policy
  automationNotes:         string;            // human-readable policy explanation
  openQuestions:           string[];          // unresolved issues

  // Build
  buildStatus:             BuildStatus;
  implementationPriority:  number;            // 1 = highest priority
}

// ── Governance registry ───────────────────────────────────────────────────────

export const SOURCE_GOVERNANCE: Record<string, SourceGovernance> = {

  // ── CMS NPPES API ─────────────────────────────────────────────────────

  NPPES_API: {
    sourceId: 'NPPES_API',
    sourceType: 'api',
    accessBoundary: 'public',
    connectorComplexity: 'low',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI'],
    feasibilityScore: 10,
    leverageScore: 9,
    maintenanceBurden: 1,
    recommendedConfidence: 'HIGH (0.95-0.99) — official CMS system of record',
    recommendedRefresh: 'Weekly pull per active NPI; daily for monitored clinicians',
    automationNotes: 'Fully public, FOIA-disclosable. No rate limit concerns at reasonable scale.',
    openQuestions: [],
    buildStatus: 'live',
    implementationPriority: 1,
  },

  // ── CMS NPPES Bulk ────────────────────────────────────────────────────

  NPPES_BULK: {
    sourceId: 'NPPES_BULK',
    sourceType: 'bulk',
    accessBoundary: 'public',
    connectorComplexity: 'medium',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI'],
    feasibilityScore: 8,
    leverageScore: 9,
    maintenanceBurden: 3,
    recommendedConfidence: 'HIGH — same authority as API, full universe coverage',
    recommendedRefresh: 'Monthly full download + weekly incremental delta',
    automationNotes: 'Large file processing (~8M records). Store snapshot hash + parser version.',
    openQuestions: ['Bulk download infrastructure not yet built'],
    buildStatus: 'planned',
    implementationPriority: 6,
  },

  // ── CMS PECOS ─────────────────────────────────────────────────────────

  PECOS_PUBLIC: {
    sourceId: 'PECOS_PUBLIC',
    sourceType: 'api',
    accessBoundary: 'public',
    connectorComplexity: 'low',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI'],
    feasibilityScore: 9,
    leverageScore: 7,
    maintenanceBurden: 2,
    recommendedConfidence: 'HIGH (0.90-0.95) — official CMS enrollment data',
    recommendedRefresh: 'Quarterly; treat enrollment as point-in-time rather than real-time',
    automationNotes: 'data.cms.gov Socrata API. Free, no key needed. Public messaging should describe PECOS as point-in-time quarterly data.',
    openQuestions: [],
    buildStatus: 'live',
    implementationPriority: 2,
  },

  // ── CMS Doctors & Clinicians / Provider Data NDF ──────────────────────

  DOCTORS_CLINICIANS: {
    sourceId: 'DOCTORS_CLINICIANS',
    sourceType: 'mixed',
    accessBoundary: 'public',
    connectorComplexity: 'medium',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI', 'PAC_ID'],
    feasibilityScore: 8,
    leverageScore: 8,
    maintenanceBurden: 3,
    recommendedConfidence: 'HIGH (0.90-0.95) — CMS claims-verified practice data',
    recommendedRefresh: 'Biweekly for NDF bulk; monthly for API',
    automationNotes: 'API via data.cms.gov dataset mj5m-pzi6. NDF bulk file is biweekly refresh with comprehensive fields (medical school, graduation year, telehealth, assignment). API and NDF are DIFFERENT datasets with different coverage. NDF is the canonical Gold-tier bulk backbone.',
    openQuestions: [
      'Current connector uses API only — does NOT cover NDF bulk fields',
      'Need dedicated NDF bulk connector for: medical school, graduation year, telehealth flag, Medicare assignment acceptance',
      'NDF and API have overlapping but not identical fields — must document coverage delta',
    ],
    buildStatus: 'live',
    implementationPriority: 3,
  },

  // ── CMS Provider Data NDF (National Downloadable File) ────────────────

  CMS_NDF: {
    sourceId: 'CMS_NDF',
    sourceType: 'bulk',
    accessBoundary: 'public',
    connectorComplexity: 'medium',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI'],
    feasibilityScore: 8,
    leverageScore: 9,
    maintenanceBurden: 4,
    recommendedConfidence: 'HIGH (0.95) — CMS Provider Data catalog, biweekly official refresh',
    recommendedRefresh: 'Biweekly full download + delta comparison against prior snapshot',
    automationNotes: 'National Downloadable File from CMS Provider Data catalog. Biweekly refresh. Contains: NPI, enrollment IDs, credential, medical school, graduation year, primary/secondary specialties, telehealth flag, group affiliation, Medicare assignment, practice address. This is the critical Gold-tier bulk backbone that the API-only D&C connector does NOT fully cover.',
    openQuestions: [
      'Bulk download + parse pipeline not yet built',
      'Need snapshot hash + timestamp + parser version tracking',
      'Delta comparison against prior snapshot for change detection',
    ],
    buildStatus: 'planned',
    implementationPriority: 4,
  },

  // ── OIG LEIE ──────────────────────────────────────────────────────────

  OIG_LEIE: {
    sourceId: 'OIG_LEIE',
    sourceType: 'mixed',
    accessBoundary: 'public',
    connectorComplexity: 'low',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI', 'name'],
    feasibilityScore: 9,
    leverageScore: 10,
    maintenanceBurden: 2,
    recommendedConfidence: 'HIGH on NPI match, MEDIUM on name-only match, UNCERTAIN on API error',
    recommendedRefresh: 'Daily — exclusion is a hard trust blocker',
    automationNotes: 'Monthly CSV bulk + optional CSV supplement ingestion. Exact NPI matches are HIGH confidence; name/state/specialty matches are POSSIBLE_MATCH and require review. Never silently pass on failure.',
    openQuestions: [],
    buildStatus: 'live',
    implementationPriority: 1,
  },

  // ── CMS Open Payments ─────────────────────────────────────────────────

  OPEN_PAYMENTS: {
    sourceId: 'OPEN_PAYMENTS',
    sourceType: 'api',
    accessBoundary: 'public',
    connectorComplexity: 'medium',
    termsRiskLevel: 'green',
    automationPolicy: 'allowed',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['NPI', 'covered_recipient_profile_id'],
    feasibilityScore: 8,
    leverageScore: 7,
    maintenanceBurden: 3,
    recommendedConfidence: 'HIGH (0.95) — official CMS disclosure data, NPI-matched',
    recommendedRefresh: 'Monthly; annual program year cycle',
    automationNotes: 'Public Socrata API, 88M+ records. NPI-to-Covered-Recipient mapping is key. General + research + ownership datasets. High-leverage: shows financial relationships that matter for conflict-of-interest and compliance.',
    openQuestions: [
      'Need to handle NPI-to-Covered-Recipient-ID mapping edge cases',
      'Multi-year aggregation strategy needed for product surface',
    ],
    buildStatus: 'live',
    implementationPriority: 5,
  },

  // ── SAM.gov ───────────────────────────────────────────────────────────

  SAM_GOV: {
    sourceId: 'SAM_GOV',
    sourceType: 'api',
    accessBoundary: 'registration_required',
    connectorComplexity: 'medium',
    termsRiskLevel: 'yellow',
    automationPolicy: 'limited',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['name', 'UEI', 'CAGE_code'],
    feasibilityScore: 6,
    leverageScore: 8,
    maintenanceBurden: 4,
    recommendedConfidence: 'MEDIUM (0.75) on name match — no direct NPI linkage',
    recommendedRefresh: 'Daily — exclusion source',
    automationNotes: 'SAM.gov Exclusions API v4 is ready but quota-limited. Free tier: 10 req/day. Higher tiers require federal account. Name-based search only (no NPI field). Match quality depends on name disambiguation. Must handle: rate limiting, API key management, identity verification on matches.',
    openQuestions: [
      'Need higher-tier API access for production volume',
      'Name-only matching creates false positive risk — needs identity verification step',
      'Explore SAM.gov bulk extract as alternative to API for daily checks',
    ],
    buildStatus: 'stub',
    implementationPriority: 7,
  },

  // ── State Medical Boards ──────────────────────────────────────────────

  STATE_BOARD: {
    sourceId: 'STATE_BOARD',
    sourceType: 'search_portal',
    accessBoundary: 'public',
    connectorComplexity: 'very_high',
    termsRiskLevel: 'yellow',
    automationPolicy: 'limited',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['name', 'license_number', 'NPI'],
    feasibilityScore: 4,
    leverageScore: 9,
    maintenanceBurden: 9,
    recommendedConfidence: 'HIGH via FSMB API (0.95), LOW via scrape (0.35), UNCERTAIN if unavailable',
    recommendedRefresh: 'Weekly for active clinicians; monthly for inactive',
    automationNotes: 'CRITICAL but FRAGMENTED. 50+ individual boards, each with different portal. FSMB DocInfo is the aggregator (subscription). Without FSMB: must build per-state scrapers. HIGH MAINTENANCE — portals change without notice. Phase carefully: CA, NY, TX first, then FL, OH, IL. Each state is effectively a separate connector. Partner/institutional access strongly recommended over scraping.',
    openQuestions: [
      'FSMB DocInfo subscription pricing and integration',
      'Per-state scraper maintenance burden — is it sustainable?',
      'Anti-automation protections on some state board sites',
      'Recommend FSMB institutional access over individual state scraping',
    ],
    buildStatus: 'stub',
    implementationPriority: 8,
  },

  // ── Nursys QuickConfirm ───────────────────────────────────────────────

  NURSYS_QUICKCONFIRM: {
    sourceId: 'NURSYS_QUICKCONFIRM',
    sourceType: 'institutional_service',
    accessBoundary: 'human_lookup_only',
    connectorComplexity: 'very_high',
    termsRiskLevel: 'red',
    automationPolicy: 'disallowed',
    monitoringMode: 'none',
    primaryIdentityKeys: ['name', 'license_number', 'state'],
    feasibilityScore: 2,
    leverageScore: 8,
    maintenanceBurden: 8,
    recommendedConfidence: 'HIGH if accessed — official NCSBN data',
    recommendedRefresh: 'N/A — human-initiated only',
    automationNotes: 'HARD STOP: Nursys QuickConfirm is NOT a scrape-first source. Has explicit anti-automation and FCRA compliance constraints. Any automated access requires institutional agreement with NCSBN. VitalCV must NOT build a scraper for this. Use Nursys e-Notify for monitoring instead.',
    openQuestions: [
      'Institutional access agreement with NCSBN — timeline and cost',
      'FCRA compliance requirements for automated license verification',
    ],
    buildStatus: 'investigating',
    implementationPriority: 99, // do not prioritize
  },

  // ── Nursys e-Notify ───────────────────────────────────────────────────

  NURSYS_ENOTIFY: {
    sourceId: 'NURSYS_ENOTIFY',
    sourceType: 'monitoring_service',
    accessBoundary: 'institutional',
    connectorComplexity: 'high',
    termsRiskLevel: 'yellow',
    automationPolicy: 'investigate',
    monitoringMode: 'push',
    primaryIdentityKeys: ['UNI', 'license_number', 'state'],
    feasibilityScore: 5,
    leverageScore: 9,
    maintenanceBurden: 5,
    recommendedConfidence: 'HIGH (0.95) — official NCSBN push notifications',
    recommendedRefresh: 'Push — real-time alerts on license status changes',
    automationNotes: 'Nursys e-Notify is the CORRECT monitoring path for nursing licenses. Requires institutional enrollment with NCSBN. Push-based: you subscribe to NPIs and receive notifications on status changes. This is the path VitalCV should pursue for nursing — NOT QuickConfirm scraping.',
    openQuestions: [
      'NCSBN enrollment process and timeline',
      'Cost per NPI monitored',
      'Webhook vs polling integration model',
      'Participating jurisdictions list (not all states participate)',
    ],
    buildStatus: 'investigating',
    implementationPriority: 10,
  },

  // ── ABMS Public Lookup ────────────────────────────────────────────────

  ABMS_PUBLIC: {
    sourceId: 'ABMS_PUBLIC',
    sourceType: 'search_portal',
    accessBoundary: 'human_lookup_only',
    connectorComplexity: 'very_high',
    termsRiskLevel: 'red',
    automationPolicy: 'disallowed',
    monitoringMode: 'none',
    primaryIdentityKeys: ['name'],
    feasibilityScore: 2,
    leverageScore: 7,
    maintenanceBurden: 8,
    recommendedConfidence: 'HIGH if verified manually — authoritative board cert data',
    recommendedRefresh: 'N/A — manual investigation only',
    automationNotes: 'ABMS public search is WEAK for automation. Anti-bot protections, no API, no bulk access. Should remain investigation-only unless institutional access is secured. CMS D&C board_cert_flag is the automated alternative (covers most ABMS data at scale).',
    openQuestions: [
      'ABMS CertLink institutional API — availability, cost, integration',
      'Whether CMS D&C board_cert_flag covers enough of ABMS for MVP',
    ],
    buildStatus: 'investigating',
    implementationPriority: 99, // do not prioritize
  },

  // ── State Board: California DCA ───────────────────────────────────────

  STATE_BOARD_CA: {
    sourceId: 'STATE_BOARD_CA',
    sourceType: 'search_portal',
    accessBoundary: 'public',
    connectorComplexity: 'high',
    termsRiskLevel: 'yellow',
    automationPolicy: 'limited',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['name', 'license_number'],
    feasibilityScore: 5,
    leverageScore: 9,
    maintenanceBurden: 7,
    recommendedConfidence: 'MEDIUM-HIGH (0.70-0.85) via Breeze portal extraction',
    recommendedRefresh: 'Weekly for monitored clinicians',
    automationNotes: 'CA DCA Breeze system. Structured data behind HTML portal. Highest-volume state — build first. Anti-automation protections may exist.',
    openQuestions: ['Breeze portal anti-automation measures', 'API availability inquiry'],
    buildStatus: 'planned',
    implementationPriority: 11,
  },

  STATE_BOARD_NY: {
    sourceId: 'STATE_BOARD_NY',
    sourceType: 'search_portal',
    accessBoundary: 'public',
    connectorComplexity: 'high',
    termsRiskLevel: 'yellow',
    automationPolicy: 'limited',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['name', 'license_number'],
    feasibilityScore: 5,
    leverageScore: 8,
    maintenanceBurden: 7,
    recommendedConfidence: 'MEDIUM (0.65-0.80) via NYSED portal extraction',
    recommendedRefresh: 'Weekly',
    automationNotes: 'NYSED professional verification portal. Second-highest volume. Similar fragility to CA.',
    openQuestions: ['NYSED rate limiting or blocking', 'Available data fields'],
    buildStatus: 'planned',
    implementationPriority: 12,
  },

  STATE_BOARD_TX: {
    sourceId: 'STATE_BOARD_TX',
    sourceType: 'search_portal',
    accessBoundary: 'public',
    connectorComplexity: 'high',
    termsRiskLevel: 'yellow',
    automationPolicy: 'limited',
    monitoringMode: 'pull',
    primaryIdentityKeys: ['name', 'license_number'],
    feasibilityScore: 5,
    leverageScore: 8,
    maintenanceBurden: 7,
    recommendedConfidence: 'MEDIUM (0.65-0.80) via TMB portal extraction',
    recommendedRefresh: 'Weekly',
    automationNotes: 'Texas Medical Board. Third-largest state.',
    openQuestions: ['TMB portal structure and anti-automation measures'],
    buildStatus: 'planned',
    implementationPriority: 13,
  },
};

// ── Access-boundary enforcement ───────────────────────────────────────────────

export interface PolicyViolation {
  sourceId:     string;
  violation:    'red_source_automated' | 'yellow_source_no_ack' | 'human_only_bypass';
  message:      string;
  severity:     'BLOCK' | 'WARN';
}

/**
 * Enforce source access policy before any connector runs.
 * Returns violations that must be addressed.
 *
 * RED sources → BLOCK (cannot be automated at all)
 * YELLOW sources → WARN (need explicit acknowledgment)
 * human_lookup_only → BLOCK (no automated connector path)
 */
export function enforceSourcePolicy(sourceId: string): PolicyViolation[] {
  const gov = SOURCE_GOVERNANCE[sourceId];
  if (!gov) return [];

  const violations: PolicyViolation[] = [];

  if (gov.termsRiskLevel === 'red') {
    violations.push({
      sourceId,
      violation: 'red_source_automated',
      message: `${sourceId}: RED-risk source — automation PROHIBITED. ${gov.automationNotes}`,
      severity: 'BLOCK',
    });
  }

  if (gov.accessBoundary === 'human_lookup_only') {
    violations.push({
      sourceId,
      violation: 'human_only_bypass',
      message: `${sourceId}: human-lookup-only source — no automated connector path. ${gov.automationNotes}`,
      severity: 'BLOCK',
    });
  }

  if (gov.termsRiskLevel === 'yellow' && gov.automationPolicy !== 'allowed') {
    violations.push({
      sourceId,
      violation: 'yellow_source_no_ack',
      message: `${sourceId}: YELLOW-risk source — requires explicit policy acknowledgment. ${gov.automationNotes}`,
      severity: 'WARN',
    });
  }

  return violations;
}

/**
 * Check if a source is safe for automated production use.
 */
export function isAutomationSafe(sourceId: string): boolean {
  const gov = SOURCE_GOVERNANCE[sourceId];
  if (!gov) return false;
  return gov.automationPolicy === 'allowed' && gov.termsRiskLevel === 'green';
}

/**
 * Get the caution map — all sources with their risk levels.
 */
export function getSourceCautionMap(): Record<string, {
  risk: TermsRiskLevel;
  automation: AutomationPolicy;
  boundary: AccessBoundary;
  notes: string;
}> {
  const map: Record<string, { risk: TermsRiskLevel; automation: AutomationPolicy; boundary: AccessBoundary; notes: string }> = {};
  for (const [id, gov] of Object.entries(SOURCE_GOVERNANCE)) {
    map[id] = {
      risk: gov.termsRiskLevel,
      automation: gov.automationPolicy,
      boundary: gov.accessBoundary,
      notes: gov.automationNotes,
    };
  }
  return map;
}

/**
 * Get recommended build order based on truth-pack sequencing.
 */
export function getBuildPriorityOrder(): Array<{ sourceId: string; priority: number; status: BuildStatus; leverage: number }> {
  return Object.values(SOURCE_GOVERNANCE)
    .filter(g => g.implementationPriority < 99)
    .sort((a, b) => a.implementationPriority - b.implementationPriority)
    .map(g => ({
      sourceId: g.sourceId,
      priority: g.implementationPriority,
      status: g.buildStatus,
      leverage: g.leverageScore,
    }));
}

// ── Competitive intelligence constants ────────────────────────────────────────

export const COMPETITIVE_POSITIONING = {
  HEARTBEAT: {
    name: 'Heartbeat.ai',
    category: 'contact_intelligence',
    notVerification: true,
    summary: 'Contact intelligence and relationship mapping — NOT verification infrastructure. Does not produce evidence-backed trust claims.',
  },
  TOPNPI: {
    name: 'TopNPI',
    category: 'reflective_directory',
    notVerification: true,
    summary: 'Reflective directory data — assembles public data into profiles. NOT an evidence layer. No receipts, no monitoring, no trust tiers.',
  },
  MEDALLION: {
    name: 'Medallion',
    category: 'workflow_managed_ops',
    notVerification: true,
    summary: 'Workflow / managed credentialing operations — outsourced human verification, not transparent trust infrastructure. Good at operations, not at evidence-backed identity.',
  },
  CAQH: {
    name: 'CAQH ProView',
    category: 'incumbent_data_infra',
    notVerification: true,
    summary: 'Incumbent data infrastructure — mostly provider-attested data. Complementary but not the same as independent evidence-backed verification. Provider fills out form; CAQH stores it. VitalCV verifies independently.',
  },
  VITALCV: {
    name: 'VitalCV',
    category: 'evidence_backed_identity',
    notVerification: false,
    summary: 'Evidence-backed identity + monitoring + receipts + trust tiers. Every claim resolves to a source artifact, timestamp, checksum, and parser version. Show the proof, not just the answer.',
  },
} as const;

/**
 * Product copy scaffolding for trust tier explanations.
 */
export const TRUST_TIER_COPY = {
  GOLD: {
    label: 'Gold — Official Authority',
    description: 'Verified directly against the official system of record (CMS, OIG, state board). This is the source of truth.',
    icon: '🥇',
  },
  SILVER: {
    label: 'Silver — Institutional Evidence',
    description: 'Corroborated by near-official or institutional sources. Strong evidence, but not the primary authority.',
    icon: '🥈',
  },
  BRONZE: {
    label: 'Bronze — Inferred',
    description: 'Derived from commercial or secondary sources. May be useful context but should never be treated as verified truth.',
    icon: '🥉',
    warning: 'Bronze-tier data is informational only. It has not been independently verified against an official source.',
  },
} as const;
