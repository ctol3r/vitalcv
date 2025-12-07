/**
 * Career Growth Engine - Intelligence Layer
 * Phase 1: Core intelligence components
 */

import type {
  CareerStage,
  GrowthProfile,
  Credential,
  SkillMap,
  Skill,
  RoleTrajectory,
  PredictedRole,
  CMERelevance,
  RenewalPrediction,
  IdentityHealthScore,
  ExperienceGap,
  TrustScoreEvolution,
} from './models';

/**
 * Task 3: Career Stage Detector
 * Detects career stage based on years practicing and credentials
 */
export class CareerStageDetector {
  static detect(profile: GrowthProfile): CareerStage {
    const { yearsPracticing, credentials } = profile;

    // Student: No active licenses, in training
    const hasActiveLicense = credentials.some(
      (c) => c.type === 'license' && (!c.expiresAt || new Date(c.expiresAt) > new Date()),
    );
    if (!hasActiveLicense && yearsPracticing === 0) {
      return 'student';
    }

    // Resident: Has license but < 3 years, typically in residency
    if (yearsPracticing < 3 && hasActiveLicense) {
      const hasResidencyCred = credentials.some((c) =>
        c.name.toLowerCase().includes('residency'),
      );
      if (hasResidencyCred || yearsPracticing < 2) {
        return 'resident';
      }
    }

    // Early Career: 3-7 years
    if (yearsPracticing >= 3 && yearsPracticing < 7) {
      return 'early_career';
    }

    // Mid Career: 7-15 years
    if (yearsPracticing >= 7 && yearsPracticing < 15) {
      return 'mid_career';
    }

    // Senior: 15+ years
    return 'senior';
  }

  static getStageLabel(stage: CareerStage): string {
    const labels: Record<CareerStage, string> = {
      student: 'Student',
      resident: 'Resident',
      early_career: 'Early Career',
      mid_career: 'Mid Career',
      senior: 'Senior',
    };
    return labels[stage];
  }

  static getStageColor(stage: CareerStage): string {
    const colors: Record<CareerStage, string> = {
      student: 'text-blue-600',
      resident: 'text-purple-600',
      early_career: 'text-green-600',
      mid_career: 'text-amber-600',
      senior: 'text-indigo-600',
    };
    return colors[stage];
  }
}

/**
 * Task 4: Skill Map Synthesizer
 * Synthesizes skills from credentials and self-reported experience
 */
export class SkillMapSynthesizer {
  static synthesize(profile: GrowthProfile, selfReportedSkills?: Skill[]): SkillMap {
    const credentialSkills = this.extractSkillsFromCredentials(profile.credentials);
    const allSkills = this.mergeSkills(credentialSkills, selfReportedSkills || []);
    const gaps = this.identifyGaps(allSkills, profile.specialties);

    return {
      clinicianId: profile.clinicianId,
      skills: allSkills,
      gaps,
      synthesizedAt: new Date().toISOString(),
    };
  }

  private static extractSkillsFromCredentials(credentials: Credential[]): Skill[] {
    const skills: Skill[] = [];

    for (const cred of credentials) {
      // Extract skills based on credential type
      if (cred.type === 'certification') {
        skills.push({
          id: `cred-${cred.id}`,
          name: cred.name,
          category: 'clinical',
          level: 'advanced',
          source: 'credential',
          confidence: 0.9,
        });
      } else if (cred.type === 'board_cert') {
        skills.push({
          id: `board-${cred.id}`,
          name: cred.specialty || cred.name,
          category: 'clinical',
          level: 'expert',
          source: 'credential',
          confidence: 0.95,
        });
      }
    }

    return skills;
  }

  private static mergeSkills(credentialSkills: Skill[], selfReported: Skill[]): Skill[] {
    const skillMap = new Map<string, Skill>();

    // Add credential skills
    for (const skill of credentialSkills) {
      skillMap.set(skill.name.toLowerCase(), skill);
    }

    // Merge self-reported, preferring higher confidence
    for (const skill of selfReported) {
      const existing = skillMap.get(skill.name.toLowerCase());
      if (!existing || skill.confidence > existing.confidence) {
        skillMap.set(skill.name.toLowerCase(), {
          ...skill,
          source: existing ? 'inferred' : skill.source,
        });
      }
    }

    return Array.from(skillMap.values());
  }

  private static identifyGaps(skills: Skill[], specialties: string[]): SkillMap['gaps'] {
    const gaps: SkillMap['gaps'] = [];

    // Common skill requirements by specialty
    const specialtyRequirements: Record<string, string[]> = {
      'Emergency Medicine': ['ACLS', 'ATLS', 'PALS'],
      'Critical Care': ['ACLS', 'Ventilator Management'],
      'Surgery': ['ATLS', 'Surgical Skills'],
    };

    for (const specialty of specialties) {
      const required = specialtyRequirements[specialty] || [];
      for (const reqSkill of required) {
        const hasSkill = skills.some(
          (s) => s.name.toLowerCase().includes(reqSkill.toLowerCase()),
        );
        if (!hasSkill) {
          gaps.push({
            skillId: `gap-${reqSkill}`,
            skillName: reqSkill,
            currentLevel: 'none',
            recommendedLevel: 'intermediate',
            gapReason: `Required for ${specialty}`,
            priority: 'high',
          });
        }
      }
    }

    return gaps;
  }
}

/**
 * Task 5: Role Trajectory Engine
 * Predicts next logical roles based on current profile
 */
export class RoleTrajectoryEngine {
  static predict(profile: GrowthProfile, availableRoles?: PredictedRole[]): RoleTrajectory {
    const stage = CareerStageDetector.detect(profile);
    const nextRoles = this.generateNextRoles(profile, stage, availableRoles);

    return {
      currentRole: this.inferCurrentRole(profile),
      nextPossibleRoles: nextRoles,
      confidence: this.calculateConfidence(profile, nextRoles),
      timeframe: this.estimateTimeframe(stage),
      requirements: this.extractRequirements(nextRoles),
    };
  }

  private static inferCurrentRole(profile: GrowthProfile): string {
    // Infer from credentials and specialties
    if (profile.credentials.some((c) => c.type === 'board_cert')) {
      return `Board-Certified ${profile.specialties[0] || 'Physician'}`;
    }
    return profile.specialties[0] || 'Clinician';
  }

  private static generateNextRoles(
    profile: GrowthProfile,
    stage: CareerStage,
    availableRoles?: PredictedRole[],
  ): PredictedRole[] {
    const roles: PredictedRole[] = [];

    // If available roles provided, use them
    if (availableRoles && availableRoles.length > 0) {
      return availableRoles
        .map((r) => ({
          ...r,
          matchScore: this.calculateMatchScore(profile, r),
        }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);
    }

    // Otherwise generate based on stage
    const stageRoles: Record<CareerStage, string[]> = {
      student: ['Resident', 'Fellow'],
      resident: ['Attending Physician', 'Fellow'],
      early_career: ['Senior Physician', 'Medical Director'],
      mid_career: ['Department Head', 'Chief Medical Officer'],
      senior: ['Executive Medical Director', 'Chief of Staff'],
    };

    const candidates = stageRoles[stage] || [];
    for (const role of candidates) {
      roles.push({
        role,
        organization: 'Various',
        matchScore: 0.7,
        requirements: [],
        timeToQualify: '6-12 months',
        confidence: 0.6,
      });
    }

    return roles;
  }

  private static calculateMatchScore(profile: GrowthProfile, role: PredictedRole): number {
    let score = 0.5; // Base score

    // Boost based on specialties
    if (role.requirements.some((r) => profile.specialties.includes(r))) {
      score += 0.2;
    }

    // Boost based on credentials
    const relevantCreds = profile.credentials.filter((c) =>
      role.requirements.some((r) => c.name.toLowerCase().includes(r.toLowerCase())),
    );
    score += relevantCreds.length * 0.1;

    // Boost based on trust score
    score += profile.trustScore * 0.1;

    return Math.min(score, 1.0);
  }

  private static calculateConfidence(profile: GrowthProfile, roles: PredictedRole[]): number {
    if (roles.length === 0) return 0.3;
    const avgMatch = roles.reduce((sum, r) => sum + r.matchScore, 0) / roles.length;
    return Math.min(avgMatch * 0.9, 0.95);
  }

  private static estimateTimeframe(stage: CareerStage): string {
    const timeframes: Record<CareerStage, string> = {
      student: '2-4 years',
      resident: '1-2 years',
      early_career: '6-18 months',
      mid_career: '3-6 months',
      senior: '1-3 months',
    };
    return timeframes[stage];
  }

  private static extractRequirements(roles: PredictedRole[]): string[] {
    const allReqs = new Set<string>();
    for (const role of roles) {
      role.requirements.forEach((r) => allReqs.add(r));
    }
    return Array.from(allReqs);
  }
}

/**
 * Task 6: CME Relevance Calculator
 * Calculates CME relevance per specialty
 */
export class CMERelevanceCalculator {
  static calculate(
    profile: GrowthProfile,
    earnedCredits: number,
    cycleStart: string,
    cycleEnd: string,
  ): CMERelevance[] {
    const relevances: CMERelevance[] = [];

    for (const specialty of profile.specialties) {
      const required = this.getRequiredCredits(specialty);
      const relevance = this.calculateRelevanceScore(
        specialty,
        earnedCredits,
        required,
        profile.credentials,
      );

      relevances.push({
        specialty,
        requiredCredits: required,
        earnedCredits,
        cycleStart,
        cycleEnd,
        relevanceScore: relevance,
        recommendedCourses: this.recommendCourses(specialty, earnedCredits, required),
      });
    }

    return relevances;
  }

  private static getRequiredCredits(specialty: string): number {
    // Typical CME requirements by specialty
    const requirements: Record<string, number> = {
      'Emergency Medicine': 50,
      'Critical Care': 50,
      'Surgery': 50,
      'Internal Medicine': 50,
    };
    return requirements[specialty] || 50; // Default 50 credits
  }

  private static calculateRelevanceScore(
    specialty: string,
    earned: number,
    required: number,
    credentials: Credential[],
  ): number {
    const progress = earned / required;
    const hasBoardCert = credentials.some(
      (c) => c.type === 'board_cert' && c.specialty === specialty,
    );

    let score = progress;
    if (hasBoardCert) score += 0.1;
    if (progress >= 1.0) score = 1.0;

    return Math.min(score, 1.0);
  }

  private static recommendCourses(
    specialty: string,
    earned: number,
    required: number,
  ): CMERelevance['recommendedCourses'] {
    const needed = Math.max(0, required - earned);
    if (needed === 0) return [];

    return [
      {
        id: `cme-${specialty}-1`,
        title: `${specialty} Advanced Topics`,
        provider: 'CME Provider',
        credits: Math.min(needed, 25),
        relevanceScore: 0.9,
        specialty,
        format: 'online',
        cost: 299,
      },
    ];
  }
}

/**
 * Task 7: DEA/Licensure Renewal Predictor
 */
export class RenewalPredictor {
  static predict(credentials: Credential[]): RenewalPrediction[] {
    const predictions: RenewalPrediction[] = [];

    for (const cred of credentials) {
      if (!cred.expiresAt) continue;

      const expiresAt = new Date(cred.expiresAt);
      const now = new Date();
      const daysUntil = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) continue; // Already expired

      const urgency = this.calculateUrgency(daysUntil, cred.type);
      const processingDays = this.estimateProcessingDays(cred.type);

      predictions.push({
        credentialId: cred.id,
        credentialName: cred.name,
        type: cred.type === 'dea' ? 'dea' : cred.type === 'board_cert' ? 'board_cert' : 'license',
        expiresAt: cred.expiresAt,
        daysUntilExpiration: daysUntil,
        renewalWindowStart: this.calculateRenewalWindowStart(expiresAt, cred.type),
        renewalWindowEnd: cred.expiresAt,
        urgency,
        estimatedProcessingDays: processingDays,
      });
    }

    return predictions.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }

  private static calculateUrgency(
    daysUntil: number,
    type: Credential['type'],
  ): RenewalPrediction['urgency'] {
    if (daysUntil < 30) return 'critical';
    if (daysUntil < 60) return 'high';
    if (daysUntil < 90) return 'medium';
    return 'low';
  }

  private static estimateProcessingDays(type: Credential['type']): number {
    const estimates: Record<Credential['type'], number> = {
      dea: 30,
      license: 45,
      board_cert: 60,
      certification: 30,
      cme: 0,
    };
    return estimates[type] || 30;
  }

  private static calculateRenewalWindowStart(expiresAt: Date, type: Credential['type']): string {
    const windowDays = type === 'dea' ? 60 : type === 'license' ? 90 : 120;
    const start = new Date(expiresAt);
    start.setDate(start.getDate() - windowDays);
    return start.toISOString();
  }
}

/**
 * Task 8: Identity Health Score Calculator
 */
export class IdentityHealthCalculator {
  static calculate(
    profile: GrowthProfile,
    chainLastUpdate: string,
    anchorAge: number,
    trustHistory: TrustScoreEvolution[],
  ): IdentityHealthScore {
    const compliance = this.calculateCompliance(profile.credentials);
    const credentialFreshness = this.calculateCredentialFreshness(profile.credentials);
    const chainIntegrity = this.calculateChainIntegrity(chainLastUpdate);
    const trust = this.calculateTrustHealth(profile.trustScore, trustHistory);

    const overall =
      (compliance.score * 0.3 +
        credentialFreshness * 0.25 +
        chainIntegrity.score * 0.25 +
        trust.score * 0.2) /
      1.0;

    return {
      overall: Math.round(overall * 100) / 100,
      compliance: compliance.score,
      credentialFreshness,
      chainIntegrity: chainIntegrity.score,
      trustScore: trust.score,
      anchorAge,
      breakdown: {
        compliance,
        credentials: {
          score: credentialFreshness,
          expired: profile.credentials.filter((c) => {
            if (!c.expiresAt) return false;
            return new Date(c.expiresAt) < new Date();
          }).length,
          expiring: profile.credentials.filter((c) => {
            if (!c.expiresAt) return false;
            const daysUntil = Math.floor(
              (new Date(c.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
            );
            return daysUntil > 0 && daysUntil <= 90;
          }).length,
          stale: profile.credentials.filter((c) => c.chainStaleness > 90).length,
        },
        chain: chainIntegrity,
        trust,
      },
    };
  }

  private static calculateCompliance(credentials: Credential[]): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 1.0;

    const expired = credentials.filter((c) => {
      if (!c.expiresAt) return false;
      return new Date(c.expiresAt) < new Date();
    });

    if (expired.length > 0) {
      issues.push(`${expired.length} expired credential(s)`);
      score -= expired.length * 0.2;
    }

    const expiringSoon = credentials.filter((c) => {
      if (!c.expiresAt) return false;
      const daysUntil = Math.floor(
        (new Date(c.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysUntil > 0 && daysUntil <= 30;
    });

    if (expiringSoon.length > 0) {
      issues.push(`${expiringSoon.length} credential(s) expiring within 30 days`);
      score -= expiringSoon.length * 0.1;
    }

    return {
      score: Math.max(0, score),
      issues,
    };
  }

  private static calculateCredentialFreshness(credentials: Credential[]): number {
    if (credentials.length === 0) return 0.5;

    const avgAge = credentials.reduce((sum, c) => {
      const issued = new Date(c.issuedAt);
      const age = (new Date().getTime() - issued.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return sum + Math.min(age / 10, 1.0); // Normalize to 10 years
    }, 0) / credentials.length;

    return Math.max(0, 1.0 - avgAge);
  }

  private static calculateChainIntegrity(lastUpdate: string): {
    score: number;
    staleness: number;
    lastUpdate: string;
  } {
    const updateDate = new Date(lastUpdate);
    const now = new Date();
    const staleness = Math.floor(
      (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Score decreases as staleness increases
    let score = 1.0;
    if (staleness > 90) score = 0.5;
    else if (staleness > 180) score = 0.3;
    else if (staleness > 365) score = 0.1;

    return {
      score,
      staleness,
      lastUpdate,
    };
  }

  private static calculateTrustHealth(
    currentTrust: number,
    history: TrustScoreEvolution[],
  ): {
    score: number;
    trend: 'up' | 'down' | 'stable';
  } {
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (history.length >= 2) {
      const recent = history.slice(-3);
      const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
      const older = history.slice(0, -3);
      if (older.length > 0) {
        const avgOlder = older.reduce((sum, h) => sum + h.score, 0) / older.length;
        if (avgRecent > avgOlder + 0.05) trend = 'up';
        else if (avgRecent < avgOlder - 0.05) trend = 'down';
      }
    }

    return {
      score: currentTrust,
      trend,
    };
  }
}

