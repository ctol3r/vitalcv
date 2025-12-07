/**
 * Career Growth Engine - Core Models
 * Phase 1: Growth Engine Core
 */

export type CareerStage = 'student' | 'resident' | 'early_career' | 'mid_career' | 'senior';

export interface GrowthProfile {
  clinicianId: string;
  specialties: string[];
  credentials: Credential[];
  trustScore: number;
  yearsPracticing: number;
  matchHistory: MatchRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Credential {
  id: string;
  type: 'license' | 'certification' | 'cme' | 'dea' | 'board_cert';
  name: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string | null;
  state?: string;
  specialty?: string;
  renewalRequired: boolean;
  renewalDaysRemaining: number | null;
  chainStaleness: number; // days since last chain update
}

export interface MatchRecord {
  id: string;
  jobId: string;
  matchScore: number;
  matchedAt: string;
  role: string;
  organization: string;
}

export interface SkillMap {
  clinicianId: string;
  skills: Skill[];
  gaps: SkillGap[];
  synthesizedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: 'clinical' | 'administrative' | 'technical' | 'leadership';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  source: 'credential' | 'self_reported' | 'inferred';
  confidence: number;
}

export interface SkillGap {
  skillId: string;
  skillName: string;
  currentLevel: string;
  recommendedLevel: string;
  gapReason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RoleTrajectory {
  currentRole: string;
  nextPossibleRoles: PredictedRole[];
  confidence: number;
  timeframe: string;
  requirements: string[];
}

export interface PredictedRole {
  role: string;
  organization: string;
  matchScore: number;
  requirements: string[];
  timeToQualify: string;
  confidence: number;
}

export interface CMERelevance {
  specialty: string;
  requiredCredits: number;
  earnedCredits: number;
  cycleStart: string;
  cycleEnd: string;
  relevanceScore: number;
  recommendedCourses: CMECourse[];
}

export interface CMECourse {
  id: string;
  title: string;
  provider: string;
  credits: number;
  relevanceScore: number;
  specialty: string;
  format: 'online' | 'in_person' | 'hybrid';
  cost: number;
  url?: string;
}

export interface RenewalPrediction {
  credentialId: string;
  credentialName: string;
  type: 'dea' | 'license' | 'board_cert';
  expiresAt: string;
  daysUntilExpiration: number;
  renewalWindowStart: string;
  renewalWindowEnd: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  estimatedProcessingDays: number;
}

export interface IdentityHealthScore {
  overall: number;
  compliance: number;
  credentialFreshness: number;
  chainIntegrity: number;
  trustScore: number;
  anchorAge: number; // days since last anchor
  breakdown: {
    compliance: {
      score: number;
      issues: string[];
    };
    credentials: {
      score: number;
      expired: number;
      expiring: number;
      stale: number;
    };
    chain: {
      score: number;
      staleness: number;
      lastUpdate: string;
    };
    trust: {
      score: number;
      trend: 'up' | 'down' | 'stable';
    };
  };
}

export interface ExperienceGap {
  id: string;
  type: 'certification' | 'training' | 'credential' | 'cme';
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  actionRequired: string;
  deadline?: string;
}

export interface TrustScoreEvolution {
  date: string;
  score: number;
  event?: string;
}

export interface CareerMilestone {
  id: string;
  type: 'education' | 'residency' | 'certification' | 'role' | 'achievement';
  title: string;
  description: string;
  date: string;
  specialty?: string;
  organization?: string;
  trustPulse?: number; // trust score boost from this milestone
}

export interface Recommendation {
  id: string;
  type: 'cme' | 'credential' | 'skill' | 'license' | 'trust' | 'match';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  actionUrl?: string;
  estimatedTime?: string;
  cost?: number;
  confidence: number;
}

export interface ComplianceReminder {
  id: string;
  type: 'dea_renewal' | 'license_renewal' | 'board_cert' | 'cme_cycle' | 'chain_update';
  title: string;
  description: string;
  dueDate: string;
  daysRemaining: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  actionUrl?: string;
  credentialId?: string;
}

export interface ClusteredExpiration {
  month: string;
  year: number;
  count: number;
  credentials: Credential[];
  urgency: 'critical' | 'high' | 'medium';
}

