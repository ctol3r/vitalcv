/**
 * B233A-CAREER-001: CareerProfile Model
 *
 * Model for career profiles with all required fields
 */

import { PrismaClient } from '@prisma/client';

export interface CareerGoals {
  shortTerm?: string[];
  longTerm?: string[];
  targetRoles?: string[];
  targetSpecialties?: string[];
  [key: string]: unknown;
}

export interface CareerProfileInput {
  userId: string;
  speciality?: string;
  careerGoals?: CareerGoals;
  preferredRoles?: string[];
  trainingCredits?: number;
  mentorshipStatus?: string;
}

export interface CareerProfile {
  id: string;
  userId: string;
  speciality: string | null;
  careerGoals: CareerGoals | null;
  preferredRoles: string[];
  trainingCredits: number;
  mentorshipStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate career profile input
 */
export function validateCareerProfileInput(input: CareerProfileInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (input.trainingCredits !== undefined && (typeof input.trainingCredits !== 'number' || input.trainingCredits < 0)) {
    throw new Error('trainingCredits must be a non-negative number');
  }
  if (input.preferredRoles && !Array.isArray(input.preferredRoles)) {
    throw new Error('preferredRoles must be an array');
  }
  const validMentorshipStatuses = ['none', 'seeking', 'matched', 'active'];
  if (input.mentorshipStatus && !validMentorshipStatuses.includes(input.mentorshipStatus)) {
    throw new Error(`mentorshipStatus must be one of: ${validMentorshipStatuses.join(', ')}`);
  }
}

/**
 * Create career profile
 */
export async function createCareerProfile(
  prisma: PrismaClient,
  input: CareerProfileInput
): Promise<CareerProfile> {
  validateCareerProfileInput(input);

  // Check if profile already exists for this user
  const existing = await prisma.careerProfile.findUnique({
    where: { userId: input.userId },
  });

  if (existing) {
    throw new Error(`Career profile already exists for user ${input.userId}`);
  }

  return prisma.careerProfile.create({
    data: {
      userId: input.userId,
      speciality: input.speciality ?? null,
      careerGoals: input.careerGoals ?? null,
      preferredRoles: input.preferredRoles ?? [],
      trainingCredits: input.trainingCredits ?? 0,
      mentorshipStatus: input.mentorshipStatus || 'none',
    },
  });
}

/**
 * Get career profile by user ID
 */
export async function getCareerProfile(
  prisma: PrismaClient,
  userId: string
): Promise<CareerProfile | null> {
  return prisma.careerProfile.findUnique({
    where: { userId },
  });
}

/**
 * Get career profile by ID
 */
export async function getCareerProfileById(
  prisma: PrismaClient,
  id: string
): Promise<CareerProfile | null> {
  return prisma.careerProfile.findUnique({
    where: { id },
  });
}

/**
 * Update career profile
 */
export async function updateCareerProfile(
  prisma: PrismaClient,
  userId: string,
  updates: Partial<CareerProfileInput>
): Promise<CareerProfile> {
  if (updates.trainingCredits !== undefined && updates.trainingCredits < 0) {
    throw new Error('trainingCredits must be non-negative');
  }
  if (updates.preferredRoles && !Array.isArray(updates.preferredRoles)) {
    throw new Error('preferredRoles must be an array');
  }
  const validMentorshipStatuses = ['none', 'seeking', 'matched', 'active'];
  if (updates.mentorshipStatus && !validMentorshipStatuses.includes(updates.mentorshipStatus)) {
    throw new Error(`mentorshipStatus must be one of: ${validMentorshipStatuses.join(', ')}`);
  }

  return prisma.careerProfile.update({
    where: { userId },
    data: {
      ...(updates.speciality !== undefined && { speciality: updates.speciality ?? null }),
      ...(updates.careerGoals !== undefined && { careerGoals: updates.careerGoals ?? null }),
      ...(updates.preferredRoles !== undefined && { preferredRoles: updates.preferredRoles }),
      ...(updates.trainingCredits !== undefined && { trainingCredits: updates.trainingCredits }),
      ...(updates.mentorshipStatus && { mentorshipStatus: updates.mentorshipStatus }),
    },
  });
}

/**
 * Update training credits
 */
export async function updateTrainingCredits(
  prisma: PrismaClient,
  userId: string,
  credits: number
): Promise<CareerProfile> {
  if (credits < 0) {
    throw new Error('credits must be non-negative');
  }

  return prisma.careerProfile.update({
    where: { userId },
    data: { trainingCredits: credits },
  });
}

/**
 * Add training credits
 */
export async function addTrainingCredits(
  prisma: PrismaClient,
  userId: string,
  creditsToAdd: number
): Promise<CareerProfile> {
  const profile = await getCareerProfile(prisma, userId);
  if (!profile) {
    throw new Error(`Career profile not found for user ${userId}`);
  }

  const newCredits = profile.trainingCredits + creditsToAdd;
  if (newCredits < 0) {
    throw new Error('Cannot reduce credits below zero');
  }

  return updateTrainingCredits(prisma, userId, newCredits);
}

/**
 * Update mentorship status
 */
export async function updateMentorshipStatus(
  prisma: PrismaClient,
  userId: string,
  status: string
): Promise<CareerProfile> {
  const validStatuses = ['none', 'seeking', 'matched', 'active'];
  if (!validStatuses.includes(status)) {
    throw new Error(`mentorshipStatus must be one of: ${validStatuses.join(', ')}`);
  }

  return prisma.careerProfile.update({
    where: { userId },
    data: { mentorshipStatus: status },
  });
}

