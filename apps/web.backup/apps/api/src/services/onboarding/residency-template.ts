import type { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import {
  recordOnboardingCheckpoint,
  listOnboardingCheckpoints,
  type OnboardingCheckpointRecord,
} from './checkpoints';
import { DEFAULT_CME_CATALOG, type CmeCourse } from '../lifecycle/renewal';

const prisma = new DefaultPrismaClient();
const TEMPLATE_ID = 'residency-onboarding';

export type PgyLevel = 1 | 2 | 3 | 4;

interface ResidencyExpectation {
  id: string;
  step: string;
  label: string;
  description: string;
  dueInDays: number;
  blockerCode?: string;
  cmeCategory?: string;
}

const RESIDENCY_EXPECTATIONS: Record<PgyLevel, ResidencyExpectation[]> = {
  1: [
    {
      id: 'orientation-handbook',
      step: 'residency:orientation',
      label: 'Orientation & compliance',
      description: 'Complete hospital orientation, HIPAA, infection prevention, and residency handbook attestation.',
      dueInDays: 7,
    },
    {
      id: 'pgy1-procedure-log',
      step: 'residency:procedure-log',
      label: 'PGY1 procedure log baseline',
      description: 'Upload initial procedure log for core competencies (central line, arterial line, airway checklist).',
      dueInDays: 30,
      cmeCategory: 'general',
    },
    {
      id: 'mentor-matching',
      step: 'residency:mentor',
      label: 'Mentor assignment',
      description: 'Document PGY1 mentor pairing and monthly check-in schedule.',
      dueInDays: 14,
    },
  ],
  2: [
    {
      id: 'quality-improvement',
      step: 'residency:quality-project',
      label: 'Quality improvement kickoff',
      description: 'Submit PGY2 quality improvement charter with attending sponsor and timeline.',
      dueInDays: 21,
      cmeCategory: 'primary',
    },
    {
      id: 'board-plan',
      step: 'residency:board-plan',
      label: 'Board readiness plan',
      description: 'Upload ABIM/ABFM study milestones, exam registration date, and block schedule conflicts.',
      dueInDays: 45,
    },
    {
      id: 'advanced-procedures',
      step: 'residency:advanced-procedures',
      label: 'Advanced procedure credentialing',
      description: 'Track ultrasound-guided procedures and sedation competencies for PGY2 sign-off.',
      dueInDays: 60,
    },
  ],
  3: [
    {
      id: 'chief-shadow',
      step: 'residency:chief-shadow',
      label: 'Chief resident shadowing',
      description: 'Log leadership/coverage shadowing for at least two chief resident call shifts.',
      dueInDays: 30,
    },
    {
      id: 'telehealth-readiness',
      step: 'residency:telehealth',
      label: 'Telehealth readiness',
      description: 'Complete documentation & workflow attestation to enable cross-state telehealth months.',
      dueInDays: 45,
      cmeCategory: 'compact',
    },
    {
      id: 'transition-plan',
      step: 'residency:transition-plan',
      label: 'Transition to attending plan',
      description: 'Upload PGY3 transition plan (job search, references, privileging milestones).',
      dueInDays: 60,
    },
  ],
  4: [
    {
      id: 'fellowship-dossier',
      step: 'residency:fellowship',
      label: 'Fellowship dossier',
      description: 'Attach fellowship acceptance, board letters, and visa/credentialing plan.',
      dueInDays: 30,
    },
    {
      id: 'structural-heart-track',
      step: 'residency:structural-heart',
      label: 'Structural heart track readiness',
      description: 'Collect proctor attestations and outcomes summaries for advanced structural heart privileges.',
      dueInDays: 45,
      cmeCategory: 'cardiology',
    },
    {
      id: 'teaching-portfolio',
      step: 'residency:teaching',
      label: 'Teaching portfolio',
      description: 'Submit PGY4 teaching evaluations plus educator-track CME completions.',
      dueInDays: 60,
      cmeCategory: 'general',
    },
  ],
};

const CME_TEMPLATE_BY_LEVEL: Record<PgyLevel, string[]> = {
  1: ['cme-general'],
  2: ['opioid-stewardship'],
  3: ['telehealth-compact'],
  4: ['cardio-refresh', 'cme-general'],
};

export interface ResidencyTemplateImportOptions {
  clinicianId: string;
  programName: string;
  pgyLevel: PgyLevel;
  now?: Date;
  prisma?: PrismaClient;
}

export interface ResidencyTemplateImportResult {
  clinicianId: string;
  pgyLevel: PgyLevel;
  createdCheckpoints: number;
  skipped: number;
  checkpointIds: string[];
  cmeCourses: CmeCourse[];
}

export class ResidencyTemplateImporter {
  constructor(private readonly db: PrismaClient = prisma) {}

  async importTemplate(options: ResidencyTemplateImportOptions): Promise<ResidencyTemplateImportResult> {
    const template = RESIDENCY_EXPECTATIONS[options.pgyLevel];
    if (!template) {
      throw new Error(`Unsupported PGY level: ${options.pgyLevel}`);
    }

    const now = options.now ?? new Date();
    const existing = await listOnboardingCheckpoints(options.clinicianId, {
      prisma: options.prisma ?? this.db,
      limit: 200,
    });
    const existingIds = new Set(extractExpectationIds(existing));
    const checkpointIds: string[] = [];

    for (const expectation of template) {
      const expectationId = buildExpectationId(options.pgyLevel, expectation.id);
      if (existingIds.has(expectationId)) {
        continue;
      }
      const checkpoint = await recordOnboardingCheckpoint({
        clinicianId: options.clinicianId,
        step: expectation.step,
        status: 'pending',
        blockerCode: expectation.blockerCode ?? null,
        metadata: buildMetadata(options, expectation, expectationId),
        timestamp: now,
        prisma: options.prisma ?? this.db,
      });
      checkpointIds.push(checkpoint.id);
      existingIds.add(expectationId);
    }

    const cmeCourses = this.selectCmeCourses(options.pgyLevel);
    for (const course of cmeCourses) {
      const expectationId = buildCmeExpectationId(course.id);
      if (existingIds.has(expectationId)) {
        continue;
      }
      const checkpoint = await recordOnboardingCheckpoint({
        clinicianId: options.clinicianId,
        step: 'cme:residency',
        status: 'pending',
        blockerCode: null,
        metadata: {
          template: TEMPLATE_ID,
          expectationId,
          pgyLevel: options.pgyLevel,
          course,
        } satisfies Prisma.JsonObject,
        prisma: options.prisma ?? this.db,
      });
      checkpointIds.push(checkpoint.id);
      existingIds.add(expectationId);
    }

    const totalExpectations = template.length + cmeCourses.length;
    const skipped = totalExpectations - checkpointIds.length;

    return {
      clinicianId: options.clinicianId,
      pgyLevel: options.pgyLevel,
      createdCheckpoints: checkpointIds.length,
      skipped,
      checkpointIds,
      cmeCourses,
    };
  }

  private selectCmeCourses(level: PgyLevel): CmeCourse[] {
    const desiredIds = new Set(CME_TEMPLATE_BY_LEVEL[level] ?? []);
    const catalog = DEFAULT_CME_CATALOG;
    const selected = catalog.filter((course) => desiredIds.has(course.id));
    if (selected.length) {
      return selected;
    }
    const fallbackCategory = RESIDENCY_EXPECTATIONS[level]?.find((item) => item.cmeCategory)?.cmeCategory;
    if (fallbackCategory) {
      return catalog.filter((course) => course.category === fallbackCategory);
    }
    return catalog.slice(0, 1);
  }
}

export async function importResidencyOnboardingTemplate(
  options: ResidencyTemplateImportOptions,
  importer = new ResidencyTemplateImporter(prisma),
): Promise<ResidencyTemplateImportResult> {
  return importer.importTemplate(options);
}

function buildExpectationId(level: PgyLevel, expectationId: string): string {
  return `${TEMPLATE_ID}:pgy${level}:${expectationId}`;
}

function buildCmeExpectationId(courseId: string): string {
  return `${TEMPLATE_ID}:cme:${courseId}`;
}

function extractExpectationIds(records: OnboardingCheckpointRecord[]): string[] {
  const ids: string[] = [];
  for (const record of records) {
    if (!record.metadata || typeof record.metadata !== 'object') continue;
    const expectationId = (record.metadata as Record<string, unknown>)?.['expectationId'];
    if (typeof expectationId === 'string') {
      ids.push(expectationId);
    }
  }
  return ids;
}

function buildMetadata(
  options: ResidencyTemplateImportOptions,
  expectation: ResidencyExpectation,
  expectationId: string,
): Prisma.JsonObject {
  return {
    template: TEMPLATE_ID,
    expectationId,
    pgyLevel: options.pgyLevel,
    programName: options.programName,
    label: expectation.label,
    description: expectation.description,
    dueInDays: expectation.dueInDays,
    cmeCategory: expectation.cmeCategory ?? null,
  };
}

