export type PricingPlanKind =
  | 'clinician_free'
  | 'clinician_plus_planned'
  | 'verifier_pilot'
  | 'verifier_team_planned'
  | 'enterprise_planned';

export type PricingPlanStatus =
  | 'foundation_preview'
  | 'pilot_ready'
  | 'planned';

export type PricingCapability =
  | 'plan_display'
  | 'role_selection'
  | 'pilot_contact'
  | 'no_payment_collection'
  | 'no_active_subscription'
  | 'no_checkout_integration';

export type PricingFoundationPlan = {
  kind: PricingPlanKind;
  label: string;
  status: PricingPlanStatus;
  audience: 'clinician' | 'verifier' | 'enterprise';
  priceLabel: string;
  capabilities: PricingCapability[];
  collectsPayment: false;
  subscriptionActive: false;
  checkoutIntegrationLive: false;
  description: string;
};

export function buildPricingFoundationPlan(): PricingFoundationPlan[] {
  const foundationCapabilities: PricingCapability[] = [
    'plan_display',
    'role_selection',
    'no_payment_collection',
    'no_active_subscription',
    'no_checkout_integration',
  ];

  return [
    {
      kind: 'clinician_free',
      label: 'Clinician Free',
      status: 'foundation_preview',
      audience: 'clinician',
      priceLabel: 'Free foundation preview',
      capabilities: foundationCapabilities,
      collectsPayment: false,
      subscriptionActive: false,
      checkoutIntegrationLive: false,
      description: 'Shows the baseline clinician passport readiness path without payment collection.',
    },
    {
      kind: 'clinician_plus_planned',
      label: 'Clinician Plus',
      status: 'planned',
      audience: 'clinician',
      priceLabel: 'Planned',
      capabilities: foundationCapabilities,
      collectsPayment: false,
      subscriptionActive: false,
      checkoutIntegrationLive: false,
      description: 'Represents future clinician profile and export packaging; it is not a live subscription.',
    },
    {
      kind: 'verifier_pilot',
      label: 'Verifier Pilot',
      status: 'pilot_ready',
      audience: 'verifier',
      priceLabel: 'Pilot conversation',
      capabilities: [...foundationCapabilities, 'pilot_contact'],
      collectsPayment: false,
      subscriptionActive: false,
      checkoutIntegrationLive: false,
      description: 'Supports pilot qualification and buyer routing without checkout or payment capture.',
    },
    {
      kind: 'verifier_team_planned',
      label: 'Verifier Team',
      status: 'planned',
      audience: 'verifier',
      priceLabel: 'Planned',
      capabilities: foundationCapabilities,
      collectsPayment: false,
      subscriptionActive: false,
      checkoutIntegrationLive: false,
      description: 'Defines the intended team plan shape before billing or subscription operations exist.',
    },
    {
      kind: 'enterprise_planned',
      label: 'Enterprise',
      status: 'planned',
      audience: 'enterprise',
      priceLabel: 'Planned',
      capabilities: [...foundationCapabilities, 'pilot_contact'],
      collectsPayment: false,
      subscriptionActive: false,
      checkoutIntegrationLive: false,
      description: 'Frames enterprise launch planning for pilots and procurement; no production billing is live.',
    },
  ];
}

export function explainPricingPlanStatus(status: PricingPlanStatus): string {
  switch (status) {
    case 'foundation_preview':
      return 'Visible as pricing scaffolding only; payments are not collected in this build.';
    case 'pilot_ready':
      return 'Can route a pilot conversation, but it does not activate a paid subscription.';
    case 'planned':
      return 'Roadmap plan only; no Stripe, checkout, or active subscription capability is live.';
  }
}
