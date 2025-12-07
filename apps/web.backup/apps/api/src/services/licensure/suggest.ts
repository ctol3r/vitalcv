import type { LicenseAutofillRecord } from '@prisma/client';
import type { NormalizedLicenseSnapshot } from './autofill';
import type { ExternalNppesRecord } from '../fraud/cross-source';

export type VitalLicenseField = 'licenseNumber' | 'issueDate' | 'expirationDate' | 'disciplinaryStatus';

export interface UploadedLicenseDocument {
  documentId: string;
  state: string;
  extracted: Partial<Record<VitalLicenseField, string>>;
  confidence: number; // 0-1
  lastVerifiedAt?: string;
  source?: string;
}

export interface LicenseSuggestionInput {
  clinicianId: string;
  state: string;
  uploadedDocuments?: UploadedLicenseDocument[];
  nppesRecord?: ExternalNppesRecord | null;
  boardSnapshot?: NormalizedLicenseSnapshot | null;
  historicalAutofill?: LicenseAutofillRecord[];
}

export interface SourceSupport {
  source: string;
  confidence: number;
  fields: VitalLicenseField[];
  evidenceId?: string;
  notes?: string;
  observedAt?: string;
}

export interface LicenseSuggestionField {
  value: string | null;
  confidence: number;
  sources: SourceSupport[];
}

export interface LicenseSuggestionResult {
  clinicianId: string;
  state: string;
  licenseNumber: LicenseSuggestionField;
  issueDate: LicenseSuggestionField;
  expirationDate: LicenseSuggestionField;
  disciplinaryStatus: LicenseSuggestionField;
  confidence: number;
  summary: string;
  support: SourceSupport[];
}

const FIELD_WEIGHTS: Record<VitalLicenseField, number> = {
  licenseNumber: 1,
  issueDate: 0.6,
  expirationDate: 0.9,
  disciplinaryStatus: 0.8,
};

export function buildLicenseSuggestion(input: LicenseSuggestionInput): LicenseSuggestionResult {
  const aggregators = createFieldAggregators();
  const support: SourceSupport[] = [];
  const documents = input.uploadedDocuments ?? [];
  const now = Date.now();

  for (const doc of documents) {
    const docSupport: SourceSupport = {
      source: doc.source ?? 'uploadedDocument',
      confidence: clamp01(doc.confidence),
      fields: [],
      evidenceId: doc.documentId,
      notes: 'Values OCR’d from uploaded license',
      observedAt: doc.lastVerifiedAt,
    };

    for (const field of Object.keys(doc.extracted ?? {}) as VitalLicenseField[]) {
      const value = doc.extracted?.[field];
      if (!value) continue;
      docSupport.fields.push(field);
      aggregators[field].addCandidate(value, docSupport.confidence, docSupport);
    }

    if (docSupport.fields.length) {
      support.push(docSupport);
    }
  }

  if (input.boardSnapshot) {
    const snapshotSupport: SourceSupport = {
      source: `stateBoard:${input.boardSnapshot.state}`,
      confidence: clamp01(input.boardSnapshot.confidence),
      fields: ['licenseNumber', 'issueDate', 'expirationDate', 'disciplinaryStatus'],
      evidenceId: input.boardSnapshot.payload?.['evidenceUrl'] as string | undefined,
      notes: `Primary source lookup via ${input.boardSnapshot.fetchedVia}`,
      observedAt: new Date().toISOString(),
    };

    aggregators.licenseNumber.addCandidate(
      input.boardSnapshot.licenseNumber,
      0.95,
      snapshotSupport,
    );
    aggregators.issueDate.addCandidate(input.boardSnapshot.issueDate ?? null, 0.7, snapshotSupport);
    aggregators.expirationDate.addCandidate(
      input.boardSnapshot.expirationDate ?? null,
      0.9,
      snapshotSupport,
    );
    aggregators.disciplinaryStatus.addCandidate(
      input.boardSnapshot.disciplinaryStatus,
      0.85,
      snapshotSupport,
    );
    support.push(snapshotSupport);
  }

  for (const record of input.historicalAutofill ?? []) {
    const json = extractRecordData(record);
    if (!json) continue;
    const ageDays = Math.max(
      0,
      (now - new Date(record.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const decay = Math.max(0.45, 1 - ageDays / 180);
    const recordSupport: SourceSupport = {
      source: `autofill:${record.source}`,
      confidence: clamp01(decay),
      fields: [],
      evidenceId: record.id,
      notes: 'Autofill history record',
      observedAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    };

    for (const field of ['licenseNumber', 'issueDate', 'expirationDate', 'disciplinaryStatus'] as VitalLicenseField[]) {
      const value = json[field];
      if (!value) continue;
      recordSupport.fields.push(field);
      aggregators[field].addCandidate(value, decay, recordSupport);
    }

    if (recordSupport.fields.length) {
      support.push(recordSupport);
    }
  }

  const fields: Record<VitalLicenseField, LicenseSuggestionField> = {
    licenseNumber: aggregators.licenseNumber.resolve(),
    issueDate: aggregators.issueDate.resolve(),
    expirationDate: aggregators.expirationDate.resolve(),
    disciplinaryStatus: aggregators.disciplinaryStatus.resolve(),
  };

  let confidence = average([
    fields.licenseNumber.confidence * FIELD_WEIGHTS.licenseNumber,
    fields.issueDate.confidence * FIELD_WEIGHTS.issueDate,
    fields.expirationDate.confidence * FIELD_WEIGHTS.expirationDate,
    fields.disciplinaryStatus.confidence * FIELD_WEIGHTS.disciplinaryStatus,
  ]);

  if (input.nppesRecord) {
    const matchesState = Boolean(
      input.nppesRecord.practiceLocation?.toUpperCase().includes(input.state.toUpperCase()),
    );
    if (matchesState) {
      confidence = clamp01(confidence + 0.05);
      support.push({
        source: 'NPPES',
        confidence: 0.5,
        fields: ['licenseNumber'],
        notes: 'Practice location state matches license state',
        observedAt: input.nppesRecord.lastUpdated,
      });
    }
  }

  const summary = buildSummary(fields, input.state);

  return {
    clinicianId: input.clinicianId,
    state: input.state,
    licenseNumber: fields.licenseNumber,
    issueDate: fields.issueDate,
    expirationDate: fields.expirationDate,
    disciplinaryStatus: fields.disciplinaryStatus,
    confidence,
    summary,
    support,
  };
}

function buildSummary(fields: Record<VitalLicenseField, LicenseSuggestionField>, state: string): string {
  const license = fields.licenseNumber.value ?? 'Pending';
  const expiry = fields.expirationDate.value
    ? new Date(fields.expirationDate.value).toLocaleDateString()
    : 'Unknown';
  const status =
    fields.disciplinaryStatus.value === 'restricted'
      ? 'disciplinary hold'
      : fields.disciplinaryStatus.value === 'monitor'
        ? 'monitoring note'
        : 'clean board standing';
  return `Autofill ${state} license ${license} (${status}) expiring ${expiry}.`;
}

function extractRecordData(record: LicenseAutofillRecord): Partial<Record<VitalLicenseField, string>> | null {
  if (!record.data || typeof record.data !== 'object') {
    return null;
  }
  const payload = record.data as Record<string, unknown>;
  return {
    licenseNumber: typeof payload.licenseNumber === 'string' ? payload.licenseNumber : undefined,
    issueDate: typeof payload.issueDate === 'string' ? payload.issueDate : undefined,
    expirationDate:
      typeof payload.expirationDate === 'string' ? payload.expirationDate : undefined,
    disciplinaryStatus:
      typeof payload.disciplinaryStatus === 'string' ? payload.disciplinaryStatus : undefined,
  };
}

function createFieldAggregators(): Record<VitalLicenseField, FieldAggregator> {
  return {
    licenseNumber: new FieldAggregator('licenseNumber'),
    issueDate: new FieldAggregator('issueDate'),
    expirationDate: new FieldAggregator('expirationDate'),
    disciplinaryStatus: new FieldAggregator('disciplinaryStatus'),
  };
}

class FieldAggregator {
  private readonly field: VitalLicenseField;
  private readonly candidates = new Map<string, CandidateAccumulator>();

  constructor(field: VitalLicenseField) {
    this.field = field;
  }

  addCandidate(value: string | null, weight: number, support: SourceSupport) {
    const key = value ?? '__MISSING__';
    const existing = this.candidates.get(key) ?? {
      value,
      totalWeight: 0,
      supports: [],
    };
    existing.totalWeight += clamp01(weight);
    existing.supports.push({
      ...support,
      fields: support.fields.includes(this.field)
        ? support.fields
        : [...support.fields, this.field],
    });
    this.candidates.set(key, existing);
  }

  resolve(): LicenseSuggestionField {
    if (!this.candidates.size) {
      return { value: null, confidence: 0, sources: [] };
    }

    let top: CandidateAccumulator | null = null;
    let total = 0;
    for (const candidate of this.candidates.values()) {
      total += candidate.totalWeight;
      if (!top || candidate.totalWeight > top.totalWeight) {
        top = candidate;
      }
    }

    if (!top) {
      return { value: null, confidence: 0, sources: [] };
    }

    return {
      value: top.value,
      confidence: clamp01(top.totalWeight / Math.max(total, 1)),
      sources: top.supports,
    };
  }
}

interface CandidateAccumulator {
  value: string | null;
  totalWeight: number;
  supports: SourceSupport[];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

