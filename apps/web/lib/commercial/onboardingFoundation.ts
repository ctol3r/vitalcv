export type OnboardingMilestoneKind =
  | 'first_npi_lookup'
  | 'profile_foundation'
  | 'import_foundation'
  | 'readiness_summary'
  | 'proof_pack_preview'
  | 'verifier_share_planned';

export type OnboardingMilestoneStatus =
  | 'foundation_available'
  | 'preview_only'
  | 'planned';

export type OnboardingFoundationMilestone = {
  kind: OnboardingMilestoneKind;
  label: string;
  status: OnboardingMilestoneStatus;
  description: string;
  completesCredentialing: false;
};

export type OnboardingFoundationPlan = {
  milestones: OnboardingFoundationMilestone[];
  productionOnboardingComplete: false;
  completesCredentialing: false;
  disclaimers: string[];
};

export function buildOnboardingFoundationPlan(): OnboardingFoundationPlan {
  return {
    productionOnboardingComplete: false,
    completesCredentialing: false,
    disclaimers: [
      'Onboarding summarizes readiness and next steps; it does not complete credentialing.',
      'Verifier sharing remains planned unless a source-backed review path is available.',
      'Proof pack previews inherit existing passport evidence and do not guarantee acceptance.',
    ],
    milestones: [
      {
        kind: 'first_npi_lookup',
        label: 'First NPI lookup',
        status: 'foundation_available',
        description: 'Begins the source-backed readiness path.',
        completesCredentialing: false,
      },
      {
        kind: 'profile_foundation',
        label: 'Profile foundation',
        status: 'foundation_available',
        description: 'Captures clinician-entered profile context without treating it as verified.',
        completesCredentialing: false,
      },
      {
        kind: 'import_foundation',
        label: 'Import foundation',
        status: 'foundation_available',
        description: 'Summarizes planned and candidate-only import sources.',
        completesCredentialing: false,
      },
      {
        kind: 'readiness_summary',
        label: 'Readiness summary',
        status: 'foundation_available',
        description: 'Explains gaps and available source evidence without overriding source truth.',
        completesCredentialing: false,
      },
      {
        kind: 'proof_pack_preview',
        label: 'Proof pack preview',
        status: 'preview_only',
        description: 'Frames export readiness as preview until evidence and verifier acceptance exist.',
        completesCredentialing: false,
      },
      {
        kind: 'verifier_share_planned',
        label: 'Verifier share',
        status: 'planned',
        description: 'Represents a future guided share path, not verifier approval or an acceptance decision.',
        completesCredentialing: false,
      },
    ],
  };
}

export function explainOnboardingMilestoneStatus(status: OnboardingMilestoneStatus): string {
  switch (status) {
    case 'foundation_available':
      return 'Milestone is represented as an onboarding foundation and does not complete credentialing.';
    case 'preview_only':
      return 'Preview state only; evidence must remain source-backed before verifier use.';
    case 'planned':
      return 'Planned onboarding control, not production-complete in this build.';
  }
}
