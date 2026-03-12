/**
 * applicationService.ts — Wave 229
 *
 * Clinician ↔ Opportunity application flow.
 *
 * Rules:
 *  - One application per (opportunity, clerkUserId)
 *  - Clinicians can withdraw their own application
 *  - Only the org that owns the opportunity can review/accept/decline
 */

import { PrismaClient, ApplicationStatus } from '@prisma/client';
import { HttpError } from '../../utils/httpError';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApplyInput {
  opportunityId: string;
  clerkUserId: string;
  npi?: string;
  coverNote?: string;
}

export interface ReviewInput {
  applicationId: string;
  /** clerkUserId of the verifier making the decision */
  reviewerClerkUserId: string;
  status: 'REVIEWED' | 'ACCEPTED' | 'DECLINED';
  reviewNote?: string;
}

// ── Create application ────────────────────────────────────────────────────────

export async function applyToOpportunity(input: ApplyInput) {
  const { opportunityId, clerkUserId, npi, coverNote } = input;

  // Opportunity must exist and be ACTIVE
  const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.status !== 'ACTIVE') throw new HttpError(409, 'This opportunity is no longer accepting applications.');

  // Prevent duplicate — return existing if already applied
  const existing = await prisma.application.findUnique({
    where: { opportunityId_clerkUserId: { opportunityId, clerkUserId } },
  });
  if (existing) {
    if (existing.status === 'WITHDRAWN') {
      // Re-activate withdrawn application
      return prisma.application.update({
        where: { id: existing.id },
        data: { status: 'PENDING', coverNote: coverNote ?? existing.coverNote, npi: npi ?? existing.npi },
      });
    }
    throw new HttpError(409, 'You have already applied to this opportunity.');
  }

  return prisma.application.create({
    data: {
      opportunityId,
      clerkUserId,
      npi: npi ?? null,
      coverNote: coverNote ?? null,
      status: 'PENDING',
    },
  });
}

// ── Clinician: list own applications ─────────────────────────────────────────

export async function listClinicianApplications(clerkUserId: string) {
  return prisma.application.findMany({
    where: { clerkUserId },
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          specialty: true,
          hiringType: true,
          state: true,
          payRange: true,
          status: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Clinician: withdraw application ──────────────────────────────────────────

export async function withdrawApplication(applicationId: string, clerkUserId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.clerkUserId !== clerkUserId) throw new HttpError(403, 'Not your application.');
  if (app.status === 'WITHDRAWN') throw new HttpError(409, 'Application is already withdrawn.');
  if (app.status === 'ACCEPTED') throw new HttpError(409, 'Cannot withdraw an accepted application.');

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: 'WITHDRAWN' },
  });
}

// ── Verifier: list applications for an opportunity ───────────────────────────

export async function listApplicationsForOpportunity(opportunityId: string, verifierClerkUserId: string) {
  // Verify this verifier owns the org that owns the opportunity
  await assertVerifierOwnsOpportunity(opportunityId, verifierClerkUserId);

  return prisma.application.findMany({
    where: { opportunityId, status: { not: 'WITHDRAWN' } },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Verifier: review application ─────────────────────────────────────────────

export async function reviewApplication(input: ReviewInput) {
  const { applicationId, reviewerClerkUserId, status, reviewNote } = input;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { opportunity: true },
  });
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.status === 'WITHDRAWN') throw new HttpError(409, 'Cannot review a withdrawn application.');

  await assertVerifierOwnsOpportunity(app.opportunityId, reviewerClerkUserId);

  return prisma.application.update({
    where: { id: applicationId },
    data: {
      status: status as ApplicationStatus,
      reviewedBy: reviewerClerkUserId,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });
}

// ── Verifier: list all applications across org's opportunities ────────────────

export async function listAllOrgApplications(verifierClerkUserId: string) {
  // Get org for this verifier
  const org = await getOrgForVerifier(verifierClerkUserId);
  if (!org) return [];

  return prisma.application.findMany({
    where: {
      opportunity: { organizationId: org.id },
      status: { not: 'WITHDRAWN' },
    },
    include: {
      opportunity: {
        select: { id: true, title: true, specialty: true, state: true, hiringType: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrgForVerifier(clerkUserId: string) {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user?.organizationId) return null;
  return prisma.organization.findUnique({ where: { id: user.organizationId } });
}

async function assertVerifierOwnsOpportunity(opportunityId: string, clerkUserId: string) {
  const org = await getOrgForVerifier(clerkUserId);
  if (!org) throw new HttpError(403, 'No organization associated with this user.');

  const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.organizationId !== org.id) throw new HttpError(403, 'This opportunity does not belong to your organization.');
}
