import { differenceInCalendarDays } from 'date-fns';
import { DriftDetector, DriftDetectionResult, DriftEvent, DriftSeverity, LocationSnapshot } from '../types';
import { buildEvidence, compareLocationSets, computeStats, coerceDate, createDriftEvent } from '../utils';

const DETECTOR_ID = 'LicenseDriftDetector';

export type LicenseStatus =
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'PROBATION'
  | 'EXPIRED'
  | 'PENDING'
  | 'UNKNOWN';

export interface LicenseSnapshot {
  state: string;
  licenseNumber: string;
  status: LicenseStatus;
  expiresAt?: Date | string | null;
  issuedAt?: Date | string | null;
  practiceLocations?: LocationSnapshot[];
  issuingAuthority?: string;
  source?: string;
  lastVerifiedAt?: Date | string | null;
}

export interface LicenseDriftInput {
  clinicianId: string;
  baseline?: LicenseSnapshot;
  observed: LicenseSnapshot;
  expirationDriftToleranceDays?: number;
}

const CRITICAL_STATUSES: ReadonlySet<LicenseStatus> = new Set(['SUSPENDED', 'EXPIRED']);
const HIGH_STATUSES: ReadonlySet<LicenseStatus> = new Set(['RESTRICTED', 'PROBATION', 'PENDING']);

export class LicenseDriftDetector implements DriftDetector<LicenseDriftInput> {
  readonly id = DETECTOR_ID;
  readonly category = 'licensure' as const;

  detect(input: LicenseDriftInput): DriftDetectionResult {
    const { observed, baseline, expirationDriftToleranceDays = 30 } = input;
    const events: DriftEvent[] = [];

    // Status drift
    if (baseline && baseline.status !== observed.status) {
      const severity = CRITICAL_STATUSES.has(observed.status)
        ? ('critical' as DriftSeverity)
        : HIGH_STATUSES.has(observed.status)
        ? ('high' as DriftSeverity)
        : ('medium' as DriftSeverity);

      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity,
          title: 'License status drift detected',
          summary: `State ${observed.state} license ${observed.licenseNumber} changed from ${baseline.status} to ${observed.status}.`,
          dimension: observed.state,
          subject: {
            type: 'license',
            id: `${observed.state}-${observed.licenseNumber}`,
            label: `${observed.state} license`,
          },
          evidence: [
            buildEvidence('status', baseline.status, observed.status, 'State board verification'),
            ...(observed.source ? [buildEvidence('source', baseline.source, observed.source)] : []),
          ],
          metadata: {
            clinicianId: input.clinicianId,
            state: observed.state,
            licenseNumber: observed.licenseNumber,
            lastVerifiedAt: coerceDate(observed.lastVerifiedAt)?.toISOString(),
          },
          recommendations: [
            'Notify credentialing team to confirm disciplinary status',
            'Update privileging profile if restrictions apply',
          ],
        })
      );
    }

    // Expiration drift
    const observedExpiry = coerceDate(observed.expiresAt);
    const baselineExpiry = coerceDate(baseline?.expiresAt);

    if (observedExpiry) {
      const now = new Date();
      if (observedExpiry < now) {
        events.push(
          createDriftEvent({
            detector: DETECTOR_ID,
            category: this.category,
            severity: 'critical',
            title: 'License expired',
            summary: `State ${observed.state} license ${observed.licenseNumber} expired on ${observedExpiry.toDateString()}.`,
            dimension: observed.state,
            subject: {
              type: 'license',
              id: `${observed.state}-${observed.licenseNumber}`,
            },
            evidence: [buildEvidence('expiresAt', baselineExpiry?.toISOString(), observedExpiry.toISOString())],
            metadata: {
              clinicianId: input.clinicianId,
              expiredOn: observedExpiry.toISOString(),
            },
            recommendations: [
              'Initiate urgent renewal with the state board',
              'Pause privilege submissions tied to this license',
            ],
          })
        );
      } else if (baselineExpiry) {
        const deltaDays = differenceInCalendarDays(observedExpiry, baselineExpiry);
        if (Math.abs(deltaDays) >= expirationDriftToleranceDays) {
          const severity: DriftSeverity = deltaDays < 0 ? 'high' : 'medium';
          events.push(
            createDriftEvent({
              detector: DETECTOR_ID,
              category: this.category,
              severity,
              title: 'License expiration drift',
              summary: `Expiration date moved ${Math.abs(deltaDays)} day(s) ${deltaDays < 0 ? 'sooner' : 'later'} than baseline for ${observed.state} license ${observed.licenseNumber}.`,
              dimension: observed.state,
              subject: {
                type: 'license',
                id: `${observed.state}-${observed.licenseNumber}`,
              },
              evidence: [
                buildEvidence('expiresAt', baselineExpiry.toISOString(), observedExpiry.toISOString(), 'State board feed vs system baseline'),
              ],
              metadata: {
                clinicianId: input.clinicianId,
                deltaDays,
              },
              recommendations: [
                'Refresh expiration in source-of-truth system',
                deltaDays < 0 ? 'Trigger renewal workflow early' : 'Confirm board data feed accuracy',
              ],
            })
          );
        }
      }
    }

    // Practice location drift
    const locationDiff = compareLocationSets(baseline?.practiceLocations, observed.practiceLocations);
    if (locationDiff.missing.length || locationDiff.unexpected.length) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'warning',
          title: 'License practice location drift',
          summary: `Practice locations changed for ${observed.state} license ${observed.licenseNumber}.`,
          dimension: observed.state,
          subject: {
            type: 'license',
            id: `${observed.state}-${observed.licenseNumber}`,
          },
          evidence: [
            buildEvidence('missingLocations', locationDiff.missing),
            buildEvidence('unexpectedLocations', locationDiff.unexpected),
          ],
          metadata: {
            clinicianId: input.clinicianId,
          },
          recommendations: [
            'Confirm practice sites with clinician',
            'Update payer/privileging packets with latest address list',
          ],
        })
      );
    }

    return {
      events,
      stats: computeStats(events),
    };
  }
}

export const licenseDriftDetector = new LicenseDriftDetector();
