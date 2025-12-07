import { PecosLifecycleStatus } from '../../pecos/models/PECOSEnrollment';
import { DriftDetector, DriftDetectionResult, DriftEvent, LocationSnapshot } from '../types';
import { buildEvidence, compareLocationSets, coerceDate, computeStats, createDriftEvent } from '../utils';

const DETECTOR_ID = 'PECOSDriftDetector';

export interface PecosSnapshot {
  enrollmentId: string;
  status: PecosLifecycleStatus;
  practiceLocations?: LocationSnapshot[];
  enrollmentType?: string;
  revalidationDueAt?: Date | string | null;
  lastCheckedAt?: Date | string | null;
}

export interface PecosDriftInput {
  clinicianId: string;
  observed: PecosSnapshot;
  expectedStatus?: PecosLifecycleStatus;
  baseline?: PecosSnapshot;
  expectedLocations?: LocationSnapshot[];
  revalidationWarningThresholdDays?: number;
}

export class PecosDriftDetector implements DriftDetector<PecosDriftInput> {
  readonly id = DETECTOR_ID;
  readonly category = 'pecos' as const;

  detect(input: PecosDriftInput): DriftDetectionResult {
    const events: DriftEvent[] = [];
    const {
      observed,
      expectedStatus,
      baseline,
      expectedLocations,
      revalidationWarningThresholdDays = 90,
    } = input;

    if (expectedStatus && expectedStatus !== observed.status) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: observed.status === PecosLifecycleStatus.DEACTIVATED ? 'critical' : 'high',
          title: 'PECOS enrollment status drift',
          summary: `PECOS enrollment ${observed.enrollmentId} is ${observed.status} (expected ${expectedStatus}).`,
          subject: {
            type: 'enrollment',
            id: observed.enrollmentId,
            label: 'PECOS',
          },
          evidence: [buildEvidence('status', expectedStatus, observed.status)],
          metadata: {
            clinicianId: input.clinicianId,
            lastCheckedAt: coerceDate(observed.lastCheckedAt)?.toISOString(),
          },
          recommendations: [
            'Open PECOS CMS portal case to reconcile status',
            observed.status === PecosLifecycleStatus.DEACTIVATED
              ? 'Escalate to Medicare enrollment team immediately'
              : 'Verify supporting docs uploaded',
          ],
        })
      );
    }

    const baselineLocations = baseline?.practiceLocations ?? expectedLocations ?? [];
    if (baselineLocations.length) {
      const locationDiff = compareLocationSets(baselineLocations, observed.practiceLocations);
      if (locationDiff.missing.length || locationDiff.unexpected.length) {
        events.push(
          createDriftEvent({
            detector: DETECTOR_ID,
            category: this.category,
            severity: 'warning',
            title: 'PECOS practice location drift',
            summary: `${locationDiff.missing.length + locationDiff.unexpected.length} PECOS location change(s) detected.`,
            subject: {
              type: 'enrollment',
              id: observed.enrollmentId,
            },
            evidence: [
              buildEvidence('missingLocations', locationDiff.missing),
              buildEvidence('newLocations', locationDiff.unexpected),
            ],
            metadata: {
              clinicianId: input.clinicianId,
            },
            recommendations: ['Update CMS-855 practice locations to match active sites'],
          })
        );
      }
    }

    const revalidationDue = coerceDate(observed.revalidationDueAt);
    if (revalidationDue) {
      const now = new Date();
      const diffDays = Math.round((revalidationDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= revalidationWarningThresholdDays) {
        events.push(
          createDriftEvent({
            detector: DETECTOR_ID,
            category: this.category,
            severity: diffDays <= 0 ? 'critical' : 'medium',
            title: diffDays <= 0 ? 'PECOS revalidation overdue' : 'PECOS revalidation approaching',
            summary: `PECOS revalidation due ${revalidationDue.toDateString()} (${diffDays} day(s)).`,
            subject: {
              type: 'enrollment',
              id: observed.enrollmentId,
            },
            evidence: [buildEvidence('revalidationDueAt', baseline?.revalidationDueAt, observed.revalidationDueAt)],
            metadata: {
              clinicianId: input.clinicianId,
              diffDays,
            },
            recommendations: ['Launch PECOS revalidation packet workflow'],
          })
        );
      }
    }

    return {
      events,
      stats: computeStats(events),
    };
  }
}

export const pecosDriftDetector = new PecosDriftDetector();
