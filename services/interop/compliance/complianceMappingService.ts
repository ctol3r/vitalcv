/**
 * Compliance Mapping Service
 * B226B-INT-008: Maps TEFCA, HIPAA, NCQA, and state regulations to internal policies
 *
 * Provides look-ups for:
 * - Autonomy engine (self-governance compliance)
 * - Reputation engine (compliance scoring)
 * Updates automatically when rules change
 */

import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('interop/compliance/complianceMappingService');

/**
 * Compliance framework types
 */
export type ComplianceFramework = 'TEFCA' | 'HIPAA' | 'NCQA' | 'STATE' | 'HITECH' | 'GDPR';

/**
 * State codes for state-specific regulations
 */
export type StateCode =
  | 'CA' | 'NY' | 'TX' | 'FL' | 'IL' | 'PA' | 'OH' | 'GA' | 'NC' | 'MI'
  | 'NJ' | 'VA' | 'WA' | 'AZ' | 'MA' | 'TN' | 'IN' | 'MO' | 'MD' | 'WI'
  | 'CO' | 'MN' | 'SC' | 'AL' | 'LA' | 'KY' | 'OR' | 'OK' | 'CT' | 'IA'
  | 'UT' | 'AR' | 'NV' | 'MS' | 'KS' | 'NM' | 'NE' | 'WV' | 'ID' | 'HI'
  | 'NH' | 'ME' | 'RI' | 'MT' | 'DE' | 'SD' | 'ND' | 'AK' | 'DC' | 'VT' | 'WY';

/**
 * Policy rule structure
 */
export interface PolicyRule {
  id: string;
  framework: ComplianceFramework;
  stateCode?: StateCode;
  category: string;
  title: string;
  description: string;
  requirements: string[];
  internalPolicyId: string;
  autonomyPolicyId?: string;
  reputationPolicyId?: string;
  effectiveDate: Date;
  lastUpdated: Date;
  isActive: boolean;
}

/**
 * Compliance mapping query
 */
export interface ComplianceMappingQuery {
  framework?: ComplianceFramework;
  stateCode?: StateCode;
  category?: string;
  policyId?: string;
}

/**
 * Compliance mapping result
 */
export interface ComplianceMappingResult {
  rules: PolicyRule[];
  autonomyPolicies: string[];
  reputationPolicies: string[];
  lastUpdated: Date;
}

/**
 * Rule change notification
 */
export interface RuleChangeNotification {
  ruleId: string;
  framework: ComplianceFramework;
  changeType: 'added' | 'updated' | 'removed';
  effectiveDate: Date;
  details: string;
}

/**
 * TEFCA-specific policy mappings
 */
const TEFCA_POLICIES: PolicyRule[] = [
  {
    id: 'tefca-001',
    framework: 'TEFCA',
    category: 'Data Exchange',
    title: 'Minimum Necessary Standard',
    description: 'Exchange only the minimum necessary PHI for the intended purpose',
    requirements: [
      'Implement data minimization practices',
      'Use purpose-specific data requests',
      'Audit data access and exchange',
    ],
    internalPolicyId: 'POL-DATA-MINIMUM',
    autonomyPolicyId: 'AUTO-DATA-MIN',
    reputationPolicyId: 'REP-DATA-MIN',
    effectiveDate: new Date('2023-01-01'),
    lastUpdated: new Date('2023-01-01'),
    isActive: true,
  },
  {
    id: 'tefca-002',
    framework: 'TEFCA',
    category: 'Security',
    title: 'UDAP Security Requirements',
    description: 'UDAP (User-Directed Access and Privacy) security standards',
    requirements: [
      'Implement OAuth 2.0 and OpenID Connect',
      'Support user-directed access controls',
      'Enable granular consent management',
    ],
    internalPolicyId: 'POL-UDAP-SECURITY',
    autonomyPolicyId: 'AUTO-UDAP',
    reputationPolicyId: 'REP-UDAP',
    effectiveDate: new Date('2023-01-01'),
    lastUpdated: new Date('2023-01-01'),
    isActive: true,
  },
];

/**
 * HIPAA-specific policy mappings
 */
const HIPAA_POLICIES: PolicyRule[] = [
  {
    id: 'hipaa-001',
    framework: 'HIPAA',
    category: 'Privacy',
    title: 'PHI Access Controls',
    description: 'Implement administrative, physical, and technical safeguards for PHI',
    requirements: [
      'Access controls and authentication',
      'Audit logs for PHI access',
      'Encryption of PHI in transit and at rest',
      'Workforce training on HIPAA compliance',
    ],
    internalPolicyId: 'POL-HIPAA-ACCESS',
    autonomyPolicyId: 'AUTO-HIPAA-ACCESS',
    reputationPolicyId: 'REP-HIPAA-ACCESS',
    effectiveDate: new Date('1996-08-21'),
    lastUpdated: new Date('2013-01-25'),
    isActive: true,
  },
  {
    id: 'hipaa-002',
    framework: 'HIPAA',
    category: 'Breach Notification',
    title: 'Breach Notification Requirements',
    description: 'Notify individuals and HHS of PHI breaches within required timeframes',
    requirements: [
      'Notify individuals within 60 days',
      'Notify HHS for breaches affecting 500+ individuals',
      'Notify media for large breaches',
      'Maintain breach log',
    ],
    internalPolicyId: 'POL-HIPAA-BREACH',
    autonomyPolicyId: 'AUTO-HIPAA-BREACH',
    reputationPolicyId: 'REP-HIPAA-BREACH',
    effectiveDate: new Date('2009-09-23'),
    lastUpdated: new Date('2013-01-25'),
    isActive: true,
  },
];

/**
 * NCQA-specific policy mappings
 */
const NCQA_POLICIES: PolicyRule[] = [
  {
    id: 'ncqa-001',
    framework: 'NCQA',
    category: 'Credentialing',
    title: 'Credentialing Verification Requirements',
    description: 'NCQA standards for credentialing verification',
    requirements: [
      'Primary source verification of credentials',
      'Ongoing monitoring of credential status',
      'Recredentialing every 3 years',
      'Documentation of verification activities',
    ],
    internalPolicyId: 'POL-NCQA-CRED',
    autonomyPolicyId: 'AUTO-NCQA-CRED',
    reputationPolicyId: 'REP-NCQA-CRED',
    effectiveDate: new Date('2020-01-01'),
    lastUpdated: new Date('2023-01-01'),
    isActive: true,
  },
];

/**
 * State-specific policy mappings (examples)
 */
const STATE_POLICIES: Record<StateCode, PolicyRule[]> = {
  CA: [
    {
      id: 'ca-001',
      framework: 'STATE',
      stateCode: 'CA',
      category: 'Privacy',
      title: 'California Consumer Privacy Act (CCPA)',
      description: 'CCPA requirements for healthcare data',
      requirements: [
        'Right to know what data is collected',
        'Right to delete personal information',
        'Right to opt-out of sale of personal information',
      ],
      internalPolicyId: 'POL-CA-CCPA',
      autonomyPolicyId: 'AUTO-CA-CCPA',
      reputationPolicyId: 'REP-CA-CCPA',
      effectiveDate: new Date('2020-01-01'),
      lastUpdated: new Date('2020-01-01'),
      isActive: true,
    },
  ],
  NY: [
    {
      id: 'ny-001',
      framework: 'STATE',
      stateCode: 'NY',
      category: 'Security',
      title: 'New York SHIELD Act',
      description: 'Data security requirements for healthcare entities',
      requirements: [
        'Reasonable security safeguards',
        'Breach notification requirements',
        'Data protection measures',
      ],
      internalPolicyId: 'POL-NY-SHIELD',
      autonomyPolicyId: 'AUTO-NY-SHIELD',
      reputationPolicyId: 'REP-NY-SHIELD',
      effectiveDate: new Date('2020-03-21'),
      lastUpdated: new Date('2020-03-21'),
      isActive: true,
    },
  ],
  // Add more states as needed
  TX: [], FL: [], IL: [], PA: [], OH: [], GA: [], NC: [], MI: [],
  NJ: [], VA: [], WA: [], AZ: [], MA: [], TN: [], IN: [], MO: [],
  MD: [], WI: [], CO: [], MN: [], SC: [], AL: [], LA: [], KY: [],
  OR: [], OK: [], CT: [], IA: [], UT: [], AR: [], NV: [], MS: [],
  KS: [], NM: [], NE: [], WV: [], ID: [], HI: [], NH: [], ME: [],
  RI: [], MT: [], DE: [], SD: [], ND: [], AK: [], DC: [], VT: [], WY: [],
};

/**
 * Compliance Mapping Service
 */
export class ComplianceMappingService {
  private rules: Map<string, PolicyRule> = new Map();
  private changeListeners: Array<(notification: RuleChangeNotification) => void> = [];

  constructor() {
    this.initializeRules();
    log.info('Compliance mapping service initialized', {
      ruleCount: this.rules.size,
    });
  }

  /**
   * Initialize all compliance rules
   */
  private initializeRules(): void {
    // Load TEFCA policies
    TEFCA_POLICIES.forEach(rule => this.rules.set(rule.id, rule));

    // Load HIPAA policies
    HIPAA_POLICIES.forEach(rule => this.rules.set(rule.id, rule));

    // Load NCQA policies
    NCQA_POLICIES.forEach(rule => this.rules.set(rule.id, rule));

    // Load state-specific policies
    Object.values(STATE_POLICIES).forEach(stateRules => {
      stateRules.forEach(rule => this.rules.set(rule.id, rule));
    });
  }

  /**
   * Query compliance mappings
   */
  queryMappings(query: ComplianceMappingQuery): ComplianceMappingResult {
    let filteredRules = Array.from(this.rules.values())
      .filter(rule => rule.isActive);

    // Filter by framework
    if (query.framework) {
      filteredRules = filteredRules.filter(rule => rule.framework === query.framework);
    }

    // Filter by state code
    if (query.stateCode) {
      filteredRules = filteredRules.filter(
        rule => rule.stateCode === query.stateCode || !rule.stateCode
      );
    }

    // Filter by category
    if (query.category) {
      filteredRules = filteredRules.filter(rule => rule.category === query.category);
    }

    // Filter by policy ID
    if (query.policyId) {
      filteredRules = filteredRules.filter(
        rule => rule.internalPolicyId === query.policyId ||
                rule.autonomyPolicyId === query.policyId ||
                rule.reputationPolicyId === query.policyId
      );
    }

    // Extract unique policy IDs
    const autonomyPolicies = [
      ...new Set(filteredRules.map(r => r.autonomyPolicyId).filter(Boolean)),
    ] as string[];

    const reputationPolicies = [
      ...new Set(filteredRules.map(r => r.reputationPolicyId).filter(Boolean)),
    ] as string[];

    log.info('Queried compliance mappings', {
      query,
      resultCount: filteredRules.length,
    });

    return {
      rules: filteredRules,
      autonomyPolicies,
      reputationPolicies,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get policy rule by ID
   */
  getRule(ruleId: string): PolicyRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules for a framework
   */
  getRulesByFramework(framework: ComplianceFramework): PolicyRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.framework === framework && rule.isActive);
  }

  /**
   * Get all rules for a state
   */
  getRulesByState(stateCode: StateCode): PolicyRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.stateCode === stateCode && rule.isActive);
  }

  /**
   * Get autonomy policies for a framework/state
   */
  getAutonomyPolicies(framework?: ComplianceFramework, stateCode?: StateCode): string[] {
    const query: ComplianceMappingQuery = {};
    if (framework) query.framework = framework;
    if (stateCode) query.stateCode = stateCode;

    const result = this.queryMappings(query);
    return result.autonomyPolicies;
  }

  /**
   * Get reputation policies for a framework/state
   */
  getReputationPolicies(framework?: ComplianceFramework, stateCode?: StateCode): string[] {
    const query: ComplianceMappingQuery = {};
    if (framework) query.framework = framework;
    if (stateCode) query.stateCode = stateCode;

    const result = this.queryMappings(query);
    return result.reputationPolicies;
  }

  /**
   * Update a policy rule
   */
  updateRule(ruleId: string, updates: Partial<PolicyRule>): void {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updatedRule: PolicyRule = {
      ...existingRule,
      ...updates,
      lastUpdated: new Date(),
    };

    this.rules.set(ruleId, updatedRule);

    this.notifyChangeListeners({
      ruleId,
      framework: updatedRule.framework,
      changeType: 'updated',
      effectiveDate: updatedRule.effectiveDate,
      details: `Rule updated: ${updatedRule.title}`,
    });

    log.info('Updated compliance rule', { ruleId, updates });
  }

  /**
   * Add a new policy rule
   */
  addRule(rule: PolicyRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule already exists: ${rule.id}`);
    }

    this.rules.set(rule.id, rule);

    this.notifyChangeListeners({
      ruleId: rule.id,
      framework: rule.framework,
      changeType: 'added',
      effectiveDate: rule.effectiveDate,
      details: `New rule added: ${rule.title}`,
    });

    log.info('Added compliance rule', { ruleId: rule.id });
  }

  /**
   * Remove a policy rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    this.rules.delete(ruleId);

    this.notifyChangeListeners({
      ruleId,
      framework: rule.framework,
      changeType: 'removed',
      effectiveDate: new Date(),
      details: `Rule removed: ${rule.title}`,
    });

    log.info('Removed compliance rule', { ruleId });
  }

  /**
   * Subscribe to rule change notifications
   */
  subscribeToChanges(listener: (notification: RuleChangeNotification) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(notification: RuleChangeNotification): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        log.error('Error notifying change listener', { error });
      }
    });
  }

  /**
   * Sync rules from external source (e.g., regulatory API)
   */
  async syncRulesFromSource(sourceUrl: string): Promise<void> {
    try {
      log.info('Syncing compliance rules from external source', { sourceUrl });

      // In production, fetch from regulatory API or compliance database
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.status}`);
      }

      const externalRules = await response.json() as PolicyRule[];

      // Update existing rules or add new ones
      for (const externalRule of externalRules) {
        const existingRule = this.rules.get(externalRule.id);
        if (existingRule) {
          // Update if changed
          if (existingRule.lastUpdated < externalRule.lastUpdated) {
            this.updateRule(externalRule.id, externalRule);
          }
        } else {
          // Add new rule
          this.addRule(externalRule);
        }
      }

      log.info('Synced compliance rules from external source', {
        sourceUrl,
        ruleCount: externalRules.length,
      });
    } catch (error) {
      log.error('Error syncing compliance rules', { error, sourceUrl });
      throw error;
    }
  }
}

/**
 * Default instance export
 */
export const complianceMappingService = new ComplianceMappingService();

