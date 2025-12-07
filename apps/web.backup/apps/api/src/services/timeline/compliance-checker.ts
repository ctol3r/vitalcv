import type { NormalizedTimelineEvent } from './normalization';
import type { InferredMilestone } from './milestone-inference';

export interface ComplianceIssue {
  type: 'missing_step' | 'sequence_error' | 'gap_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  requiredStep?: string;
  detectedAt: string;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  issues: ComplianceIssue[];
  score: number; // 0-100
}

/**
 * Check timeline for NCQA-required sequence steps
 */
export function checkNCQACompliance(
  events: NormalizedTimelineEvent[],
  milestones: InferredMilestone[],
): ComplianceCheckResult {
  const issues: ComplianceIssue[] = [];

  // NCQA requires: medical school → residency → board certification → privileges
  const requiredSequence = ['medical_school', 'residency', 'board_cert', 'privilege_grant'];

  // Check for required steps
  const eventTypes = new Set(events.map((e) => e.normalizedType));
  const milestoneTypes = new Set(milestones.map((m) => m.type));

  // Check medical school (should be earliest milestone or event)
  if (!milestoneTypes.has('residency') && !eventTypes.has('education')) {
    issues.push({
      type: 'missing_step',
      severity: 'high',
      description: 'Medical school completion not found',
      requiredStep: 'medical_school',
      detectedAt: new Date().toISOString(),
    });
  }

  // Check residency
  if (!milestoneTypes.has('residency') && !eventTypes.has('training')) {
    issues.push({
      type: 'missing_step',
      severity: 'critical',
      description: 'Residency training not found or documented',
      requiredStep: 'residency',
      detectedAt: new Date().toISOString(),
    });
  }

  // Check board certification
  if (!eventTypes.has('certification')) {
    issues.push({
      type: 'missing_step',
      severity: 'high',
      description: 'Board certification not found',
      requiredStep: 'board_cert',
      detectedAt: new Date().toISOString(),
    });
  }

  // Check for sequence errors (residency before medical school, etc.)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.normalizedDates.start).getTime() - new Date(b.normalizedDates.start).getTime(),
  );

  // Check if privileges appear before board certification
  const firstPrivilege = sortedEvents.find((e) => e.normalizedType === 'privilege_grant');
  const firstCert = sortedEvents.find((e) => e.normalizedType === 'certification');

  if (firstPrivilege && firstCert) {
    const privilegeDate = new Date(firstPrivilege.normalizedDates.start);
    const certDate = new Date(firstCert.normalizedDates.start);

    if (privilegeDate < certDate) {
      issues.push({
        type: 'sequence_error',
        severity: 'medium',
        description: 'Privileges granted before board certification',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Calculate compliance score
  const maxIssues = 4; // Maximum possible issues
  const score = Math.max(0, 100 - (issues.length / maxIssues) * 100);

  return {
    compliant: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0,
    issues,
    score: Math.round(score),
  };
}

