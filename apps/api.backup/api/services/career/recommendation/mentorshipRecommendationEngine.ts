/**
 * B233B-CAREER-008: MentorshipRecommendationEngine
 *
 * Suggests potential mentors to users based on common interests, specialty,
 * and previous mentorship outcomes;
 * allows users to opt in or out
 */

import { PrismaClient } from '@prisma/client';

export interface MentorshipProfile {
  userId: string;
  specialty?: string;
  interests?: string[];
  region?: string;
  // Excludes: name, email, NPI, or other PII
}

export interface MentorProfile {
  mentorId: string;
  specialty?: string;
  interests?: string[];
  region?: string;
  yearsExperience?: number;
  mentorshipCount?: number; // Number of mentees they've helped
  averageOutcome?: number; // Average outcome rating (1-5)
  availability?: 'available' | 'limited' | 'unavailable';
  optInStatus: 'opted_in' | 'opted_out';
  // Excludes: name, email, NPI, or other PII
}

export interface MentorshipOutcome {
  mentorshipId: string;
  mentorId: string;
  menteeId: string;
  outcomeRating?: number; // 1-5 rating
  completed: boolean;
  durationWeeks?: number;
  specialty?: string;
}

export interface MentorshipRecommendation {
  mentor: MentorProfile;
  score: number; // 0-1 relevance score
  matchReasons: string[]; // Why this mentor is a good match
  commonInterests?: string[];
}

export interface RecommendationRequest {
  menteeProfile: MentorshipProfile;
  limit?: number;
  minScore?: number;
}

export class MentorshipRecommendationEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Recommend mentors based on interests, specialty, and outcomes
   */
  async recommend(
    request: RecommendationRequest
  ): Promise<MentorshipRecommendation[]> {
    const { menteeProfile, limit = 5, minScore = 0.4 } = request;

    // Get available mentors (opted in, available)
    const availableMentors = await this.getAvailableMentors(menteeProfile);

    // Get mentorship outcomes for scoring
    const outcomes = await this.getMentorshipOutcomes();

    // Score and rank mentors
    const recommendations: MentorshipRecommendation[] = [];

    for (const mentor of availableMentors) {
      const score = this.calculateScore(
        mentor,
        menteeProfile,
        outcomes.filter((o) => o.mentorId === mentor.mentorId)
      );

      if (score >= minScore) {
        const matchReasons = this.generateMatchReasons(
          mentor,
          menteeProfile
        );
        const commonInterests = this.findCommonInterests(
          mentor,
          menteeProfile
        );

        recommendations.push({
          mentor,
          score,
          matchReasons,
          commonInterests,
        });
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, limit);
  }

  /**
   * Calculate mentor match score
   */
  private calculateScore(
    mentor: MentorProfile,
    mentee: MentorshipProfile,
    mentorOutcomes: MentorshipOutcome[]
  ): number {
    let score = 0;

    // 1. Specialty match (30% weight)
    if (mentee.specialty && mentor.specialty === mentee.specialty) {
      score += 0.3;
    }

    // 2. Interest overlap (25% weight)
    const commonInterests = this.findCommonInterests(mentor, mentee);
    if (commonInterests.length > 0) {
      const interestScore = Math.min(
        0.25,
        (commonInterests.length / Math.max(mentee.interests?.length || 1, mentor.interests?.length || 1)) *
          0.25
      );
      score += interestScore;
    }

    // 3. Previous mentorship outcomes (25% weight)
    if (mentorOutcomes.length > 0) {
      const avgOutcome =
        mentorOutcomes.reduce(
          (sum, o) => sum + (o.outcomeRating || 3),
          0
        ) / mentorOutcomes.length;
      score += (avgOutcome / 5) * 0.25;
    } else if (mentor.averageOutcome) {
      score += (mentor.averageOutcome / 5) * 0.25;
    }

    // 4. Experience level (10% weight) - more experience = better
    if (mentor.yearsExperience) {
      const expScore = Math.min(1, mentor.yearsExperience / 20); // Normalize to 20 years max
      score += expScore * 0.1;
    }

    // 5. Mentorship count (10% weight) - more mentees = more reliable
    if (mentor.mentorshipCount) {
      const countScore = Math.min(1, mentor.mentorshipCount / 10); // Normalize to 10 mentees max
      score += countScore * 0.1;
    }

    return Math.min(1, score);
  }

  /**
   * Find common interests between mentor and mentee
   */
  private findCommonInterests(
    mentor: MentorProfile,
    mentee: MentorshipProfile
  ): string[] {
    if (!mentor.interests || !mentee.interests) return [];

    return mentor.interests.filter((interest) =>
      mentee.interests!.includes(interest)
    );
  }

  /**
   * Generate match reasons
   */
  private generateMatchReasons(
    mentor: MentorProfile,
    mentee: MentorshipProfile
  ): string[] {
    const reasons: string[] = [];

    // Specialty match
    if (mentee.specialty && mentor.specialty === mentee.specialty) {
      reasons.push(`same specialty (${mentee.specialty})`);
    }

    // Common interests
    const commonInterests = this.findCommonInterests(mentor, mentee);
    if (commonInterests.length > 0) {
      reasons.push(
        `shared interests: ${commonInterests.slice(0, 3).join(', ')}`
      );
    }

    // Experience
    if (mentor.yearsExperience && mentor.yearsExperience >= 10) {
      reasons.push(`experienced mentor (${mentor.yearsExperience}+ years)`);
    }

    // Outcomes
    if (mentor.averageOutcome && mentor.averageOutcome >= 4) {
      reasons.push(`high mentorship rating (${mentor.averageOutcome}/5)`);
    }

    // Mentorship count
    if (mentor.mentorshipCount && mentor.mentorshipCount >= 5) {
      reasons.push(`experienced mentor (${mentor.mentorshipCount} previous mentees)`);
    }

    return reasons.length > 0 ? reasons : ['available mentor'];
  }

  /**
   * Get available mentors (opted in, available)
   */
  private async getAvailableMentors(
    menteeProfile: MentorshipProfile
  ): Promise<MentorProfile[]> {
    // In production, this would query a MentorProfile table
    // For now, return mock data filtered by opt-in status

    const mockMentors: MentorProfile[] = [
      {
        mentorId: 'mentor-1',
        specialty: '207R00000X',
        interests: ['cardiology', 'telehealth', 'research'],
        region: 'CA',
        yearsExperience: 15,
        mentorshipCount: 8,
        averageOutcome: 4.5,
        availability: 'available',
        optInStatus: 'opted_in',
      },
      {
        mentorId: 'mentor-2',
        specialty: '207R00000X',
        interests: ['primary-care', 'telehealth', 'patient-safety'],
        region: 'NY',
        yearsExperience: 12,
        mentorshipCount: 5,
        averageOutcome: 4.2,
        availability: 'available',
        optInStatus: 'opted_in',
      },
      {
        mentorId: 'mentor-3',
        specialty: '207R00000X',
        interests: ['emergency-medicine', 'trauma', 'leadership'],
        region: 'TX',
        yearsExperience: 20,
        mentorshipCount: 12,
        averageOutcome: 4.8,
        availability: 'limited',
        optInStatus: 'opted_in',
      },
    ];

    // Filter by opt-in status and availability
    return mockMentors.filter(
      (m) =>
        m.optInStatus === 'opted_in' &&
        m.availability !== 'unavailable' &&
        (!menteeProfile.specialty || m.specialty === menteeProfile.specialty)
    );
  }

  /**
   * Get mentorship outcomes for scoring
   */
  private async getMentorshipOutcomes(): Promise<MentorshipOutcome[]> {
    // In production, this would query a MentorshipOutcome table
    // Mock data for demonstration
    return [
      {
        mentorshipId: 'mentorship-1',
        mentorId: 'mentor-1',
        menteeId: 'mentee-1',
        outcomeRating: 5,
        completed: true,
        durationWeeks: 12,
        specialty: '207R00000X',
      },
      {
        mentorshipId: 'mentorship-2',
        mentorId: 'mentor-1',
        menteeId: 'mentee-2',
        outcomeRating: 4,
        completed: true,
        durationWeeks: 16,
        specialty: '207R00000X',
      },
      {
        mentorshipId: 'mentorship-3',
        mentorId: 'mentor-2',
        menteeId: 'mentee-3',
        outcomeRating: 4,
        completed: true,
        durationWeeks: 10,
        specialty: '207R00000X',
      },
    ];
  }

  /**
   * Allow user to opt in as a mentor
   */
  async optInAsMentor(
    userId: string,
    profile: Partial<MentorProfile>
  ): Promise<void> {
    // In production, this would update a MentorProfile table
    // Set optInStatus to 'opted_in'
    console.log(`User ${userId} opted in as mentor`, profile);
  }

  /**
   * Allow user to opt out as a mentor
   */
  async optOutAsMentor(userId: string): Promise<void> {
    // In production, this would update a MentorProfile table
    // Set optInStatus to 'opted_out'
    console.log(`User ${userId} opted out as mentor`);
  }

  /**
   * Allow user to opt out of receiving mentorship recommendations
   */
  async optOutOfMentorship(userId: string): Promise<void> {
    // In production, this would update user preferences
    console.log(`User ${userId} opted out of mentorship recommendations`);
  }
}

