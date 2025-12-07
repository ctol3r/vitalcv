/**
 * Mobility UI utilities and types
 *
 * Phase 3: Visualize practice rights across the country
 */

import type { CompactRuleInput, CompactRuleOutput } from './CompactEngine';
import { CompactEngine } from './CompactEngine';
import { getWhereYouCanPracticeToday, type PracticeMapData } from './eligibility-algorithms';

/**
 * Color codes for map visualization
 */
export const COMPACT_STATUS_COLORS = {
  eligible: '#10b981', // green-500
  conditional: '#f59e0b', // amber-500
  ineligible: '#ef4444', // red-500
} as const;

/**
 * Get color for practice status
 */
export function getStatusColor(status: 'eligible' | 'conditional' | 'ineligible'): string {
  return COMPACT_STATUS_COLORS[status];
}

/**
 * State detail information
 */
export interface StateDetail {
  state: string;
  status: 'eligible' | 'conditional' | 'ineligible';
  rules: string[];
  timeline: string[];
  exclusions: string[];
  compactTypes: string[];
  estimatedTime?: number;
}

/**
 * Generate state detail from evaluation
 */
export function generateStateDetail(
  state: string,
  evaluation: CompactRuleOutput
): StateDetail {
  return {
    state,
    status: evaluation.status,
    rules: evaluation.notes,
    timeline: evaluation.requiredSteps.map((step, idx) =>
      `Step ${idx + 1}: ${step}`
    ),
    exclusions: evaluation.blockers,
    compactTypes: [],
    estimatedTime: evaluation.estimatedTime,
  };
}

/**
 * Compact badge configuration
 */
export interface CompactBadgeConfig {
  compactType: string;
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive';
  icon?: string;
}

export const COMPACT_BADGE_CONFIGS: Record<string, CompactBadgeConfig> = {
  IMLC: {
    compactType: 'IMLC',
    label: 'IMLC-Member',
    variant: 'success',
    icon: '🏥',
  },
  NLC: {
    compactType: 'NLC',
    label: 'NLC-Member',
    variant: 'success',
    icon: '👩‍⚕️',
  },
  PSYPACT: {
    compactType: 'PSYPACT',
    label: 'PSYPACT-Member',
    variant: 'success',
    icon: '🧠',
  },
  APRN: {
    compactType: 'APRN',
    label: 'APRN-Member',
    variant: 'success',
    icon: '💊',
  },
  PT: {
    compactType: 'PT',
    label: 'PT-Member',
    variant: 'default',
    icon: '🏃',
  },
  OT: {
    compactType: 'OT',
    label: 'OT-Member',
    variant: 'default',
    icon: '🤲',
  },
};

/**
 * Credential to compact coverage crosswalk
 */
export interface CredentialCrosswalk {
  credentialType: string;
  compactTypes: string[];
  coverage: number; // number of states
  status: 'active' | 'expired' | 'pending';
}

/**
 * Generate crosswalk from credentials
 */
export function generateCredentialCrosswalk(
  input: CompactRuleInput
): CredentialCrosswalk[] {
  const crosswalks: CredentialCrosswalk[] = [];
  const mapData = getWhereYouCanPracticeToday(input);

  // Group by credential type
  const byType = new Map<string, PracticeMapData[]>();

  mapData.forEach(data => {
    data.compactTypes.forEach(compact => {
      if (!byType.has(compact)) {
        byType.set(compact, []);
      }
      byType.get(compact)!.push(data);
    });
  });

  byType.forEach((states, compactType) => {
    const eligibleStates = states.filter(s => s.status === 'eligible');

    crosswalks.push({
      credentialType: input.licenseType,
      compactTypes: [compactType],
      coverage: eligibleStates.length,
      status: 'active',
    });
  });

  return crosswalks;
}

/**
 * License portability suggestion
 */
export interface PortabilitySuggestion {
  targetState: string;
  compactType: string;
  benefit: string;
  estimatedTime: number;
  requirements: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate portability suggestions
 */
export function generatePortabilitySuggestions(
  input: CompactRuleInput,
  currentStates: string[]
): PortabilitySuggestion[] {
  const suggestions: PortabilitySuggestion[] = [];
  const mapData = getWhereYouCanPracticeToday(input);

  // Find states with high coverage that aren't already covered
  const highCoverageStates = mapData
    .filter(data =>
      !currentStates.includes(data.state) &&
      data.status === 'eligible' &&
      data.compactTypes.length >= 2
    )
    .sort((a, b) => b.compactTypes.length - a.compactTypes.length)
    .slice(0, 5);

  highCoverageStates.forEach(data => {
    suggestions.push({
      targetState: data.state,
      compactType: data.compactTypes[0] || '',
      benefit: `Access to ${data.compactTypes.length} compacts`,
      estimatedTime: 30,
      requirements: [],
      priority: data.compactTypes.length >= 3 ? 'high' : 'medium',
    });
  });

  return suggestions;
}

/**
 * Compact expiry reminder
 */
export interface CompactExpiryReminder {
  compactType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  renewalSteps: string[];
  urgent: boolean;
}

/**
 * Generate expiry reminders
 */
export function generateExpiryReminders(
  profile?: { compacts?: Record<string, { expiresAt?: string | Date }> }
): CompactExpiryReminder[] {
  const reminders: CompactExpiryReminder[] = [];

  if (!profile?.compacts) {
    return reminders;
  }

  Object.entries(profile.compacts).forEach(([compactType, info]) => {
    if (info.expiresAt) {
      const expiryDate = new Date(info.expiresAt);
      const now = new Date();
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry <= 90) {
        reminders.push({
          compactType,
          expiryDate: expiryDate.toISOString().split('T')[0],
          daysUntilExpiry,
          renewalSteps: [
            'Complete renewal application',
            'Submit required documentation',
            'Pay renewal fee',
          ],
          urgent: daysUntilExpiry <= 30,
        });
      }
    }
  });

  return reminders.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

