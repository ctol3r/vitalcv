/**
 * B233B-CAREER-007: TrainingRecommendationEngine
 *
 * Recommends TrainingCourses and credentials to users based on CareerProfile,
 * projected workforce demand, and course ratings;
 * excludes sensitive personal data; explains rationale
 */

import { PrismaClient } from '@prisma/client';
import { WorkforceDemandForecaster, DemandForecast } from '../analytics/workforceDemandForecaster.js';

export interface CareerProfile {
  userId: string;
  specialty?: string;
  region?: string;
  currentCredentials: string[]; // Credential IDs or types
  interests?: string[];
  // Excludes: name, email, NPI, or other PII
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  credentialType: string; // Type of credential this course prepares for
  specialty: string;
  duration?: number; // Hours
  rating?: number; // 1-5
  ratingCount?: number;
  cost?: number;
  provider?: string;
  tags?: string[];
}

export interface TrainingRecommendation {
  course: TrainingCourse;
  score: number; // 0-1 relevance score
  rationale: string; // Explanation of why this course is recommended
  demandBoost?: number; // How much workforce demand increases the score
  credentialGap?: string; // Missing credential this course addresses
}

export interface RecommendationRequest {
  careerProfile: CareerProfile;
  limit?: number; // Max recommendations to return
  minScore?: number; // Minimum relevance score threshold
}

export class TrainingRecommendationEngine {
  private demandForecaster: WorkforceDemandForecaster;

  constructor(
    private prisma: PrismaClient,
    demandForecaster?: WorkforceDemandForecaster
  ) {
    this.demandForecaster =
      demandForecaster || new WorkforceDemandForecaster(prisma);
  }

  /**
   * Recommend training courses based on profile, demand, and ratings
   */
  async recommend(
    request: RecommendationRequest
  ): Promise<TrainingRecommendation[]> {
    const { careerProfile, limit = 10, minScore = 0.3 } = request;

    // Get user's current credentials (anonymized - only types)
    const userCredentials = await this.getUserCredentials(careerProfile.userId);

    // Get workforce demand forecasts for user's specialty/region
    const demandForecasts = await this.demandForecaster.predictDemand({
      specialty: careerProfile.specialty,
      region: careerProfile.region,
      horizonDays: [90], // 90-day forecast
    });

    // Get available training courses (mock - in production, this would be from a TrainingCourse table)
    const availableCourses = await this.getAvailableCourses(
      careerProfile.specialty
    );

    // Score and rank courses
    const recommendations: TrainingRecommendation[] = [];

    for (const course of availableCourses) {
      const score = this.calculateScore(
        course,
        careerProfile,
        userCredentials,
        demandForecasts
      );

      if (score >= minScore) {
        const rationale = this.generateRationale(
          course,
          careerProfile,
          userCredentials,
          demandForecasts,
          score
        );

        recommendations.push({
          course,
          score,
          rationale,
          demandBoost: this.calculateDemandBoost(course, demandForecasts),
          credentialGap: this.identifyCredentialGap(course, userCredentials),
        });
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, limit);
  }

  /**
   * Calculate relevance score for a course
   */
  private calculateScore(
    course: TrainingCourse,
    profile: CareerProfile,
    currentCredentials: string[],
    demandForecasts: DemandForecast[]
  ): number {
    let score = 0;

    // 1. Specialty match (40% weight)
    if (profile.specialty && course.specialty === profile.specialty) {
      score += 0.4;
    }

    // 2. Credential gap (30% weight)
    const credentialGap = this.identifyCredentialGap(course, currentCredentials);
    if (credentialGap) {
      score += 0.3;
    }

    // 3. Workforce demand boost (20% weight)
    const demandBoost = this.calculateDemandBoost(course, demandForecasts);
    score += Math.min(0.2, demandBoost * 0.2);

    // 4. Course rating (10% weight)
    if (course.rating) {
      score += (course.rating / 5) * 0.1;
    }

    // 5. Interest match (bonus)
    if (profile.interests && course.tags) {
      const interestMatch = profile.interests.some((interest) =>
        course.tags?.includes(interest)
      );
      if (interestMatch) {
        score += 0.1;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Calculate demand boost based on workforce forecasts
   */
  private calculateDemandBoost(
    course: TrainingCourse,
    forecasts: DemandForecast[]
  ): number {
    if (forecasts.length === 0) return 0;

    // Find relevant forecast for course specialty
    const relevantForecast = forecasts.find(
      (f) => f.specialty === course.specialty
    );

    if (!relevantForecast) return 0;

    // Normalize demand (0-1 scale based on forecast range)
    // Higher demand = higher boost
    const normalizedDemand = Math.min(
      1,
      relevantForecast.predictedDemand / 100
    ); // Assuming 100 jobs = max normalization

    // Apply trend multiplier
    let trendMultiplier = 1;
    if (relevantForecast.trend === 'increasing') trendMultiplier = 1.2;
    else if (relevantForecast.trend === 'decreasing') trendMultiplier = 0.8;

    return normalizedDemand * trendMultiplier;
  }

  /**
   * Identify credential gap this course addresses
   */
  private identifyCredentialGap(
    course: TrainingCourse,
    currentCredentials: string[]
  ): string | undefined {
    // Check if user already has this credential type
    const hasCredential = currentCredentials.some(
      (cred) => cred === course.credentialType
    );

    if (!hasCredential) {
      return course.credentialType;
    }

    return undefined;
  }

  /**
   * Generate explanation for recommendation
   */
  private generateRationale(
    course: TrainingCourse,
    profile: CareerProfile,
    currentCredentials: string[],
    forecasts: DemandForecast[],
    score: number
  ): string {
    const reasons: string[] = [];

    // Specialty match
    if (profile.specialty && course.specialty === profile.specialty) {
      reasons.push(`aligned with your specialty (${profile.specialty})`);
    }

    // Credential gap
    const credentialGap = this.identifyCredentialGap(course, currentCredentials);
    if (credentialGap) {
      reasons.push(`addresses missing credential: ${credentialGap}`);
    }

    // Demand
    const relevantForecast = forecasts.find(
      (f) => f.specialty === course.specialty
    );
    if (relevantForecast) {
      if (relevantForecast.trend === 'increasing') {
        reasons.push(
          `high demand forecast (${relevantForecast.predictedDemand} jobs projected) with increasing trend`
        );
      } else if (relevantForecast.predictedDemand > 50) {
        reasons.push(
          `strong demand forecast (${relevantForecast.predictedDemand} jobs projected)`
        );
      }
    }

    // Rating
    if (course.rating && course.rating >= 4) {
      reasons.push(`highly rated (${course.rating}/5)`);
    }

    // Default if no specific reasons
    if (reasons.length === 0) {
      reasons.push('relevant to your career profile');
    }

    return `Recommended because: ${reasons.join('; ')}.`;
  }

  /**
   * Get user's current credentials (anonymized - only types)
   */
  private async getUserCredentials(userId: string): Promise<string[]> {
    const credentials = await this.prisma.credential.findMany({
      where: {
        userId,
        status: 'active',
      },
      select: {
        type: true, // Only select type, not personal data
      },
    });

    return credentials.map((c) => c.type);
  }

  /**
   * Get available training courses (mock implementation)
   * In production, this would query a TrainingCourse table
   */
  private async getAvailableCourses(
    specialty?: string
  ): Promise<TrainingCourse[]> {
    // Mock data - in production, this would be from a database table
    const mockCourses: TrainingCourse[] = [
      {
        id: 'course-1',
        title: 'Advanced Cardiac Life Support (ACLS)',
        description: 'Comprehensive ACLS certification course',
        credentialType: 'ACLS',
        specialty: '207R00000X', // Internal Medicine
        duration: 16,
        rating: 4.5,
        ratingCount: 120,
        cost: 250,
        provider: 'American Heart Association',
        tags: ['emergency', 'cardiac', 'certification'],
      },
      {
        id: 'course-2',
        title: 'Telehealth Best Practices',
        description: 'Learn effective telehealth delivery methods',
        credentialType: 'Telehealth_Certification',
        specialty: '207R00000X',
        duration: 8,
        rating: 4.2,
        ratingCount: 85,
        cost: 150,
        provider: 'Healthcare Training Institute',
        tags: ['telehealth', 'technology', 'patient-care'],
      },
      {
        id: 'course-3',
        title: 'Medical License Multi-State Compact',
        description: 'Understanding and applying for IMLC eligibility',
        credentialType: 'IMLC_Eligibility',
        specialty: '207R00000X',
        duration: 4,
        rating: 4.7,
        ratingCount: 200,
        cost: 100,
        provider: 'State Medical Board',
        tags: ['licensing', 'mobility', 'compliance'],
      },
    ];

    if (specialty) {
      return mockCourses.filter((c) => c.specialty === specialty);
    }

    return mockCourses;
  }
}

