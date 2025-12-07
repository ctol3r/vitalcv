import { createHash } from 'crypto';

export type ExternalSource = 'nppes' | 'stateLicense' | 'boardCert';

export interface CrossSourceValidationInput {
  clinicianId: string;
  npi: string;
  licenseNumber: string;
  licenseState: string;
  board: {
    name: string;
    certificateId: string;
  };
  allowedThreshold?: number;
}

export interface CrossSourceMismatch {
  field: string;
  provided: string;
  expected: string;
  source: ExternalSource;
  score: number;
  threshold: number;
  details?: string;
}

export interface SourceSnapshot<T = Record<string, unknown>> {
  source: ExternalSource;
  payload: T;
  lastUpdated: string;
}

export interface CrossSourceValidationResult {
  mismatches: CrossSourceMismatch[];
  mismatchRatio: number;
  sources: {
    nppes: SourceSnapshot<ExternalNppesRecord>;
    stateLicense: SourceSnapshot<ExternalLicenseRecord>;
    boardCert: SourceSnapshot<ExternalBoardRecord>;
  };
  comparisons: number;
  evaluatedAt: string;
}

export interface ExternalNppesRecord {
  npi: string;
  legalName: string;
  practiceLocation: string;
  taxonomy: string;
  lastUpdated: string;
}

export interface ExternalLicenseRecord {
  licenseNumber: string;
  state: string;
  status: string;
  expiresOn: string;
  lastUpdated: string;
}

export interface ExternalBoardRecord {
  certificateId: string;
  boardName: string;
  status: string;
  expiresOn: string;
  lastUpdated: string;
}

export async function validateAcrossSources(
  input: CrossSourceValidationInput,
): Promise<CrossSourceValidationResult> {
  const allowedThreshold = clamp01(input.allowedThreshold ?? 0.18);
  const [nppes, stateLicense, boardCert] = await Promise.all([
    fetchNppesRecord(input.npi),
    fetchStateLicenseRecord(input.licenseState, input.licenseNumber),
    fetchBoardRecord(input.board.name, input.board.certificateId),
  ]);

  const comparisons = [
    {
      field: 'npi',
      provided: input.npi,
      expected: nppes.npi,
      source: 'nppes' as const,
      threshold: 0.05,
      details: 'Registry identifier should fully match NPPES.',
    },
    {
      field: 'legalName',
      provided: normalizeName(nppes.legalName),
      expected: normalizeName(resolveDisplayName(input)),
      source: 'nppes' as const,
      threshold: allowedThreshold,
      details: 'Name drift greater than configured threshold.',
    },
    {
      field: 'licenseNumber',
      provided: normalizeLicense(input.licenseNumber),
      expected: normalizeLicense(stateLicense.licenseNumber),
      source: 'stateLicense' as const,
      threshold: 0.12,
      details: 'License number mismatch with state board lookup.',
    },
    {
      field: 'licenseStatus',
      provided: 'active',
      expected: stateLicense.status.toLowerCase(),
      source: 'stateLicense' as const,
      threshold: 0.3,
      details: 'Local record status differs from board status.',
    },
    {
      field: 'boardCertificate',
      provided: normalizeLicense(input.board.certificateId),
      expected: normalizeLicense(boardCert.certificateId),
      source: 'boardCert' as const,
      threshold: 0.1,
      details: 'Board certificate ID mismatch.',
    },
    {
      field: 'boardStatus',
      provided: 'active',
      expected: boardCert.status.toLowerCase(),
      source: 'boardCert' as const,
      threshold: 0.28,
      details: 'Board certification status drift detected.',
    },
  ];

  const mismatches: CrossSourceMismatch[] = comparisons
    .map((comparison) => {
      const score = computeDelta(comparison.provided, comparison.expected);
      return {
        field: comparison.field,
        provided: comparison.provided,
        expected: comparison.expected,
        source: comparison.source,
        score,
        threshold: comparison.threshold,
        details: comparison.details,
      };
    })
    .filter((result) => result.score > result.threshold);

  const mismatchRatio = comparisons.length
    ? clamp01(mismatches.length / comparisons.length)
    : 0;

  return {
    mismatches,
    mismatchRatio,
    sources: {
      nppes: {
        source: 'nppes',
        payload: nppes,
        lastUpdated: nppes.lastUpdated,
      },
      stateLicense: {
        source: 'stateLicense',
        payload: stateLicense,
        lastUpdated: stateLicense.lastUpdated,
      },
      boardCert: {
        source: 'boardCert',
        payload: boardCert,
        lastUpdated: boardCert.lastUpdated,
      },
    },
    comparisons: comparisons.length,
    evaluatedAt: new Date().toISOString(),
  };
}

async function fetchNppesRecord(npi: string): Promise<ExternalNppesRecord> {
  const normalized = npi.padStart(10, '0');
  const hash = buildSeed(`${normalized}:nppes`);
  const practice = buildPracticeLocation(hash);
  return {
    npi: normalized,
    legalName: hash % 2 === 0 ? 'Dr. Nia Ramsey' : 'Dr. Mateo Ellis',
    practiceLocation: practice,
    taxonomy: hash % 3 === 0 ? '207R00000X' : '207P00000X',
    lastUpdated: buildStaleness(hash),
  };
}

async function fetchStateLicenseRecord(
  state: string,
  licenseNumber: string,
): Promise<ExternalLicenseRecord> {
  const hash = buildSeed(`${state}:${licenseNumber}:license`);
  const normalized = normalizeLicense(licenseNumber);
  const expiresOn = new Date(Date.now() + (hash % 400) * 24 * 60 * 60 * 1000).toISOString();
  const status = hash % 7 === 0 ? 'probation' : hash % 5 === 0 ? 'expired' : 'active';
  return {
    licenseNumber: normalized,
    state: state.toUpperCase(),
    status,
    expiresOn,
    lastUpdated: buildStaleness(hash),
  };
}

async function fetchBoardRecord(
  boardName: string,
  certificateId: string,
): Promise<ExternalBoardRecord> {
  const hash = buildSeed(`${boardName}:${certificateId}:board`);
  const normalized = normalizeLicense(certificateId);
  const expiresOn = new Date(Date.now() + (hash % 600) * 24 * 60 * 60 * 1000).toISOString();
  const status = hash % 9 === 0 ? 'lapsed' : 'active';
  return {
    certificateId: normalized,
    boardName,
    status,
    expiresOn,
    lastUpdated: buildStaleness(hash),
  };
}

function computeDelta(provided: string, expected: string): number {
  if (!provided && !expected) {
    return 0;
  }
  if (!provided || !expected) {
    return 1;
  }

  const normalizedProvided = provided.toLowerCase().trim();
  const normalizedExpected = expected.toLowerCase().trim();
  if (normalizedProvided === normalizedExpected) {
    return 0;
  }

  const distance = levenshtein(normalizedProvided, normalizedExpected);
  const longest = Math.max(normalizedProvided.length, normalizedExpected.length);
  if (!longest) {
    return 0;
  }

  return clamp01(distance / longest);
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function normalizeLicense(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/(dr\.?|md|do)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDisplayName(input: CrossSourceValidationInput): string {
  return input.board.name || `Clinician ${input.clinicianId}`;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function buildSeed(value: string): number {
  const digest = createHash('sha256').update(value).digest('hex');
  return parseInt(digest.slice(0, 6), 16);
}

function buildPracticeLocation(seed: number): string {
  const cities = ['Chicago, IL', 'Seattle, WA', 'Austin, TX', 'San Diego, CA'];
  return cities[seed % cities.length];
}

function buildStaleness(seed: number): string {
  const ageDays = seed % 45;
  const date = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  return date.toISOString();
}










