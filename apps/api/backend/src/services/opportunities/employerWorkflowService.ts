import { ApplicationStatus } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

export async function acceptApplication(applicationId: string, actorId: string) {
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.CREDENTIALING }
  });
  return updated;
}

export async function requestMissingInfo(applicationId: string, field: string, message: string, actorId: string) {
  const request = await prisma.missingRequest.create({
    data: {
      applicationId,
      field,
      message,
      status: 'OPEN'
    }
  });

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.IN_REVIEW }
  });
  
  return { updated, request };
}

export async function rejectApplication(applicationId: string, actorId: string) {
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.REJECTED }
  });
  return updated;
}
