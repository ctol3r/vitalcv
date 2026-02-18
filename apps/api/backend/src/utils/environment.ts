const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function parseBooleanEnv(raw: string | undefined, fallback = false): boolean {
  if (raw === undefined || raw === null) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return TRUE_VALUES.has(normalized);
}

export function isStrictTransitionMode(): boolean {
  return parseBooleanEnv(process.env.STRICT_TRANSITION_MODE, false);
}
