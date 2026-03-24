export const BILLING_TIERS = ['STARTER', 'GROWTH', 'ENTERPRISE'] as const;

export type BillingTier = (typeof BILLING_TIERS)[number];

export type BillingCheckoutMode = 'self-serve' | 'contact-sales';

export type BillingFeature =
  | 'credential_issuance'
  | 'basic_verification'
  | 'trust_registry_read'
  | 'selective_disclosure'
  | 'federation'
  | 'analytics'
  | 'oid4vci'
  | 'oid4vp'
  | 'did_management'
  | 'conformance_suite'
  | 'sla'
  | 'dedicated_support'
  | 'custom_governance';

export interface BillingPlan {
  tier: BillingTier;
  name: string;
  priceMonthly: number | null;
  priceLabel: string;
  apiRequestsPerHour: number | null;
  checkoutMode: BillingCheckoutMode;
  features: readonly BillingFeature[];
  launchLimitations: readonly string[];
}

export const BILLING_FEATURE_LABELS: Record<BillingFeature, string> = {
  credential_issuance: 'Credential issuance',
  basic_verification: 'Basic verification',
  trust_registry_read: 'Trust registry read',
  selective_disclosure: 'Selective disclosure (SD-JWT)',
  federation: 'Federation',
  analytics: 'Analytics',
  oid4vci: 'OID4VCI flows',
  oid4vp: 'OID4VP flows',
  did_management: 'DID management',
  conformance_suite: 'Conformance suite',
  sla: 'SLA guarantee',
  dedicated_support: 'Dedicated support',
  custom_governance: 'Custom governance',
};

export const BILLING_PLANS: Record<BillingTier, BillingPlan> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    priceMonthly: 99,
    priceLabel: '$99/mo',
    apiRequestsPerHour: 100,
    checkoutMode: 'self-serve',
    features: ['credential_issuance', 'basic_verification', 'trust_registry_read'],
    launchLimitations: [
      'Launch copy must not imply live source coverage beyond NPPES and OIG/LEIE.',
      'Government access fees remain pass-through only and are not included in the card price.',
    ],
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth',
    priceMonthly: 299,
    priceLabel: '$299/mo',
    apiRequestsPerHour: 1000,
    checkoutMode: 'self-serve',
    features: [
      'credential_issuance',
      'basic_verification',
      'trust_registry_read',
      'selective_disclosure',
      'federation',
      'analytics',
      'oid4vci',
      'oid4vp',
    ],
    launchLimitations: [
      'Repeat access in the same freshness band is not re-billed.',
      'Contract-gated sources still require signed access before they can be shown as live.',
    ],
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: null,
    priceLabel: 'Custom',
    apiRequestsPerHour: null,
    checkoutMode: 'contact-sales',
    features: [
      'credential_issuance',
      'basic_verification',
      'trust_registry_read',
      'selective_disclosure',
      'federation',
      'analytics',
      'oid4vci',
      'oid4vp',
      'did_management',
      'conformance_suite',
      'sla',
      'dedicated_support',
      'custom_governance',
    ],
    launchLimitations: [
      'Enterprise pricing is manual until launch gating and buyer operations are proven on the pilot wedge.',
      'No contract or checkout path may imply unsupported compliance scope or unshipped source integrations.',
    ],
  },
};

export const PRICING_DOCTRINE_LIMITATIONS = [
  'Clinicians and issuers do not pay to participate in the network.',
  'Organizations pay for verified pulls, monitoring refreshes, exports, and integration utility only.',
  'Same-band repeat access is included and must not create a second charge.',
  'Government and registry fees are pass-through line items billed at cost with no markup.',
  'Contract-gated sources stay explicitly gated until institutional access is live.',
  'Launch pricing does not imply that public credit-card checkout is already enabled.',
] as const;

export const PRICING_FRESHNESS_BANDS = ['static', 'monthly-monitoring', 'continuous-monitoring'] as const;

export type PricingFreshnessBand = (typeof PRICING_FRESHNESS_BANDS)[number];

export type PricingAccessEvent =
  | {
      activity: 'credential_access';
      organizationId: string;
      credentialKey: string;
      freshnessBand: PricingFreshnessBand;
    }
  | {
      activity: 'monitoring_refresh' | 'export_run';
      organizationId: string;
      count?: number;
    };

export interface PricingAccessSummary {
  billableCredentialPulls: number;
  includedRepeatViews: number;
  monitoringRefreshes: number;
  exportRuns: number;
  billablePullsByFreshnessBand: Record<PricingFreshnessBand, number>;
}

function createFreshnessBandSummary(): Record<PricingFreshnessBand, number> {
  return {
    static: 0,
    'monthly-monitoring': 0,
    'continuous-monitoring': 0,
  };
}

export function isBillingTier(value: unknown): value is BillingTier {
  return typeof value === 'string' && BILLING_TIERS.includes(value as BillingTier);
}

export function normalizeBillingTier(
  value: unknown,
  fallback: BillingTier = 'STARTER',
): BillingTier {
  return isBillingTier(value) ? value : fallback;
}

export function getBillingPlan(tier: BillingTier): BillingPlan {
  return BILLING_PLANS[tier];
}

export function listBillingPlans(): BillingPlan[] {
  return BILLING_TIERS.map((tier) => getBillingPlan(tier));
}

export function getTierRateLimit(tier: BillingTier): number {
  return getBillingPlan(tier).apiRequestsPerHour ?? -1;
}

export function checkBillingFeatureAccess(
  tier: BillingTier,
  feature: BillingFeature,
): boolean {
  return getBillingPlan(tier).features.includes(feature);
}

export function summarizePricingAccess(
  events: readonly PricingAccessEvent[],
): PricingAccessSummary {
  const seenAccesses = new Set<string>();
  const summary: PricingAccessSummary = {
    billableCredentialPulls: 0,
    includedRepeatViews: 0,
    monitoringRefreshes: 0,
    exportRuns: 0,
    billablePullsByFreshnessBand: createFreshnessBandSummary(),
  };

  for (const event of events) {
    if (event.activity === 'credential_access') {
      const accessKey = [
        event.organizationId,
        event.credentialKey,
        event.freshnessBand,
      ].join('|');

      if (seenAccesses.has(accessKey)) {
        summary.includedRepeatViews += 1;
        continue;
      }

      seenAccesses.add(accessKey);
      summary.billableCredentialPulls += 1;
      summary.billablePullsByFreshnessBand[event.freshnessBand] += 1;
      continue;
    }

    const increment = event.count ?? 1;
    if (event.activity === 'monitoring_refresh') {
      summary.monitoringRefreshes += increment;
      continue;
    }

    summary.exportRuns += increment;
  }

  return summary;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}
