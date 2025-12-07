import { NCQAEvidenceType, NCQARuleCode } from '../models/NCQAComplianceRecord';

export interface NCQASourceRequirement {
  source: string;
  description: string;
  refreshWindowDays: number;
  requiredEvidenceTypes: NCQAEvidenceType[];
  disqualifyingConditions: string[];
}

export interface NCQARuleDefinition {
  ruleCode: NCQARuleCode;
  title: string;
  summary: string;
  refreshWindowDays: number;
  requiredSources: NCQASourceRequirement[];
  requiredEvidenceTypes: NCQAEvidenceType[];
  disqualifyingConditions: string[];
}

const ORDER: NCQARuleCode[] = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];

const DEFINITIONS: Record<NCQARuleCode, NCQARuleDefinition> = {
  CR1: {
    ruleCode: 'CR1',
    title: 'Credentialing primary source verification',
    summary:
      'Verify licenses, education, sanctions, and board certifications from primary sources within 180 days of committee decision.',
    refreshWindowDays: 180,
    requiredEvidenceTypes: ['PSV_RESULT', 'LICENSE', 'BOARD_CERT', 'DEA', 'SANCTIONS', 'ATTESTATION'],
    disqualifyingConditions: [
      'Missing active license for practice state',
      'Board certification expired for required specialty',
      'PSV bundle older than 180 days',
      'Unresolved sanctions or exclusions',
    ],
    requiredSources: [
      {
        source: 'STATE_LICENSE_BOARD',
        description: 'Primary source license verification per jurisdiction',
        refreshWindowDays: 180,
        requiredEvidenceTypes: ['LICENSE'],
        disqualifyingConditions: ['status != ACTIVE', 'expiryDate < decisionDate'],
      },
      {
        source: 'DEA_NTIS',
        description: 'DEA registration validation for prescribing privileges',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['DEA'],
        disqualifyingConditions: ['registration expired', 'missing schedules'],
      },
      {
        source: 'ABMS_AOA',
        description: 'ABMS/AOA board certification verification',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['BOARD_CERT'],
        disqualifyingConditions: ['board not accepted', 'certification lapsed'],
      },
      {
        source: 'NPDB',
        description: 'NPDB query proof',
        refreshWindowDays: 120,
        requiredEvidenceTypes: ['SANCTIONS'],
        disqualifyingConditions: ['open NPDB adverse action'],
      },
      {
        source: 'ATTESTATION',
        description: 'Education + work history attestation / references',
        refreshWindowDays: 1095,
        requiredEvidenceTypes: ['ATTESTATION'],
        disqualifyingConditions: ['missing five-year work history', 'education not verified'],
      },
    ],
  },
  CR2: {
    ruleCode: 'CR2',
    title: 'Recredentialing 36-month cycle',
    summary: 'Ensure recredentialing occurs ≤36 months with PSV refresh and ongoing monitoring.',
    refreshWindowDays: 1095,
    requiredEvidenceTypes: ['PSV_RESULT', 'LICENSE', 'BOARD_CERT', 'SANCTIONS'],
    disqualifyingConditions: [
      'Recredentialing overdue (>36 months)',
      'Sanctions found during ongoing monitoring',
      'Missing NPDB or sanctions check during cycle',
    ],
    requiredSources: [
      {
        source: 'REVALIDATION_TRACKER',
        description: 'Workflow history of recredentialing cycle',
        refreshWindowDays: 1095,
        requiredEvidenceTypes: ['PSV_RESULT'],
        disqualifyingConditions: ['no cycle completion in 36 months'],
      },
      {
        source: 'SANCTIONS_MONITORING',
        description: 'Monthly OIG/SAM/OFAC monitoring proof',
        refreshWindowDays: 30,
        requiredEvidenceTypes: ['SANCTIONS'],
        disqualifyingConditions: ['sanctions unresolved >30 days'],
      },
      {
        source: 'BOARD_CERT_REFRESH',
        description: 'Board certification re-verification',
        refreshWindowDays: 1095,
        requiredEvidenceTypes: ['BOARD_CERT'],
        disqualifyingConditions: ['board certification not refreshed during cycle'],
      },
    ],
  },
  CR3: {
    ruleCode: 'CR3',
    title: 'Practitioner rights',
    summary:
      'Document practitioner rights notifications, appeals workflows, and corrective action communications per NCQA timelines.',
    refreshWindowDays: 365,
    requiredEvidenceTypes: ['RIGHTS_NOTICE', 'APPEAL'],
    disqualifyingConditions: [
      'Rights notification missing or delayed',
      'Appeal not processed according to policy',
    ],
    requiredSources: [
      {
        source: 'RIGHTS_NOTIFICATION_LOG',
        description: 'Portal/email acknowledgement for practitioner rights',
        refreshWindowDays: 30,
        requiredEvidenceTypes: ['RIGHTS_NOTICE'],
        disqualifyingConditions: ['no acknowledgement', 'notice delivered >15 days after request'],
      },
      {
        source: 'APPEALS_TRACKER',
        description: 'Appeal submission + decision workflow',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['APPEAL'],
        disqualifyingConditions: ['appeal unresolved beyond SLA', 'missing documentation'],
      },
    ],
  },
  CR4: {
    ruleCode: 'CR4',
    title: 'Delegated credentialing oversight',
    summary: 'Maintain delegation agreements, annual audits, and file completeness ≥95%.',
    refreshWindowDays: 365,
    requiredEvidenceTypes: ['FILE_AUDIT', 'DELEGATION_AUDIT'],
    disqualifyingConditions: [
      'Delegation audit >12 months old',
      'Credential file completeness <95%',
    ],
    requiredSources: [
      {
        source: 'DELEGATION_AGREEMENT',
        description: 'Executed delegation agreement covering NCQA elements',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['DELEGATION_AUDIT'],
        disqualifyingConditions: ['missing NCQA clauses', 'no audit remediation plan'],
      },
      {
        source: 'FILE_AUDIT_REPORT',
        description: 'Annual file audit sample results',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['FILE_AUDIT'],
        disqualifyingConditions: ['completeness <95%', 'audit not reviewed by committee'],
      },
    ],
  },
  CR5: {
    ruleCode: 'CR5',
    title: 'Ongoing professional practice evaluation',
    summary: 'Track OPPE metrics, FPPE triggers, and peer review outcomes.',
    refreshWindowDays: 180,
    requiredEvidenceTypes: ['OPPE', 'FPPE', 'QUALITY_METRIC'],
    disqualifyingConditions: [
      'OPPE not produced within last 6 months',
      'FPPE trigger without documented follow-up',
    ],
    requiredSources: [
      {
        source: 'OPPE_DASHBOARD',
        description: 'Quality metrics (HEDIS, patient experience, adverse events)',
        refreshWindowDays: 180,
        requiredEvidenceTypes: ['OPPE', 'QUALITY_METRIC'],
        disqualifyingConditions: ['metrics missing', 'metrics below target without action'],
      },
      {
        source: 'FPPE_WORKFLOW',
        description: 'Focused review initiation and closure artefacts',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['FPPE'],
        disqualifyingConditions: ['open FPPE >6 months', 'trigger thresholds undefined'],
      },
    ],
  },
};

export function getNCQARuleDefinition(ruleCode: NCQARuleCode): NCQARuleDefinition {
  return DEFINITIONS[ruleCode];
}

export function listNCQARuleDefinitions(): NCQARuleDefinition[] {
  return ORDER.map((code) => DEFINITIONS[code]);
}
import { NCQAEvidenceType, NCQARuleCode } from '../models/NCQAComplianceRecord';

export interface NCQASourceRequirement {
  source: string;
  description: string;
  refreshWindowDays: number;
  requiredEvidenceTypes: NCQAEvidenceType[];
  disqualifyingConditions: string[];
}

export interface NCQARuleDefinition {
  ruleCode: NCQARuleCode;
  title: string;
  summary: string;
  refreshWindowDays: number;
  requiredSources: NCQASourceRequirement[];
  requiredEvidenceTypes: NCQAEvidenceType[];
  disqualifyingConditions: string[];
}

const RULE_ORDER: NCQARuleCode[] = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];

const RULE_DEFINITIONS: Record<NCQARuleCode, NCQARuleDefinition> = {
  CR1: {
    ruleCode: 'CR1',
    title: 'Credentialing primary source verification',
    summary:
      'Verify credentials (license, board, education, work history, sanctions) from primary sources within 180 days of committee decision.',
    refreshWindowDays: 180,
    requiredEvidenceTypes: ['PSV_RESULT', 'LICENSE', 'BOARD_CERT', 'DEA', 'SANCTIONS', 'ATTESTATION'],
    disqualifyingConditions: [
      'No active state license in jurisdiction of practice',
      'Board certification expired for required specialties',
      'PSV bundle older than 180 days',
      'Unresolved sanctions or exclusions',
    ],
    requiredSources: [
      {
        source: 'STATE_LICENSE_BOARD',
        description: 'Primary verification for all active licenses tied to clinician scope',
        refreshWindowDays: 180,
        requiredEvidenceTypes: ['LICENSE'],
        disqualifyingConditions: ['status != ACTIVE', 'expiryDate < committeeDate'],
      },
      {
        source: 'DEA_NTIS',
        description: 'DEA registration status for controlled substances',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['DEA'],
        disqualifyingConditions: ['registration expired', 'schedules missing for privilege request'],
      },
      {
        source: 'ABMS_AOA',
        description: 'ABMS/AOA board certification verification',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['BOARD_CERT'],
        disqualifyingConditions: ['board certification lapsed', 'board not accepted for specialty'],
      },
      {
        source: 'NPDB',
        description: 'National Practitioner Data Bank query results',
        refreshWindowDays: 120,
        requiredEvidenceTypes: ['SANCTIONS'],
        disqualifyingConditions: ['NPDB hit without documented remediation'],
      },
      {
        source: 'ATTESTATION',
        description: 'Work history + education attestation / references',
        refreshWindowDays: 1095,
        requiredEvidenceTypes: ['ATTESTATION'],
        disqualifyingConditions: ['missing 5-year work history', 'education source not verified'],
      },
    ],
  },
  CR2: {
    ruleCode: 'CR2',
    title: 'Recredentialing 36-month cycle',
    summary:
      'Ensure every practitioner is recredentialed at least every 36 months with full PSV refresh and sanctions monitoring.',
    refreshWindowDays: 1095,
    requiredEvidenceTypes: ['PSV_RESULT', 'LICENSE', 'BOARD_CERT', 'SANCTIONS'],
    disqualifyingConditions: [
      'Recredentialing date older than 36 months',
      'Expired license or sanctions discovered during cycle',
      'Missing NPDB or sanctions monitoring between cycles',
    ],
    requiredSources: [
      {
        source: 'REVALIDATION_TRACKER',
        description: 'Recredentialing workflow event log',
        refreshWindowDays: 1095,
        requiredEvidenceTypes: ['PSV_RESULT'],
        disqualifyingConditions: ['no completed recredentialing event in past 36 months'],
      },
      {
        source: 'SANCTIONS_MONITORING',
        description: 'Monthly OIG/SAM/OFAC monitoring proof',
        refreshWindowDays: 30,
        requiredEvidenceTypes: ['SANCTIONS'],
        disqualifyingConditions: ['sanctions hit unresolved >30 days'],
      },
      {
        source: 'BOARD_CERT_REFRESH',
        description: 'Board certification re-verification during cycle',
        refreshWindowDays: 1095,
        requiredEvidenceTypes: ['BOARD_CERT'],
        disqualifyingConditions: ['board certification not refreshed during cycle'],
      },
    ],
  },
  CR3: {
    ruleCode: 'CR3',
    title: 'Practitioner rights',
    summary:
      'Document practitioner rights notifications, appeals workflow, and corrective action communications within required timelines.',
    refreshWindowDays: 365,
    requiredEvidenceTypes: ['RIGHTS_NOTICE', 'APPEAL'],
    disqualifyingConditions: [
      'Rights notification not delivered within required timeframe',
      'Appeal not acknowledged or resolved per policy',
    ],
    requiredSources: [
      {
        source: 'RIGHTS_NOTIFICATION_LOG',
        description: 'Portal/email delivery log for practitioner rights acknowledgement',
        refreshWindowDays: 30,
        requiredEvidenceTypes: ['RIGHTS_NOTICE'],
        disqualifyingConditions: ['no acknowledgement record', 'notification delayed > 15 days'],
      },
      {
        source: 'APPEALS_TRACKER',
        description: 'Appeal submission + decision workflow with timestamps',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['APPEAL'],
        disqualifyingConditions: ['appeal not processed per policy', 'missing decision documentation'],
      },
    ],
  },
  CR4: {
    ruleCode: 'CR4',
    title: 'Delegated credentialing oversight',
    summary:
      'Maintain delegation agreements, annual audits, and file completeness metrics for delegated entities.',
    refreshWindowDays: 365,
    requiredEvidenceTypes: ['FILE_AUDIT', 'DELEGATION_AUDIT'],
    disqualifyingConditions: [
      'Most recent delegation audit > 12 months old',
      'Credential file completeness < 95%',
    ],
    requiredSources: [
      {
        source: 'DELEGATION_AGREEMENT',
        description: 'Executed delegation agreement with health plan',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['DELEGATION_AUDIT'],
        disqualifyingConditions: ['agreement missing required NCQA language', 'no annual audit clause'],
      },
      {
        source: 'FILE_AUDIT_REPORT',
        description: 'Annual file audit sample with completeness metric',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['FILE_AUDIT'],
        disqualifyingConditions: ['completeness < 95%', 'no remediation plan for findings'],
      },
    ],
  },
  CR5: {
    ruleCode: 'CR5',
    title: 'Ongoing professional practice evaluation (OPPE)',
    summary:
      'Track peer review, quality metrics, and FPPE triggers to ensure ongoing professional practice oversight.',
    refreshWindowDays: 180,
    requiredEvidenceTypes: ['OPPE', 'FPPE', 'QUALITY_METRIC'],
    disqualifyingConditions: [
      'No OPPE report generated in past 6 months',
      'FPPE trigger detected without documented follow-up',
      'Adverse quality metrics without committee review',
    ],
    requiredSources: [
      {
        source: 'OPPE_DASHBOARD',
        description: 'Quality metrics & peer review summary (HEDIS, patient feedback, adverse events)',
        refreshWindowDays: 180,
        requiredEvidenceTypes: ['OPPE', 'QUALITY_METRIC'],
        disqualifyingConditions: ['no metrics captured', 'metrics below threshold without action'],
      },
      {
        source: 'FPPE_WORKFLOW',
        description: 'Focused review initiation + closure documentation',
        refreshWindowDays: 365,
        requiredEvidenceTypes: ['FPPE'],
        disqualifyingConditions: ['open FPPE > 6 months', 'no FPPE defined for critical triggers'],
      },
    ],
  },
};

export function getNCQARuleDefinition(ruleCode: NCQARuleCode): NCQARuleDefinition {
  return RULE_DEFINITIONS[ruleCode];
}

export function listNCQARuleDefinitions(): NCQARuleDefinition[] {
  return RULE_ORDER.map((code) => RULE_DEFINITIONS[code]);
}

