/**
 * B233A-CAREER-004: MentorshipMatchService
 *
 * Matches mentees with mentors based on speciality, region, and expressed goals;
 * allows mentees/mentors to accept or decline; stores mentorship relationships
 */

import { PrismaClient } from '@prisma/client';
import { getCareerProfile, CareerProfile } from './models/CareerProfile';

export interface MentorshipMatch {
  mentorshipId: string;
  menteeId: string;
  mentorId: string;
  matchScore: number;
  matchReasons: string[];
  status: string;
  matchedAt: Date;
}

export interface MatchCriteria {
  speciality?: string;
  region?: string;
  preferredRoles?: string[];
  minMatchScore?: number;
}

export class MentorshipMatchService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find potential mentors for a mentee
   */
  async findPotentialMentors(
    menteeUserId: string,
    criteria?: MatchCriteria
  ): Promise<MentorshipMatch[]> {
    const menteeProfile = await getCareerProfile(this.prisma, menteeUserId);
    if (!menteeProfile) {
      throw new Error(`Career profile not found for user ${menteeUserId}`);
    }

    // Get all mentors (users with mentorshipStatus = 'active' or who have been mentors)
    const potentialMentors = await this.prisma.careerProfile.findMany({
      where: {
        userId: { not: menteeUserId },
        mentorshipStatus: {
          in: ['active', 'matched'],
        },
        // Filter by speciality if provided
        ...(criteria?.speciality && { speciality: criteria.speciality }),
      },
    });

    // Get existing mentorship relationships to exclude
    const existingMentorships = await this.prisma.mentorship.findMany({
      where: {
        menteeId: menteeProfile.id,
      },
      select: { mentorId: true },
    });
    const excludedMentorIds = existingMentorships.map((m) => m.mentorId);

    // Score and rank potential mentors
    const matches: MentorshipMatch[] = [];

    for (const mentorProfile of potentialMentors) {
      if (excludedMentorIds.includes(mentorProfile.id)) {
        continue; // Skip already matched mentors
      }

      const matchScore = this.calculateMatchScore(menteeProfile, mentorProfile, criteria);
      const matchReasons = this.getMatchReasons(menteeProfile, mentorProfile, criteria);

      if (matchScore >= (criteria?.minMatchScore || 0.5)) {
        matches.push({
          mentorshipId: '', // Will be set when mentorship is created
          menteeId: menteeProfile.id,
          mentorId: mentorProfile.id,
          matchScore,
          matchReasons,
          status: 'pending',
          matchedAt: new Date(),
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  }

  /**
   * Create a mentorship match (mentee requests mentorship)
   */
  async createMentorshipMatch(
    menteeUserId: string,
    mentorUserId: string
  ): Promise<MentorshipMatch> {
    const menteeProfile = await getCareerProfile(this.prisma, menteeUserId);
    const mentorProfile = await getCareerProfile(this.prisma, mentorUserId);

    if (!menteeProfile) {
      throw new Error(`Career profile not found for mentee ${menteeUserId}`);
    }
    if (!mentorProfile) {
      throw new Error(`Career profile not found for mentor ${mentorUserId}`);
    }

    // Check if mentorship already exists
    const existing = await this.prisma.mentorship.findUnique({
      where: {
        menteeId_mentorId: {
          menteeId: menteeProfile.id,
          mentorId: mentorProfile.id,
        },
      },
    });

    if (existing) {
      throw new Error('Mentorship relationship already exists');
    }

    // Calculate match score
    const matchScore = this.calculateMatchScore(menteeProfile, mentorProfile);
    const matchReasons = this.getMatchReasons(menteeProfile, mentorProfile);

    // Create mentorship with pending status
    const mentorship = await this.prisma.mentorship.create({
      data: {
        menteeId: menteeProfile.id,
        mentorId: mentorProfile.id,
        status: 'pending',
      },
    });

    // Update mentee status to 'seeking' if not already
    if (menteeProfile.mentorshipStatus === 'none') {
      await this.prisma.careerProfile.update({
        where: { id: menteeProfile.id },
        data: { mentorshipStatus: 'seeking' },
      });
    }

    return {
      mentorshipId: mentorship.id,
      menteeId: menteeProfile.id,
      mentorId: mentorProfile.id,
      matchScore,
      matchReasons,
      status: mentorship.status,
      matchedAt: mentorship.matchedAt,
    };
  }

  /**
   * Accept a mentorship request (mentor accepts)
   */
  async acceptMentorship(mentorshipId: string, mentorUserId: string): Promise<void> {
    const mentorship = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      include: { mentor: true, mentee: true },
    });

    if (!mentorship) {
      throw new Error('Mentorship not found');
    }

    if (mentorship.mentor.userId !== mentorUserId) {
      throw new Error('Only the mentor can accept this mentorship');
    }

    if (mentorship.status !== 'pending') {
      throw new Error(`Cannot accept mentorship with status: ${mentorship.status}`);
    }

    await this.prisma.mentorship.update({
      where: { id: mentorshipId },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    // Update both profiles' mentorship status
    await Promise.all([
      this.prisma.careerProfile.update({
        where: { id: mentorship.menteeId },
        data: { mentorshipStatus: 'matched' },
      }),
      this.prisma.careerProfile.update({
        where: { id: mentorship.mentorId },
        data: { mentorshipStatus: 'active' },
      }),
    ]);
  }

  /**
   * Decline a mentorship request
   */
  async declineMentorship(mentorshipId: string, userId: string): Promise<void> {
    const mentorship = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      include: { mentor: true, mentee: true },
    });

    if (!mentorship) {
      throw new Error('Mentorship not found');
    }

    // Either mentor or mentee can decline
    const isMentor = mentorship.mentor.userId === userId;
    const isMentee = mentorship.mentee.userId === userId;

    if (!isMentor && !isMentee) {
      throw new Error('Only the mentor or mentee can decline this mentorship');
    }

    if (mentorship.status === 'declined' || mentorship.status === 'completed') {
      throw new Error(`Cannot decline mentorship with status: ${mentorship.status}`);
    }

    await this.prisma.mentorship.update({
      where: { id: mentorshipId },
      data: {
        status: 'declined',
        declinedAt: new Date(),
      },
    });

    // Update mentee status back to 'seeking' or 'none'
    if (isMentor) {
      // Mentor declined, mentee can continue seeking
      await this.prisma.careerProfile.update({
        where: { id: mentorship.menteeId },
        data: { mentorshipStatus: 'seeking' },
      });
    }
  }

  /**
   * Complete a mentorship relationship
   */
  async completeMentorship(mentorshipId: string, userId: string): Promise<void> {
    const mentorship = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      include: { mentor: true, mentee: true },
    });

    if (!mentorship) {
      throw new Error('Mentorship not found');
    }

    // Either mentor or mentee can mark as completed
    const isMentor = mentorship.mentor.userId === userId;
    const isMentee = mentorship.mentee.userId === userId;

    if (!isMentor && !isMentee) {
      throw new Error('Only the mentor or mentee can complete this mentorship');
    }

    if (mentorship.status !== 'accepted') {
      throw new Error(`Cannot complete mentorship with status: ${mentorship.status}`);
    }

    await this.prisma.mentorship.update({
      where: { id: mentorshipId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Update mentee status
    await this.prisma.careerProfile.update({
      where: { id: mentorship.menteeId },
      data: { mentorshipStatus: 'none' },
    });
  }

  /**
   * Get mentorship relationships for a user
   */
  async getUserMentorships(userId: string): Promise<MentorshipMatch[]> {
    const profile = await getCareerProfile(this.prisma, userId);
    if (!profile) {
      throw new Error(`Career profile not found for user ${userId}`);
    }

    const mentorships = await this.prisma.mentorship.findMany({
      where: {
        OR: [{ menteeId: profile.id }, { mentorId: profile.id }],
      },
      include: {
        mentee: true,
        mentor: true,
      },
    });

    return mentorships.map((m) => ({
      mentorshipId: m.id,
      menteeId: m.menteeId,
      mentorId: m.mentorId,
      matchScore: 0, // Can be recalculated if needed
      matchReasons: [],
      status: m.status,
      matchedAt: m.matchedAt,
    }));
  }

  /**
   * Calculate match score between mentee and mentor
   */
  private calculateMatchScore(
    mentee: CareerProfile,
    mentor: CareerProfile,
    criteria?: MatchCriteria
  ): number {
    let score = 0;
    let factors = 0;

    // Speciality match (40% weight)
    if (mentee.speciality && mentor.speciality) {
      if (mentee.speciality === mentor.speciality) {
        score += 0.4;
      }
      factors += 0.4;
    } else if (criteria?.speciality) {
      if (mentor.speciality === criteria.speciality) {
        score += 0.4;
      }
      factors += 0.4;
    }

    // Preferred roles match (30% weight)
    if (mentee.preferredRoles.length > 0 && mentor.preferredRoles.length > 0) {
      const commonRoles = mentee.preferredRoles.filter((r) => mentor.preferredRoles.includes(r));
      const roleMatchRatio = commonRoles.length / Math.max(mentee.preferredRoles.length, 1);
      score += 0.3 * roleMatchRatio;
      factors += 0.3;
    }

    // Career goals alignment (30% weight)
    const menteeGoals = mentee.careerGoals as { targetRoles?: string[] } | null;
    if (menteeGoals?.targetRoles && mentor.preferredRoles.length > 0) {
      const alignedRoles = menteeGoals.targetRoles.filter((r) =>
        mentor.preferredRoles.includes(r)
      );
      const alignmentRatio = alignedRoles.length / Math.max(menteeGoals.targetRoles.length, 1);
      score += 0.3 * alignmentRatio;
      factors += 0.3;
    }

    // Normalize score
    return factors > 0 ? score / factors : 0;
  }

  /**
   * Get reasons for match
   */
  private getMatchReasons(
    mentee: CareerProfile,
    mentor: CareerProfile,
    criteria?: MatchCriteria
  ): string[] {
    const reasons: string[] = [];

    if (mentee.speciality && mentor.speciality && mentee.speciality === mentor.speciality) {
      reasons.push(`Both specialize in ${mentee.speciality}`);
    }

    const commonRoles = mentee.preferredRoles.filter((r) => mentor.preferredRoles.includes(r));
    if (commonRoles.length > 0) {
      reasons.push(`Shared interest in: ${commonRoles.join(', ')}`);
    }

    const menteeGoals = mentee.careerGoals as { targetRoles?: string[] } | null;
    if (menteeGoals?.targetRoles) {
      const alignedRoles = menteeGoals.targetRoles.filter((r) =>
        mentor.preferredRoles.includes(r)
      );
      if (alignedRoles.length > 0) {
        reasons.push(`Mentor has experience in your target roles: ${alignedRoles.join(', ')}`);
      }
    }

    return reasons;
  }
}

