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

export interface ConnectorSchemaState {
  connector: string;
  baselineFingerprint: string | null;
  currentFingerprint: string | null;
  checkedAt: string | null;
  samplesSeen: number;
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
  currentFingerprint: string | null;
  checkedAt: string | null;
  samplesSeen: number;
  detected: boolean;
  severity: 'NONE' | 'WARN' | 'CRITICAL';
  missingFields: string[];
  additionalFields: string[];
  missingRequiredFields: string[];
  typeChanges: SchemaTypeChange[];
  policy: ConnectorSchemaPolicy;
}

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
      state.baselinePaths = currentPaths;
      state.baselineFingerprint = currentFingerprint;
      state.detected = false;
      state.severity = 'NONE';
      state.missingFields = [];
      state.additionalFields = [];
      state.missingRequiredFields = [];
      state.typeChanges = [];
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
    } else if (missingFields.length > 0 || (!resolvedPolicy.allowAdditionalFields && additionalFields.length > 0) || additionalFields.length > 0) {
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

  setBaseline(connector: string, payload: unknown, policy: ConnectorSchemaPolicy = {}, recordedAt?: string): ConnectorSchemaState {
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
    state.detected = false;
    state.severity = 'NONE';
    state.missingFields = [];
    state.additionalFields = [];
    state.missingRequiredFields = [];
    state.typeChanges = [];
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
        currentFingerprint: null,
        checkedAt: null,
        samplesSeen: 0,
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

  private getStateSnapshot(connector: string): ConnectorSchemaState {
    const state = this.ensureState(connector);
    return {
      connector,
      baselineFingerprint: state.baselineFingerprint,
      currentFingerprint: state.currentFingerprint,
      checkedAt: state.checkedAt,
      samplesSeen: state.samplesSeen,
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
