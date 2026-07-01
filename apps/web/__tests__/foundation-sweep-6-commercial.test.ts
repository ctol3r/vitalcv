/**
 * FOUNDATION-SWEEP-6A - commercial launch foundation tests.
 *
 * Truth invariants enforced:
 *   - Pricing is a foundation preview and never collects payment.
 *   - Signup foundation does not claim payment or identity proofing.
 *   - Onboarding does not complete credentialing.
 *   - Routes carry required safe copy and avoid live subscription/vendor claims.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildOnboardingFoundationPlan,
  explainOnboardingMilestoneStatus,
  type OnboardingMilestoneStatus,
} from '../lib/commercial/onboardingFoundation';
import {
  buildPricingFoundationPlan,
  explainPricingPlanStatus,
  type PricingPlanStatus,
} from '../lib/commercial/pricingFoundation';
import {
  buildSignupFoundationPlan,
  explainSignupStepStatus,
  type SignupStepStatus,
} from '../lib/commercial/selfServeSignupFoundation';

const APP_ROOT = resolve(__dirname, '..', 'app');
const readRoute = (rel: string) => readFileSync(resolve(APP_ROOT, rel), 'utf-8');

describe('pricing foundation', () => {
  const plans = buildPricingFoundationPlan();

  it('includes all required commercial plan kinds', () => {
    expect(plans.map((p) => p.kind)).toEqual([
      'clinician_free',
      'clinician_plus_planned',
      'verifier_pilot',
      'verifier_team_planned',
      'enterprise_planned',
    ]);
  });

  it('pricing plans do not collect payments or activate subscriptions', () => {
    for (const plan of plans) {
      expect(plan.collectsPayment).toBe(false);
      expect(plan.subscriptionActive).toBe(false);
      expect(plan.checkoutIntegrationLive).toBe(false);
      expect(plan.capabilities).toContain('no_payment_collection');
      expect(plan.capabilities).toContain('no_active_subscription');
      expect(plan.capabilities).toContain('no_checkout_integration');
    }
  });

  it('pricing text does not claim Stripe, checkout, or live subscriptions', () => {
    const text = JSON.stringify(plans).toLowerCase();
    for (const phrase of [
      'payments are live',
      'stripe checkout live',
      'subscription active',
      'active paid subscription',
      'payment method collected',
    ]) {
      expect(text).not.toContain(phrase);
    }
  });

  it('explainPricingPlanStatus returns text for every status', () => {
    const statuses: PricingPlanStatus[] = ['foundation_preview', 'pilot_ready', 'planned'];
    for (const status of statuses) {
      expect(explainPricingPlanStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe('self-serve signup foundation', () => {
  const plan = buildSignupFoundationPlan();

  it('includes every required signup step', () => {
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'choose_role',
      'enter_npi',
      'create_account_planned',
      'verify_email_planned',
      'complete_profile',
      'export_passport',
      'request_verifier_review',
    ]);
  });

  it('signup flow does not claim identity proofing or payment collection', () => {
    expect(plan.accountCreationProductionReady).toBe(false);
    expect(plan.identityProofingComplete).toBe(false);
    expect(plan.paymentCollectionLive).toBe(false);
    for (const step of plan.steps) {
      expect(step.requiresIdentityProofing).toBe(false);
      expect(step.collectsPayment).toBe(false);
    }
  });

  it('explains NPI and profile setup as non-proofing foundation states', () => {
    expect(plan.disclaimers.some((d) => /NPI entry and profile setup do not complete identity proofing/.test(d))).toBe(true);
    expect(plan.disclaimers.some((d) => /No payment method is collected/.test(d))).toBe(true);
  });

  it('explainSignupStepStatus returns text for every status', () => {
    const statuses: SignupStepStatus[] = ['foundation_available', 'planned_control', 'next_step'];
    for (const status of statuses) {
      expect(explainSignupStepStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe('onboarding foundation', () => {
  const plan = buildOnboardingFoundationPlan();

  it('includes required onboarding milestones', () => {
    expect(plan.milestones.map((m) => m.kind)).toEqual([
      'first_npi_lookup',
      'profile_foundation',
      'import_foundation',
      'readiness_summary',
      'proof_pack_preview',
      'verifier_share_planned',
    ]);
  });

  it('onboarding does not claim production completion or credentialing completion', () => {
    expect(plan.productionOnboardingComplete).toBe(false);
    expect(plan.completesCredentialing).toBe(false);
    for (const milestone of plan.milestones) {
      expect(milestone.completesCredentialing).toBe(false);
    }
  });

  it('keeps verifier share planned and proof pack preview-only', () => {
    const proofPack = plan.milestones.find((m) => m.kind === 'proof_pack_preview');
    const verifierShare = plan.milestones.find((m) => m.kind === 'verifier_share_planned');
    expect(proofPack?.status).toBe('preview_only');
    expect(verifierShare?.status).toBe('planned');
  });

  it('explainOnboardingMilestoneStatus returns text for every status', () => {
    const statuses: OnboardingMilestoneStatus[] = ['foundation_available', 'preview_only', 'planned'];
    for (const status of statuses) {
      expect(explainOnboardingMilestoneStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe('commercial route copy invariants', () => {
  it('pricing route includes the required payment safety copy', () => {
    const src = readRoute('pricing/page.tsx');
    expect(src).toContain('Pricing is a foundation preview. Payments are not collected in this build.');
  });

  it('signup route is a pure redirect to the real Clerk sign-up flow', () => {
    const src = readRoute('signup/page.tsx');
    expect(src).toContain("redirect('/sign-up')");
    // The legacy foundation shell is gone: the alias must not render its own
    // signup UI or plan copy that could read as a second account-creation path.
    expect(src).not.toContain('buildSignupFoundationPlan');
  });

  it('onboarding route includes the required credentialing safety copy', () => {
    const src = readRoute('onboarding/page.tsx');
    expect(src).toContain('Onboarding summarizes the continuation path. It does not complete credentialing.');
  });

  it('commercial routes avoid positive live payment, proofing, and acceptance claims', () => {
    const banned = [
      'payments are live',
      'stripe checkout live',
      'identity proofing complete',
      'guaranteed acceptance',
      'production signup complete',
      'payment data collected',
      'subscriptions are live',
      'complete credentialing achieved',
    ];

    for (const rel of ['pricing/page.tsx', 'signup/page.tsx', 'onboarding/page.tsx']) {
      const src = readRoute(rel).toLowerCase();
      for (const phrase of banned) {
        expect(src).not.toContain(phrase);
      }
    }
  });
});
