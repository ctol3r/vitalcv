import { DriftDetector, DriftDetectionResult, DriftEvent, LocationSnapshot } from '../types';
import { buildEvidence, compareLocationSets, computeStats, createDriftEvent, normalizeName } from '../utils';

const DETECTOR_ID = 'DirectoryDriftDetector';

export interface DirectoryName {
  first: string;
  last: string;
  middle?: string;
  prefix?: string;
  suffix?: string;
}

export interface DirectoryProfileSnapshot {
  npi: string;
  source: string;
  taxonomyCode: string;
  taxonomyDescription?: string;
  name: DirectoryName;
  practiceAddress: LocationSnapshot;
  mailingAddress?: LocationSnapshot;
  lastUpdatedAt?: Date | string | null;
}

export interface DirectoryDriftInput {
  clinicianId: string;
  baseline: DirectoryProfileSnapshot;
  observed: DirectoryProfileSnapshot;
  acceptedTaxonomyCodes?: string[];
}

export class DirectoryDriftDetector implements DriftDetector<DirectoryDriftInput> {
  readonly id = DETECTOR_ID;
  readonly category = 'directory' as const;

  detect(input: DirectoryDriftInput): DriftDetectionResult {
    const events: DriftEvent[] = [];
    const { baseline, observed, acceptedTaxonomyCodes = [] } = input;

    const normalizedBaselineTaxonomy = baseline.taxonomyCode.toUpperCase();
    const normalizedObservedTaxonomy = observed.taxonomyCode.toUpperCase();
    const acceptedSet = new Set(acceptedTaxonomyCodes.map((code) => code.toUpperCase()));

    if (
      normalizedBaselineTaxonomy !== normalizedObservedTaxonomy &&
      (acceptedSet.size === 0 || !acceptedSet.has(normalizedObservedTaxonomy))
    ) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'critical',
          title: 'Directory taxonomy drift',
          summary: `NPI ${observed.npi} taxonomy changed from ${baseline.taxonomyCode} to ${observed.taxonomyCode}.`,
          subject: {
            type: 'directory',
            id: observed.npi,
            label: observed.source,
          },
          evidence: [
            buildEvidence('taxonomyCode', baseline.taxonomyCode, observed.taxonomyCode),
            buildEvidence('taxonomyDescription', baseline.taxonomyDescription, observed.taxonomyDescription),
          ],
          metadata: {
            clinicianId: input.clinicianId,
            acceptedTaxonomyCodes,
          },
          recommendations: [
            'Update payer/privileging records with new taxonomy or reconcile discrepancy with NPPES',
          ],
        })
      );
    }

    const baselineName = normalizeName(baseline.name);
    const observedName = normalizeName(observed.name);
    if (baselineName && observedName && baselineName !== observedName) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'medium',
          title: 'Directory name drift',
          summary: `Directory name changed from "${baselineName}" to "${observedName}".`,
          subject: {
            type: 'directory',
            id: observed.npi,
            label: observed.source,
          },
          evidence: [buildEvidence('name', baselineName, observedName)],
          metadata: {
            clinicianId: input.clinicianId,
          },
          recommendations: ['Confirm legal name vs DBA across identity sources'],
        })
      );
    }

    const locationDiff = compareLocationSets(
      [baseline.practiceAddress, baseline.mailingAddress].filter(Boolean) as LocationSnapshot[],
      [observed.practiceAddress, observed.mailingAddress].filter(Boolean) as LocationSnapshot[]
    );

    if (locationDiff.missing.length || locationDiff.unexpected.length) {
      events.push(
        createDriftEvent({
          detector: DETECTOR_ID,
          category: this.category,
          severity: 'warning',
          title: 'Directory address drift',
          summary: `Directory practice/mailing addresses changed for NPI ${observed.npi}.`,
          subject: {
            type: 'directory',
            id: observed.npi,
          },
          evidence: [
            buildEvidence('missingAddresses', locationDiff.missing),
            buildEvidence('newAddresses', locationDiff.unexpected),
          ],
          metadata: {
            clinicianId: input.clinicianId,
          },
          recommendations: ['Sync address to payers and credentialing packets'],
        })
      );
    }

    return {
      events,
      stats: computeStats(events),
    };
  }
}

export const directoryDriftDetector = new DirectoryDriftDetector();
