export type SpecialtyDistanceMap = Map<string, Map<string, number>>;

export const DEFAULT_SPECIALTY_DISTANCE_MAP: Record<string, Record<string, number>> = {
  'internal medicine': {
    'primary care': 0.9,
    'family medicine': 0.85,
    geriatrics: 0.8,
  },
  'family medicine': {
    'primary care': 0.9,
    pediatrics: 0.7,
  },
  pediatrics: {
    'family medicine': 0.7,
  },
  cardiology: {
    'cardiovascular disease': 0.95,
    'internal medicine': 0.6,
  },
  neurology: {
    'internal medicine': 0.55,
    'primary care': 0.45,
  },
  'emergency medicine': {
    'urgent care': 0.75,
    'primary care': 0.5,
  },
  'critical care': {
    pulmonology: 0.7,
    anesthesiology: 0.65,
  },
};

export function normalizeSpecialty(value: string): string {
  return value.trim().toLowerCase();
}

export function loadSpecialtyDistanceMap(
  seed: Record<string, Record<string, number>> = DEFAULT_SPECIALTY_DISTANCE_MAP,
): SpecialtyDistanceMap {
  const map: SpecialtyDistanceMap = new Map();
  for (const [from, targets] of Object.entries(seed)) {
    const fromKey = normalizeSpecialty(from);
    const inner = map.get(fromKey) ?? new Map<string, number>();
    for (const [to, distance] of Object.entries(targets)) {
      const toKey = normalizeSpecialty(to);
      const safeDistance = Math.max(0, Math.min(1, distance));
      inner.set(toKey, safeDistance);
      const reverse = map.get(toKey) ?? new Map<string, number>();
      reverse.set(fromKey, safeDistance);
      map.set(toKey, reverse);
    }
    map.set(fromKey, inner);
  }
  return map;
}

export function getSpecialtyDistance(
  map: SpecialtyDistanceMap,
  from: string,
  to: string,
): number | undefined {
  const fromKey = normalizeSpecialty(from);
  const toKey = normalizeSpecialty(to);
  const direct = map.get(fromKey)?.get(toKey);
  if (direct !== undefined) return direct;
  return map.get(toKey)?.get(fromKey);
}
