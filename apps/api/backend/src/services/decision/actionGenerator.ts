/**
 * actionGenerator.ts — Wave 83: Recommended Action Generator
 *
 * Generates actionable recommendations based on credential state,
 * risk factors, and decision capsule analysis.
 */

import type { RiskFactor } from './riskAnalysis';

// ── Types ─────────────────────────────────────────────────────────────

export type ActionPriority = 'IMMEDIATE' | 'SOON' | 'ROUTINE';
export type ActionTarget = 'CLINICIAN' | 'VERIFIER' | 'EMPLOYER' | 'SYSTEM';

export interface RecommendedAction {
  id: string;
  priority: ActionPriority;
  target: ActionTarget;
  action: string;
  reason: string;
}

// ── Artifact / Capsule shapes ─────────────────────────────────────────

interface ArtifactInput {
  id: string;
  source: string;
  status: string;
  trustState: string;
}

interface CapsuleInput {
  id: string;
  status: string;
  decisionType: string;
  credentialIds: string[];
}

// ── Action Generator ──────────────────────────────────────────────────

export function generateActions(
  artifacts: ArtifactInput[],
  risks: RiskFactor[],
  capsules: CapsuleInput[],
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // Actions from risk factors
  for (const risk of risks) {
    switch (risk.type) {
      case 'EXPIRING_CREDENTIAL':
        if (risk.daysRemaining !== undefined && risk.daysRemaining <= 30) {
          actions.push({
            id: `action-renew-${risk.credentialId}`,
            priority: 'IMMEDIATE',
            target: 'CLINICIAN',
            action: `Request renewal for ${risk.title.split('"')[1] ?? 'credential'}`,
            reason: `Expires in ${risk.daysRemaining} days`,
          });
        } else {
          actions.push({
            id: `action-plan-renew-${risk.credentialId}`,
            priority: 'SOON',
            target: 'CLINICIAN',
            action: `Plan renewal for ${risk.title.split('"')[1] ?? 'credential'}`,
            reason: `Expires in ${risk.daysRemaining} days`,
          });
        }
        break;

      case 'REVOKED_DEPENDENCY':
        actions.push({
          id: `action-review-${risk.credentialId}`,
          priority: 'IMMEDIATE',
          target: 'VERIFIER',
          action: 'Flag for compliance review',
          reason: risk.description,
        });
        break;

      case 'ISSUER_DEGRADATION':
        actions.push({
          id: `action-issuer-${risk.id}`,
          priority: 'SOON',
          target: 'VERIFIER',
          action: 'Review issuer trust relationship',
          reason: risk.description,
        });
        break;

      case 'INCOMPLETE_CHAIN':
        actions.push({
          id: `action-chain-${risk.id}`,
          priority: 'ROUTINE',
          target: 'CLINICIAN',
          action: risk.title.includes('DEA') ? 'Request DEA registration' : 'Request board verification',
          reason: risk.description,
        });
        break;

      case 'EXPIRED_CREDENTIAL':
        actions.push({
          id: `action-expired-${risk.credentialId}`,
          priority: 'IMMEDIATE',
          target: 'CLINICIAN',
          action: `Wait for ${risk.title.split('"')[1] ?? 'credential'} renewal`,
          reason: risk.description,
        });
        break;
    }
  }

  // Actions from capsule state
  const validCapsules = capsules.filter((c) => c.status === 'VALID');
  const atRiskCapsules = capsules.filter((c) => c.status === 'AT_RISK');

  if (validCapsules.length > 0 && risks.length === 0) {
    actions.push({
      id: 'action-approve',
      priority: 'ROUTINE',
      target: 'VERIFIER',
      action: 'Safe to approve candidate',
      reason: `${validCapsules.length} valid decision capsule(s), no active risk factors`,
    });
  }

  if (atRiskCapsules.length > 0) {
    actions.push({
      id: 'action-at-risk-review',
      priority: 'IMMEDIATE',
      target: 'VERIFIER',
      action: 'Flag for compliance review',
      reason: `${atRiskCapsules.length} decision capsule(s) are at risk due to credential changes`,
    });
  }

  // Sort by priority
  const order: Record<ActionPriority, number> = { IMMEDIATE: 0, SOON: 1, ROUTINE: 2 };
  return actions.sort((a, b) => order[a.priority] - order[b.priority]);
}
