/**
 * governanceRules.ts — Wave 108: Trust Governance Layer
 *
 * Establishes governance rules for the VitalCV trust network.
 * Rules define thresholds and automated actions for:
 *   - Issuer trust score thresholds
 *   - Revocation escalation triggers
 *   - Network peer acceptance requirements
 */

import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export type GovernanceRuleType =
  | 'TRUST_THRESHOLD'
  | 'REVOCATION_ESCALATION'
  | 'PEER_ACCEPTANCE';

export type GovernanceAction =
  | 'SUSPEND_ISSUER'
  | 'FLAG_FOR_REVIEW'
  | 'REQUIRE_PEER_APPROVAL'
  | 'ALERT_ADMIN'
  | 'BLOCK_REGISTRATION';

export interface GovernanceRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Description of what this rule enforces */
  description: string;
  /** Category of governance rule */
  ruleType: GovernanceRuleType;
  /** Numeric threshold that triggers the action (optional) */
  threshold?: number;
  /** Action taken when rule is triggered */
  action: GovernanceAction;
  /** Whether the rule is currently active */
  enabled: boolean;
  /** ISO-8601 timestamp when rule was last updated */
  updatedAt: string;
}

// ── Seed Rules ─────────────────────────────────────────────────────────────────

const GOVERNANCE_RULES: GovernanceRule[] = [
  {
    id: 'min-trust-score',
    name: 'Minimum Issuer Trust Score',
    description:
      'Any issuer whose trust score falls below the threshold is automatically suspended ' +
      'pending review. Trust scores are recalculated after each verification event.',
    ruleType: 'TRUST_THRESHOLD',
    threshold: 60,
    action: 'SUSPEND_ISSUER',
    enabled: true,
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'revocation-escalation',
    name: 'Revocation Escalation',
    description:
      "When an issuer's cumulative revocation count exceeds the threshold within a rolling " +
      '30-day window, the issuer is automatically flagged for human review. ' +
      'High revocation rates may indicate issuer compromise or policy violations.',
    ruleType: 'REVOCATION_ESCALATION',
    threshold: 5,
    action: 'FLAG_FOR_REVIEW',
    enabled: true,
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'peer-acceptance',
    name: 'Network Peer Acceptance',
    description:
      'New issuers joining as AUTHORITATIVE trust level must receive endorsement from ' +
      'at least the specified number of existing AUTHORITATIVE peers before full activation. ' +
      'Prevents unilateral elevation of trust levels.',
    ruleType: 'PEER_ACCEPTANCE',
    threshold: 3,
    action: 'REQUIRE_PEER_APPROVAL',
    enabled: true,
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

// ── In-memory store ────────────────────────────────────────────────────────────

const rulesMap = new Map<string, GovernanceRule>(
  GOVERNANCE_RULES.map((r) => [r.id, r]),
);

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * List all governance rules.
 */
export function listGovernanceRules(): GovernanceRule[] {
  return Array.from(rulesMap.values());
}

/**
 * Get a governance rule by ID.
 */
export function getGovernanceRule(id: string): GovernanceRule | undefined {
  return rulesMap.get(id);
}

/**
 * Upsert a governance rule (admin use).
 */
export function upsertGovernanceRule(rule: GovernanceRule): void {
  rulesMap.set(rule.id, { ...rule, updatedAt: new Date().toISOString() });
  log('info', 'Wave 108: Governance rule upserted', { id: rule.id, ruleType: rule.ruleType });
}

/**
 * Returns the number of active rules.
 */
export function activeRulesCount(): number {
  return Array.from(rulesMap.values()).filter((r) => r.enabled).length;
}
