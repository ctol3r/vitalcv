import { DriftDetector, DriftDetectionResult, DriftEvent, DriftRiskImpact } from '../types';
import { coerceDate, computeStats, createDriftEvent } from '../utils';
import type { TimelineEvent } from '../../timeline/types';

const DETECTOR_ID = 'BoardDriftDetector';

type BoardCertificationStatus = 'ACTIVE' | 'LAPSED' | 'REVOKED' | 'PENDING' | 'EXPIRED';

export interface BoardCertificationSnapshot {
  board: string;
  specialty: string;
  certificationId?: string;
  status: BoardCertificationStatus;
  expiresAt?: Date | string | null;
  issuedAt?: Date | string | null;
  revocationReason?: string;
  source?: string;
}

export interface BoardDriftInput {
  clinicianId: string;
  observed: BoardCertificationSnapshot;
  baseline?: BoardCertificationSnapshot;
}

export class BoardDriftDetector implements DriftDetector<BoardDriftInput> {
  readonly id = DETECTOR_ID;
  readonly category = 'board' as const;

  detect(input: BoardDriftInput): DriftDetectionResult {
    const events: DriftEvent[] = [];
    const timelineEvents: TimelineEvent[] = [];
    const riskImpacts: DriftRiskImpact[] = [];

    const push = (event: DriftEvent, code: string) => {
      events.push(event);
      riskImpacts.push({
        code,
        severity: event.severity,
        description: event.summary,
        tags: ['board', 'drift'],
        metadata: {
          clinicianId: input.clinicianId,
          board: input.observed.board,
          specialty: input.observed.specialty,
        },
      });
      timelineEvents.push({
        id: `timeline-board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phase: 'board',
        type: code,
        title: event.title,
        timestamp: event.detectedAt,
        status: event.severity === 'critical' ? 'failed' : 'warning',
        summary: event.summary,
        metadata: {
          board: input.observed.board,
          specialty: input.observed.specialty,
        },
      });
    };

    const observedExpiry = coerceDate(input.observed.expiresAt);
    if (observedExpiry && observedExpiry < new Date()) {
      push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'critical',
          title: 'Board certification expired',
          summary: `${input.observed.board} (${input.observed.specialty}) lapsed on ${observedExpiry.toDateString()}.`,
          subject: {
            type: 'board_cert',
            id: input.observed.certificationId || `${input.observed.board}-${input.observed.specialty}`,
            label: `${input.observed.board} certification`,
          },
          metadata: {
            clinicianId: input.clinicianId,
            expiredOn: observedExpiry.toISOString(),
          },
          recommendations: [
            'Trigger re-certification workflow',
            'Notify medical staff office and pause FPPE approvals',
          ],
        }),
        'BOARD_CERT_EXPIRED'
      );
    }

    if (input.observed.status === 'REVOKED') {
      push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'critical',
          title: 'Board certification revoked',
          summary: `${input.observed.board} revoked certification for ${input.observed.specialty}.`,
          subject: {
            type: 'board_cert',
            id: input.observed.certificationId || `${input.observed.board}-${input.observed.specialty}`,
          },
          metadata: {
            clinicianId: input.clinicianId,
            revocationReason: input.observed.revocationReason,
          },
          recommendations: [
            'Escalate to credentialing committee',
            'Suspend privileges linked to this specialty',
          ],
        }),
        'BOARD_CERT_REVOKED'
      );
    } else if (input.observed.status === 'LAPSED' || input.observed.status === 'EXPIRED') {
      push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'high',
          title: 'Board certification lapsed',
          summary: `${input.observed.board} reported status ${input.observed.status} for ${input.observed.specialty}.`,
          subject: {
            type: 'board_cert',
            id: input.observed.certificationId || `${input.observed.board}-${input.observed.specialty}`,
          },
          metadata: {
            clinicianId: input.clinicianId,
          },
          recommendations: ['Confirm renewal paperwork and supporting CME documentation'],
        }),
        'BOARD_CERT_STATUS'
      );
    }

    if (input.baseline && input.baseline.specialty !== input.observed.specialty) {
      push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'medium',
          title: 'Board specialty drift',
          summary: `Board specialty changed from ${input.baseline.specialty} to ${input.observed.specialty}.`,
          subject: {
            type: 'board_cert',
            id: input.observed.certificationId || `${input.observed.board}-${input.observed.specialty}`,
          },
          metadata: {
            clinicianId: input.clinicianId,
            previousSpecialty: input.baseline.specialty,
            newSpecialty: input.observed.specialty,
          },
          recommendations: ['Update privileging matrix and payer rosters if specialty changed'],
        }),
        'BOARD_SPECIALTY_DRIFT'
      );
    }

    if (input.baseline && input.baseline.status === 'ACTIVE' && input.observed.status === 'PENDING') {
      push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'warning',
          title: 'Board certification pending verification',
          summary: `${input.observed.board} now lists certification as pending.`,
          subject: {
            type: 'board_cert',
            id: input.observed.certificationId || `${input.observed.board}-${input.observed.specialty}`,
          },
          metadata: {
            clinicianId: input.clinicianId,
          },
          recommendations: ['Confirm documentation submitted to ABMS/FSMB feed'],
        }),
        'BOARD_STATUS_PENDING'
      );
    }

    return {
      events,
      timelineEvents,
      riskImpacts,
      stats: computeStats(events),
    };
  }
}

export const boardDriftDetector = new BoardDriftDetector();
