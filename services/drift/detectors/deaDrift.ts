import { differenceInCalendarDays } from 'date-fns';
import { DriftDetector, DriftDetectionResult, DriftEvent } from '../types';
import { buildEvidence, coerceDate, computeStats, createDriftEvent } from '../utils';

const DETECTOR_ID = 'DEADriftDetector';

type DeaStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' | 'PENDING';

export interface DeaRegistrationSnapshot {
  registrationNumber: string;
  schedules: string[];
  status: DeaStatus;
  expiresAt?: Date | string | null;
  lastVerifiedAt?: Date | string | null;
  source?: string;
}

export interface DeaDriftInput {
  clinicianId: string;
  observed: DeaRegistrationSnapshot;
  baseline?: DeaRegistrationSnapshot;
  requiredSchedules?: string[];
  expirationDriftToleranceDays?: number;
}

export class DEADriftDetector implements DriftDetector<DeaDriftInput> {
  readonly id = DETECTOR_ID;
  readonly category = 'dea' as const;

  detect(input: DeaDriftInput): DriftDetectionResult {
    const events: DriftEvent[] = [];
    const { observed, baseline, requiredSchedules = [], expirationDriftToleranceDays = 15 } = input;

    // Status drift or suspension
    if (observed.status !== 'ACTIVE') {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: observed.status === 'REVOKED' || observed.status === 'SUSPENDED' ? 'critical' : 'high',
          title: `DEA status ${observed.status.toLowerCase()}`,
          summary: `DEA registration ${observed.registrationNumber} now ${observed.status.toLowerCase()}.`,
          subject: {
            type: 'dea',
            id: observed.registrationNumber,
            label: observed.registrationNumber,
          },
          evidence: [buildEvidence('status', baseline?.status, observed.status)],
          metadata: {
            clinicianId: input.clinicianId,
            lastVerifiedAt: coerceDate(observed.lastVerifiedAt)?.toISOString(),
          },
          recommendations: [
            'Escalate to compliance and halt controlled substance scheduling',
            'Notify medical staff office immediately',
          ],
        })
      );
    }

    // Schedule drift
    const baselineSchedules = new Set((baseline?.schedules ?? []).map((s) => s.toUpperCase()));
    const observedSchedules = new Set(observed.schedules.map((s) => s.toUpperCase()));
    const missingBaseline = Array.from(baselineSchedules).filter((schedule) => !observedSchedules.has(schedule));
    const newSchedules = Array.from(observedSchedules).filter((schedule) => !baselineSchedules.has(schedule));

    const requiredMissing = requiredSchedules
      .map((schedule) => schedule.toUpperCase())
      .filter((schedule) => !observedSchedules.has(schedule));

    if (missingBaseline.length || newSchedules.length || requiredMissing.length) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: requiredMissing.length ? 'critical' : 'high',
          title: 'DEA schedule drift',
          summary: 'DEA schedules differ from baseline / requirements.',
          subject: {
            type: 'dea',
            id: observed.registrationNumber,
          },
          evidence: [
            buildEvidence('missingSchedules', missingBaseline),
            buildEvidence('newSchedules', newSchedules),
            buildEvidence('requiredMissing', requiredMissing),
          ],
          metadata: {
            clinicianId: input.clinicianId,
          },
          recommendations: [
            'Confirm DEA endorsement for controlled substance schedules',
            requiredMissing.length
              ? 'Restrict prescribing until DEA schedules restored'
              : 'Update credentialing packet with revised schedules',
          ],
        })
      );
    }

    // Expiration drift
    const observedExpiry = coerceDate(observed.expiresAt);
    const baselineExpiry = coerceDate(baseline?.expiresAt);

    if (observedExpiry) {
      if (observedExpiry < new Date()) {
        events.push(
          createDriftEvent({
            detector: DETECTOR_ID,
            category: this.category,
            severity: 'critical',
            title: 'DEA registration expired',
            summary: `DEA registration ${observed.registrationNumber} expired on ${observedExpiry.toDateString()}.`,
            subject: {
              type: 'dea',
              id: observed.registrationNumber,
            },
            evidence: [buildEvidence('expiresAt', baselineExpiry?.toISOString(), observedExpiry.toISOString())],
            metadata: {
              clinicianId: input.clinicianId,
            },
            recommendations: ['Suspend controlled substance privileges', 'Initiate DEA renewal immediately'],
          })
        );
      } else if (baselineExpiry) {
        const deltaDays = differenceInCalendarDays(observedExpiry, baselineExpiry);
        if (Math.abs(deltaDays) >= expirationDriftToleranceDays) {
          events.push(
            createDriftEvent({
              detector: DETECTOR_ID,
              category: this.category,
              severity: deltaDays < 0 ? 'high' : 'medium',
              title: 'DEA expiration drift',
              summary: `DEA expiration moved ${Math.abs(deltaDays)} day(s) ${deltaDays < 0 ? 'sooner' : 'later'} than baseline.`,
              subject: {
                type: 'dea',
                id: observed.registrationNumber,
              },
              evidence: [buildEvidence('expiresAt', baselineExpiry.toISOString(), observedExpiry.toISOString())],
              metadata: {
                clinicianId: input.clinicianId,
                deltaDays,
              },
              recommendations: ['Refresh expiration in compliance source', 'Confirm DEA letter of authorization'],
            })
          );
        }
      }
    }

    return {
      events,
      stats: computeStats(events),
    };
  }
}

export const deaDriftDetector = new DEADriftDetector();
