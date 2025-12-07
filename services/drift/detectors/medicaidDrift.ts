import type { MedicaidEnrollment } from '../../revalidation/calc';
import type { DiscrepancyFinding } from '../../payer/detectPayerDiscrepancies';
import { DriftDetector, DriftDetectionResult, DriftEvent } from '../types';
import { buildEvidence, computeStats, createDriftEvent } from '../utils';

const DETECTOR_ID = 'MedicaidDriftDetector';

type MedicaidStatus = MedicaidEnrollment['status'] | 'SUSPENDED' | 'DISENROLLED' | 'DENIED';

export interface MedicaidEnrollmentSnapshot extends MedicaidEnrollment {
  state: string;
  status?: MedicaidStatus;
  lastUpdatedAt?: Date | string | null;
}

export interface MedicaidDriftInput {
  clinicianId: string;
  observed: MedicaidEnrollmentSnapshot;
  baseline?: MedicaidEnrollmentSnapshot;
  payerInsights?: DiscrepancyFinding[];
}

export class MedicaidDriftDetector implements DriftDetector<MedicaidDriftInput> {
  readonly id = DETECTOR_ID;
  readonly category = 'medicaid' as const;

  detect(input: MedicaidDriftInput): DriftDetectionResult {
    const events: DriftEvent[] = [];
    const { observed, baseline, payerInsights = [] } = input;

    if (baseline && baseline.state !== observed.state) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'warning',
          title: 'Medicaid enrollment state drift',
          summary: `Medicaid enrollment moved from ${baseline.state} to ${observed.state}.`,
          subject: {
            type: 'enrollment',
            id: observed.enrollmentId,
            label: observed.program,
          },
          evidence: [buildEvidence('state', baseline.state, observed.state)],
          metadata: {
            clinicianId: input.clinicianId,
            payerInsights,
          },
          recommendations: ['Validate domicile/practice address for state Medicaid program'],
        })
      );
    }

    const status = observed.status ?? 'ACTIVE';
    if (['TERMINATED', 'DISENROLLED', 'DENIED'].includes(status)) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'critical',
          title: 'Medicaid dis-enrollment detected',
          summary: `${observed.program} (${observed.state}) reports status ${status}.`,
          subject: {
            type: 'enrollment',
            id: observed.enrollmentId,
          },
          evidence: [buildEvidence('status', baseline?.status, status)],
          metadata: {
            clinicianId: input.clinicianId,
            payerInsights,
          },
          recommendations: ['Notify payer relations and begin re-enrollment or appeal'],
        })
      );
    } else if (status === 'SUSPENDED') {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'high',
          title: 'Medicaid suspension detected',
          summary: `${observed.program} (${observed.state}) suspended enrollment.`,
          subject: {
            type: 'enrollment',
            id: observed.enrollmentId,
          },
          evidence: [buildEvidence('status', baseline?.status, status)],
          metadata: {
            clinicianId: input.clinicianId,
            payerInsights,
          },
          recommendations: ['Escalate to compliance and resolve outstanding issues'],
        })
      );
    }

    return {
      events,
      stats: computeStats(events),
    };
  }
}

export const medicaidDriftDetector = new MedicaidDriftDetector();
