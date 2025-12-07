import { PrismaClient } from '@prisma/client';
import { isoCountry, normSpec } from '../../src/etl/normalize';

const prisma = new PrismaClient();

export interface ProgramRecord {
  programId: string;
  name: string;
  institution: string;
  country?: string;
  accreditor?: string;
  specialty?: string;
  level: string;
  url?: string;
}

export interface QAReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  validPercent: number;
  errors: Array<{ programId: string; error: string }>;
  passed: boolean;
}

export async function validateProgram(program: ProgramRecord): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  if (!program.name || program.name.trim() === '') {
    errors.push('Program name is required');
  }

  if (program.country) {
    const country = isoCountry(program.country);
    if (country.length !== 2) {
      errors.push(`Invalid ISO country code: ${program.country}`);
    }
  }

  if (program.level === 'residency' && !program.accreditor) {
    errors.push('Accreditor required for residency programs');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function runQAChecks(
  programs: ProgramRecord[]
): Promise<QAReport> {
  let validCount = 0;
  const errors: Array<{ programId: string; error: string }> = [];

  for (const program of programs) {
    const { valid, errors: programErrors } = await validateProgram(program);
    if (valid) {
      validCount++;
    } else {
      for (const err of programErrors) {
        errors.push({ programId: program.programId, error: err });
      }
    }
  }

  const totalRecords = programs.length;
  const invalidRecords = totalRecords - validCount;
  const validPercent = totalRecords > 0 ? (validCount / totalRecords) * 100 : 0;
  const passed = validPercent >= 98;

  return {
    totalRecords,
    validRecords: validCount,
    invalidRecords,
    validPercent,
    errors,
    passed,
  };
}

export async function generateDiffReport(
  before: ProgramRecord[],
  after: ProgramRecord[]
): Promise<{
  added: ProgramRecord[];
  changed: ProgramRecord[];
  removed: ProgramRecord[];
}> {
  const beforeMap = new Map(before.map((p) => [p.programId, p]));
  const afterMap = new Map(after.map((p) => [p.programId, p]));

  const added: ProgramRecord[] = [];
  const changed: ProgramRecord[] = [];
  const removed: ProgramRecord[] = [];

  // Find added and changed
  for (const [id, afterProgram] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push(afterProgram);
    } else {
      const beforeProgram = beforeMap.get(id)!;
      if (JSON.stringify(beforeProgram) !== JSON.stringify(afterProgram)) {
        changed.push(afterProgram);
      }
    }
  }

  // Find removed
  for (const [id, beforeProgram] of beforeMap) {
    if (!afterMap.has(id)) {
      removed.push(beforeProgram);
    }
  }

  return { added, changed, removed };
}

