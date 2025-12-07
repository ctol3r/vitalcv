/**
 * Identity Evolution Predictor
 * Task 4: Add Identity Evolution Predictor (career trajectory inference)
 *
 * Predicts career trajectory based on historical patterns, credentials,
 * and role transitions.
 */

import type { CredentialNode, RoleNode, Specialty } from './professional-graph';
import type { SkillTrajectory } from './continuum-model';

export interface CareerTrajectory {
  currentPhase: 'junior' | 'mid' | 'senior' | 'expert' | 'leadership';
  projectedPhase: 'junior' | 'mid' | 'senior' | 'expert' | 'leadership';
  timeToNextPhase: number; // months
  confidence: number; // 0-1
  pathOptions: CareerPathOption[];
}

export interface CareerPathOption {
  title: string;
  description: string;
  probability: number; // 0-1
  requiredCredentials: string[];
  timeToAchieve: number; // months
  prerequisites: string[];
}

export interface EvolutionFactors {
  credentialVelocity: number; // credentials per year
  roleTransitionRate: number; // transitions per year
  skillGrowthRate: number; // 0-1
  specializationDepth: number; // 0-1
  crossDomainMobility: number; // 0-1
}

export interface TrajectoryProjection {
  timeline: Array<{
    date: Date;
    phase: CareerTrajectory['currentPhase'];
    credentials: string[];
    roles: string[];
    skills: string[];
    confidence: number;
  }>;
  milestones: Array<{
    date: Date;
    type: 'credential' | 'role' | 'skill' | 'phase_transition';
    description: string;
    probability: number;
  }>;
}

export class IdentityEvolutionPredictor {
  private credentialHistory: Array<{ credentialId: string; date: Date; type: string }>;
  private roleHistory: Array<{ roleId: string; startDate: Date; endDate?: Date; title: string }>;
  private skillTrajectories: SkillTrajectory[];

  constructor() {
    this.credentialHistory = [];
    this.roleHistory = [];
    this.skillTrajectories = [];
  }

  /**
   * Predict career trajectory
   */
  predictTrajectory(
    currentCredentials: CredentialNode[],
    currentRoles: RoleNode[],
    specialties: Specialty[]
  ): CareerTrajectory {
    const currentPhase = this.determineCurrentPhase(currentRoles, currentCredentials);
    const evolutionFactors = this.calculateEvolutionFactors();
    const projectedPhase = this.projectNextPhase(currentPhase, evolutionFactors);

    const timeToNextPhase = this.estimateTimeToPhaseTransition(
      currentPhase,
      projectedPhase,
      evolutionFactors
    );

    const pathOptions = this.generateCareerPaths(
      currentPhase,
      currentCredentials,
      specialties
    );

    const confidence = this.calculatePredictionConfidence(
      evolutionFactors,
      this.credentialHistory.length,
      this.roleHistory.length
    );

    return {
      currentPhase,
      projectedPhase,
      timeToNextPhase,
      confidence,
      pathOptions,
    };
  }

  /**
   * Generate a detailed trajectory projection
   */
  generateProjection(
    trajectory: CareerTrajectory,
    monthsAhead: number = 24
  ): TrajectoryProjection {
    const timeline: TrajectoryProjection['timeline'] = [];
    const milestones: TrajectoryProjection['milestones'] = [];
    const now = new Date();

    let currentPhase = trajectory.currentPhase;
    let monthOffset = 0;

    while (monthOffset < monthsAhead) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + monthOffset);

      // Determine phase at this point
      const phaseTransitionTime = trajectory.timeToNextPhase;
      if (monthOffset >= phaseTransitionTime && currentPhase !== trajectory.projectedPhase) {
        milestones.push({
          date,
          type: 'phase_transition',
          description: `Transition to ${trajectory.projectedPhase}`,
          probability: trajectory.confidence,
        });
        currentPhase = trajectory.projectedPhase;
      }

      // Predict credentials
      const credentialVelocity = this.credentialHistory.length > 0
        ? (this.credentialHistory.length / Math.max(1, this.getYearsOfHistory())) * 12
        : 1;

      const projectedCredentialCount = Math.floor((monthOffset / 12) * credentialVelocity);
      const projectedCredentials = Array(projectedCredentialCount).fill(null).map(
        (_, i) => `projected_cred_${monthOffset}_${i}`
      );

      // Predict roles
      const projectedRoles = this.projectRolesAtMonth(monthOffset);

      // Predict skills
      const projectedSkills = this.projectSkillsAtMonth(monthOffset);

      timeline.push({
        date,
        phase: currentPhase,
        credentials: projectedCredentials,
        roles: projectedRoles,
        skills: projectedSkills,
        confidence: Math.max(0.3, trajectory.confidence - (monthOffset / monthsAhead) * 0.5),
      });

      monthOffset += 3; // Quarterly projections
    }

    // Add credential milestones
    const credentialIntervals = Math.floor(12 / Math.max(1, this.calculateEvolutionFactors().credentialVelocity));
    for (let i = credentialIntervals; i < monthsAhead; i += credentialIntervals) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      milestones.push({
        date,
        type: 'credential',
        description: 'Potential new credential opportunity',
        probability: 0.6,
      });
    }

    return { timeline, milestones };
  }

  /**
   * Infer career trajectory from historical data
   */
  addCredentialHistory(credentialId: string, date: Date, type: string): void {
    this.credentialHistory.push({ credentialId, date, type });
    this.credentialHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  addRoleHistory(roleId: string, startDate: Date, endDate: Date | undefined, title: string): void {
    this.roleHistory.push({ roleId, startDate, endDate, title });
    this.roleHistory.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  updateSkillTrajectories(trajectories: SkillTrajectory[]): void {
    this.skillTrajectories = trajectories;
  }

  /**
   * Determine current career phase
   */
  private determineCurrentPhase(
    roles: RoleNode[],
    credentials: CredentialNode[]
  ): CareerTrajectory['currentPhase'] {
    const yearsOfExperience = this.getYearsOfHistory();
    const roleTitles = roles.map((r) => r.title.toLowerCase());

    // Check for leadership indicators
    if (roleTitles.some((t) => t.includes('lead') || t.includes('director') || t.includes('chief'))) {
      return 'leadership';
    }

    // Check for expert indicators
    const expertKeywords = ['senior', 'principal', 'expert', 'specialist'];
    if (roleTitles.some((t) => expertKeywords.some((k) => t.includes(k)))) {
      return yearsOfExperience > 10 ? 'expert' : 'senior';
    }

    // Use experience and credential count
    if (yearsOfExperience < 2) return 'junior';
    if (yearsOfExperience < 5) return 'mid';
    if (yearsOfExperience < 10) return 'senior';
    return 'expert';
  }

  /**
   * Project next phase
   */
  private projectNextPhase(
    currentPhase: CareerTrajectory['currentPhase'],
    factors: EvolutionFactors
  ): CareerTrajectory['currentPhase'] {
    const phaseProgression: CareerTrajectory['currentPhase'][] = [
      'junior',
      'mid',
      'senior',
      'expert',
      'leadership',
    ];

    const currentIndex = phaseProgression.indexOf(currentPhase);
    if (currentIndex === phaseProgression.length - 1) {
      return currentPhase; // Already at highest phase
    }

    // Fast progression if credential velocity is high
    if (factors.credentialVelocity > 2 && factors.roleTransitionRate > 1) {
      return phaseProgression[Math.min(phaseProgression.length - 1, currentIndex + 1)];
    }

    // Check if already progressing
    if (factors.skillGrowthRate > 0.7 && factors.specializationDepth > 0.6) {
      return phaseProgression[Math.min(phaseProgression.length - 1, currentIndex + 1)];
    }

    return currentPhase;
  }

  /**
   * Calculate evolution factors
   */
  private calculateEvolutionFactors(): EvolutionFactors {
    const yearsOfHistory = this.getYearsOfHistory();
    const credentialVelocity = yearsOfHistory > 0
      ? this.credentialHistory.length / yearsOfHistory
      : 0;

    const activeRoles = this.roleHistory.filter((r) => !r.endDate || r.endDate > new Date());
    const roleTransitionRate = yearsOfHistory > 0
      ? this.roleHistory.length / yearsOfHistory
      : 0;

    const skillGrowthRate = this.skillTrajectories.length > 0
      ? this.skillTrajectories.reduce(
          (sum, t) => sum + (t.trend === 'rising' ? 1 : t.trend === 'stable' ? 0.5 : 0),
          0
        ) / this.skillTrajectories.length
      : 0.5;

    const specializationDepth = this.skillTrajectories.length > 0
      ? this.skillTrajectories.reduce((sum, t) => sum + t.confidence, 0) /
        this.skillTrajectories.length
      : 0.5;

    const crossDomainMobility = this.roleHistory.length > 1
      ? this.calculateDomainMobility()
      : 0;

    return {
      credentialVelocity,
      roleTransitionRate,
      skillGrowthRate,
      specializationDepth,
      crossDomainMobility,
    };
  }

  /**
   * Generate career path options
   */
  private generateCareerPaths(
    currentPhase: CareerTrajectory['currentPhase'],
    credentials: CredentialNode[],
    specialties: Specialty[]
  ): CareerPathOption[] {
    const paths: CareerPathOption[] = [];

    // Specialization path
    if (specialties.length > 0) {
      paths.push({
        title: 'Deep Specialization',
        description: `Become an expert in ${specialties[0].name}`,
        probability: 0.7,
        requiredCredentials: [],
        timeToAchieve: 18,
        prerequisites: [`Strong foundation in ${specialties[0].name}`],
      });
    }

    // Leadership path
    if (currentPhase !== 'junior') {
      paths.push({
        title: 'Leadership Track',
        description: 'Transition to management or leadership roles',
        probability: 0.5,
        requiredCredentials: ['leadership_training'],
        timeToAchieve: 24,
        prerequisites: ['5+ years experience', 'Proven track record'],
      });
    }

    // Cross-domain path
    paths.push({
      title: 'Cross-Domain Expansion',
      description: 'Expand into related specialties',
      probability: 0.6,
      requiredCredentials: credentials.slice(0, 2).map((c) => c.id),
      timeToAchieve: 12,
      prerequisites: ['Strong base credentials'],
    });

    return paths.sort((a, b) => b.probability - a.probability);
  }

  private estimateTimeToPhaseTransition(
    current: CareerTrajectory['currentPhase'],
    projected: CareerTrajectory['currentPhase'],
    factors: EvolutionFactors
  ): number {
    if (current === projected) return 999; // No transition

    const baseMonths = {
      junior: 24,
      mid: 36,
      senior: 48,
      expert: 60,
    }[current] || 36;

    // Accelerate if factors are strong
    const accelerationFactor = 1 + factors.credentialVelocity * 0.1 + factors.skillGrowthRate * 0.2;
    return Math.max(6, baseMonths / accelerationFactor);
  }

  private calculatePredictionConfidence(
    factors: EvolutionFactors,
    credentialCount: number,
    roleCount: number
  ): number {
    let confidence = 0.5; // Base confidence

    // More data = higher confidence
    if (credentialCount > 5) confidence += 0.2;
    if (roleCount > 2) confidence += 0.2;

    // Strong patterns = higher confidence
    if (factors.credentialVelocity > 1) confidence += 0.1;

    return Math.min(1, confidence);
  }

  private getYearsOfHistory(): number {
    if (this.credentialHistory.length === 0 && this.roleHistory.length === 0) return 1;

    const earliestCredential = this.credentialHistory[0]?.date;
    const earliestRole = this.roleHistory[0]?.startDate;

    const earliest = earliestCredential && earliestRole
      ? new Date(Math.min(earliestCredential.getTime(), earliestRole.getTime()))
      : earliestCredential || earliestRole || new Date();

    const years = (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return Math.max(0.5, years);
  }

  private calculateDomainMobility(): number {
    // Analyze how many different types of roles
    const roleTypes = new Set(this.roleHistory.map((r) => this.categorizeRole(r.title)));
    return Math.min(1, roleTypes.size / 3);
  }

  private categorizeRole(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('clinical') || lower.includes('patient')) return 'clinical';
    if (lower.includes('admin') || lower.includes('manager')) return 'administrative';
    if (lower.includes('research') || lower.includes('academic')) return 'research';
    return 'other';
  }

  private projectRolesAtMonth(monthOffset: number): string[] {
    // Simple projection based on transition rate
    if (monthOffset < 6) return ['current_role'];
    if (monthOffset < 12) return ['current_role', 'potential_role'];
    return ['current_role', 'potential_role', 'future_role'];
  }

  private projectSkillsAtMonth(monthOffset: number): string[] {
    return this.skillTrajectories
      .filter((t) => t.trend === 'rising')
      .slice(0, 3)
      .map((t) => t.skill);
  }
}

