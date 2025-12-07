import { getServiceLogger } from '../logging/serviceLogger';
const log = getServiceLogger('psv/freshness-blocker');
/**
 * B128A-NCQA-011: Freshness blockers (≤120d/≤90d)
 * PagerDuty alert with deep-link & runbook
 */

export interface FreshnessPolicy {
  name: string;
  maxAgeDays: number; // Maximum age in days before blocking
  checkType: string; // Type of check (e.g., 'license', 'credential', 'psv')
  blocksExport: boolean; // Whether stale data blocks credential export
}

export interface FreshnessCheck {
  providerId: string;
  checkType: string;
  lastVerifiedAt: string;
  ageDays: number;
  isStale: boolean;
  policy: FreshnessPolicy;
  blocksExport: boolean;
}

export interface PagerDutyAlert {
  severity: 'critical' | 'error' | 'warning' | 'info';
  summary: string;
  source: string;
  component: string;
  class: string;
  group: string;
  custom_details: Record<string, any>;
  links: Array<{
    href: string;
    text: string;
  }>;
}

// B128A-NCQA-011: Freshness policies
const FRESHNESS_POLICIES: FreshnessPolicy[] = [
  {
    name: 'NCQA PSV 120-day',
    maxAgeDays: 120,
    checkType: 'psv',
    blocksExport: true,
  },
  {
    name: 'NCQA License 90-day',
    maxAgeDays: 90,
    checkType: 'license',
    blocksExport: true,
  },
  {
    name: 'NCQA Credential 90-day',
    maxAgeDays: 90,
    checkType: 'credential',
    blocksExport: true,
  },
  {
    name: 'Board Certification 365-day',
    maxAgeDays: 365,
    checkType: 'board_certification',
    blocksExport: false, // Warning only
  },
];

/**
 * B128A-NCQA-011: Calculate age in days
 */
function calculateAgeDays(lastVerifiedAt: string): number {
  const now = new Date();
  const lastVerified = new Date(lastVerifiedAt);
  const diffMs = now.getTime() - lastVerified.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * B128A-NCQA-011: Check freshness for a provider check
 */
export function checkFreshness(
  providerId: string,
  checkType: string,
  lastVerifiedAt: string
): FreshnessCheck {
  const policy = FRESHNESS_POLICIES.find(p => p.checkType === checkType);

  if (!policy) {
    // No policy defined - use default
    return {
      providerId,
      checkType,
      lastVerifiedAt,
      ageDays: calculateAgeDays(lastVerifiedAt),
      isStale: false,
      policy: {
        name: 'Default (no limit)',
        maxAgeDays: Infinity,
        checkType,
        blocksExport: false,
      },
      blocksExport: false,
    };
  }

  const ageDays = calculateAgeDays(lastVerifiedAt);
  const isStale = ageDays > policy.maxAgeDays;
  const blocksExport = isStale && policy.blocksExport;

  return {
    providerId,
    checkType,
    lastVerifiedAt,
    ageDays,
    isStale,
    policy,
    blocksExport,
  };
}

/**
 * B128A-NCQA-011: Check freshness for multiple provider checks
 */
export function checkProviderFreshness(
  providerId: string,
  checks: Array<{ checkType: string; lastVerifiedAt: string }>
): {
  providerId: string;
  checks: FreshnessCheck[];
  hasStaleChecks: boolean;
  blocksExport: boolean;
  staleChecks: FreshnessCheck[];
} {
  const freshnessChecks = checks.map(check =>
    checkFreshness(providerId, check.checkType, check.lastVerifiedAt)
  );

  const staleChecks = freshnessChecks.filter(c => c.isStale);
  const hasStaleChecks = staleChecks.length > 0;
  const blocksExport = staleChecks.some(c => c.blocksExport);

  return {
    providerId,
    checks: freshnessChecks,
    hasStaleChecks,
    blocksExport,
    staleChecks,
  };
}

/**
 * B128A-NCQA-011: Generate PagerDuty alert with deep-link and runbook
 */
export function generatePagerDutyAlert(
  freshnessCheck: FreshnessCheck,
  providerName: string
): PagerDutyAlert {
  const severity = freshnessCheck.blocksExport ? 'critical' : 'warning';
  const baseUrl = process.env.APP_BASE_URL || 'https://vitalcv.ai';
  const runbookUrl = `${baseUrl}/docs/runbooks/freshness-blocker`;
  const providerUrl = `${baseUrl}/admin/providers/${freshnessCheck.providerId}`;

  // B128A-NCQA-011: PagerDuty alert includes provider deep-link and runbook URL
  const alert: PagerDutyAlert = {
    severity,
    summary: `Stale ${freshnessCheck.checkType} check for provider ${providerName} (${freshnessCheck.ageDays}d old)`,
    source: 'VitalCV Freshness Monitor',
    component: 'PSV Freshness',
    class: 'freshness_blocker',
    group: 'ncqa_compliance',
    custom_details: {
      provider_id: freshnessCheck.providerId,
      provider_name: providerName,
      check_type: freshnessCheck.checkType,
      last_verified_at: freshnessCheck.lastVerifiedAt,
      age_days: freshnessCheck.ageDays,
      max_age_days: freshnessCheck.policy.maxAgeDays,
      policy_name: freshnessCheck.policy.name,
      blocks_export: freshnessCheck.blocksExport,
      action_required: freshnessCheck.blocksExport
        ? 'IMMEDIATE: Re-verify provider to unblock export'
        : 'SOON: Schedule re-verification',
    },
    links: [
      {
        href: providerUrl,
        text: `View Provider ${freshnessCheck.providerId}`,
      },
      {
        href: runbookUrl,
        text: 'Freshness Blocker Runbook',
      },
      {
        href: `${baseUrl}/admin/providers/${freshnessCheck.providerId}/reverify`,
        text: 'Re-verify Provider',
      },
    ],
  };

  return alert;
}

/**
 * B128A-NCQA-011: Send PagerDuty alert
 */
export async function sendPagerDutyAlert(alert: PagerDutyAlert): Promise<boolean> {
  const pdApiKey = process.env.PAGERDUTY_API_KEY;
  const pdIntegrationKey = process.env.PAGERDUTY_INTEGRATION_KEY;

  if (!pdApiKey || !pdIntegrationKey) {
    log.warn('[Freshness] PagerDuty not configured - alert not sent');
    log.info('[Freshness] Alert:', JSON.stringify(alert, null, 2));
    return false;
  }

  try {
    // PagerDuty Events API v2
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.pagerduty+json;version=2',
        'Authorization': `Token token=${pdApiKey}`,
      },
      body: JSON.stringify({
        routing_key: pdIntegrationKey,
        event_action: 'trigger',
        payload: {
          summary: alert.summary,
          severity: alert.severity,
          source: alert.source,
          component: alert.component,
          class: alert.class,
          group: alert.group,
          custom_details: alert.custom_details,
        },
        links: alert.links,
      }),
    });

    if (!response.ok) {
      log.error('[Freshness] PagerDuty alert failed:', response.status, response.statusText);
      return false;
    }

    log.info('[Freshness] PagerDuty alert sent successfully');
    return true;
  } catch (error) {
    log.error('[Freshness] PagerDuty alert error:', error);
    return false;
  }
}

/**
 * B128A-NCQA-011: Monitor freshness and trigger alerts
 */
export async function monitorProviderFreshness(
  providerId: string,
  providerName: string,
  checks: Array<{ checkType: string; lastVerifiedAt: string }>
): Promise<{
  providerId: string;
  hasStaleChecks: boolean;
  blocksExport: boolean;
  alertsSent: number;
}> {
  const result = checkProviderFreshness(providerId, checks);

  let alertsSent = 0;

  // B128A-NCQA-011: Send PagerDuty alerts for stale checks that block export
  for (const staleCheck of result.staleChecks) {
    if (staleCheck.blocksExport) {
      const alert = generatePagerDutyAlert(staleCheck, providerName);
      const sent = await sendPagerDutyAlert(alert);
      if (sent) {
        alertsSent++;
      }
    }
  }

  return {
    providerId,
    hasStaleChecks: result.hasStaleChecks,
    blocksExport: result.blocksExport,
    alertsSent,
  };
}

/**
 * Get all freshness policies
 */
export function getFreshnessPolicies(): FreshnessPolicy[] {
  return FRESHNESS_POLICIES;
}

/**
 * Get freshness policy by check type
 */
export function getFreshnessPolicy(checkType: string): FreshnessPolicy | undefined {
  return FRESHNESS_POLICIES.find(p => p.checkType === checkType);
}
