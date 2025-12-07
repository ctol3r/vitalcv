/**
 * B170B-FPPE-003: Checklist templates for FPPE cases
 *
 * Provides privilege-specific templates that define which evidence items must be
 * collected during an FPPE. Templates are stored as JSON on FPPECase records,
 * enabling per-privilege customization and UI rendering.
 */

import {
  FPPEChecklist,
  FPPEChecklistItemStatusSchema,
  FPPEChecklistSchema,
} from './models/FPPECase';

type ChecklistLibrary = Record<string, FPPEChecklist>;

const CHECKLIST_LIBRARY: ChecklistLibrary = {
  'CARD-CATH-ADULT': buildTemplate('CARD-CATH-ADULT', 'Cardiology', {
    chartsReviewed: { target: 10, description: 'Diagnostic cath charts peer reviewed' },
    supervisedCases: { target: 5, description: 'Cases with proctor sign-off' },
    outcomes: { target: 3, description: 'Documented outcomes within 30 days' },
  }),
  'CARD-PCI': buildTemplate('CARD-PCI', 'Interventional Cardiology', {
    chartsReviewed: { target: 12, description: 'PCI cases audited for appropriateness' },
    supervisedCases: { target: 4, description: 'Percutaneous coronary interventions with mentorship' },
    outcomes: { target: 5, description: 'STEMI/NSTEMI patient outcomes tracked' },
  }),
  'PED-EMERG-SED': buildTemplate('PED-EMERG-SED', 'Pediatric Emergency Medicine', {
    chartsReviewed: { target: 8, description: 'Procedural sedation cases reviewed' },
    supervisedCases: { target: 6, description: 'Sedation events directly supervised' },
    outcomes: { target: 4, description: 'Post-sedation follow-ups' },
  }),
};

const DEFAULT_TEMPLATE = buildTemplate('DEFAULT', 'General Medicine', {
  chartsReviewed: { target: 6, description: 'Representative cases reviewed' },
  supervisedCases: { target: 3, description: 'Proctored encounters confirming competence' },
  outcomes: { target: 2, description: 'Documented patient outcomes' },
});

interface TemplateConfigEntry {
  target: number;
  description: string;
}

interface TemplateConfig {
  chartsReviewed: TemplateConfigEntry;
  supervisedCases: TemplateConfigEntry;
  outcomes: TemplateConfigEntry;
}

function buildTemplate(code: string, specialty: string, config: TemplateConfig): FPPEChecklist {
  return {
    version: 1,
    privilegeCode: code,
    specialty,
    items: [
      {
        key: 'chartsReviewed',
        label: 'Charts reviewed',
        description: config.chartsReviewed.description,
        required: true,
        targetCount: config.chartsReviewed.target,
        completedCount: 0,
        status: FPPEChecklistItemStatusSchema.Enum.PENDING,
        evidence: [],
      },
      {
        key: 'supervisedCases',
        label: 'Supervised cases',
        description: config.supervisedCases.description,
        required: true,
        targetCount: config.supervisedCases.target,
        completedCount: 0,
        status: FPPEChecklistItemStatusSchema.Enum.PENDING,
        evidence: [],
      },
      {
        key: 'outcomes',
        label: 'Outcome tracking',
        description: config.outcomes.description,
        required: true,
        targetCount: config.outcomes.target,
        completedCount: 0,
        status: FPPEChecklistItemStatusSchema.Enum.PENDING,
        evidence: [],
      },
    ],
  };
}

function deepCloneChecklist(template: FPPEChecklist): FPPEChecklist {
  const parsed = FPPEChecklistSchema.parse(template);
  return {
    ...parsed,
    items: parsed.items.map((item) => ({
      ...item,
      completedCount: 0,
      status: FPPEChecklistItemStatusSchema.Enum.PENDING,
      notes: undefined,
      evidence: [],
    })),
  };
}

export function normalizePrivilegeCode(code: string): string {
  if (!code) {
    return 'UNKNOWN';
  }

  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getChecklistTemplate(rawCode: string): FPPEChecklist {
  const code = normalizePrivilegeCode(rawCode);
  const template = CHECKLIST_LIBRARY[code] ?? {
    ...DEFAULT_TEMPLATE,
    privilegeCode: code || DEFAULT_TEMPLATE.privilegeCode,
  };
  return deepCloneChecklist(template);
}
/**
 * B170B-FPPE-003: FPPE evidence checklist presets
 *
 * Each FPPE case tracks a lightweight evidence checklist composed of three
 * quantitative buckets:
 *   - chartsReviewed
 *   - supervisedCases
 *   - outcomes (positive clinical outcomes / case reviews)
 *
 * Organizations can vary the required counts per privilege/specialty. We ship a
 * starter library for the main demo specialties.
 */

import {
  ChecklistMetric,
  ChecklistMetricSchema,
  FPPEEvidenceChecklist,
  FPPEEvidenceChecklistSchema,
} from './models/FPPECase.js';

export type ChecklistRequirement = {
  chartsReviewed: number;
  supervisedCases: number;
  outcomes: number;
};

type ChecklistLibraryEntry = ChecklistRequirement & {
  label: string;
};

const CHECKLIST_LIBRARY: Record<string, ChecklistLibraryEntry> = {
  GENERAL_SURGERY: {
    label: 'General Surgery Core',
    chartsReviewed: 10,
    supervisedCases: 8,
    outcomes: 5,
  },
  INTERVENTIONAL_CARDIOLOGY: {
    label: 'Cardiology Cath Lab',
    chartsReviewed: 8,
    supervisedCases: 10,
    outcomes: 8,
  },
  EMERGENCY_MEDICINE: {
    label: 'Emergency Medicine Procedures',
    chartsReviewed: 6,
    supervisedCases: 12,
    outcomes: 10,
  },
};

const DEFAULT_REQUIREMENTS: ChecklistLibraryEntry = {
  label: 'Default Privilege',
  chartsReviewed: 5,
  supervisedCases: 5,
  outcomes: 3,
};

export function normalizePrivilegeCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function getChecklistTemplate(privilegeCode: string): FPPEEvidenceChecklist {
  const normalized = normalizePrivilegeCode(privilegeCode);
  const config = CHECKLIST_LIBRARY[normalized] ?? DEFAULT_REQUIREMENTS;
  return buildChecklistFromRequirement(config);
}

export function buildChecklistFromRequirement(config: ChecklistRequirement): FPPEEvidenceChecklist {
  const charts = createMetric(config.chartsReviewed);
  const supervised = createMetric(config.supervisedCases);
  const outcomes = createMetric(config.outcomes);
  return {
    chartsReviewed: charts,
    supervisedCases: supervised,
    outcomes: outcomes,
  };
}

function createMetric(required: number): ChecklistMetric {
  return ChecklistMetricSchema.parse({
    required,
    completed: 0,
  });
}

export function mergeChecklistProgress(
  current: FPPEEvidenceChecklist,
  updates: Partial<FPPEEvidenceChecklist>
): FPPEEvidenceChecklist {
  const merged: FPPEEvidenceChecklist = {
    chartsReviewed: mergeMetric(current.chartsReviewed, updates.chartsReviewed),
    supervisedCases: mergeMetric(current.supervisedCases, updates.supervisedCases),
    outcomes: mergeMetric(current.outcomes, updates.outcomes),
  };
  return FPPEEvidenceChecklistSchema.parse(merged);
}

function mergeMetric(existing: ChecklistMetric, incoming?: ChecklistMetric): ChecklistMetric {
  if (!incoming) {
    return existing;
  }
  const completed = clamp(
    incoming.completed ?? existing.completed,
    0,
    Math.max(existing.required, incoming.required ?? existing.required)
  );
  return ChecklistMetricSchema.parse({
    required: incoming.required ?? existing.required,
    completed,
    notes: incoming.notes ?? existing.notes,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isChecklistComplete(checklist: FPPEEvidenceChecklist): boolean {
  return (
    checklist.chartsReviewed.completed >= checklist.chartsReviewed.required &&
    checklist.supervisedCases.completed >= checklist.supervisedCases.required &&
    checklist.outcomes.completed >= checklist.outcomes.required
  );
}

