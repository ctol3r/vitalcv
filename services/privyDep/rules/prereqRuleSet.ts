import { normalizePrivilegeCode } from '../models/PrivilegeNode';

export type BoardCertificationRule = {
  type: 'BOARD_CERT';
  boards: string[];
  specialties?: string[];
  expirationBufferMonths?: number;
};

export type CertificationPathwayRule = {
  type: 'CERT_PATHWAY';
  pathways: string[];
  allowsProvisional?: boolean;
};

export type CaseLogRule = {
  type: 'CASE_LOG';
  procedure: string;
  minCases: number;
  lookbackMonths: number;
};

export type FPPERule = {
  type: 'FPPE';
  status: 'COMPLETED';
  casesObserved: number;
  preceptorRole: string;
};

export type OPPERule = {
  type: 'OPPE';
  metric: string;
  threshold: number;
  lookbackMonths: number;
};

export type PrerequisiteRule = BoardCertificationRule | CertificationPathwayRule | CaseLogRule | FPPERule | OPPERule;

export interface PrivilegePrerequisiteEntry {
  privilegeCode: string;
  rules: PrerequisiteRule[];
  summary: string;
}

const RAW_RULES: PrivilegePrerequisiteEntry[] = [
  {
    privilegeCode: 'basic sedation',
    summary: 'Baseline sedation competence for invasive monitoring and endoscopy support.',
    rules: [
      {
        type: 'BOARD_CERT',
        boards: ['ABA', 'ABEM'],
        specialties: ['Anesthesiology', 'Emergency Medicine'],
        expirationBufferMonths: 6,
      },
      {
        type: 'CERT_PATHWAY',
        pathways: ['ASA Moderate Sedation', 'ACEP Procedural Sedation'],
      },
      {
        type: 'FPPE',
        status: 'COMPLETED',
        casesObserved: 10,
        preceptorRole: 'Supervising Anesthesiologist',
      },
    ],
  },
  {
    privilegeCode: 'airway management',
    summary: 'Advanced airway management including fiberoptic rescue techniques.',
    rules: [
      {
        type: 'BOARD_CERT',
        boards: ['ABA'],
        specialties: ['Anesthesiology'],
      },
      {
        type: 'CASE_LOG',
        procedure: 'Difficult Airway Rescue',
        minCases: 25,
        lookbackMonths: 24,
      },
      {
        type: 'FPPE',
        status: 'COMPLETED',
        casesObserved: 5,
        preceptorRole: 'Airway Medical Director',
      },
    ],
  },
  {
    privilegeCode: 'arterial line placement',
    summary: 'Arterial line monitoring for OR and ICU settings.',
    rules: [
      {
        type: 'CASE_LOG',
        procedure: 'Arterial Line Placement',
        minCases: 20,
        lookbackMonths: 12,
      },
      {
        type: 'FPPE',
        status: 'COMPLETED',
        casesObserved: 5,
        preceptorRole: 'Cardiac Anesthesiologist',
      },
    ],
  },
  {
    privilegeCode: 'central line',
    summary: 'Non-tunneled and tunneled central line placement privileges.',
    rules: [
      {
        type: 'BOARD_CERT',
        boards: ['ABIM', 'ABA'],
        specialties: ['Critical Care Medicine'],
      },
      {
        type: 'CASE_LOG',
        procedure: 'Central Venous Catheter',
        minCases: 30,
        lookbackMonths: 24,
      },
      {
        type: 'FPPE',
        status: 'COMPLETED',
        casesObserved: 8,
        preceptorRole: 'ICU Medical Director',
      },
      {
        type: 'OPPE',
        metric: 'CLABSI rate per 1,000 line days',
        threshold: 1,
        lookbackMonths: 12,
      },
    ],
  },
  {
    privilegeCode: 'upper endoscopy',
    summary: 'Upper GI endoscopy with therapeutic interventions.',
    rules: [
      {
        type: 'BOARD_CERT',
        boards: ['ABIM'],
        specialties: ['Gastroenterology'],
      },
      {
        type: 'CASE_LOG',
        procedure: 'Upper Endoscopy',
        minCases: 100,
        lookbackMonths: 24,
      },
      {
        type: 'OPPE',
        metric: 'Unplanned transfer rate',
        threshold: 2,
        lookbackMonths: 12,
      },
    ],
  },
];

const RULE_MAP = RAW_RULES.reduce<Record<string, PrivilegePrerequisiteEntry>>((acc, entry) => {
  const normalizedCode = normalizePrivilegeCode(entry.privilegeCode);
  acc[normalizedCode] = {
    ...entry,
    privilegeCode: normalizedCode,
  };
  return acc;
}, {});

export function getPrerequisitesForPrivilege(code: string): PrivilegePrerequisiteEntry | undefined {
  return RULE_MAP[normalizePrivilegeCode(code)];
}

export function listPrereqSummaries(): Record<string, string> {
  return Object.fromEntries(
    Object.values(RULE_MAP).map((entry) => [entry.privilegeCode, entry.summary]),
  );
}

export function hasOperationalMonitoringRequirement(code: string): boolean {
  const entry = getPrerequisitesForPrivilege(code);
  if (!entry) return false;
  return entry.rules.some((rule) => rule.type === 'OPPE');
}

