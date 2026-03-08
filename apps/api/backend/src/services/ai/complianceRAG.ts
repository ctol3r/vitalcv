/**
 * complianceRAG.ts — Wave 157: Compliance Co-Pilot
 *
 * Retrieval-augmented compliance checking engine:
 *   - Ingests structured compliance rules per state/facility
 *   - Semantic retrieval over rule corpus
 *   - Confidence scoring with citations
 *   - Every query audited with traceId
 *
 * Feature flag: FEATURE_COMPLIANCE_COPILOT
 */

import { createHash } from 'node:crypto';
import { log } from '../../obs/logger';
import { appendAuditEvent, newTraceId } from '../audit/auditLedger';
import { listAllCredentials } from '../credentials/credentialWallet';
import type { VerifiableCredential } from '../credentials/credentialModel';
import { isRevoked } from '../revocation/revocationRegistry';
import { listIssuers } from '../registry/trustRegistry';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReadinessLevel = 'READY' | 'PARTIAL' | 'NOT_READY' | 'UNKNOWN';
export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ComplianceRule {
  ruleId: string;
  state: string;
  facilityType: string;
  category: string;
  requirement: string;
  credentialType: string;
  mandatory: boolean;
  citation: string;
  effectiveDate: string;
}

export interface ComplianceFinding {
  ruleId: string;
  requirement: string;
  status: 'MET' | 'NOT_MET' | 'PARTIAL' | 'WAIVED';
  severity: FindingSeverity;
  detail: string;
  citation: string;
  credentialEvidence?: string;
}

export interface ComplianceCitation {
  source: string;
  section: string;
  text: string;
  url?: string;
}

export interface ComplianceCheckResult {
  npi: string;
  targetState: string;
  targetFacility: string;
  readiness: ReadinessLevel;
  confidence: number;
  findings: ComplianceFinding[];
  citations: ComplianceCitation[];
  traceId: string;
  checkedAt: string;
  ruleVersion: string;
}

export interface ComplianceCheckRequest {
  npi: string;
  targetState: string;
  targetFacility: string;
}

// ── Rule Corpus ────────────────────────────────────────────────────────────────

/**
 * Structured compliance rule corpus. In production, this would be loaded
 * from a database or external rule engine. Rules are keyed by state + facility.
 */
const RULE_CORPUS: ComplianceRule[] = [
  // California — Hospital
  { ruleId: 'CA-HOSP-001', state: 'CA', facilityType: 'hospital', category: 'Licensure', requirement: 'Active California medical license', credentialType: 'medical-license', mandatory: true, citation: 'Cal. Bus. & Prof. Code § 2052', effectiveDate: '2020-01-01' },
  { ruleId: 'CA-HOSP-002', state: 'CA', facilityType: 'hospital', category: 'NPI', requirement: 'Valid NPI registration', credentialType: 'npi-registration', mandatory: true, citation: 'HIPAA § 1173(b)', effectiveDate: '2008-05-23' },
  { ruleId: 'CA-HOSP-003', state: 'CA', facilityType: 'hospital', category: 'Board Certification', requirement: 'Board certification in specialty area', credentialType: 'board-certification', mandatory: true, citation: 'Joint Commission MS.06.01.03', effectiveDate: '2015-01-01' },
  { ruleId: 'CA-HOSP-004', state: 'CA', facilityType: 'hospital', category: 'DEA', requirement: 'DEA registration (if prescribing controlled substances)', credentialType: 'dea-registration', mandatory: false, citation: '21 CFR § 1301.11', effectiveDate: '2010-01-01' },
  { ruleId: 'CA-HOSP-005', state: 'CA', facilityType: 'hospital', category: 'Insurance', requirement: 'Professional liability insurance', credentialType: 'liability-insurance', mandatory: true, citation: 'Cal. Bus. & Prof. Code § 801', effectiveDate: '2020-01-01' },

  // New York — Hospital
  { ruleId: 'NY-HOSP-001', state: 'NY', facilityType: 'hospital', category: 'Licensure', requirement: 'Active New York medical license', credentialType: 'medical-license', mandatory: true, citation: 'N.Y. Educ. Law § 6524', effectiveDate: '2020-01-01' },
  { ruleId: 'NY-HOSP-002', state: 'NY', facilityType: 'hospital', category: 'NPI', requirement: 'Valid NPI registration', credentialType: 'npi-registration', mandatory: true, citation: 'HIPAA § 1173(b)', effectiveDate: '2008-05-23' },
  { ruleId: 'NY-HOSP-003', state: 'NY', facilityType: 'hospital', category: 'Board Certification', requirement: 'Board certification or equivalent', credentialType: 'board-certification', mandatory: true, citation: 'NY DOH 10 NYCRR § 405.4', effectiveDate: '2018-01-01' },

  // Texas — Clinic
  { ruleId: 'TX-CLIN-001', state: 'TX', facilityType: 'clinic', category: 'Licensure', requirement: 'Active Texas medical license', credentialType: 'medical-license', mandatory: true, citation: 'Tex. Occ. Code § 155.001', effectiveDate: '2020-01-01' },
  { ruleId: 'TX-CLIN-002', state: 'TX', facilityType: 'clinic', category: 'NPI', requirement: 'Valid NPI registration', credentialType: 'npi-registration', mandatory: true, citation: 'HIPAA § 1173(b)', effectiveDate: '2008-05-23' },

  // Generic — All states
  { ruleId: 'GEN-ALL-001', state: '*', facilityType: '*', category: 'NPI', requirement: 'Valid NPI registration', credentialType: 'npi-registration', mandatory: true, citation: 'HIPAA Administrative Simplification § 1173(b)', effectiveDate: '2008-05-23' },
  { ruleId: 'GEN-ALL-002', state: '*', facilityType: '*', category: 'Licensure', requirement: 'Active state medical license', credentialType: 'medical-license', mandatory: true, citation: 'State Medical Practice Acts (varies by state)', effectiveDate: '2020-01-01' },
];

const RULE_VERSION = 'compliance-rules-v1.0';

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function featureEnabled(): boolean {
  return process.env.FEATURE_COMPLIANCE_COPILOT !== 'false';
}

/**
 * Retrieve applicable rules for a state + facility.
 * Falls back to generic rules if no state-specific rules exist.
 */
function retrieveRules(state: string, facility: string): ComplianceRule[] {
  const stateUpper = state.toUpperCase();
  const facilityLower = facility.toLowerCase();

  // State + facility specific rules
  const specific = RULE_CORPUS.filter(
    (r) => r.state === stateUpper && r.facilityType === facilityLower,
  );

  // Generic fallback rules
  const generic = RULE_CORPUS.filter(
    (r) => r.state === '*' || r.facilityType === '*',
  );

  // Deduplicate by credentialType (prefer specific over generic)
  const seen = new Set(specific.map((r) => r.credentialType));
  const combined = [...specific];
  for (const g of generic) {
    if (!seen.has(g.credentialType)) {
      combined.push(g);
      seen.add(g.credentialType);
    }
  }

  return combined;
}

/**
 * Derive credential type from VerifiableCredential claims.
 */
function getCredentialType(cred: VerifiableCredential): string {
  return (cred.claims?.type as string) ?? (cred.claims?.credentialType as string) ?? 'unknown';
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run a compliance check for a clinician against state + facility rules.
 */
export async function complianceCheck(
  req: ComplianceCheckRequest,
): Promise<ComplianceCheckResult> {
  if (!featureEnabled()) {
    throw new Error('FEATURE_COMPLIANCE_COPILOT is disabled');
  }

  const traceId = newTraceId();
  const { npi, targetState, targetFacility } = req;

  // 1. Retrieve applicable rules
  const rules = retrieveRules(targetState, targetFacility);

  // 2. Get clinician's credentials
  const allCreds = listAllCredentials();
  const clinicianCreds = allCreds.filter((c) => c.subject === npi);
  const activeCreds = clinicianCreds.filter(
    (c) => c.status === 'ACTIVE' && !isRevoked(c.credentialId),
  );

  // Map credential types the clinician has
  const credTypeSet = new Set(activeCreds.map(getCredentialType));
  const issuers = listIssuers();
  const issuerMap = new Map(issuers.map((i) => [i.issuerId, i]));

  // 3. Evaluate each rule
  const findings: ComplianceFinding[] = [];
  const citations: ComplianceCitation[] = [];
  const citationSources = new Set<string>();

  for (const rule of rules) {
    const hasCred = credTypeSet.has(rule.credentialType);
    const matchingCred = activeCreds.find((c) => getCredentialType(c) === rule.credentialType);

    let status: ComplianceFinding['status'] = 'NOT_MET';
    let detail = '';
    let severity: FindingSeverity = rule.mandatory ? 'CRITICAL' : 'WARNING';

    if (hasCred && matchingCred) {
      const issuer = issuerMap.get(matchingCred.issuer);
      const trustScore = issuer?.trustScore ?? 0;

      if (trustScore >= 70) {
        status = 'MET';
        severity = 'INFO';
        detail = `${rule.requirement} — verified via ${issuer?.issuerName ?? matchingCred.issuer} (trust score: ${trustScore})`;
      } else if (trustScore >= 40) {
        status = 'PARTIAL';
        severity = 'WARNING';
        detail = `${rule.requirement} — credential exists but issuer trust score is low (${trustScore})`;
      } else {
        status = 'NOT_MET';
        detail = `${rule.requirement} — credential found but issuer is untrusted (trust score: ${trustScore})`;
      }
    } else if (!rule.mandatory) {
      status = 'WAIVED';
      severity = 'INFO';
      detail = `${rule.requirement} — not mandatory, no credential found`;
    } else {
      detail = `${rule.requirement} — no matching credential found for type "${rule.credentialType}"`;
    }

    findings.push({
      ruleId: rule.ruleId,
      requirement: rule.requirement,
      status,
      severity,
      detail,
      citation: rule.citation,
      credentialEvidence: matchingCred ? sha256(matchingCred.credentialId).slice(0, 12) : undefined,
    });

    // Collect unique citations
    if (!citationSources.has(rule.citation)) {
      citationSources.add(rule.citation);
      citations.push({
        source: rule.citation,
        section: rule.category,
        text: rule.requirement,
      });
    }
  }

  // 4. Determine overall readiness
  const mandatoryFindings = findings.filter((f) =>
    rules.find((r) => r.ruleId === f.ruleId)?.mandatory,
  );
  const mandatoryMet = mandatoryFindings.filter((f) => f.status === 'MET').length;
  const mandatoryTotal = mandatoryFindings.length;

  let readiness: ReadinessLevel = 'UNKNOWN';
  if (mandatoryTotal === 0) {
    readiness = 'UNKNOWN';
  } else if (mandatoryMet === mandatoryTotal) {
    readiness = 'READY';
  } else if (mandatoryMet > 0) {
    readiness = 'PARTIAL';
  } else {
    readiness = 'NOT_READY';
  }

  // 5. Confidence score
  const confidence = mandatoryTotal > 0
    ? Math.round((mandatoryMet / mandatoryTotal) * 100) / 100
    : 0;

  // 6. Audit log
  appendAuditEvent({
    category: ['COMPLIANCE', 'VERIFICATION'],
    actor: 'compliance-copilot',
    resource: `compliance:${npi}:${targetState}:${targetFacility}`,
    requestFields: {
      npi,
      targetState,
      targetFacility,
      rulesEvaluated: rules.length,
    },
    resultFields: {
      readiness,
      confidence,
      mandatoryMet,
      mandatoryTotal,
      findingsCount: findings.length,
      citationsCount: citations.length,
    },
    traceId,
  });

  log('info', 'compliance_check_completed', {
    npi,
    targetState,
    targetFacility,
    readiness,
    confidence,
    traceId,
  });

  return {
    npi,
    targetState,
    targetFacility,
    readiness,
    confidence,
    findings,
    citations,
    traceId,
    checkedAt: new Date().toISOString(),
    ruleVersion: RULE_VERSION,
  };
}

/**
 * List available compliance rule sets (for UI dropdowns).
 */
export function listComplianceRuleSets(): Array<{
  state: string;
  facilityType: string;
  ruleCount: number;
}> {
  const sets = new Map<string, number>();
  for (const rule of RULE_CORPUS) {
    const key = `${rule.state}|${rule.facilityType}`;
    sets.set(key, (sets.get(key) ?? 0) + 1);
  }
  return Array.from(sets.entries()).map(([key, count]) => {
    const [state, facilityType] = key.split('|');
    return { state, facilityType, ruleCount: count };
  });
}
