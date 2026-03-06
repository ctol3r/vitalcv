/**
 * subscriptionService.ts — Wave 115: Subscription Billing
 *
 * Manages VitalCV subscription tiers and feature access.
 *
 * Tiers:
 *   STARTER    — $99/mo   — 100 API req/hr, basic features
 *   GROWTH     — $299/mo  — 1000 API req/hr, all features
 *   ENTERPRISE — custom   — unlimited, SLA, dedicated support
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../../obs/logger';

const prisma = new PrismaClient();

export type SubscriptionTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export interface TierConfig {
  tier: SubscriptionTier;
  priceMonthly: number | null; // null = custom
  apiRequestsPerHour: number;  // -1 = unlimited
  features: string[];
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  STARTER: {
    tier: 'STARTER',
    priceMonthly: 99,
    apiRequestsPerHour: 100,
    features: ['credential_issuance', 'basic_verification', 'trust_registry_read'],
  },
  GROWTH: {
    tier: 'GROWTH',
    priceMonthly: 299,
    apiRequestsPerHour: 1000,
    features: [
      'credential_issuance', 'basic_verification', 'trust_registry_read',
      'selective_disclosure', 'federation', 'analytics', 'oid4vci', 'oid4vp',
    ],
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    priceMonthly: null,
    apiRequestsPerHour: -1,
    features: [
      'credential_issuance', 'basic_verification', 'trust_registry_read',
      'selective_disclosure', 'federation', 'analytics', 'oid4vci', 'oid4vp',
      'did_management', 'conformance_suite', 'sla', 'dedicated_support', 'custom_governance',
    ],
  },
};

export async function createSubscription(
  clinicianId: string,
  tier: SubscriptionTier,
  stripeSubId?: string,
): Promise<{ id: string; tier: string; status: string }> {
  // Cancel any existing active subscription
  await prisma.subscription.updateMany({
    where: { clinicianId, status: 'active' },
    data: { status: 'canceled' },
  });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const sub = await prisma.subscription.create({
    data: {
      clinicianId,
      tier,
      status: 'active',
      stripeSubId: stripeSubId ?? null,
      currentPeriodEnd: periodEnd,
    },
  });

  log('info', 'subscription_created', { clinicianId, tier, id: sub.id });
  return { id: sub.id, tier: sub.tier, status: sub.status };
}

export async function cancelSubscription(id: string): Promise<void> {
  await prisma.subscription.update({
    where: { id },
    data: { status: 'canceled', updatedAt: new Date() },
  });
  log('info', 'subscription_canceled', { id });
}

export async function getSubscriptionByClinicianId(
  clinicianId: string,
): Promise<{ id: string; tier: string; status: string; currentPeriodEnd: Date | null } | null> {
  return prisma.subscription.findFirst({
    where: { clinicianId, status: 'active' },
    select: { id: true, tier: true, status: true, currentPeriodEnd: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function checkFeatureAccess(tier: SubscriptionTier, feature: string): boolean {
  return TIER_CONFIGS[tier]?.features.includes(feature) ?? false;
}
