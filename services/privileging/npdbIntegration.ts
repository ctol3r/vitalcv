const log = getServiceLogger('privileging/npdbIntegration');
/**
 * NPDB Integration Service for Privilege Review
 * B134C-NPDB-002
 *
 * Integrates with the National Practitioner Data Bank (NPDB) to query
 * adverse action reports and trigger HOLD status for privilege applications.
 *
 * NPDB reports include:
 * - Medical malpractice payments
 * - Adverse clinical privilege actions
 * - Adverse professional society membership actions
 * - State licensure actions
 * - DEA actions
 * - Medicare/Medicaid exclusions
 */

import crypto from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

export interface NPDBQueryRequest {
  npi: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  requestingOrganization: string;
  requestingOfficer: string;
  purpose: 'initial_privileging' | 'renewal' | 'focused_review' | 'adverse_event';
}

export interface NPDBAdverseAction {
  actionId: string;
  actionType: 'malpractice_payment' | 'clinical_privilege_action' | 'professional_society_action' |
              'state_license_action' | 'dea_action' | 'cms_exclusion' | 'peer_review_action';
  actionDate: string;
  state?: string;
  organization?: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'under_review';
  reportingEntity: string;
  confidentialDetails?: string; // Protected health information
}

export interface NPDBQueryResult {
  ok: boolean;
  queryId: string;
  npi: string;
  queryDate: string;
  status: 'clear' | 'adverse_found' | 'hold_required' | 'error';
  adverseActions: NPDBAdverseAction[];
  holdTriggered: boolean;
  holdReasons: string[];
  cached: boolean;
  cacheExpiry?: string;
  evidenceHash: string;
}

export interface NPDBCacheEntry {
  npi: string;
  queryResult: NPDBQueryResult;
  cachedAt: Date;
  expiresAt: Date;
  ttlDays: number;
}

/**
 * NPDB Integration Service
 * Manages queries to NPDB and caching of results
 */
export class NPDBIntegrationService {
  private cache: Map<string, NPDBCacheEntry> = new Map();
  private readonly ttlDays: number;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(config?: {
    ttlDays?: number;
    apiEndpoint?: string;
    apiKey?: string;
  }) {
    this.ttlDays = config?.ttlDays || parseInt(process.env.NPDB_TTL_DAYS || '60', 10);
    this.apiEndpoint = config?.apiEndpoint || process.env.NPDB_API_ENDPOINT || 'https://npdb.hrsa.gov/api/v1';
    this.apiKey = config?.apiKey || process.env.NPDB_API_KEY || 'mock-api-key';
  }

  /**
   * Query NPDB for a practitioner
   * Returns cached result if available and not expired
   */
  async queryNPDB(request: NPDBQueryRequest): Promise<NPDBQueryResult> {
    // Check cache first
    const cached = this.getCachedResult(request.npi);
    if (cached) {
      return {
        ...cached.queryResult,
        cached: true,
        cacheExpiry: cached.expiresAt.toISOString()
      };
    }

    // Perform fresh query
    const result = await this.performNPDBQuery(request);

    // Cache the result
    this.cacheResult(request.npi, result);

    return result;
  }

  /**
   * Perform actual NPDB query
   * In production, this would call the real NPDB API
   */
  private async performNPDBQuery(request: NPDBQueryRequest): Promise<NPDBQueryResult> {
    const queryId = this.generateQueryId();
    const queryDate = new Date().toISOString();

    // In production, call actual NPDB API
    // For now, simulate with mock data
    if (process.env.NODE_ENV === 'production' && this.apiKey !== 'mock-api-key') {
      return await this.callRealNPDB(request, queryId, queryDate);
    }

    // Mock implementation for development/testing
    return this.mockNPDBQuery(request, queryId, queryDate);
  }

  /**
   * Call the real NPDB API (production only)
   */
  private async callRealNPDB(
    request: NPDBQueryRequest,
    queryId: string,
    queryDate: string
  ): Promise<NPDBQueryResult> {
    try {
      // Real NPDB API call would go here
      const response = await fetch(`${this.apiEndpoint}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          npi: request.npi,
          firstName: request.firstName,
          lastName: request.lastName,
          dateOfBirth: request.dateOfBirth,
          requestingOrganization: request.requestingOrganization,
          requestingOfficer: request.requestingOfficer,
          purpose: request.purpose
        })
      });

      if (!response.ok) {
        throw new Error(`NPDB API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse NPDB response and convert to our format
      const adverseActions: NPDBAdverseAction[] = (data.actions || []).map((action: any) => ({
        actionId: action.id,
        actionType: this.mapActionType(action.type),
        actionDate: action.date,
        state: action.state,
        organization: action.organization,
        description: action.description,
        severity: this.calculateSeverity(action),
        status: action.status || 'active',
        reportingEntity: action.reportingEntity,
        confidentialDetails: action.confidentialDetails
      }));

      const { holdTriggered, holdReasons } = this.evaluateHoldCriteria(adverseActions);

      return {
        ok: true,
        queryId,
        npi: request.npi,
        queryDate,
        status: adverseActions.length === 0 ? 'clear' : holdTriggered ? 'hold_required' : 'adverse_found',
        adverseActions,
        holdTriggered,
        holdReasons,
        cached: false,
        evidenceHash: this.hashEvidence({ queryId, npi: request.npi, adverseActions, queryDate })
      };
    } catch (error: any) {
      log.error('NPDB API error:', error);
      return {
        ok: false,
        queryId,
        npi: request.npi,
        queryDate,
        status: 'error',
        adverseActions: [],
        holdTriggered: true,
        holdReasons: [`NPDB query failed: ${error.message}. Manual verification required.`],
        cached: false,
        evidenceHash: this.hashEvidence({ queryId, npi: request.npi, error: error.message, queryDate })
      };
    }
  }

  /**
   * Mock NPDB query for development/testing
   * Simulates various scenarios based on NPI patterns
   */
  private mockNPDBQuery(
    request: NPDBQueryRequest,
    queryId: string,
    queryDate: string
  ): NPDBQueryResult {
    const npi = request.npi;
    let adverseActions: NPDBAdverseAction[] = [];

    // Simulate different scenarios based on NPI
    // Clean record (most NPIs)
    if (npi.endsWith('0') || npi.endsWith('1') || npi.endsWith('2')) {
      adverseActions = [];
    }
    // Minor malpractice payment (no hold)
    else if (npi.endsWith('3')) {
      adverseActions = [{
        actionId: `NPDB-${npi}-001`,
        actionType: 'malpractice_payment',
        actionDate: '2020-03-15',
        state: 'CA',
        organization: 'Medical Malpractice Insurer',
        description: 'Malpractice payment: $25,000. Settled case, no admission of fault.',
        severity: 'low',
        status: 'resolved',
        reportingEntity: 'ABC Insurance Company'
      }];
    }
    // Clinical privilege action (triggers HOLD)
    else if (npi.endsWith('4')) {
      adverseActions = [{
        actionId: `NPDB-${npi}-002`,
        actionType: 'clinical_privilege_action',
        actionDate: '2023-08-20',
        state: 'NY',
        organization: 'Memorial Hospital',
        description: 'Temporary suspension of surgical privileges due to peer review concerns. Privileges reinstated after additional training.',
        severity: 'high',
        status: 'resolved',
        reportingEntity: 'Memorial Hospital Medical Staff Office'
      }];
    }
    // State license action (triggers HOLD)
    else if (npi.endsWith('5')) {
      adverseActions = [{
        actionId: `NPDB-${npi}-003`,
        actionType: 'state_license_action',
        actionDate: '2024-01-10',
        state: 'TX',
        description: 'License placed on probation for 6 months due to failure to complete CME requirements. Probation lifted upon completion.',
        severity: 'moderate',
        status: 'resolved',
        reportingEntity: 'Texas Medical Board'
      }];
    }
    // Active DEA action (triggers HOLD)
    else if (npi.endsWith('6')) {
      adverseActions = [{
        actionId: `NPDB-${npi}-004`,
        actionType: 'dea_action',
        actionDate: '2024-10-01',
        state: 'FL',
        description: 'DEA registration suspended pending investigation into prescribing practices.',
        severity: 'critical',
        status: 'active',
        reportingEntity: 'DEA Field Division'
      }];
    }
    // CMS Exclusion (triggers HOLD)
    else if (npi.endsWith('7')) {
      adverseActions = [{
        actionId: `NPDB-${npi}-005`,
        actionType: 'cms_exclusion',
        actionDate: '2024-06-15',
        description: 'Excluded from Medicare/Medicaid participation for conviction of healthcare fraud.',
        severity: 'critical',
        status: 'active',
        reportingEntity: 'Office of Inspector General'
      }];
    }
    // Multiple adverse actions (triggers HOLD)
    else if (npi.endsWith('8') || npi.endsWith('9')) {
      adverseActions = [
        {
          actionId: `NPDB-${npi}-006`,
          actionType: 'malpractice_payment',
          actionDate: '2019-05-10',
          state: 'IL',
          organization: 'Midwest Medical Malpractice',
          description: 'Malpractice payment: $150,000. Surgical complication case.',
          severity: 'moderate',
          status: 'resolved',
          reportingEntity: 'Midwest Medical Malpractice'
        },
        {
          actionId: `NPDB-${npi}-007`,
          actionType: 'peer_review_action',
          actionDate: '2022-11-20',
          state: 'IL',
          organization: 'Regional Medical Center',
          description: 'Mandatory additional training and supervision required following quality review.',
          severity: 'moderate',
          status: 'resolved',
          reportingEntity: 'Regional Medical Center QA Department'
        },
        {
          actionId: `NPDB-${npi}-008`,
          actionType: 'state_license_action',
          actionDate: '2023-03-15',
          state: 'IL',
          description: 'Letter of concern issued by state medical board. No formal disciplinary action.',
          severity: 'low',
          status: 'resolved',
          reportingEntity: 'Illinois Department of Financial and Professional Regulation'
        }
      ];
    }

    const { holdTriggered, holdReasons } = this.evaluateHoldCriteria(adverseActions);

    return {
      ok: true,
      queryId,
      npi: request.npi,
      queryDate,
      status: adverseActions.length === 0 ? 'clear' : holdTriggered ? 'hold_required' : 'adverse_found',
      adverseActions,
      holdTriggered,
      holdReasons,
      cached: false,
      evidenceHash: this.hashEvidence({ queryId, npi: request.npi, adverseActions, queryDate })
    };
  }

  /**
   * Evaluate if adverse actions trigger a HOLD on privileging
   * Based on organizational policy and regulatory requirements
   */
  private evaluateHoldCriteria(actions: NPDBAdverseAction[]): {
    holdTriggered: boolean;
    holdReasons: string[];
  } {
    const holdReasons: string[] = [];

    // Critical severity actions always trigger hold
    const criticalActions = actions.filter(a => a.severity === 'critical');
    if (criticalActions.length > 0) {
      holdReasons.push(
        `${criticalActions.length} critical adverse action(s) found: ${criticalActions.map(a => a.actionType).join(', ')}`
      );
    }

    // Active license actions trigger hold
    const activeLicenseActions = actions.filter(
      a => a.status === 'active' && (
        a.actionType === 'state_license_action' ||
        a.actionType === 'dea_action'
      )
    );
    if (activeLicenseActions.length > 0) {
      holdReasons.push(
        `Active license/DEA action(s) found: ${activeLicenseActions.map(a => a.actionType).join(', ')}`
      );
    }

    // Active CMS exclusions trigger hold
    const cmsExclusions = actions.filter(
      a => a.actionType === 'cms_exclusion' && a.status === 'active'
    );
    if (cmsExclusions.length > 0) {
      holdReasons.push('Active CMS/Medicare exclusion found - practitioner ineligible for privileges');
    }

    // Recent clinical privilege actions (within 3 years) trigger hold
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const recentPrivilegeActions = actions.filter(
      a => a.actionType === 'clinical_privilege_action' &&
           new Date(a.actionDate) > threeYearsAgo
    );
    if (recentPrivilegeActions.length > 0) {
      holdReasons.push(
        `Recent clinical privilege action(s) within 3 years require additional review`
      );
    }

    // Multiple malpractice payments (3+) trigger hold
    const malpracticePayments = actions.filter(a => a.actionType === 'malpractice_payment');
    if (malpracticePayments.length >= 3) {
      holdReasons.push(
        `${malpracticePayments.length} malpractice payments found - pattern requires review`
      );
    }

    // High-severity actions trigger hold
    const highSeverityActions = actions.filter(a => a.severity === 'high');
    if (highSeverityActions.length > 0) {
      holdReasons.push(
        `${highSeverityActions.length} high-severity action(s) require detailed review`
      );
    }

    // Multiple actions (4+) of any type trigger hold
    if (actions.length >= 4) {
      holdReasons.push(
        `Multiple adverse actions (${actions.length}) found - comprehensive review required`
      );
    }

    return {
      holdTriggered: holdReasons.length > 0,
      holdReasons
    };
  }

  /**
   * Get cached NPDB result if available and not expired
   */
  private getCachedResult(npi: string): NPDBCacheEntry | null {
    const cached = this.cache.get(npi);
    if (!cached) return null;

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.cache.delete(npi);
      return null;
    }

    return cached;
  }

  /**
   * Cache NPDB query result
   */
  private cacheResult(npi: string, result: NPDBQueryResult): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlDays * 24 * 60 * 60 * 1000);

    const cacheEntry: NPDBCacheEntry = {
      npi,
      queryResult: result,
      cachedAt: now,
      expiresAt,
      ttlDays: this.ttlDays
    };

    this.cache.set(npi, cacheEntry);
  }

  /**
   * Clear cache for specific NPI (e.g., when new information is reported)
   */
  clearCache(npi: string): void {
    this.cache.delete(npi);
  }

  /**
   * Clear all cached results
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `NPDB-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Hash evidence for audit trail
   */
  private hashEvidence(evidence: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(evidence));
    return `sha256:${hash.digest('hex')}`;
  }

  /**
   * Map NPDB action type codes to our enum
   */
  private mapActionType(npdbType: string): NPDBAdverseAction['actionType'] {
    const mapping: Record<string, NPDBAdverseAction['actionType']> = {
      'MP': 'malpractice_payment',
      'CP': 'clinical_privilege_action',
      'PS': 'professional_society_action',
      'LS': 'state_license_action',
      'DEA': 'dea_action',
      'CMS': 'cms_exclusion',
      'PR': 'peer_review_action'
    };
    return mapping[npdbType] || 'peer_review_action';
  }

  /**
   * Calculate severity based on action details
   */
  private calculateSeverity(action: any): 'low' | 'moderate' | 'high' | 'critical' {
    // CMS exclusions and active DEA actions are always critical
    if (action.type === 'CMS' || (action.type === 'DEA' && action.status === 'active')) {
      return 'critical';
    }

    // Active license suspensions are critical
    if (action.type === 'LS' && action.status === 'active' &&
        action.description?.toLowerCase().includes('suspend')) {
      return 'critical';
    }

    // Clinical privilege suspensions are high
    if (action.type === 'CP' && action.description?.toLowerCase().includes('suspend')) {
      return 'high';
    }

    // Large malpractice payments are high severity
    if (action.type === 'MP' && action.amount && action.amount > 100000) {
      return 'high';
    }

    // License actions are at least moderate
    if (action.type === 'LS') {
      return 'moderate';
    }

    // Default to low for minor issues
    return 'low';
  }

  /**
   * Get statistics about cache
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    const now = new Date();
    let validCount = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (now <= entry.expiresAt) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache(): number {
    const now = new Date();
    let removedCount = 0;

    for (const [npi, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(npi);
        removedCount++;
      }
    }

    return removedCount;
  }
}

/**
 * Singleton instance for application-wide use
 */
export const npdbService = new NPDBIntegrationService();

/**
 * Helper function to check if privilege request should be placed on HOLD
 * based on NPDB query result
 */
export function shouldHoldPrivilege(npdbResult: NPDBQueryResult): boolean {
  return npdbResult.holdTriggered || npdbResult.status === 'hold_required';
}

/**
 * Format NPDB result for display in reviewer panel
 */
export function formatNPDBResultForPanel(result: NPDBQueryResult): string {
  if (result.status === 'clear') {
    return '✅ NPDB Query Clear - No adverse actions found';
  }

  if (result.status === 'error') {
    return '⚠️ NPDB Query Error - Manual verification required';
  }

  let summary = `⚠️ NPDB Adverse Actions Found (${result.adverseActions.length}):\n\n`;

  result.adverseActions.forEach((action, idx) => {
    summary += `${idx + 1}. ${action.actionType.toUpperCase()} - ${action.actionDate}\n`;
    summary += `   Status: ${action.status} | Severity: ${action.severity}\n`;
    summary += `   ${action.description}\n\n`;
  });

  if (result.holdTriggered) {
    summary += '\n🛑 HOLD REQUIRED:\n';
    result.holdReasons.forEach(reason => {
      summary += `   • ${reason}\n`;
    });
  }

  return summary;
}

