import { createHash } from 'node:crypto';

export interface ConnectorSchemaPolicy {
  requiredFields?: readonly string[];
  allowAdditionalFields?: boolean;
}

export interface SchemaTypeChange {
  field: string;
  expected: string;
  actual: string;
}

export type ConnectorSchemaBaselineState = 'UNSET' | 'LEARNING' | 'LEARNED' | 'SEEDED';

export interface ConnectorSchemaState {
  connector: string;
  baselineFingerprint: string | null;
  currentFingerprint: string | null;
  checkedAt: string | null;
  samplesSeen: number;
  baselineState: ConnectorSchemaBaselineState;
  candidateFingerprint: string | null;
  candidateSamples: number;
  detected: boolean;
  severity: 'NONE' | 'WARN' | 'CRITICAL';
  missingFields: string[];
  additionalFields: string[];
  missingRequiredFields: string[];
  typeChanges: SchemaTypeChange[];
}

interface MutableSchemaState {
  baselinePaths: Map<string, string> | null;
  baselineFingerprint: string | null;
  candidatePaths: Map<string, string> | null;
  candidateFingerprint: string | null;
  candidateSamples: number;
  currentFingerprint: string | null;
  checkedAt: string | null;
  samplesSeen: number;
  baselineState: ConnectorSchemaBaselineState;
  detected: boolean;
  severity: 'NONE' | 'WARN' | 'CRITICAL';
  missingFields: string[];
  additionalFields: string[];
  missingRequiredFields: string[];
  typeChanges: SchemaTypeChange[];
  policy: ConnectorSchemaPolicy;
}

const REQUIRED_STABLE_SAMPLES = 2;

function stableFingerprint(paths: Map<string, string>): string {
  const normalized = [...paths.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, type]) => `${path}:${type}`)
    .join('|');

  return createHash('sha256').update(normalized).digest('hex');
}

function inferValueType(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'array<empty>';
    }

    const elementTypes = [...new Set(value.map((entry) => inferValueType(entry)))].sort();
    return `array<${elementTypes.join('|')}>`;
  }

  return typeof value === 'object' ? 'object' : typeof value;
}

function collectSchemaPaths(value: unknown, path = ''): Map<string, string> {
  const entries = new Map<string, string>();
  const currentPath = path || '$';
  const valueType = inferValueType(value);
  entries.set(currentPath, valueType);

  if (Array.isArray(value)) {
    if (value.length > 0) {
      const first = value[0];
      for (const [childPath, childType] of collectSchemaPaths(first, `${currentPath}[]`).entries()) {
        entries.set(childPath, childType);
      }
    }

    return entries;
  }

  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const childPath = currentPath === '$' ? key : `${currentPath}.${key}`;
      const childEntries = collectSchemaPaths(
        (value as Record<string, unknown>)[key],
        childPath,
      );
      for (const [nestedPath, nestedType] of childEntries.entries()) {
        entries.set(nestedPath, nestedType);
      }
    }
  }

  return entries;
}

function nowIso(value?: string): string {
  return value ?? new Date().toISOString();
}

export class ConnectorSchemaDriftDetector {
  private readonly states = new Map<string, MutableSchemaState>();

  observe(
    connector: string,
    payload: unknown,
    policy: ConnectorSchemaPolicy = {},
    recordedAt?: string,
  ): ConnectorSchemaState {
    const state = this.ensureState(connector);
    const checkedAt = nowIso(recordedAt);
    const resolvedPolicy = {
      allowAdditionalFields: true,
      ...policy,
    };

    state.policy = resolvedPolicy;
    state.samplesSeen += 1;
    state.checkedAt = checkedAt;

    const currentPaths = collectSchemaPaths(payload);
    const currentFingerprint = stableFingerprint(currentPaths);
    state.currentFingerprint = currentFingerprint;

    if (!state.baselinePaths) {
      this.observeLearningCandidate(state, currentPaths, currentFingerprint);
      this.resetDriftState(state);
      return this.getStateSnapshot(connector);
    }

    const missingFields: string[] = [];
    const additionalFields: string[] = [];
    const typeChanges: SchemaTypeChange[] = [];

    for (const [path, expectedType] of state.baselinePaths.entries()) {
      const actualType = currentPaths.get(path);
      if (actualType == null) {
        missingFields.push(path);
      } else if (actualType !== expectedType) {
        typeChanges.push({
          field: path,
          expected: expectedType,
          actual: actualType,
        });
      }
    }

    for (const [path] of currentPaths.entries()) {
      if (!state.baselinePaths.has(path)) {
        additionalFields.push(path);
      }
    }

    const missingRequiredFields = (resolvedPolicy.requiredFields ?? []).filter((field) => !currentPaths.has(field));

    let severity: ConnectorSchemaState['severity'] = 'NONE';
    if (typeChanges.length > 0 || missingRequiredFields.length > 0) {
      severity = 'CRITICAL';
    } else if (missingFields.length > 0 || (!resolvedPolicy.allowAdditionalFields && additionalFields.length > 0)) {
      severity = 'WARN';
    }

    state.detected = severity !== 'NONE';
    state.severity = severity;
    state.missingFields = missingFields;
    state.additionalFields = additionalFields;
    state.missingRequiredFields = missingRequiredFields;
    state.typeChanges = typeChanges;

    return this.getStateSnapshot(connector);
  }

  setBaseline(
    connector: string,
    payload: unknown,
    policy: ConnectorSchemaPolicy = {},
    recordedAt?: string,
  ): ConnectorSchemaState {
    const state = this.ensureState(connector);
    const checkedAt = nowIso(recordedAt);
    state.policy = {
      allowAdditionalFields: true,
      ...policy,
    };
    state.samplesSeen += 1;
    state.checkedAt = checkedAt;
    state.baselinePaths = collectSchemaPaths(payload);
    state.baselineFingerprint = stableFingerprint(state.baselinePaths);
    state.currentFingerprint = state.baselineFingerprint;
    state.baselineState = 'SEEDED';
    state.candidatePaths = null;
    state.candidateFingerprint = null;
    state.candidateSamples = 0;
    this.resetDriftState(state);
    return this.getStateSnapshot(connector);
  }

  getState(connector: string): ConnectorSchemaState {
    return this.getStateSnapshot(connector);
  }

  reset(): void {
    this.states.clear();
  }

  private ensureState(connector: string): MutableSchemaState {
    if (!this.states.has(connector)) {
      this.states.set(connector, {
        baselinePaths: null,
        baselineFingerprint: null,
        candidatePaths: null,
        candidateFingerprint: null,
        candidateSamples: 0,
        currentFingerprint: null,
        checkedAt: null,
        samplesSeen: 0,
        baselineState: 'UNSET',
        detected: false,
        severity: 'NONE',
        missingFields: [],
        additionalFields: [],
        missingRequiredFields: [],
        typeChanges: [],
        policy: {
          allowAdditionalFields: true,
        },
      });
    }

    return this.states.get(connector)!;
  }

  private observeLearningCandidate(
    state: MutableSchemaState,
    currentPaths: Map<string, string>,
    currentFingerprint: string,
  ): void {
    if (state.candidateFingerprint === currentFingerprint) {
      state.candidateSamples += 1;
    } else {
      state.candidatePaths = currentPaths;
      state.candidateFingerprint = currentFingerprint;
      state.candidateSamples = 1;
    }

    if (state.candidateSamples >= REQUIRED_STABLE_SAMPLES && state.candidatePaths) {
      state.baselinePaths = new Map(state.candidatePaths);
      state.baselineFingerprint = currentFingerprint;
      state.baselineState = 'LEARNED';
      state.candidatePaths = null;
      state.candidateFingerprint = null;
      state.candidateSamples = 0;
      return;
    }

    state.baselineState = 'LEARNING';
  }

  private resetDriftState(state: MutableSchemaState): void {
    state.detected = false;
    state.severity = 'NONE';
    state.missingFields = [];
    state.additionalFields = [];
    state.missingRequiredFields = [];
    state.typeChanges = [];
  }

  private getStateSnapshot(connector: string): ConnectorSchemaState {
    const state = this.ensureState(connector);
    return {
      connector,
      baselineFingerprint: state.baselineFingerprint,
      currentFingerprint: state.currentFingerprint,
      checkedAt: state.checkedAt,
      samplesSeen: state.samplesSeen,
      baselineState: state.baselineState,
      candidateFingerprint: state.candidateFingerprint,
      candidateSamples: state.candidateSamples,
      detected: state.detected,
      severity: state.severity,
      missingFields: [...state.missingFields],
      additionalFields: [...state.additionalFields],
      missingRequiredFields: [...state.missingRequiredFields],
      typeChanges: state.typeChanges.map((change) => ({ ...change })),
    };
  }
}

export const connectorSchemaDriftDetector = new ConnectorSchemaDriftDetector();
