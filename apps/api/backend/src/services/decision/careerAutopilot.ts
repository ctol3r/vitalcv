// ── VitalCV Career Autopilot ──────────────────────────────────────
// Clinician-facing equivalent of the Employer Next Best Action.
// Analyzes the current ProofManifest and market context to generate
// actionable next steps for the clinician to improve their readiness.

import { ReadinessPosture } from '../../../../packages/trust-contract/src/index';

// ── Market Context ───────────────────────────────────────────────

export interface DemandSignal {
  roleType: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  activeOpenings: number;
}

export interface MarketContext {
  demandSignals: DemandSignal[];
}

export interface RoleReadiness {
  roleType: string;
  isReady: boolean;
  missingLanes: string[];
}

// ── Autopilot Output ─────────────────────────────────────────────

export interface AutopilotSuggestion {
  id: string;
  type: 'IMPROVE_READINESS' | 'FIX_BLOCKER' | 'TARGET_ROLE';
  title: string;
  description: string;
  actionText: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
}

export interface CareerAutopilotPlan {
  currentPosture: ReadinessPosture;
  marketReadiness: RoleReadiness[];
  suggestions: AutopilotSuggestion[];
  generatedAt: string;
}

// ── Autopilot Engine ─────────────────────────────────────────────

export function generateCareerAutopilot(
  posture: ReadinessPosture,
  limitations: string[],
  market: MarketContext
): CareerAutopilotPlan {
  const suggestions: AutopilotSuggestion[] = [];

  // 1. FIX BLOCKERS (Highest Priority)
  if (posture === ReadinessPosture.BLOCKED) {
    suggestions.push({
      id: 'fix_blocker_oig',
      type: 'FIX_BLOCKER',
      title: 'Resolve Adverse Action Flag',
      description: 'Your profile has been flagged for an adverse action (e.g., OIG exclusion or Board revocation). You cannot be deployed until this is cleared.',
      actionText: 'Review Details',
      priority: 'CRITICAL',
    });
  }

  // 2. IMPROVE READINESS
  if (posture === ReadinessPosture.INSUFFICIENT_DATA || posture === ReadinessPosture.PARTIAL || posture === ReadinessPosture.CHECKING) {
    if (limitations.some(l => l.toLowerCase().includes('identity') || l.toLowerCase().includes('nppes'))) {
      suggestions.push({
        id: 'improve_identity',
        type: 'IMPROVE_READINESS',
        title: 'Update NPPES Registry',
        description: 'Your NPI registry data is missing or incomplete. Update your taxonomy and license info on the NPPES website to reach Decision Grade.',
        actionText: 'Update NPPES',
        priority: 'HIGH',
      });
    }
    
    if (limitations.some(l => l.toLowerCase().includes('license') || l.toLowerCase().includes('board'))) {
      suggestions.push({
        id: 'improve_license',
        type: 'IMPROVE_READINESS',
        title: 'Sync State License',
        description: 'Your state medical license has not been verified. Connect your primary state board to complete your readiness profile.',
        actionText: 'Sync License',
        priority: 'HIGH',
      });
    }

    if (suggestions.length === 0 && posture === ReadinessPosture.PARTIAL) {
      suggestions.push({
        id: 'improve_general',
        type: 'IMPROVE_READINESS',
        title: 'Complete Readiness Profile',
        description: 'You are missing required credentials. Check your missing coverage lanes to reach Decision Grade.',
        actionText: 'View Missing Items',
        priority: 'HIGH',
      });
    }
  }

  // 3. TARGET ROLES (If ready or close to ready)
  const roleReadiness: RoleReadiness[] = [];
  
  if (posture === ReadinessPosture.DECISION_GRADE) {
    // Clinician is ready, suggest high demand roles
    const highDemand = market.demandSignals.filter(d => d.urgency === 'HIGH');
    for (const role of highDemand) {
      roleReadiness.push({ roleType: role.roleType, isReady: true, missingLanes: [] });
      suggestions.push({
        id: `target_role_${role.roleType.toLowerCase().replace(/\\s+/g, '_')}`,
        type: 'TARGET_ROLE',
        title: `High Demand: ${role.roleType}`,
        description: `There are ${role.activeOpenings} urgent openings for ${role.roleType}s. Your profile is 100% verified and ready for 1-click apply.`,
        actionText: 'View Openings',
        priority: 'NORMAL',
      });
    }
  } else if (posture === ReadinessPosture.PARTIAL) {
    // Show what they are missing for high demand roles
    const highDemand = market.demandSignals.filter(d => d.urgency === 'HIGH');
    for (const role of highDemand) {
      roleReadiness.push({ roleType: role.roleType, isReady: false, missingLanes: ['State License', 'Background Check'] });
      suggestions.push({
        id: `target_role_gap_${role.roleType.toLowerCase().replace(/\\s+/g, '_')}`,
        type: 'TARGET_ROLE',
        title: `2 Steps Away: ${role.roleType}`,
        description: `You are 2 steps away from qualifying for ${role.activeOpenings} urgent ${role.roleType} openings.`,
        actionText: 'Complete Profile to Apply',
        priority: 'NORMAL',
      });
    }
  }

  return {
    currentPosture: posture,
    marketReadiness: roleReadiness,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}
