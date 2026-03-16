import type { InvestigatorCadence, InvestigatorSourceId, ScheduleJobDefinition } from './types';

export interface InvestigatorSourceDefinition {
  id: InvestigatorSourceId;
  cadence: InvestigatorCadence;
  label: string;
  description: string;
  trustWeight: number;
  defaultConfidence: number;
}

export const INVESTIGATOR_SOURCE_DEFINITIONS: Record<InvestigatorSourceId, InvestigatorSourceDefinition> = {
  LEIE: {
    id: 'LEIE',
    cadence: 'daily',
    label: 'LEIE',
    description: 'Daily exclusion monitoring from the HHS OIG exclusion dataset.',
    trustWeight: 1,
    defaultConfidence: 0.98,
  },
  NPPES: {
    id: 'NPPES',
    cadence: 'daily',
    label: 'NPPES',
    description: 'Daily provider identity and practice-state monitoring from CMS NPPES.',
    trustWeight: 0.97,
    defaultConfidence: 0.96,
  },
  CLINICAL_TRIALS: {
    id: 'CLINICAL_TRIALS',
    cadence: 'daily',
    label: 'ClinicalTrials.gov',
    description: 'Daily investigator and study participation checks.',
    trustWeight: 0.78,
    defaultConfidence: 0.75,
  },
  OPENALEX: {
    id: 'OPENALEX',
    cadence: 'weekly',
    label: 'OpenAlex',
    description: 'Weekly publication and citation scans for research-active providers.',
    trustWeight: 0.7,
    defaultConfidence: 0.7,
  },
  SEMANTIC_SCHOLAR: {
    id: 'SEMANTIC_SCHOLAR',
    cadence: 'weekly',
    label: 'Semantic Scholar',
    description: 'Weekly corroboration pass over scholarly authorship and citation momentum.',
    trustWeight: 0.64,
    defaultConfidence: 0.65,
  },
  NIH_REPORTER: {
    id: 'NIH_REPORTER',
    cadence: 'weekly',
    label: 'NIH RePORTER',
    description: 'Weekly federal grant and principal-investigator monitoring.',
    trustWeight: 0.84,
    defaultConfidence: 0.82,
  },
  OPEN_PAYMENTS: {
    id: 'OPEN_PAYMENTS',
    cadence: 'annual',
    label: 'Open Payments',
    description: 'Annual payment and ownership-release processing.',
    trustWeight: 0.9,
    defaultConfidence: 0.9,
  },
  NPDB: {
    id: 'NPDB',
    cadence: 'quarterly',
    label: 'NPDB',
    description: 'Quarterly malpractice and adverse-action monitoring.',
    trustWeight: 0.92,
    defaultConfidence: 0.88,
  },
  MONTHLY_DIFF: {
    id: 'MONTHLY_DIFF',
    cadence: 'monthly',
    label: 'Monthly Diff',
    description: 'Monthly compaction and trend-diff synthesis across prior findings.',
    trustWeight: 0.6,
    defaultConfidence: 0.72,
  },
};

export const DEFAULT_SCHEDULE_JOBS: ScheduleJobDefinition[] = [
  {
    id: 'daily-provider-poll',
    cadence: 'daily',
    sources: ['LEIE', 'NPPES', 'CLINICAL_TRIALS'],
    description: 'Daily critical-source monitoring for exclusions, credentials, and trial participation.',
  },
  {
    id: 'weekly-research-scan',
    cadence: 'weekly',
    sources: ['OPENALEX', 'SEMANTIC_SCHOLAR', 'NIH_REPORTER'],
    description: 'Weekly research and grant intelligence scan.',
  },
  {
    id: 'monthly-diff-job',
    cadence: 'monthly',
    sources: ['MONTHLY_DIFF'],
    description: 'Monthly cross-source diff compaction and trend storyline generation.',
  },
  {
    id: 'quarterly-npdb-diff',
    cadence: 'quarterly',
    sources: ['NPDB'],
    description: 'Quarterly NPDB adverse-action diff.',
  },
  {
    id: 'annual-payment-diff',
    cadence: 'annual',
    sources: ['OPEN_PAYMENTS'],
    description: 'Annual Open Payments release ingestion and payment-diff generation.',
  },
];

export function sourceDefinitionFor(sourceId: InvestigatorSourceId): InvestigatorSourceDefinition {
  return INVESTIGATOR_SOURCE_DEFINITIONS[sourceId];
}
