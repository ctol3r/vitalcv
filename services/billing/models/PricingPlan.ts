/**
 * Pricing Plan Model for Partner Billing
 *
 * Supports tiered pricing with per-job-post and per-successful-hire tariffs.
 * Default plans are stored and can be customized per partner.
 */

export interface PricingTier {
  tierName: string;
  minVolume: number;
  maxVolume?: number; // undefined means unlimited
  pricePerUnit: number; // in cents
}

export interface JobPostPricing {
  enabled: boolean;
  tiers: PricingTier[];
  flatRate?: number; // in cents, if not using tiers
}

export interface SuccessfulHirePricing {
  enabled: boolean;
  tiers: PricingTier[];
  flatRate?: number; // in cents, if not using tiers
  percentageOfSalary?: number; // alternative: percentage of first year salary
}

export interface PricingPlan {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  jobPostPricing: JobPostPricing;
  successfulHirePricing: SuccessfulHirePricing;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerPricingConfig {
  partnerId: string;
  pricingPlanId: string;
  customOverrides?: Partial<PricingPlan>;
  effectiveDate: Date;
  expiryDate?: Date;
}

/**
 * Default Pricing Plans
 */
export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter Plan',
    description: 'For small businesses and startups',
    isDefault: true,
    jobPostPricing: {
      enabled: true,
      flatRate: 9900, // $99 per job post
      tiers: [],
    },
    successfulHirePricing: {
      enabled: true,
      flatRate: 49900, // $499 per successful hire
      tiers: [],
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'growth',
    name: 'Growth Plan',
    description: 'For growing companies with volume hiring',
    isDefault: false,
    jobPostPricing: {
      enabled: true,
      tiers: [
        {
          tierName: 'First 10 jobs',
          minVolume: 1,
          maxVolume: 10,
          pricePerUnit: 8900, // $89 per job
        },
        {
          tierName: '11-50 jobs',
          minVolume: 11,
          maxVolume: 50,
          pricePerUnit: 7900, // $79 per job
        },
        {
          tierName: '51+ jobs',
          minVolume: 51,
          pricePerUnit: 6900, // $69 per job
        },
      ],
    },
    successfulHirePricing: {
      enabled: true,
      tiers: [
        {
          tierName: 'First 5 hires',
          minVolume: 1,
          maxVolume: 5,
          pricePerUnit: 44900, // $449 per hire
        },
        {
          tierName: '6-20 hires',
          minVolume: 6,
          maxVolume: 20,
          pricePerUnit: 39900, // $399 per hire
        },
        {
          tierName: '21+ hires',
          minVolume: 21,
          pricePerUnit: 34900, // $349 per hire
        },
      ],
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    description: 'For large organizations with custom pricing',
    isDefault: false,
    jobPostPricing: {
      enabled: true,
      tiers: [
        {
          tierName: 'First 50 jobs',
          minVolume: 1,
          maxVolume: 50,
          pricePerUnit: 5900, // $59 per job
        },
        {
          tierName: '51-200 jobs',
          minVolume: 51,
          maxVolume: 200,
          pricePerUnit: 4900, // $49 per job
        },
        {
          tierName: '201+ jobs',
          minVolume: 201,
          pricePerUnit: 3900, // $39 per job
        },
      ],
    },
    successfulHirePricing: {
      enabled: true,
      percentageOfSalary: 10, // 10% of first year salary
      tiers: [
        {
          tierName: 'First 20 hires',
          minVolume: 1,
          maxVolume: 20,
          pricePerUnit: 29900, // $299 per hire
        },
        {
          tierName: '21+ hires',
          minVolume: 21,
          pricePerUnit: 24900, // $249 per hire
        },
      ],
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
];

/**
 * Calculate pricing for job posts based on volume and tier
 */
export function calculateJobPostPrice(
  volume: number,
  pricing: JobPostPricing
): number {
  if (!pricing.enabled) {
    return 0;
  }

  if (pricing.flatRate) {
    return pricing.flatRate * volume;
  }

  let totalPrice = 0;
  let remainingVolume = volume;

  for (const tier of pricing.tiers) {
    if (remainingVolume <= 0) break;

    const tierCapacity = tier.maxVolume
      ? Math.min(remainingVolume, tier.maxVolume - tier.minVolume + 1)
      : remainingVolume;

    totalPrice += tierCapacity * tier.pricePerUnit;
    remainingVolume -= tierCapacity;
  }

  return totalPrice;
}

/**
 * Calculate pricing for successful hires based on volume and tier
 */
export function calculateSuccessfulHirePrice(
  volume: number,
  pricing: SuccessfulHirePricing,
  estimatedSalary?: number
): number {
  if (!pricing.enabled) {
    return 0;
  }

  // If percentage-based and salary provided, use that
  if (pricing.percentageOfSalary && estimatedSalary) {
    return Math.round((estimatedSalary * pricing.percentageOfSalary) / 100);
  }

  if (pricing.flatRate) {
    return pricing.flatRate * volume;
  }

  let totalPrice = 0;
  let remainingVolume = volume;

  for (const tier of pricing.tiers) {
    if (remainingVolume <= 0) break;

    const tierCapacity = tier.maxVolume
      ? Math.min(remainingVolume, tier.maxVolume - tier.minVolume + 1)
      : remainingVolume;

    totalPrice += tierCapacity * tier.pricePerUnit;
    remainingVolume -= tierCapacity;
  }

  return totalPrice;
}

/**
 * Get pricing plan by ID
 */
export function getPricingPlan(planId: string): PricingPlan | undefined {
  return DEFAULT_PRICING_PLANS.find((plan) => plan.id === planId);
}

/**
 * Get default pricing plan
 */
export function getDefaultPricingPlan(): PricingPlan {
  const defaultPlan = DEFAULT_PRICING_PLANS.find((plan) => plan.isDefault);
  if (!defaultPlan) {
    throw new Error('No default pricing plan configured');
  }
  return defaultPlan;
}

/**
 * Database Migration Helper
 * This would be used in a Prisma migration or similar
 */
export function generatePricingPlanMigration(): string {
  return `
-- Migration: Add Pricing Plans
-- Generated: ${new Date().toISOString()}

CREATE TABLE IF NOT EXISTS pricing_plans (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  job_post_pricing JSONB NOT NULL,
  successful_hire_pricing JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_pricing_configs (
  id SERIAL PRIMARY KEY,
  partner_id VARCHAR(255) NOT NULL,
  pricing_plan_id VARCHAR(255) NOT NULL REFERENCES pricing_plans(id),
  custom_overrides JSONB,
  effective_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, effective_date)
);

CREATE INDEX idx_partner_pricing_partner_id ON partner_pricing_configs(partner_id);
CREATE INDEX idx_partner_pricing_effective_date ON partner_pricing_configs(effective_date);

-- Insert default pricing plans
${DEFAULT_PRICING_PLANS.map(
  (plan) => `
INSERT INTO pricing_plans (id, name, description, is_default, job_post_pricing, successful_hire_pricing, created_at, updated_at)
VALUES (
  '${plan.id}',
  '${plan.name}',
  '${plan.description || ''}',
  ${plan.isDefault},
  '${JSON.stringify(plan.jobPostPricing)}'::jsonb,
  '${JSON.stringify(plan.successfulHirePricing)}'::jsonb,
  '${plan.createdAt.toISOString()}',
  '${plan.updatedAt.toISOString()}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_default = EXCLUDED.is_default,
  job_post_pricing = EXCLUDED.job_post_pricing,
  successful_hire_pricing = EXCLUDED.successful_hire_pricing,
  updated_at = NOW();
`
).join('\n')}
`;
}

