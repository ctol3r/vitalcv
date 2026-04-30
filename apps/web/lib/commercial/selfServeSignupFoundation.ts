export type SignupStepKind =
  | 'choose_role'
  | 'enter_npi'
  | 'create_account_planned'
  | 'verify_email_planned'
  | 'complete_profile'
  | 'export_passport'
  | 'request_verifier_review';

export type SignupStepStatus =
  | 'foundation_available'
  | 'planned_control'
  | 'next_step';

export type SignupFoundationStep = {
  kind: SignupStepKind;
  label: string;
  status: SignupStepStatus;
  description: string;
  requiresIdentityProofing: false;
  collectsPayment: false;
};

export type SignupFoundationPlan = {
  steps: SignupFoundationStep[];
  accountCreationProductionReady: false;
  identityProofingComplete: false;
  paymentCollectionLive: false;
  disclaimers: string[];
};

export function buildSignupFoundationPlan(): SignupFoundationPlan {
  return {
    accountCreationProductionReady: false,
    identityProofingComplete: false,
    paymentCollectionLive: false,
    disclaimers: [
      'Self-serve signup is a foundation flow. Production account creation may require additional controls.',
      'NPI entry and profile setup do not complete identity proofing.',
      'No payment method is collected during this signup foundation.',
    ],
    steps: [
      {
        kind: 'choose_role',
        label: 'Choose role',
        status: 'foundation_available',
        description: 'Separates clinician and verifier intent for future routing.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
      {
        kind: 'enter_npi',
        label: 'Enter NPI',
        status: 'foundation_available',
        description: 'Starts source lookup context; an NPI entry is not government identity proofing.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
      {
        kind: 'create_account_planned',
        label: 'Create account',
        status: 'planned_control',
        description: 'Production account creation may require additional auth, recovery, and abuse controls.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
      {
        kind: 'verify_email_planned',
        label: 'Verify email',
        status: 'planned_control',
        description: 'Email verification is planned as an account control, not identity proofing.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
      {
        kind: 'complete_profile',
        label: 'Complete profile',
        status: 'foundation_available',
        description: 'Collects user-entered context that remains unverified until source-backed checks upgrade it.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
      {
        kind: 'export_passport',
        label: 'Export passport preview',
        status: 'next_step',
        description: 'Exports remain preview/source-backed according to existing passport evidence.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
      {
        kind: 'request_verifier_review',
        label: 'Request verifier review',
        status: 'next_step',
        description: 'Routes to a verifier review request path without guaranteeing acceptance.',
        requiresIdentityProofing: false,
        collectsPayment: false,
      },
    ],
  };
}

export function explainSignupStepStatus(status: SignupStepStatus): string {
  switch (status) {
    case 'foundation_available':
      return 'Foundation step is represented for planning and route copy.';
    case 'planned_control':
      return 'Required production control is planned, not live in this foundation.';
    case 'next_step':
      return 'Action depends on existing evidence and does not complete credentialing by itself.';
  }
}
