// Maps ReadinessNextAction recommendations to BlockerNode objects with
// domain knowledge: estimated days, owner, dependency rules, resolution path.

import type { ReadinessNextAction } from '../entity/readinessActions';
import type { BlockerNode, BlockerSeverity, BlockerOwner } from './orchestrationEngine';

interface BlockerProfile {
  estimatedDays: number;
  severity: BlockerSeverity;
  owner: BlockerOwner;
  dependencies: string[];
  resolutionPath: string;
}

// Domain knowledge — source of truth for orchestration planning.
// estimatedDays is the pessimistic (P90) estimate for resolution.
const BLOCKER_PROFILES: Record<string, BlockerProfile> = {
  'verify-identity': {
    estimatedDays: 0,
    severity: 'high',
    owner: 'system',
    dependencies: [],
    resolutionPath: 'System runs NPPES lookup automatically. No clinician action required.',
  },
  'refresh-licensure': {
    estimatedDays: 21,
    severity: 'high',
    owner: 'clinician',
    dependencies: [],
    resolutionPath: 'Clinician contacts state licensing board and uploads current license artifact. Typical state board processing: 2–4 weeks.',
  },
  'run-exclusion-check': {
    estimatedDays: 3,
    severity: 'high',
    owner: 'system',
    dependencies: ['verify-identity'],
    resolutionPath: 'System queries OIG LEIE/SAM after identity is confirmed. Automated — typically resolves within 1–3 business days.',
  },
  'submit-pecos-enrollment': {
    estimatedDays: 60,
    severity: 'critical',
    owner: 'clinician',
    dependencies: ['verify-identity'],
    resolutionPath: 'Clinician applies at pecos.cms.hhs.gov. CMS processing typically takes 45–60 days. Monitor the PECOS portal for status updates.',
  },
  'repair-proof-chain': {
    estimatedDays: 7,
    severity: 'high',
    owner: 'clinician',
    dependencies: [],
    resolutionPath: 'Replace any credential that no longer has a valid artifact and receipt trail. Upload a fresh source document from the issuing authority.',
  },
  'renew-expired-credentials': {
    estimatedDays: 30,
    severity: 'high',
    owner: 'clinician',
    dependencies: [],
    resolutionPath: 'Renew with the issuing authority (state board, DEA, etc.) and provide the updated credential document for re-verification.',
  },
  'resolve-review-queue': {
    estimatedDays: 10,
    severity: 'medium',
    owner: 'employer',
    dependencies: [],
    resolutionPath: 'Credentialing staff manually adjudicates queued items. Assign reviewer and resolve within standard SLA (5–10 business days).',
  },
  'resolve-leie-review': {
    estimatedDays: 10,
    severity: 'critical',
    owner: 'employer',
    dependencies: ['run-exclusion-check'],
    resolutionPath: 'Legal/compliance team reviews possible LEIE match and determines whether the exclusion applies to this clinician before start.',
  },
  'verify-medicare-enrollment': {
    estimatedDays: 14,
    severity: 'medium',
    owner: 'employer',
    dependencies: [],
    resolutionPath: 'Run or refresh quarterly PECOS check. If source remains inconclusive, verify directly via CMS PECOS portal.',
  },
  'refresh-stale-data': {
    estimatedDays: 1,
    severity: 'low',
    owner: 'system',
    dependencies: [],
    resolutionPath: 'System re-queries source APIs. Typically resolves within 24 hours of next scheduled refresh cycle.',
  },
  'resolve-board-order': {
    estimatedDays: 60,
    severity: 'critical',
    owner: 'clinician',
    dependencies: [],
    resolutionPath: 'Clinician contacts issuing state medical board and provides written explanation. Legal counsel recommended. Resolution timeline highly variable (30–90 days).',
  },
  'renew-license': {
    estimatedDays: 30,
    severity: 'high',
    owner: 'clinician',
    dependencies: [],
    resolutionPath: 'Contact the issuing state licensing board to initiate renewal. Upload renewed license once issued (2–6 weeks depending on state).',
  },
  'authority-source-pending': {
    estimatedDays: 3,
    severity: 'medium',
    owner: 'employer',
    dependencies: [],
    resolutionPath: 'Admin enables FSMB or Nursys integration in VitalCV settings. Once connected, authority verification runs automatically.',
  },
  'verify-state-board-direct': {
    estimatedDays: 14,
    severity: 'medium',
    owner: 'employer',
    dependencies: [],
    resolutionPath: 'Contact the state licensing board directly or request a board-issued verification letter from the clinician. Allow 1–3 weeks for response.',
  },
  'share-ready-passport': {
    estimatedDays: 0,
    severity: 'low',
    owner: 'clinician',
    dependencies: [],
    resolutionPath: 'All blocking items are clear. Share the VitalCV passport link with the prospective employer.',
  },
};

const DEFAULT_PROFILE: BlockerProfile = {
  estimatedDays: 14,
  severity: 'medium',
  owner: 'clinician',
  dependencies: [],
  resolutionPath: 'Contact the relevant authority to resolve this item and provide updated documentation.',
};

export function enrichBlockers(actions: ReadinessNextAction[]): BlockerNode[] {
  const actionIds = new Set(actions.map((a) => a.id));

  return actions.map((action) => {
    const profile = BLOCKER_PROFILES[action.id] ?? DEFAULT_PROFILE;

    // Only include dependencies that are actually present in this case's blocker set
    const resolvedDependencies = profile.dependencies.filter((depId) => actionIds.has(depId));

    return {
      id: action.id,
      label: action.title,
      estimatedDays: profile.estimatedDays,
      severity: actionPriorityToSeverity(action.priority, profile.severity),
      owner: profile.owner,
      dependencies: resolvedDependencies,
      resolutionPath: profile.resolutionPath,
    };
  });
}

function actionPriorityToSeverity(
  priority: ReadinessNextAction['priority'],
  fallback: BlockerSeverity,
): BlockerSeverity {
  switch (priority) {
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return fallback;
  }
}
