import type { IdentitySource } from './ingestion-v3';

export interface IdentityConflict {
  field: string;
  values: Array<{ sourceId: string; value: unknown; confidence: number }>;
  resolution?: {
    selectedValue: unknown;
    selectedSourceId: string;
    rationale: string;
  };
}

export interface ConflictResolution {
  conflicts: IdentityConflict[];
  resolved: IdentityConflict[];
  unresolved: IdentityConflict[];
}

/**
 * Resolve identity conflicts:
 * - mismatched graduation years
 * - inconsistent specialties
 * - name variations
 */
export function resolveIdentityConflicts(
  sources: IdentitySource[],
): ConflictResolution {
  const conflicts: IdentityConflict[] = [];
  const fieldValues = new Map<string, Array<{ sourceId: string; value: unknown; confidence: number }>>();

  // Collect all field values from all sources
  for (const source of sources) {
    for (const [field, value] of Object.entries(source.data)) {
      if (value === null || value === undefined) continue;

      if (!fieldValues.has(field)) {
        fieldValues.set(field, []);
      }

      fieldValues.get(field)!.push({
        sourceId: source.sourceId,
        value,
        confidence: source.confidence,
      });
    }
  }

  // Detect conflicts (multiple different values for same field)
  for (const [field, values] of fieldValues.entries()) {
    const uniqueValues = new Set(values.map((v) => JSON.stringify(v.value)));
    if (uniqueValues.size > 1) {
      conflicts.push({
        field,
        values,
      });
    }
  }

  // Resolve conflicts
  const resolved: IdentityConflict[] = [];
  const unresolved: IdentityConflict[] = [];

  for (const conflict of conflicts) {
    const resolution = attemptResolveConflict(conflict, sources);
    if (resolution) {
      resolved.push({
        ...conflict,
        resolution,
      });
    } else {
      unresolved.push(conflict);
    }
  }

  return {
    conflicts,
    resolved,
    unresolved,
  };
}

function attemptResolveConflict(
  conflict: IdentityConflict,
  sources: IdentitySource[],
): IdentityConflict['resolution'] | null {
  // Special handling for specific field types
  if (conflict.field === 'graduationYear' || conflict.field.includes('Year')) {
    return resolveYearConflict(conflict, sources);
  }

  if (conflict.field === 'specialty' || conflict.field.includes('Specialty')) {
    return resolveSpecialtyConflict(conflict, sources);
  }

  if (conflict.field === 'name' || conflict.field.includes('Name')) {
    return resolveNameConflict(conflict, sources);
  }

  // Generic resolution: pick highest confidence source
  return resolveGenericConflict(conflict, sources);
}

function resolveYearConflict(
  conflict: IdentityConflict,
  sources: IdentitySource[],
): IdentityConflict['resolution'] | null {
  const years = conflict.values
    .map((v) => {
      const year = typeof v.value === 'number' ? v.value : parseInt(String(v.value), 10);
      return { ...v, numericYear: year };
    })
    .filter((v) => !isNaN(v.numericYear))
    .sort((a, b) => b.confidence - a.confidence);

  if (!years.length) {
    return null;
  }

  // Prefer most recent year from highest confidence source
  const selected = years[0];
  const source = sources.find((s) => s.sourceId === selected.sourceId);

  return {
    selectedValue: selected.value,
    selectedSourceId: selected.sourceId,
    rationale: `Selected ${selected.numericYear} from ${source?.sourceType ?? 'unknown'} source (highest confidence)`,
  };
}

function resolveSpecialtyConflict(
  conflict: IdentityConflict,
  sources: IdentitySource[],
): IdentityConflict['resolution'] | null {
  // Group by specialty code/name
  const specialtyGroups = new Map<string, typeof conflict.values>();

  for (const value of conflict.values) {
    const specialtyKey = String(value.value).toLowerCase().trim();
    if (!specialtyGroups.has(specialtyKey)) {
      specialtyGroups.set(specialtyKey, []);
    }
    specialtyGroups.get(specialtyKey)!.push(value);
  }

  // Find the most common specialty
  let maxCount = 0;
  let selectedGroup: typeof conflict.values | null = null;

  for (const group of specialtyGroups.values()) {
    if (group.length > maxCount) {
      maxCount = group.length;
      selectedGroup = group;
    }
  }

  if (!selectedGroup || selectedGroup.length === 0) {
    return null;
  }

  // Pick highest confidence from most common group
  const selected = selectedGroup.sort((a, b) => b.confidence - a.confidence)[0];
  const source = sources.find((s) => s.sourceId === selected.sourceId);

  return {
    selectedValue: selected.value,
    selectedSourceId: selected.sourceId,
    rationale: `Selected specialty "${selected.value}" (appears in ${maxCount} sources, highest confidence)`,
  };
}

function resolveNameConflict(
  conflict: IdentityConflict,
  sources: IdentitySource[],
): IdentityConflict['resolution'] | null {
  // For names, prefer NPPES or STATE_BOARD sources
  const prioritized = conflict.values
    .map((v) => {
      const source = sources.find((s) => s.sourceId === v.sourceId);
      const priority =
        source?.sourceType === 'NPPES'
          ? 3
          : source?.sourceType === 'STATE_BOARD'
            ? 2
            : source?.sourceType === 'GLOBAL_REGULATOR'
              ? 1
              : 0;

      return {
        ...v,
        priority,
        sourceType: source?.sourceType ?? 'unknown',
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.confidence - a.confidence;
    });

  const selected = prioritized[0];
  const source = sources.find((s) => s.sourceId === selected.sourceId);

  return {
    selectedValue: selected.value,
    selectedSourceId: selected.sourceId,
    rationale: `Selected name from ${selected.sourceType} source (authoritative source priority)`,
  };
}

function resolveGenericConflict(
  conflict: IdentityConflict,
  sources: IdentitySource[],
): IdentityConflict['resolution'] | null {
  // Sort by confidence, then by source type priority
  const prioritized = conflict.values
    .map((v) => {
      const source = sources.find((s) => s.sourceId === v.sourceId);
      const sourcePriority =
        source?.sourceType === 'NPPES'
          ? 4
          : source?.sourceType === 'NPDB'
            ? 3
            : source?.sourceType === 'STATE_BOARD'
              ? 2
              : source?.sourceType === 'GLOBAL_REGULATOR'
                ? 1
                : 0;

      return {
        ...v,
        sourcePriority,
        sourceType: source?.sourceType ?? 'unknown',
      };
    })
    .sort((a, b) => {
      if (a.sourcePriority !== b.sourcePriority) {
        return b.sourcePriority - a.sourcePriority;
      }
      return b.confidence - a.confidence;
    });

  const selected = prioritized[0];
  const source = sources.find((s) => s.sourceId === selected.sourceId);

  return {
    selectedValue: selected.value,
    selectedSourceId: selected.sourceId,
    rationale: `Selected value from ${selected.sourceType} source (highest priority and confidence)`,
  };
}

