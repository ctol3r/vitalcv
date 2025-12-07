import { PrismaClient } from '@prisma/client';
import { normalizePrivilegeCode } from '../../../../../services/privyDep/models/PrivilegeNode';

const prisma = new PrismaClient();

export type PrivilegeRuleImportFormat = 'csv' | 'json' | 'rows';

export interface PrivilegeRuleRow {
  code?: string;
  name?: string;
  procedure?: string;
  requirements?: string | string[];
  notes?: string;
}

export interface ImportPrivilegeRulesOptions {
  hospitalId: string;
  specialty: string;
  source: string | Buffer | PrivilegeRuleRow[];
  format?: PrivilegeRuleImportFormat;
  version?: number;
  dryRun?: boolean;
  actorId?: string;
}

export interface PrivilegeRuleImportSummary {
  hospitalId: string;
  specialty: string;
  version: number;
  setId: string | null;
  totalProcedures: number;
  duplicates: string[];
  ignored: string[];
  procedures: string[];
  warnings: string[];
  importedAt: string;
}

export class PrivilegeRulesImporter {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async import(options: ImportPrivilegeRulesOptions): Promise<PrivilegeRuleImportSummary> {
    const format = options.format ?? detectFormat(options.source);
    const parsed = this.parseSource(options.source, format);
    if (parsed.procedures.length === 0) {
      throw new Error('No privilege procedures found in import payload');
    }

    const version = options.version ?? (await this.nextVersion(options.hospitalId, options.specialty));
    let setId: string | null = null;
    if (!options.dryRun) {
      const record = await this.prismaClient.privilegeSet.create({
        data: {
          hospitalId: options.hospitalId,
          specialty: options.specialty,
          procedures: parsed.procedures,
          version,
          updatedAt: new Date(),
        },
      });
      setId = record.id;
    }

    return {
      hospitalId: options.hospitalId,
      specialty: options.specialty,
      version,
      setId,
      totalProcedures: parsed.procedures.length,
      duplicates: parsed.duplicates,
      ignored: parsed.ignored,
      procedures: parsed.procedures,
      warnings: parsed.warnings,
      importedAt: new Date().toISOString(),
    };
  }

  private async nextVersion(hospitalId: string, specialty: string): Promise<number> {
    const latest = await this.prismaClient.privilegeSet.findFirst({
      where: { hospitalId, specialty },
      orderBy: { version: 'desc' },
    });
    return (latest?.version ?? 0) + 1;
  }

  private parseSource(
    source: ImportPrivilegeRulesOptions['source'],
    format: PrivilegeRuleImportFormat,
  ): { procedures: string[]; duplicates: string[]; ignored: string[]; warnings: string[] } {
    if (Array.isArray(source) || format === 'rows') {
      return this.fromRows(Array.isArray(source) ? source : []);
    }
    if (format === 'json') {
      return this.fromRows(parseJson(source));
    }
    return this.fromRows(parseCsv(source));
  }

  private fromRows(rows: PrivilegeRuleRow[]) {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const ignored: string[] = [];
    const warnings: string[] = [];

    const procedures = rows
      .map((row, index) => {
        const token = pickToken(row);
        if (!token) {
          ignored.push(`row:${index}`);
          return null;
        }
        const normalized = normalizeProcedure(token);
        if (!normalized) {
          ignored.push(token);
          return null;
        }
        if (seen.has(normalized)) {
          duplicates.push(normalized);
          return null;
        }
        seen.add(normalized);
        if (!row.requirements) {
          warnings.push(`No requirements listed for ${normalized}`);
        }
        return normalized;
      })
      .filter((value): value is string => Boolean(value));

    return { procedures, duplicates, ignored, warnings };
  }
}

export function detectFormat(source: ImportPrivilegeRulesOptions['source']): PrivilegeRuleImportFormat {
  if (Array.isArray(source)) {
    return 'rows';
  }
  const text = source instanceof Buffer ? source.toString('utf-8') : String(source ?? '');
  const trimmed = text.trim();
  if (!trimmed) return 'csv';
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return 'json';
  }
  return 'csv';
}

function parseJson(source: string | Buffer): PrivilegeRuleRow[] {
  const text = source instanceof Buffer ? source.toString('utf-8') : source;
  try {
    const payload = JSON.parse(text);
    if (Array.isArray(payload)) {
      return payload as PrivilegeRuleRow[];
    }
    if (Array.isArray(payload?.procedures)) {
      return payload.procedures as PrivilegeRuleRow[];
    }
    throw new Error('JSON payload must be an array or include a procedures array');
  } catch (error) {
    throw new Error(`Invalid JSON privilege payload: ${(error as Error).message}`);
  }
}

function parseCsv(source: string | Buffer): PrivilegeRuleRow[] {
  const text = source instanceof Buffer ? source.toString('utf-8') : source;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitLine(lines[0], delimiter).map((header) => header.toLowerCase());
  const rows: PrivilegeRuleRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitLine(lines[i], delimiter);
    const row: PrivilegeRuleRow = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (!value) return;
      switch (header) {
        case 'code':
          row.code = value;
          break;
        case 'procedure':
        case 'name':
          row.procedure = value;
          break;
        case 'requirements':
          row.requirements = value.split(/;\s*|,\s*/).filter(Boolean);
          break;
        case 'notes':
          row.notes = value;
          break;
        default:
          break;
      }
    });
    rows.push(row);
  }

  return rows;
}

function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function pickToken(row: PrivilegeRuleRow): string | null {
  return row.code ?? row.procedure ?? row.name ?? null;
}

function normalizeProcedure(value: string): string {
  return normalizePrivilegeCode(value);
}


