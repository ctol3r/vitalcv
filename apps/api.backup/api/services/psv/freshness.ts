import { getServiceLogger } from '../logging/serviceLogger';
const log = getServiceLogger('psv/freshness');
/**
 * B111A-NCQA-011: Freshness blockers: ≤120d/≤90d; PagerDuty alert deep-link+runbook
 *
 * Manages freshness windows (120d/90d) and alerting:
 * - Stale blocks verification
 * - PagerDuty alert includes provider link & runbook
 */

export interface FreshnessPolicy {
  /** Policy identifier */
  id: string;
  /** Check type (e.g., 'CR1', 'CR2') */
  checkType: string;
  /** Freshness window in days */
  windowDays: number;
  /** Alert threshold (days before expiry) */
  alertThresholdDays: number;
}

export interface FreshnessBreach {
  providerId: string;
  checkId: string;
  checkType: string;
  ageDays: number;
  windowDays: number;
  breachedAt: number;
  incidentId?: string;
}

export interface FreshnessAlert {
  type: 'breach' | 'warning' | 'expiring';
  providerId: string;
  checkId: string;
  checkType: string;
  message: string;
  timestamp: number;
  pagerDutyIncidentId?: string;
  providerLink?: string;
  runbookLink?: string;
}

/**
 * Freshness policy manager
 */
export class FreshnessPolicyManager {
  private policies: Map<string, FreshnessPolicy>;
  private breaches: FreshnessBreach[];
  private alerts: FreshnessAlert[];

  constructor() {
    this.policies = new Map();
    this.breaches = [];
    this.alerts = [];

    // Initialize default NCQA policies
    this.policies.set('CR1', {
      id: 'CR1',
      checkType: 'CR1',
      windowDays: 120, // 120 days
      alertThresholdDays: 30, // Alert 30 days before expiry
    });

    this.policies.set('CR2', {
      id: 'CR2',
      checkType: 'CR2',
      windowDays: 90, // 90 days
      alertThresholdDays: 20, // Alert 20 days before expiry
    });
  }

  /**
   * Check freshness of a PSV check
   * B114A-NCQA-011: Stale blocks export; PD alert includes provider link & runbook
   */
  async checkFreshness(check: { id: string; providerId: string; checkType: string; updatedAt: number }): Promise<{
    fresh: boolean;
    ageDays: number;
    windowDays: number;
    breach?: FreshnessBreach;
    alert?: FreshnessAlert;
  }> {
    const policy = this.policies.get(check.checkType);

    if (!policy) {
      // No policy = always fresh (for unknown check types)
      return {
        fresh: true,
        ageDays: 0,
        windowDays: 0,
      };
    }

    const now = Date.now();
    const ageMs = now - check.updatedAt;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const windowDays = policy.windowDays;
    const fresh = ageDays < windowDays;

    let breach: FreshnessBreach | undefined;
    let alert: FreshnessAlert | undefined;

    if (!fresh) {
      // Breach detected
      const incidentId = `inc-${check.providerId}-${check.checkType}-${now}`;
      breach = {
        providerId: check.providerId,
        checkId: check.id,
        checkType: check.checkType,
        ageDays,
        windowDays,
        breachedAt: now,
        incidentId,
      };

      this.breaches.push(breach);

      // B114A-NCQA-011: Generate PagerDuty alert with deep-link and runbook
      const providerLink = `${process.env.PUBLIC_APP_URL || 'https://vitalcv.ai'}/providers/${check.providerId}`;
      const runbookLink = `${process.env.RUNBOOK_BASE_URL || 'https://docs.vitalcv.ai'}/runbooks/freshness-breach`;
      const pagerDutyIncidentId = await this.sendPagerDutyAlert({
        incidentId,
        providerId: check.providerId,
        checkId: check.id,
        checkType: check.checkType,
        ageDays,
        windowDays,
        providerLink,
        runbookLink,
      });

      alert = {
        type: 'breach',
        providerId: check.providerId,
        checkId: check.id,
        checkType: check.checkType,
        message: `Freshness breach: ${check.checkType} check is ${ageDays} days old (window: ${windowDays} days)`,
        timestamp: now,
        pagerDutyIncidentId,
        providerLink,
        runbookLink,
      };

      this.alerts.push(alert);
    } else if (ageDays >= windowDays - policy.alertThresholdDays) {
      // Approaching expiry - warning
      alert = {
        type: 'warning',
        providerId: check.providerId,
        checkId: check.id,
        checkType: check.checkType,
        message: `Freshness warning: ${check.checkType} check will expire in ${windowDays - ageDays} days`,
        timestamp: now,
      };

      this.alerts.push(alert);
    }

    return {
      fresh,
      ageDays,
      windowDays,
      breach,
      alert,
    };
  }

  /**
   * Get all breaches
   */
  getBreaches(): FreshnessBreach[] {
    return [...this.breaches];
  }

  /**
   * Get breaches for a provider
   */
  getBreachesForProvider(providerId: string): FreshnessBreach[] {
    return this.breaches.filter(b => b.providerId === providerId);
  }

  /**
   * Get all alerts
   */
  getAlerts(limit: number = 100): FreshnessAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get stale items (breached freshness)
   */
  getStaleItems(): FreshnessBreach[] {
    return this.breaches.filter(b => {
      // Only return breaches that haven't been resolved
      // (In production, check if incident is closed)
      return true;
    });
  }

  /**
   * Export stale items list
   */
  exportStaleItems(): { stale: FreshnessBreach[]; exportedAt: string } {
    return {
      stale: this.getStaleItems(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * B111A-NCQA-011: Send PagerDuty alert with deep-link and runbook
   */
  private async sendPagerDutyAlert(alertData: {
    incidentId: string;
    providerId: string;
    checkId: string;
    checkType: string;
    ageDays: number;
    windowDays: number;
    providerLink: string;
    runbookLink: string;
  }): Promise<string | undefined> {
    const pagerDutyIntegrationKey = process.env.PAGERDUTY_INTEGRATION_KEY;

    if (!pagerDutyIntegrationKey) {
      log.warn('[Freshness] PagerDuty integration key not configured. Skipping alert.');
      return undefined;
    }

    try {
      // B111A-NCQA-011: Construct PagerDuty alert payload with deep-link and runbook
      const payload = {
        routing_key: pagerDutyIntegrationKey,
        event_action: 'trigger',
        dedup_key: alertData.incidentId,
        payload: {
          summary: `Freshness breach: ${alertData.checkType} check for provider ${alertData.providerId} is ${alertData.ageDays} days old (window: ${alertData.windowDays} days)`,
          severity: 'critical',
          source: 'vitalcv-freshness-service',
          custom_details: {
            providerId: alertData.providerId,
            checkId: alertData.checkId,
            checkType: alertData.checkType,
            ageDays: alertData.ageDays,
            windowDays: alertData.windowDays,
            providerLink: alertData.providerLink,
            runbookLink: alertData.runbookLink,
            incidentId: alertData.incidentId,
          },
          links: [
            {
              href: alertData.providerLink,
              text: 'View Provider',
            },
            {
              href: alertData.runbookLink,
              text: 'View Runbook',
            },
          ],
        },
      };

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        log.error('[Freshness] PagerDuty alert failed:', response.status, errorText);
        return undefined;
      }

      const result = await response.json();
      log.info('[Freshness] PagerDuty alert sent:', {
        incidentId: alertData.incidentId,
        pagerDutyIncidentId: result.dedup_key,
        providerLink: alertData.providerLink,
        runbookLink: alertData.runbookLink,
      });

      return result.dedup_key || alertData.incidentId;
    } catch (error) {
      log.error('[Freshness] PagerDuty alert error:', error);
      return undefined;
    }
  }
}

// Singleton instance
let freshnessManager: FreshnessPolicyManager | null = null;

export function getFreshnessManager(): FreshnessPolicyManager {
  if (!freshnessManager) {
    freshnessManager = new FreshnessPolicyManager();
  }
  return freshnessManager;
}

