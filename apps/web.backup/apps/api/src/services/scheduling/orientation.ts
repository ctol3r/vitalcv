import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

import { provisionShiftAccess } from './provision';

const prisma = new PrismaClient();

export interface OrientationScheduleRequest {
  clinicianId: string;
  employerId: string;
  hiringEventId: string;
  readinessScore?: number | null;
  preferredMode?: 'virtual' | 'onsite';
  prisma?: PrismaClient;
}

export interface OrientationScheduleResult {
  sessionId: string;
  clinicianId: string;
  employerId: string;
  deliveryMode: 'virtual' | 'onsite';
  scheduledStart: string;
  scheduledEnd: string;
  host: string;
  location: string;
  calendarUrl: string;
  joinUrl: string;
  provisioning: Awaited<ReturnType<typeof provisionShiftAccess>>;
  createdAt: string;
}

export async function autoScheduleOrientation(
  request: OrientationScheduleRequest,
): Promise<OrientationScheduleResult> {
  const client = request.prisma ?? prisma;
  const deliveryMode =
    request.preferredMode ??
    (request.readinessScore && request.readinessScore >= 0.8 ? 'virtual' : 'onsite');
  const slot = computeSlot(request.clinicianId, request.hiringEventId);
  const sessionId = `orient_${randomUUID().slice(0, 8)}`;
  const host = deliveryMode === 'virtual' ? 'Orientation bot' : 'Mobility coordinator';
  const location =
    deliveryMode === 'virtual'
      ? `Teams · ${buildMeetingSlug(request.employerId)}`
      : `Ops Hub ${selectCity(request.employerId)}`;
  const joinUrl = `https://meet.vital.work/${sessionId}`;
  const calendarUrl = `https://cal.vital.work/orientation/${sessionId}`;

  const provisioning = await provisionShiftAccess({
    assignmentId: sessionId,
    shiftId: `orientation-${request.employerId}`,
    clinicianId: request.clinicianId,
    orgId: request.employerId,
    role: 'orientation',
    readinessScore: request.readinessScore,
    requestedBy: 'orientation_bot',
  });

  return {
    sessionId,
    clinicianId: request.clinicianId,
    employerId: request.employerId,
    deliveryMode,
    scheduledStart: slot.start.toISOString(),
    scheduledEnd: slot.end.toISOString(),
    host,
    location,
    calendarUrl,
    joinUrl,
    provisioning,
    createdAt: new Date().toISOString(),
  };
}

function computeSlot(clinicianId: string, hiringEventId: string) {
  const hash = createHash('sha256').update(`${clinicianId}:${hiringEventId}`).digest('hex');
  const offsetMinutes = (parseInt(hash.slice(0, 4), 16) % 240) + 180;
  const durationMinutes = 45;
  const start = new Date(Date.now() + offsetMinutes * 60_000);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

function buildMeetingSlug(employerId: string) {
  return employerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase() || 'vital';
}

function selectCity(employerId: string) {
  const cities = ['Seattle', 'Austin', 'Atlanta', 'Boston'];
  const hash = createHash('md5').update(employerId).digest('hex');
  const index = parseInt(hash.slice(0, 2), 16) % cities.length;
  return cities[index];
}

