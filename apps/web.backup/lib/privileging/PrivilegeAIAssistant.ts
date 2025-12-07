/**
 * Facility Privileging Engine - AI Assistant
 * Phase 5: AI assistant: "How to earn this privilege"
 */

import type { Privilege, ClinicianProfile, PrivilegeEligibilityResult } from './models';
import { PrivilegeEvaluationService } from './PrivilegeEvaluationService';
import { SkillPrivilegeUnlockService } from './SkillPrivilegeUnlockService';
import { RiskScoreAdjustmentService } from './RiskScoreAdjustmentService';

export interface PrivilegePathwayGuidance {
  privilege: Privilege;
  currentStatus: 'not_started' | 'in_progress' | 'near_complete' | 'ready';
  progress: number; // 0-100
  steps: Array<{
    step: number;
    title: string;
    description: string;
    status: 'completed' | 'in_progress' | 'pending';
    estimatedTime?: string;
    resources?: Array<{ title: string; url?: string }>;
  }>;
  estimatedTotalTime: string;
  quickWins: string[];
  blockers: string[];
}

export class PrivilegeAIAssistant {
  private evaluationService: PrivilegeEvaluationService;
  private skillUnlockService: SkillPrivilegeUnlockService;
  private riskAdjustmentService: RiskScoreAdjustmentService;

  constructor() {
    this.evaluationService = new PrivilegeEvaluationService();
    this.skillUnlockService = new SkillPrivilegeUnlockService();
    this.riskAdjustmentService = new RiskScoreAdjustmentService();
  }

  /**
   * Generate "How to earn this privilege" guidance
   * Phase 5: AI assistant: "How to earn this privilege"
   */
  generatePrivilegePathway(
    privilege: Privilege,
    profile: ClinicianProfile
  ): PrivilegePathwayGuidance {
    // Evaluate current eligibility
    const eligibility = this.evaluationService.evaluateEligibility(privilege, profile);

    // Determine current status
    let currentStatus: 'not_started' | 'in_progress' | 'near_complete' | 'ready';
    if (eligibility.status === 'Eligible') {
      currentStatus = 'ready';
    } else if (eligibility.confidenceScore >= 70) {
      currentStatus = 'near_complete';
    } else if (eligibility.confidenceScore >= 30) {
      currentStatus = 'in_progress';
    } else {
      currentStatus = 'not_started';
    }

    // Build step-by-step pathway
    const steps = this.buildPathwaySteps(privilege, profile, eligibility);

    // Calculate progress
    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

    // Estimate total time
    const estimatedTotalTime = this.estimateTotalTime(steps);

    // Identify quick wins
    const quickWins = this.identifyQuickWins(privilege, profile, eligibility);

    return {
      privilege,
      currentStatus,
      progress,
      steps,
      estimatedTotalTime,
      quickWins,
      blockers: eligibility.blockers,
    };
  }

  /**
   * Build step-by-step pathway
   */
  private buildPathwaySteps(
    privilege: Privilege,
    profile: ClinicianProfile,
    eligibility: PrivilegeEligibilityResult
  ): Array<{
    step: number;
    title: string;
    description: string;
    status: 'completed' | 'in_progress' | 'pending';
    estimatedTime?: string;
    resources?: Array<{ title: string; url?: string }>;
  }> {
    const steps: Array<{
      step: number;
      title: string;
      description: string;
      status: 'completed' | 'in_progress' | 'pending';
      estimatedTime?: string;
      resources?: Array<{ title: string; url?: string }>;
    }> = [];

    let stepNumber = 1;

    // Step 1: Verify credentials
    const missingCredentials = privilege.requiredCredentials.filter(
      (cred) => !profile.credentials.some((c) => c.type === cred && c.verified)
    );
    if (missingCredentials.length > 0) {
      steps.push({
        step: stepNumber++,
        title: 'Obtain Required Credentials',
        description: `Verify or obtain: ${missingCredentials.join(', ')}`,
        status: eligibility.requirements.some((r) => r.type === 'credential' && !r.verified)
          ? 'pending'
          : 'completed',
        estimatedTime: '2-4 weeks',
        resources: [
          { title: 'Credential Verification Guide', url: '/docs/credentials' },
          { title: 'State Board Requirements', url: '/docs/state-boards' },
        ],
      });
    }

    // Step 2: Verify skills
    const missingSkills = privilege.requiredSkills.filter(
      (skill) => !profile.skills.some((s) => s.name === skill && s.verified)
    );
    if (missingSkills.length > 0) {
      steps.push({
        step: stepNumber++,
        title: 'Complete Skill Verification',
        description: `Obtain verification for: ${missingSkills.join(', ')}`,
        status: eligibility.requirements.some((r) => r.type === 'skill' && !r.verified)
          ? 'in_progress'
          : 'completed',
        estimatedTime: '4-8 weeks',
        resources: [
          { title: 'Skill Verification Process', url: '/docs/skills' },
          { title: 'Training Programs', url: '/docs/training' },
        ],
      });
    }

    // Step 3: Obtain attestations
    const missingAttestations = privilege.requiredAttestations.filter(
      (att) => !profile.attestations.some((a) => a.type === att)
    );
    if (missingAttestations.length > 0) {
      steps.push({
        step: stepNumber++,
        title: 'Request Supervisor Attestations',
        description: `Request attestations for: ${missingAttestations.join(', ')}`,
        status: eligibility.requirements.some((r) => r.type === 'attestation' && !r.verified)
          ? 'pending'
          : 'completed',
        estimatedTime: '1-2 weeks',
        resources: [
          { title: 'Attestation Request Form', url: '/forms/attestation' },
          { title: 'Supervisor Contact List', url: '/contacts/supervisors' },
        ],
      });
    }

    // Step 4: DEA/MATE registration
    if (privilege.deaRequired || privilege.mateRequired) {
      const hasDEA = privilege.deaRequired && profile.deaRegistration;
      const hasMATE = privilege.mateRequired && profile.mateRegistration;

      if (!hasDEA || !hasMATE) {
        steps.push({
          step: stepNumber++,
          title: 'Obtain DEA/MATE Registration',
          description: `${!hasDEA ? 'DEA registration required. ' : ''}${!hasMATE ? 'MATE registration required.' : ''}`,
          status: eligibility.requirements.some((r) => (r.type === 'dea' || r.type === 'mate') && !r.verified)
            ? 'pending'
            : 'completed',
          estimatedTime: '2-6 weeks',
          resources: [
            { title: 'DEA Registration Guide', url: '/docs/dea' },
            { title: 'MATE Registration Guide', url: '/docs/mate' },
          ],
        });
      }
    }

    // Step 5: Complete training (for high-risk privileges)
    if (privilege.riskLevel === 'high' || privilege.riskLevel === 'critical') {
      steps.push({
        step: stepNumber++,
        title: 'Complete Advanced Training',
        description: 'Complete specialized training for high-risk privilege',
        status: eligibility.confidenceScore >= 80 ? 'completed' : 'pending',
        estimatedTime: '8-12 weeks',
        resources: [
          { title: 'Advanced Training Programs', url: '/training/advanced' },
          { title: 'Safety Protocols', url: '/docs/safety' },
        ],
      });
    }

    // Step 6: Submit request
    steps.push({
      step: stepNumber++,
      title: 'Submit Privilege Request',
      description: 'Submit complete request with all evidence',
      status: eligibility.status === 'Eligible' ? 'completed' : 'pending',
      estimatedTime: '1 week',
      resources: [
        { title: 'Request Submission Guide', url: '/docs/privilege-request' },
        { title: 'Evidence Checklist', url: '/checklists/privilege' },
      ],
    });

    return steps;
  }

  /**
   * Estimate total time to complete pathway
   */
  private estimateTotalTime(
    steps: Array<{ estimatedTime?: string }>
  ): string {
    const timeEstimates = steps
      .map((s) => s.estimatedTime)
      .filter(Boolean)
      .map((time) => {
        // Parse "X-Y weeks" format
        const match = time?.match(/(\d+)-(\d+)\s*weeks?/);
        if (match) {
          return (parseInt(match[1]) + parseInt(match[2])) / 2;
        }
        return 0;
      });

    const avgWeeks = timeEstimates.length > 0
      ? Math.round(timeEstimates.reduce((sum, weeks) => sum + weeks, 0) / timeEstimates.length)
      : 0;

    if (avgWeeks < 4) {
      return `${avgWeeks} weeks`;
    } else if (avgWeeks < 12) {
      return `${Math.round(avgWeeks / 4)}-${Math.round(avgWeeks / 4) + 1} months`;
    } else {
      return `${Math.round(avgWeeks / 12)}-${Math.round(avgWeeks / 12) + 1} years`;
    }
  }

  /**
   * Identify quick wins
   */
  private identifyQuickWins(
    privilege: Privilege,
    profile: ClinicianProfile,
    eligibility: PrivilegeEligibilityResult
  ): string[] {
    const quickWins: string[] = [];

    // Check for skills that can be quickly verified
    const skillRecommendations = this.skillUnlockService.getSkillRecommendationsForPrivilege(
      privilege,
      profile
    );
    const inProgressSkills = skillRecommendations.filter((r) => r.status === 'in_progress');
    if (inProgressSkills.length > 0) {
      quickWins.push(
        `Complete verification for ${inProgressSkills.length} skill(s) already in progress`
      );
    }

    // Check for expiring credentials that need renewal
    const expiringCredentials = profile.credentials.filter((c) => {
      if (!c.expiresAt) return false;
      const daysUntilExpiry =
        (new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry < 60;
    });
    if (expiringCredentials.length > 0) {
      quickWins.push(
        `Renew ${expiringCredentials.length} expiring credential(s) to maintain eligibility`
      );
    }

    // Check for missing attestations that are easy to obtain
    const missingAttestations = privilege.requiredAttestations.filter(
      (att) => !profile.attestations.some((a) => a.type === att)
    );
    if (missingAttestations.length > 0) {
      quickWins.push(
        `Request ${missingAttestations.length} supervisor attestation(s) - typically approved within 1-2 weeks`
      );
    }

    return quickWins;
  }

  /**
   * Get personalized recommendations
   */
  getPersonalizedRecommendations(
    privilege: Privilege,
    profile: ClinicianProfile
  ): string[] {
    const pathway = this.generatePrivilegePathway(privilege, profile);
    const recommendations: string[] = [];

    // Add quick wins
    recommendations.push(...pathway.quickWins);

    // Add next steps
    const nextStep = pathway.steps.find((s) => s.status === 'pending' || s.status === 'in_progress');
    if (nextStep) {
      recommendations.push(`Next: ${nextStep.title} - ${nextStep.description}`);
    }

    // Add risk mitigation if needed
    if (privilege.riskLevel === 'high' || privilege.riskLevel === 'critical') {
      const riskRecommendations = this.riskAdjustmentService.getRiskMitigationRecommendations(
        privilege,
        profile
      );
      recommendations.push(...riskRecommendations);
    }

    return recommendations;
  }
}
