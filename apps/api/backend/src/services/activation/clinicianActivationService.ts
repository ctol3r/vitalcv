/**
 * ACT-7.1 (read) — the authorized DB read behind the clinician "path to start".
 *
 * Authorization: ownership only. The application's `clerkUserId` must equal the
 * authenticated caller's. A non-owned OR non-existent id returns the SAME
 * "not found" (uniform 404), so the endpoint cannot enumerate other clinicians'
 * applications. This is a pure read — it never instantiates, resolves, or
 * advances anything (those gated mutations are a later, separately-reviewed
 * bundle). The view shaping + honesty gate live in `clinicianActivationView.ts`.
 */

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import { getApplicationStartState } from './startEventService';
import {
  deriveClinicianActivationView,
  type ClinicianActivationView,
} from './clinicianActivationView';

export async function getClinicianApplicationActivation(
  applicationId: string,
  clerkUserId: string,
): Promise<ClinicianActivationView> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, clerkUserId: true },
  });
  // Uniform 404: "exists but not yours" is indistinguishable from "does not exist".
  if (!application || application.clerkUserId !== clerkUserId) {
    throw new HttpError(404, 'Application not found.');
  }

  const [rows, startState] = await Promise.all([
    prisma.activationRequirement.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    }),
    getApplicationStartState(applicationId),
  ]);

  return deriveClinicianActivationView(applicationId, rows, startState);
}
